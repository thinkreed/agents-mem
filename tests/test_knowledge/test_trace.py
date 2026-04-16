"""
Tests for knowledge.trace module.

Tests TraceBuilder, TraceChain, TraceResult.
"""

import pytest
from datetime import datetime
from enum import Enum

from agents_mem.core.types import TraceResult, EntityType
from agents_mem.knowledge.trace import (
    TraceBuilder,
    TraceChain,
)


class TraceLevel(str, Enum):
    """Trace level for testing"""
    FACT = "fact"
    CONTENT = "content"
    SOURCE = "source"


class MockDBConnection:
    """Mock database"""
    
    def __init__(self):
        self._facts = {
            "fact-001": {
                "id": "fact-001",
                "user_id": "user123",
                "source_type": "documents",
                "source_id": "doc-001",
                "source_uri": "mem://user123/_/_/documents/doc-001",
                "content": "Test fact",
                "fact_type": "preference",
            }
        }
        self._documents = {
            "doc-001": {
                "id": "doc-001",
                "user_id": "user123",
                "title": "Test Document",
                "content": "Test content",
            }
        }
    
    async def query_one(self, sql: str, params: list | None = None):
        """Mock query"""
        if "facts" in sql and "WHERE id" in sql:
            fact_id = params[0] if params else ""
            return self._facts.get(fact_id)
        if "documents" in sql and "WHERE id" in sql:
            doc_id = params[0] if params else ""
            return self._documents.get(doc_id)
        return None
    
    async def query(self, sql: str, params: list | None = None):
        """Mock query list"""
        return []


class MockOpenVikingClient:
    """Mock OpenViking"""
    
    async def search(self, **kwargs):
        return []


@pytest.fixture
def mock_db():
    return MockDBConnection()


@pytest.fixture
def mock_openviking():
    return MockOpenVikingClient()


@pytest.fixture
def trace_builder(mock_db, mock_openviking):
    return TraceBuilder(mock_db, mock_openviking)


class TestTraceLevel:
    """TraceLevel tests"""
    
    def test_trace_level_values(self):
        """Test trace level enum values"""
        assert TraceLevel.FACT.value == "fact"
        assert TraceLevel.CONTENT.value == "content"
        assert TraceLevel.SOURCE.value == "source"


class TestTraceChain:
    """TraceChain tests"""
    
    def test_trace_chain_creation(self):
        """Test creating trace chain"""
        chain = TraceChain(
            fact_id="fact-001",
            fact_content="User prefers dark mode",
            source_uri="mem://user123/_/_/documents/doc-001",
            source_type=EntityType.DOCUMENTS,
            source_id="doc-001",
        )
        assert chain.fact_id == "fact-001"
        assert chain.source_uri == "mem://user123/_/_/documents/doc-001"
    
    def test_trace_chain_defaults(self):
        """Test default values"""
        chain = TraceChain(fact_id="fact-001")
        assert chain.fact_content is None
        assert chain.source_uri is None
        assert chain.is_complete is False
    
    def test_trace_chain_to_result(self):
        """Test converting to TraceResult"""
        chain = TraceChain(
            fact_id="fact-001",
            fact_content="Test fact",
            source_uri="mem://user123/_/_/documents/doc-001",
            source_type=EntityType.DOCUMENTS,
            source_id="doc-001",
            is_complete=True,
        )
        
        result = chain.to_trace_result()
        assert isinstance(result, TraceResult)
        assert result.fact_id == "fact-001"
    
    def test_trace_chain_completeness(self):
        """Test completeness check"""
        complete_chain = TraceChain(
            fact_id="fact-001",
            fact_content="Test",
            source_uri="mem://test",
            is_complete=True,
        )
        assert complete_chain.is_complete is True
        
        incomplete_chain = TraceChain(fact_id="fact-001")
        assert incomplete_chain.is_complete is False


class TestTraceBuilder:
    """TraceBuilder tests"""
    
    def test_initialization(self, mock_db, mock_openviking):
        """Test initialization"""
        builder = TraceBuilder(mock_db, mock_openviking)
        assert builder._db == mock_db
        assert builder._openviking == mock_openviking
    
    def test_initialization_without_openviking(self, mock_db):
        """Test without OpenViking"""
        builder = TraceBuilder(mock_db, None)
        assert builder._openviking is None
    
    @pytest.mark.asyncio
    async def test_build_trace(self, trace_builder):
        """Test building trace"""
        chain = await trace_builder.build_trace("fact-001")
        
        assert isinstance(chain, TraceChain)
        assert chain.fact_id == "fact-001"
    
    @pytest.mark.asyncio
    async def test_build_trace_nonexistent(self, trace_builder):
        """Test nonexistent fact"""
        chain = await trace_builder.build_trace("nonexistent")
        
        assert chain.fact_id == "nonexistent"
        assert chain.is_complete is False
    
    @pytest.mark.asyncio
    async def test_get_fact_content(self, trace_builder):
        """Test getting fact content"""
        content = await trace_builder._get_fact_content("fact-001")
        assert content == "Test fact"
    
    @pytest.mark.asyncio
    async def test_get_source_info(self, trace_builder):
        """Test getting source info"""
        info = await trace_builder._get_source_info("fact-001")
        assert info is not None
        assert info.get("source_type") == "documents"
    
    @pytest.mark.asyncio
    async def test_get_source_content(self, trace_builder):
        """Test getting source content"""
        content = await trace_builder._get_source_content("doc-001", EntityType.DOCUMENTS)
        assert content is not None


class TestTraceResultConversion:
    """TraceResult conversion tests"""
    
    def test_trace_result_from_chain(self):
        """Test TraceResult from chain"""
        chain = TraceChain(
            fact_id="fact-001",
            fact_content="Test fact",
            source_uri="mem://test",
            source_type=EntityType.DOCUMENTS,
            source_id="doc-001",
            content_preview="Preview text",
            is_complete=True,
        )
        
        result = chain.to_trace_result()
        
        assert result.fact_id == "fact-001"
        assert result.fact_content == "Test fact"
        assert result.source_uri == "mem://test"
        assert result.is_complete is True