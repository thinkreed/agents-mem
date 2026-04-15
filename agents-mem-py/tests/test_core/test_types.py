"""
Tests for core.types module.

Tests all Pydantic models:
- EntityType, ContentType, FactType, SearchMode, TierLevel enums
- Scope model
- MaterialURI model
- Content model
- Fact model
- SearchResult model
- TraceResult model
- Entity model
- TieredContent model
"""

import pytest
from datetime import datetime

from agents_mem.core.types import (
    EntityType,
    ContentType,
    FactType,
    SearchMode,
    TierLevel,
    Scope,
    MaterialURI,
    Content,
    Fact,
    SearchResult,
    TraceResult,
    Entity,
    TieredContent,
)


# ============================================================================
# Enum Tests
# ============================================================================


class TestEntityType:
    """EntityType enum tests."""
    
    def test_entity_type_values(self):
        """Test entity type values."""
        assert EntityType.DOCUMENTS.value == "documents"
        assert EntityType.ASSETS.value == "assets"
        assert EntityType.CONVERSATIONS.value == "conversations"
        assert EntityType.MESSAGES.value == "messages"
        assert EntityType.FACTS.value == "facts"
        assert EntityType.TIERED.value == "tiered"
        assert EntityType.ENTITY_NODES.value == "entity_nodes"
    
    def test_entity_type_from_string(self):
        """Test creating EntityType from string."""
        assert EntityType("documents") == EntityType.DOCUMENTS
        assert EntityType("assets") == EntityType.ASSETS


class TestContentType:
    """ContentType enum tests."""
    
    def test_content_type_values(self):
        """Test content type values."""
        assert ContentType.ARTICLE.value == "article"
        assert ContentType.NOTE.value == "note"
        assert ContentType.URL.value == "url"
        assert ContentType.FILE.value == "file"
        assert ContentType.CONVERSATION.value == "conversation"
    
    def test_content_type_from_string(self):
        """Test creating ContentType from string."""
        assert ContentType("note") == ContentType.NOTE
        assert ContentType("article") == ContentType.ARTICLE


class TestFactType:
    """FactType enum tests."""
    
    def test_fact_type_values(self):
        """Test fact type values."""
        assert FactType.PREFERENCE.value == "preference"
        assert FactType.DECISION.value == "decision"
        assert FactType.OBSERVATION.value == "observation"
        assert FactType.CONCLUSION.value == "conclusion"
    
    def test_fact_type_from_string(self):
        """Test creating FactType from string."""
        assert FactType("preference") == FactType.PREFERENCE
        assert FactType("decision") == FactType.DECISION


class TestSearchMode:
    """SearchMode enum tests."""
    
    def test_search_mode_values(self):
        """Test search mode values."""
        assert SearchMode.FTS.value == "fts"
        assert SearchMode.SEMANTIC.value == "semantic"
        assert SearchMode.HYBRID.value == "hybrid"
        assert SearchMode.PROGRESSIVE.value == "progressive"
    
    def test_search_mode_from_string(self):
        """Test creating SearchMode from string."""
        assert SearchMode("hybrid") == SearchMode.HYBRID


class TestTierLevel:
    """TierLevel enum tests."""
    
    def test_tier_level_values(self):
        """Test tier level values."""
        assert TierLevel.L0.value == "L0"
        assert TierLevel.L1.value == "L1"
        assert TierLevel.L2.value == "L2"
    
    def test_tier_level_order(self):
        """Test tier level ordering."""
        assert TierLevel.L0.value < TierLevel.L1.value < TierLevel.L2.value


# ============================================================================
# Scope Tests
# ============================================================================


class TestScope:
    """Scope model tests."""
    
    def test_scope_basic(self):
        """Test basic scope creation."""
        scope = Scope(user_id="user123")
        assert scope.user_id == "user123"
        assert scope.agent_id is None
        assert scope.team_id is None
        assert scope.is_global is False
    
    def test_scope_with_agent(self):
        """Test scope with agent."""
        scope = Scope(user_id="user123", agent_id="agent1")
        assert scope.user_id == "user123"
        assert scope.agent_id == "agent1"
        assert scope.team_id is None
    
    def test_scope_with_team(self):
        """Test scope with team."""
        scope = Scope(user_id="user123", team_id="team1")
        assert scope.user_id == "user123"
        assert scope.agent_id is None
        assert scope.team_id == "team1"
    
    def test_scope_full(self):
        """Test full scope."""
        scope = Scope(user_id="user123", agent_id="agent1", team_id="team1", is_global=True)
        assert scope.user_id == "user123"
        assert scope.agent_id == "agent1"
        assert scope.team_id == "team1"
        assert scope.is_global is True
    
    def test_scope_frozen(self):
        """Test scope is frozen."""
        scope = Scope(user_id="user123")
        with pytest.raises(Exception):
            scope.user_id = "new_user"
    
    def test_scope_str(self):
        """Test scope string representation."""
        scope = Scope(user_id="user123")
        assert str(scope) == "mem://user123/_/_"
        
        scope_agent = Scope(user_id="user123", agent_id="agent1")
        assert str(scope_agent) == "mem://user123/agent1/_"
        
        scope_full = Scope(user_id="user123", agent_id="agent1", team_id="team1")
        assert str(scope_full) == "mem://user123/agent1/team1"
    
    def test_scope_to_dict(self):
        """Test scope to_dict."""
        scope = Scope(user_id="user123", agent_id="agent1", team_id="team1", is_global=True)
        d = scope.to_dict()
        assert d["userId"] == "user123"
        assert d["agentId"] == "agent1"
        assert d["teamId"] == "team1"
        assert d["isGlobal"] is True


# ============================================================================
# MaterialURI Tests
# ============================================================================


class TestMaterialURI:
    """MaterialURI model tests."""
    
    def test_material_uri_creation(self):
        """Test MaterialURI creation."""
        uri = MaterialURI(
            user_id="user123",
            agent_id="agent1",
            team_id="team1",
            entity_type=EntityType.DOCUMENTS,
            resource_id="doc-001",
        )
        assert uri.user_id == "user123"
        assert uri.entity_type == EntityType.DOCUMENTS
        assert uri.resource_id == "doc-001"
    
    def test_material_uri_to_string(self):
        """Test MaterialURI to_string."""
        uri = MaterialURI(
            user_id="user123",
            agent_id="agent1",
            team_id="team1",
            entity_type=EntityType.DOCUMENTS,
            resource_id="doc-001",
        )
        assert uri.to_string() == "mem://user123/agent1/team1/documents/doc-001"
    
    def test_material_uri_to_string_no_agent(self):
        """Test MaterialURI to_string without agent."""
        uri = MaterialURI(
            user_id="user123",
            entity_type=EntityType.DOCUMENTS,
            resource_id="doc-001",
        )
        assert uri.to_string() == "mem://user123/_/_/documents/doc-001"
    
    def test_material_uri_from_string(self):
        """Test MaterialURI from_string."""
        uri = MaterialURI.from_string("mem://user123/agent1/team1/documents/doc-001")
        assert uri.user_id == "user123"
        assert uri.agent_id == "agent1"
        assert uri.team_id == "team1"
        assert uri.entity_type == EntityType.DOCUMENTS
        assert uri.resource_id == "doc-001"
    
    def test_material_uri_from_string_no_agent(self):
        """Test MaterialURI from_string without agent."""
        uri = MaterialURI.from_string("mem://user123/_/_/documents/doc-001")
        assert uri.user_id == "user123"
        assert uri.agent_id is None
        assert uri.team_id is None
        assert uri.entity_type == EntityType.DOCUMENTS
        assert uri.resource_id == "doc-001"
    
    def test_material_uri_from_string_invalid(self):
        """Test MaterialURI from_string with invalid format."""
        with pytest.raises(ValueError):
            MaterialURI.from_string("invalid://uri")
        
        with pytest.raises(ValueError):
            MaterialURI.from_string("mem://user123/documents/doc-001")


# ============================================================================
# Content Tests
# ============================================================================


class TestContent:
    """Content model tests."""
    
    def test_content_creation(self):
        """Test Content creation."""
        content = Content(
            id="content-001",
            uri="mem://user123/_/_/documents/content-001",
            title="Test Document",
            body="Test body content",
            content_type=ContentType.NOTE,
            user_id="user123",
        )
        assert content.id == "content-001"
        assert content.title == "Test Document"
        assert content.body == "Test body content"
        assert content.content_type == ContentType.NOTE
        assert content.user_id == "user123"
    
    def test_content_with_metadata(self):
        """Test Content with metadata."""
        content = Content(
            id="content-001",
            uri="mem://user123/_/_/documents/content-001",
            title="Test",
            body="Test",
            content_type=ContentType.NOTE,
            user_id="user123",
            metadata={"key": "value", "tags": ["tag1", "tag2"]},
        )
        assert content.metadata["key"] == "value"
        assert content.metadata["tags"] == ["tag1", "tag2"]
    
    def test_content_with_token_count(self):
        """Test Content with token count."""
        content = Content(
            id="content-001",
            uri="mem://user123/_/_/documents/content-001",
            title="Test",
            body="Test",
            content_type=ContentType.NOTE,
            user_id="user123",
            token_count=100,
            tier=TierLevel.L0,
        )
        assert content.token_count == 100
        assert content.tier == TierLevel.L0
    
    def test_content_updated_at_auto(self):
        """Test Content updated_at is auto-set."""
        content = Content(
            id="content-001",
            uri="mem://user123/_/_/documents/content-001",
            title="Test",
            body="Test",
            content_type=ContentType.NOTE,
            user_id="user123",
        )
        assert content.updated_at is not None


# ============================================================================
# Fact Tests
# ============================================================================


class TestFact:
    """Fact model tests."""
    
    def test_fact_creation(self):
        """Test Fact creation."""
        fact = Fact(
            id="fact-001",
            content="User prefers Python",
            fact_type=FactType.PREFERENCE,
            user_id="user123",
            entities=["Python"],
            confidence=0.9,
        )
        assert fact.id == "fact-001"
        assert fact.content == "User prefers Python"
        assert fact.fact_type == FactType.PREFERENCE
        assert fact.entities == ["Python"]
        assert fact.confidence == 0.9
    
    def test_fact_with_source(self):
        """Test Fact with source."""
        fact = Fact(
            id="fact-001",
            content="User prefers Python",
            fact_type=FactType.PREFERENCE,
            user_id="user123",
            source_uri="mem://user123/_/_/documents/doc-001",
            source_type=EntityType.DOCUMENTS,
            source_id="doc-001",
        )
        assert fact.source_uri == "mem://user123/_/_/documents/doc-001"
        assert fact.source_type == EntityType.DOCUMENTS
        assert fact.source_id == "doc-001"
    
    def test_fact_importance_range(self):
        """Test Fact importance must be in range."""
        # Valid range
        fact = Fact(
            id="fact-001",
            content="Test",
            fact_type=FactType.OBSERVATION,
            user_id="user123",
            importance=0.5,
        )
        assert fact.importance == 0.5
        
        # Edge cases
        fact_min = Fact(
            id="fact-002",
            content="Test",
            fact_type=FactType.OBSERVATION,
            user_id="user123",
            importance=0.0,
        )
        assert fact_min.importance == 0.0
        
        fact_max = Fact(
            id="fact-003",
            content="Test",
            fact_type=FactType.OBSERVATION,
            user_id="user123",
            importance=1.0,
        )
        assert fact_max.importance == 1.0
    
    def test_fact_confidence_range(self):
        """Test Fact confidence must be in range."""
        fact = Fact(
            id="fact-001",
            content="Test",
            fact_type=FactType.OBSERVATION,
            user_id="user123",
            confidence=0.8,
        )
        assert fact.confidence == 0.8


# ============================================================================
# SearchResult Tests
# ============================================================================


class TestSearchResult:
    """SearchResult model tests."""
    
    def test_search_result_creation(self):
        """Test SearchResult creation."""
        result = SearchResult(
            uri="mem://user123/_/_/documents/doc-001",
            score=0.85,
            title="Test Document",
            content="Test content snippet",
        )
        assert result.uri == "mem://user123/_/_/documents/doc-001"
        assert result.score == 0.85
        assert result.title == "Test Document"
        assert result.content == "Test content snippet"
    
    def test_search_result_frozen(self):
        """Test SearchResult is frozen."""
        result = SearchResult(uri="test://uri", score=0.5)
        with pytest.raises(Exception):
            result.score = 0.9
    
    def test_search_result_score_range(self):
        """Test SearchResult score must be in range."""
        # Valid
        result = SearchResult(uri="test://uri", score=0.5)
        assert result.score == 0.5
        
        # Edge cases
        result_min = SearchResult(uri="test://uri", score=0.0)
        assert result_min.score == 0.0
        
        result_max = SearchResult(uri="test://uri", score=1.0)
        assert result_max.score == 1.0


# ============================================================================
# TraceResult Tests
# ============================================================================


class TestTraceResult:
    """TraceResult model tests."""
    
    def test_trace_result_creation(self):
        """Test TraceResult creation."""
        result = TraceResult(
            l0_abstract="Quick summary",
            l1_overview="Detailed overview",
            trace_chain=["uri1", "uri2", "uri3"],
            depth=3,
        )
        assert result.l0_abstract == "Quick summary"
        assert result.l1_overview == "Detailed overview"
        assert result.trace_chain == ["uri1", "uri2", "uri3"]
        assert result.depth == 3
    
    def test_trace_result_with_fact(self):
        """Test TraceResult with fact."""
        fact = Fact(
            id="fact-001",
            content="Test fact",
            fact_type=FactType.OBSERVATION,
            user_id="user123",
        )
        result = TraceResult(fact=fact)
        assert result.fact == fact
    
    def test_trace_result_frozen(self):
        """Test TraceResult is frozen."""
        result = TraceResult(depth=1)
        with pytest.raises(Exception):
            result.depth = 2


# ============================================================================
# Entity Tests
# ============================================================================


class TestEntity:
    """Entity model tests."""
    
    def test_entity_creation(self):
        """Test Entity creation."""
        entity = Entity(
            id="entity-001",
            name="Python",
            entity_type="concept",
            user_id="user123",
        )
        assert entity.id == "entity-001"
        assert entity.name == "Python"
        assert entity.entity_type == "concept"
    
    def test_entity_with_relations(self):
        """Test Entity with relations."""
        entity = Entity(
            id="entity-001",
            name="Python",
            entity_type="concept",
            user_id="user123",
            relations=[
                {"target": "entity-002", "type": "related"},
            ],
        )
        assert len(entity.relations) == 1
        assert entity.relations[0]["target"] == "entity-002"


# ============================================================================
# TieredContent Tests
# ============================================================================


class TestTieredContent:
    """TieredContent model tests."""
    
    def test_tiered_content_creation(self):
        """Test TieredContent creation."""
        content = TieredContent(
            id="tiered-001",
            source_type=EntityType.DOCUMENTS,
            source_id="doc-001",
            user_id="user123",
            abstract="L0 abstract summary",
            overview="L1 detailed overview",
        )
        assert content.id == "tiered-001"
        assert content.source_type == EntityType.DOCUMENTS
        assert content.source_id == "doc-001"
        assert content.abstract == "L0 abstract summary"
        assert content.overview == "L1 detailed overview"
    
    def test_tiered_content_with_lance_ids(self):
        """Test TieredContent with LanceDB IDs."""
        content = TieredContent(
            id="tiered-001",
            source_type=EntityType.DOCUMENTS,
            source_id="doc-001",
            user_id="user123",
            abstract="L0",
            lance_id_l0="lance-001",
            lance_id_l1="lance-002",
        )
        assert content.lance_id_l0 == "lance-001"
        assert content.lance_id_l1 == "lance-002"