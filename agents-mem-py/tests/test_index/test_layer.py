"""
Tests for index.layer module.

Tests IndexLayer, FindOptions, IndexResult, and RRF fusion.
"""

import pytest
import pytest_asyncio

from agents_mem.core.types import Scope, SearchMode, EntityType, SearchResult
from agents_mem.index.layer import (
    IndexLayer,
    FindOptions,
    IndexResult,
    reciprocal_rank_fusion,
)


class TestFindOptions:
    """FindOptions tests."""

    def test_find_options_defaults(self):
        """Test FindOptions default values."""
        options = FindOptions()
        assert options.limit == 10
        assert options.offset == 0
        assert options.min_importance == 0.0
        assert options.min_score == 0.0
        assert options.target_type is None
        assert options.entity_type is None

    def test_find_options_custom(self):
        """Test FindOptions with custom values."""
        options = FindOptions(
            limit=20,
            offset=5,
            min_importance=0.5,
            min_score=0.7,
            target_type="document",
            entity_type=EntityType.DOCUMENTS,
        )
        assert options.limit == 20
        assert options.offset == 5
        assert options.min_importance == 0.5
        assert options.min_score == 0.7
        assert options.target_type == "document"
        assert options.entity_type == EntityType.DOCUMENTS


class TestIndexResult:
    """IndexResult tests."""

    def test_index_result_creation(self):
        """Test IndexResult creation."""
        result = IndexResult(
            uri="mem://user123/_/_/documents/doc-001",
            metadata_entry=None,
            vector_indexed=True,
            vector_task_id="task-001",
        )
        assert result.uri == "mem://user123/_/_/documents/doc-001"
        assert result.vector_indexed is True
        assert result.vector_task_id == "task-001"

    def test_index_result_no_vector(self):
        """Test IndexResult without vector indexing."""
        result = IndexResult(
            uri="mem://user123/_/_/documents/doc-001",
            metadata_entry=None,
            vector_indexed=False,
        )
        assert result.vector_indexed is False
        assert result.vector_task_id is None


class TestReciprocalRankFusion:
    """RRF fusion tests."""

    def test_rrf_empty_results(self):
        """Test RRF with empty results."""
        result = reciprocal_rank_fusion([], [])
        assert result == []

    def test_rrf_fts_only(self):
        """Test RRF with FTS results only."""
        fts_results = [
            SearchResult(uri="uri1", score=0.9),
            SearchResult(uri="uri2", score=0.8),
        ]
        result = reciprocal_rank_fusion(fts_results, [])
        
        assert len(result) == 2
        assert result[0].uri == "uri1"
        assert result[1].uri == "uri2"

    def test_rrf_vector_only(self):
        """Test RRF with vector results only."""
        vector_results = [
            SearchResult(uri="uri1", score=0.95),
            SearchResult(uri="uri3", score=0.85),
        ]
        result = reciprocal_rank_fusion([], vector_results)
        
        assert len(result) == 2
        assert result[0].uri == "uri1"

    def test_rrf_combines_results(self):
        """Test RRF combines FTS and vector results."""
        fts_results = [
            SearchResult(uri="uri1", score=0.9),
            SearchResult(uri="uri2", score=0.8),
        ]
        vector_results = [
            SearchResult(uri="uri1", score=0.95),
            SearchResult(uri="uri3", score=0.85),
        ]
        result = reciprocal_rank_fusion(fts_results, vector_results)
        
        # uri1 appears in both, should have higher RRF score
        assert len(result) == 3
        # uri1 should be first due to higher combined rank
        assert result[0].uri == "uri1"

    def test_rrf_custom_k(self):
        """Test RRF with custom k parameter."""
        fts_results = [
            SearchResult(uri="uri1", score=0.9),
        ]
        vector_results = [
            SearchResult(uri="uri1", score=0.95),
        ]
        result_k60 = reciprocal_rank_fusion(fts_results, vector_results, k=60)
        result_k20 = reciprocal_rank_fusion(fts_results, vector_results, k=20)
        
        # Different k should produce different scores
        assert len(result_k60) == len(result_k20) == 1
        # k affects the score calculation
        assert result_k60[0].score != result_k20[0].score

    def test_rrf_preserves_metadata(self):
        """Test RRF preserves metadata from both sources."""
        fts_results = [
            SearchResult(uri="uri1", score=0.9, metadata={"fts_field": "fts_val"}),
        ]
        vector_results = [
            SearchResult(uri="uri1", score=0.95, metadata={"vec_field": "vec_val"}),
        ]
        result = reciprocal_rank_fusion(fts_results, vector_results)
        
        # Both metadata should be merged
        assert "fts_field" in result[0].metadata
        assert "vec_field" in result[0].metadata


class TestIndexLayer:
    """IndexLayer tests."""

    def test_index_layer_creation(self):
        """Test IndexLayer creation."""
        from agents_mem.identity.layer import IdentityLayer
        from agents_mem.sqlite.connection import DatabaseConnection
        
        identity = IdentityLayer()
        
        # Create without OpenViking client
        layer = IndexLayer.__new__(IndexLayer)
        layer._identity = identity
        layer._uri_system = None
        
        assert layer._identity == identity

    def test_uri_system_property(self):
        """Test uri_system property."""
        from agents_mem.core.uri import URISystem
        from agents_mem.identity.layer import IdentityLayer
        
        identity = IdentityLayer()
        layer = IndexLayer.__new__(IndexLayer)
        layer._identity = identity
        layer._uri_system = URISystem
        
        assert layer.uri_system == URISystem

    def test_build_uri(self):
        """Test build_uri method."""
        from agents_mem.core.uri import URISystem
        from agents_mem.identity.layer import IdentityLayer
        
        identity = IdentityLayer()
        layer = IndexLayer.__new__(IndexLayer)
        layer._identity = identity
        layer._uri_system = URISystem
        
        scope = Scope(user_id="user123")
        uri = layer.build_uri(scope, "document", "doc-001")
        
        assert uri == "mem://user123/_/_/document/doc-001"

    def test_parse_uri(self):
        """Test parse_uri method."""
        from agents_mem.core.uri import URISystem
        from agents_mem.identity.layer import IdentityLayer
        
        identity = IdentityLayer()
        layer = IndexLayer.__new__(IndexLayer)
        layer._identity = identity
        layer._uri_system = URISystem
        
        uri = "mem://user123/_/_/document/doc-001"
        parsed = layer.parse_uri(uri)
        
        assert parsed.user_id == "user123"
        assert parsed.resource_type == "document"
        assert parsed.resource_id == "doc-001"

    def test_validate_uri(self):
        """Test validate_uri method."""
        from agents_mem.core.uri import URISystem
        from agents_mem.identity.layer import IdentityLayer
        
        identity = IdentityLayer()
        layer = IndexLayer.__new__(IndexLayer)
        layer._identity = identity
        layer._uri_system = URISystem
        
        valid_uri = "mem://user123/_/_/document/doc-001"
        invalid_uri = "invalid://uri"
        
        assert layer.validate_uri(valid_uri) is True
        assert layer.validate_uri(invalid_uri) is False


class TestIndexLayerIntegration:
    """IndexLayer integration tests with mock components."""

    @pytest_asyncio.fixture
    async def mock_db_for_index(self):
        """Create mock DB for index tests."""
        class MockDB:
            async def execute(self, sql, params=None):
                pass
            
            async def fetch_one(self, sql, params=None):
                return None
            
            async def fetch_all(self, sql, params=None):
                return []
        
        return MockDB()

    @pytest.mark.asyncio
    async def test_layer_init_without_openviking(self, mock_db_for_index):
        """Test IndexLayer initialization without OpenViking."""
        from agents_mem.identity.layer import IdentityLayer
        
        identity = IdentityLayer()
        layer = IndexLayer(
            identity_layer=identity,
            db=mock_db_for_index,
        )
        
        assert layer._identity == identity
        assert layer._vector_search is None

    @pytest.mark.asyncio
    async def test_find_fts_mode(self, mock_db_for_index):
        """Test find with FTS mode."""
        from agents_mem.identity.layer import IdentityLayer
        
        identity = IdentityLayer()
        layer = IndexLayer(
            identity_layer=identity,
            db=mock_db_for_index,
        )
        
        scope = Scope(user_id="user123")
        
        # FTS mode should work without OpenViking
        results = await layer.find(
            query="test",
            scope=scope,
            mode=SearchMode.FTS,
        )
        
        assert isinstance(results, list)

    @pytest.mark.asyncio
    async def test_find_semantic_without_openviking_raises(self, mock_db_for_index):
        """Test find with semantic mode without OpenViking raises."""
        from agents_mem.identity.layer import IdentityLayer
        from agents_mem.core.exceptions import SearchError
        
        identity = IdentityLayer()
        layer = IndexLayer(
            identity_layer=identity,
            db=mock_db_for_index,
        )
        
        scope = Scope(user_id="user123")
        
        # Semantic mode without OpenViking should raise
        with pytest.raises(SearchError):
            await layer.find(
                query="test",
                scope=scope,
                mode=SearchMode.SEMANTIC,
            )

    @pytest.mark.asyncio
    async def test_find_validates_scope(self, mock_db_for_index):
        """Test find validates scope."""
        from agents_mem.identity.layer import IdentityLayer
        from agents_mem.core.exceptions import ScopeError
        
        identity = IdentityLayer()
        layer = IndexLayer(
            identity_layer=identity,
            db=mock_db_for_index,
        )
        
        # Invalid scope (empty user_id)
        invalid_scope = Scope(user_id="")
        
        with pytest.raises(ScopeError):
            await layer.find(
                query="test",
                scope=invalid_scope,
                mode=SearchMode.FTS,
            )