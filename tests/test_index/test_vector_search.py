"""
Tests for index.capabilities.vector_search module.

Tests VectorSearchCapability, VectorSearchOptions, VectorIndexEntry.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from agents_mem.core.types import EntityType, SearchResult
from agents_mem.index.capabilities.vector_search import (
    VectorSearchCapability,
    VectorSearchOptions,
    VectorIndexEntry,
    create_vector_search_capability,
)
from agents_mem.openviking.client import OpenVikingClient, OpenVikingConfig
from agents_mem.openviking.uri_adapter import URIAdapter
from agents_mem.core.exceptions import SearchError


class MockOpenVikingClient:
    """Mock OpenViking client for testing"""
    
    def __init__(self):
        self._search_results = []
        self._index_result = MagicMock(root_uri="viking://test/root", task_id="task-001")
    
    async def search(self, query: str, target_uri: str, limit: int, mode: str):
        """Mock search"""
        return self._search_results
    
    async def index(self, uri: str, embedding: list[float], metadata: dict | None, content: str | None):
        """Mock index"""
        return self._index_result
    
    async def delete(self, uri: str):
        """Mock delete"""
        return True
    
    async def health_check(self):
        """Mock health check"""
        return (True, "OK")
    
    def set_search_results(self, results: list):
        """Set mock search results"""
        self._search_results = results


@pytest.fixture
def mock_client():
    """Create mock OpenViking client"""
    return MockOpenVikingClient()


@pytest.fixture
def uri_adapter():
    """Create URI adapter"""
    return URIAdapter(account="test")


@pytest.fixture
def vector_search(mock_client, uri_adapter):
    """Create VectorSearchCapability"""
    return VectorSearchCapability(mock_client, uri_adapter, "test")


class TestVectorSearchOptions:
    """VectorSearchOptions tests"""
    
    def test_options_defaults(self):
        """Test default options"""
        options = VectorSearchOptions()
        assert options.limit == 10
        assert options.mode == "hybrid"
        assert options.tier is None
        assert options.min_score == 0.0
    
    def test_options_custom(self):
        """Test custom options"""
        options = VectorSearchOptions(
            limit=50,
            mode="vector",
            tier="L0",
            min_score=0.7,
        )
        assert options.limit == 50
        assert options.mode == "vector"
        assert options.tier == "L0"
        assert options.min_score == 0.7


class TestVectorIndexEntry:
    """VectorIndexEntry tests"""
    
    def test_entry_creation(self):
        """Test creating index entry"""
        entry = VectorIndexEntry(
            uri="mem://user123/_/_/documents/doc-001",
            embedding=[0.1, 0.2, 0.3],
            metadata={"title": "Test"},
            content="Test content",
        )
        assert entry.uri == "mem://user123/_/_/documents/doc-001"
        assert len(entry.embedding) == 3
        assert entry.metadata["title"] == "Test"
    
    def test_entry_defaults(self):
        """Test entry defaults"""
        entry = VectorIndexEntry(uri="mem://user123/_/_/documents/doc-001")
        assert entry.embedding == []
        assert entry.metadata == {}
        assert entry.content is None


class TestVectorSearchCapability:
    """VectorSearchCapability tests"""
    
    def test_initialization(self, mock_client, uri_adapter):
        """Test initialization"""
        capability = VectorSearchCapability(mock_client, uri_adapter, "test")
        assert capability._client == mock_client
        assert capability._adapter == uri_adapter
    
    def test_initialization_without_adapter(self, mock_client):
        """Test initialization creates adapter"""
        capability = VectorSearchCapability(mock_client, None, "test")
        assert capability._adapter is not None
    
    @pytest.mark.asyncio
    async def test_find_empty_results(self, vector_search, mock_client):
        """Test find with empty results"""
        results = await vector_search.find(
            "test query",
            "viking://test/target",
        )
        assert results == []
    
    @pytest.mark.asyncio
    async def test_find_with_results(self, vector_search, mock_client):
        """Test find with mock results"""
        from agents_mem.openviking.client import SearchResult as VikingSearchResult
        
        mock_client.set_search_results([
            VikingSearchResult(
                uri="viking://test/doc-001",
                score=0.9,
                abstract="Test abstract",
                metadata={"title": "Test"},
            ),
        ])
        
        results = await vector_search.find(
            "test query",
            "viking://test/target",
        )
        assert len(results) == 1
        assert results[0].score == 0.9
    
    @pytest.mark.asyncio
    async def test_find_with_min_score(self, vector_search, mock_client):
        """Test find filters by min_score"""
        from agents_mem.openviking.client import SearchResult as VikingSearchResult
        
        mock_client.set_search_results([
            VikingSearchResult(uri="viking://test/doc-001", score=0.9),
            VikingSearchResult(uri="viking://test/doc-002", score=0.3),
        ])
        
        options = VectorSearchOptions(min_score=0.5)
        results = await vector_search.find(
            "test query",
            "viking://test/target",
            options=options,
        )
        assert len(results) == 1
        assert results[0].score == 0.9
    
    @pytest.mark.asyncio
    async def test_index(self, vector_search, mock_client):
        """Test indexing resource"""
        result = await vector_search.index(
            uri="mem://user123/_/_/documents/doc-001",
            embedding=[0.1] * 1024,
            metadata={"title": "Test"},
        )
        assert result in ["viking://test/root", "task-001"]
    
    @pytest.mark.asyncio
    async def test_delete(self, vector_search, mock_client):
        """Test delete"""
        result = await vector_search.delete("mem://user123/_/_/documents/doc-001")
        assert result is True
    
    @pytest.mark.asyncio
    async def test_health_check(self, vector_search, mock_client):
        """Test health check"""
        is_healthy, message = await vector_search.health_check()
        assert is_healthy is True
        assert message == "OK"
    
    def test_build_target_uri(self, vector_search):
        """Test target URI building"""
        uri = vector_search.build_target_uri(
            user_id="user123",
            agent_id="agent1",
            entity_type=EntityType.DOCUMENTS,
        )
        assert "user123" in uri
        assert "documents" in uri


class TestFactoryFunction:
    """Factory function tests"""
    
    def test_create_vector_search_capability(self):
        """Test factory creates capability"""
        config = OpenVikingConfig(base_url="http://localhost:1933")
        capability = create_vector_search_capability(config, "test")
        assert isinstance(capability, VectorSearchCapability)
        assert capability._client is not None