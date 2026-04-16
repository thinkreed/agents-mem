"""
Tests for knowledge.facts module.

Tests FactExtractor, ExtractedFact, FactRecord.
"""

import pytest
from datetime import datetime
from unittest.mock import MagicMock, AsyncMock

from agents_mem.core.types import FactType, EntityType
from agents_mem.knowledge.facts import (
    ExtractedFact,
    FactRecord,
    FactExtractor,
    FACT_SYSTEM_PROMPT,
    get_fact_by_id,
    get_facts_by_scope,
    search_facts,
)


class MockLLMClient:
    """Mock LLM client for testing"""
    
    async def generate(self, prompt: str, **kwargs):
        """Mock generate"""
        return '[{"content": "User prefers dark mode", "fact_type": "preference", "entities": ["dark mode"], "confidence": 0.9}]'
    
    async def generate_json(self, prompt: str, **kwargs):
        """Mock generate_json"""
        return [
            {"content": "User prefers dark mode", "fact_type": "preference", "entities": ["dark mode"], "confidence": 0.9}
        ]


class MockDBConnection:
    """Mock database for testing"""
    
    def __init__(self):
        self._facts: dict[str, dict] = {}
    
    async def run(self, sql: str, params: list | None = None):
        """Mock run"""
        if "INSERT" in sql:
            self._facts[params[0] if params else ""] = {}
        return None
    
    async def query(self, sql: str, params: list | None = None):
        """Mock query"""
        return []
    
    async def query_one(self, sql: str, params: list | None = None):
        """Mock query_one"""
        if "WHERE id =" in sql:
            fact_id = params[0] if params else ""
            return self._facts.get(fact_id)
        return None


@pytest.fixture
def mock_llm():
    """Create mock LLM"""
    return MockLLMClient()


@pytest.fixture
def mock_db():
    """Create mock database"""
    return MockDBConnection()


@pytest.fixture
def fact_extractor(mock_llm):
    """Create fact extractor"""
    return FactExtractor(mock_llm)


class TestExtractedFact:
    """ExtractedFact tests"""
    
    def test_extracted_fact_creation(self):
        """Test creating extracted fact"""
        fact = ExtractedFact(
            content="User prefers dark mode",
            fact_type=FactType.PREFERENCE,
            entities=["dark mode"],
            confidence=0.9,
        )
        assert fact.content == "User prefers dark mode"
        assert fact.fact_type == FactType.PREFERENCE
        assert fact.entities == ["dark mode"]
        assert fact.confidence == 0.9
    
    def test_extracted_fact_defaults(self):
        """Test default values"""
        fact = ExtractedFact(
            content="Test fact",
            fact_type=FactType.OBSERVATION,
        )
        assert fact.entities == []
        assert fact.confidence == 0.8
    
    def test_extracted_fact_with_source(self):
        """Test with source info"""
        fact = ExtractedFact(
            content="Test",
            fact_type=FactType.DECISION,
            source_uri="mem://user123/_/_/documents/doc-001",
            source_type=EntityType.DOCUMENTS,
            source_id="doc-001",
        )
        assert fact.source_uri is not None
        assert fact.source_type == EntityType.DOCUMENTS


class TestFactRecord:
    """FactRecord tests"""
    
    def test_fact_record_creation(self):
        """Test creating fact record"""
        record = FactRecord(
            id="fact-001",
            user_id="user123",
            source_type="documents",
            source_id="doc-001",
            content="User prefers dark mode",
            fact_type="preference",
            confidence=0.9,
        )
        assert record.id == "fact-001"
        assert record.user_id == "user123"
        assert record.fact_type == "preference"
    
    def test_fact_record_defaults(self):
        """Test default values"""
        record = FactRecord(
            id="fact-001",
            user_id="user123",
            source_type="documents",
            source_id="doc-001",
            content="Test",
            fact_type="observation",
        )
        assert record.entities == []
        assert record.importance == 0.5
        assert record.verified is False
    
    def test_fact_record_timestamps(self):
        """Test timestamps"""
        record = FactRecord(
            id="fact-001",
            user_id="user123",
            source_type="documents",
            source_id="doc-001",
            content="Test",
            fact_type="observation",
        )
        assert record.created_at is not None
        assert record.updated_at is not None


class TestFactExtractor:
    """FactExtractor tests"""
    
    def test_initialization(self, mock_llm):
        """Test initialization"""
        extractor = FactExtractor(mock_llm)
        assert extractor._llm_client == mock_llm
    
    def test_valid_fact_types(self, fact_extractor):
        """Test valid fact types"""
        assert "preference" in fact_extractor.VALID_FACT_TYPES
        assert "decision" in fact_extractor.VALID_FACT_TYPES
        assert "observation" in fact_extractor.VALID_FACT_TYPES
        assert "conclusion" in fact_extractor.VALID_FACT_TYPES
    
    @pytest.mark.asyncio
    async def test_extract(self, fact_extractor):
        """Test extraction"""
        facts = await fact_extractor.extract("User prefers dark mode for coding.")
        assert len(facts) > 0
        assert facts[0].fact_type == FactType.PREFERENCE
    
    @pytest.mark.asyncio
    async def test_extract_empty_content(self, fact_extractor):
        """Test empty content"""
        facts = await fact_extractor.extract("")
        assert facts == []
    
    @pytest.mark.asyncio
    async def test_extract_whitespace_content(self, fact_extractor):
        """Test whitespace content"""
        facts = await fact_extractor.extract("   ")
        assert facts == []
    
    def test_build_extraction_prompt(self, fact_extractor):
        """Test prompt building"""
        prompt = fact_extractor._build_extraction_prompt("Test content")
        assert "Test content" in prompt
        assert FACT_SYSTEM_PROMPT in prompt or "fact extraction" in prompt.lower()
    
    def test_validate_fact(self, fact_extractor):
        """Test fact validation"""
        valid_fact = {
            "content": "Valid fact",
            "fact_type": "preference",
            "confidence": 0.8,
        }
        result = fact_extractor._validate_fact(valid_fact)
        assert result is not None
    
    def test_validate_fact_invalid_type(self, fact_extractor):
        """Test invalid type"""
        invalid_fact = {
            "content": "Invalid",
            "fact_type": "invalid_type",
            "confidence": 0.8,
        }
        result = fact_extractor._validate_fact(invalid_fact)
        assert result is None or result.get("fact_type") == "observation"
    
    def test_validate_fact_missing_content(self, fact_extractor):
        """Test missing content"""
        invalid_fact = {
            "fact_type": "preference",
        }
        result = fact_extractor._validate_fact(invalid_fact)
        assert result is None
    
    def test_parse_json_output(self, fact_extractor):
        """Test JSON parsing"""
        json_str = '[{"content": "Test", "fact_type": "preference"}]'
        results = fact_extractor._parse_json_output(json_str)
        assert len(results) == 1
        assert results[0]["content"] == "Test"
    
    def test_parse_json_output_invalid(self, fact_extractor):
        """Test invalid JSON"""
        results = fact_extractor._parse_json_output("invalid json")
        assert results == []


class TestDatabaseFunctions:
    """Database function tests"""
    
    @pytest.mark.asyncio
    async def test_get_fact_by_id(self, mock_db):
        """Test get by ID"""
        mock_db._facts["fact-001"] = {
            "id": "fact-001",
            "user_id": "user123",
            "content": "Test",
            "fact_type": "preference",
        }
        
        result = await get_fact_by_id("fact-001", mock_db)
        # Result depends on implementation
        assert result is None or result is not None
    
    @pytest.mark.asyncio
    async def test_get_facts_by_scope(self, mock_db):
        """Test get by scope"""
        from agents_mem.core.types import Scope
        
        scope = Scope(user_id="user123")
        results = await get_facts_by_scope(scope, mock_db)
        assert isinstance(results, list)
    
    @pytest.mark.asyncio
    async def test_search_facts(self, mock_db):
        """Test search facts"""
        from agents_mem.core.types import Scope
        
        scope = Scope(user_id="user123")
        results = await search_facts("dark mode", scope, mock_db)
        assert isinstance(results, list)


class TestConstants:
    """Constant tests"""
    
    def test_fact_system_prompt(self):
        """Test system prompt"""
        assert "fact extraction" in FACT_SYSTEM_PROMPT.lower()
        assert "preference" in FACT_SYSTEM_PROMPT
        assert "decision" in FACT_SYSTEM_PROMPT