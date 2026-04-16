"""
Tests for index.metadata module.

Tests MetadataIndex, MetadataEntry, SearchOptions.
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime

from agents_mem.core.types import Scope, SearchResult
from agents_mem.index.metadata import (
    MetadataEntry,
    MetadataIndex,
    SearchOptions,
    DBConnection,
)
from agents_mem.identity.layer import IdentityLayer


class MockDBConnection:
    """Mock database connection for testing"""
    
    def __init__(self):
        self._data: dict[str, dict[str, any]] = {}
        self._execute_result = 0
    
    async def execute(self, query: str, params: dict[str, any] | None = None) -> int:
        # Simulate INSERT/UPDATE/DELETE
        if "INSERT" in query or "REPLACE" in query:
            uri = params.get("uri", "")
            self._data[uri] = params.copy()
            return 1
        if "DELETE" in query:
            uri = params.get("uri", "")
            if uri in self._data:
                del self._data[uri]
                return 1
            return 0
        if "UPDATE" in query:
            uri = params.get("uri", "")
            if uri in self._data:
                self._data[uri].update(params)
                return 1
            return 0
        return self._execute_result
    
    async def fetch_one(self, query: str, params: dict[str, any] | None = None) -> dict[str, any] | None:
        if "WHERE uri = :uri" in query:
            uri = params.get("uri", "")
            return self._data.get(uri)
        return None
    
    async def fetch_all(self, query: str, params: dict[str, any] | None = None) -> list[dict[str, any]]:
        # Simple implementation for search
        results = []
        for entry in self._data.values():
            results.append(entry)
        return results[:params.get("limit", 10) if params else 10]


@pytest.fixture
def identity_layer():
    """Create identity layer for testing"""
    return IdentityLayer()


@pytest.fixture
def mock_db():
    """Create mock database connection"""
    return MockDBConnection()


@pytest.fixture
def metadata_index(identity_layer, mock_db):
    """Create metadata index for testing"""
    return MetadataIndex(mock_db, identity_layer)


class TestMetadataEntry:
    """MetadataEntry tests"""
    
    def test_metadata_entry_creation(self):
        """Test creating a metadata entry"""
        entry = MetadataEntry(
            uri="mem://user123/_/_/documents/doc-001",
            user_id="user123",
            target_type="documents",
            target_id="doc-001",
            title="Test Document",
            created_at=1700000000,
            updated_at=1700000000,
        )
        assert entry.uri == "mem://user123/_/_/documents/doc-001"
        assert entry.user_id == "user123"
        assert entry.target_type == "documents"
        assert entry.title == "Test Document"
    
    def test_metadata_entry_to_search_result(self):
        """Test converting entry to SearchResult"""
        entry = MetadataEntry(
            uri="mem://user123/_/_/documents/doc-001",
            user_id="user123",
            target_type="documents",
            target_id="doc-001",
            title="Test Document",
            description="Test description",
            importance=0.8,
            created_at=1700000000,
            updated_at=1700000000,
        )
        result = entry.to_search_result()
        assert isinstance(result, SearchResult)
        assert result.uri == entry.uri
        assert result.score == entry.importance
        assert result.title == entry.title
        assert result.content == entry.description
    
    def test_metadata_entry_frozen(self):
        """Test that MetadataEntry is frozen"""
        entry = MetadataEntry(
            uri="mem://user123/_/_/documents/doc-001",
            user_id="user123",
            target_type="documents",
            target_id="doc-001",
            title="Test Document",
            created_at=1700000000,
            updated_at=1700000000,
        )
        with pytest.raises(Exception):
            entry.title = "New Title"


class TestSearchOptions:
    """SearchOptions tests"""
    
    def test_search_options_defaults(self):
        """Test default search options"""
        options = SearchOptions()
        assert options.limit == 10
        assert options.offset == 0
        assert options.min_importance == 0.0
        assert options.target_type is None
        assert options.order_by == "importance DESC"
    
    def test_search_options_custom(self):
        """Test custom search options"""
        options = SearchOptions(
            limit=50,
            offset=10,
            min_importance=0.5,
            target_type="documents",
            order_by="updated_at DESC",
        )
        assert options.limit == 50
        assert options.offset == 10
        assert options.min_importance == 0.5
        assert options.target_type == "documents"
        assert options.order_by == "updated_at DESC"


class TestMetadataIndex:
    """MetadataIndex tests"""
    
    @pytest.mark.asyncio
    async def test_index_resource(self, metadata_index, mock_db):
        """Test indexing a resource"""
        scope = Scope(user_id="user123")
        entry = await metadata_index.index_resource(
            uri="mem://user123/_/_/documents/doc-001",
            scope=scope,
            target_type="documents",
            target_id="doc-001",
            title="Test Document",
            description="Test description",
            importance=0.8,
        )
        assert entry.uri == "mem://user123/_/_/documents/doc-001"
        assert entry.user_id == "user123"
        assert entry.target_type == "documents"
        assert entry.title == "Test Document"
    
    @pytest.mark.asyncio
    async def test_index_resource_with_tags(self, metadata_index, mock_db):
        """Test indexing with tags"""
        scope = Scope(user_id="user123")
        entry = await metadata_index.index_resource(
            uri="mem://user123/_/_/documents/doc-002",
            scope=scope,
            target_type="documents",
            target_id="doc-002",
            title="Tagged Document",
            tags=["tag1", "tag2"],
        )
        assert entry.tags == "tag1,tag2"
    
    @pytest.mark.asyncio
    async def test_get_by_uri(self, metadata_index, mock_db):
        """Test getting entry by URI"""
        scope = Scope(user_id="user123")
        await metadata_index.index_resource(
            uri="mem://user123/_/_/documents/doc-001",
            scope=scope,
            target_type="documents",
            target_id="doc-001",
            title="Test Document",
        )
        
        entry = await metadata_index.get_by_uri("mem://user123/_/_/documents/doc-001")
        assert entry is not None
        assert entry.title == "Test Document"
    
    @pytest.mark.asyncio
    async def test_get_by_uri_not_found(self, metadata_index, mock_db):
        """Test getting non-existent entry"""
        entry = await metadata_index.get_by_uri("mem://user123/_/_/documents/nonexistent")
        assert entry is None
    
    @pytest.mark.asyncio
    async def test_get_by_uri_or_raise(self, metadata_index, mock_db):
        """Test getting entry or raising"""
        scope = Scope(user_id="user123")
        await metadata_index.index_resource(
            uri="mem://user123/_/_/documents/doc-001",
            scope=scope,
            target_type="documents",
            target_id="doc-001",
            title="Test Document",
        )
        
        entry = await metadata_index.get_by_uri_or_raise("mem://user123/_/_/documents/doc-001")
        assert entry.title == "Test Document"
    
    @pytest.mark.asyncio
    async def test_get_by_uri_or_raise_not_found(self, metadata_index, mock_db):
        """Test raising for non-existent entry"""
        from agents_mem.core.exceptions import NotFoundError
        with pytest.raises(NotFoundError):
            await metadata_index.get_by_uri_or_raise("mem://user123/_/_/documents/nonexistent")
    
    @pytest.mark.asyncio
    async def test_update_entry(self, metadata_index, mock_db):
        """Test updating entry"""
        scope = Scope(user_id="user123")
        await metadata_index.index_resource(
            uri="mem://user123/_/_/documents/doc-001",
            scope=scope,
            target_type="documents",
            target_id="doc-001",
            title="Original Title",
        )
        
        updated = await metadata_index.update(
            uri="mem://user123/_/_/documents/doc-001",
            title="Updated Title",
            importance=0.9,
        )
        assert updated.title == "Updated Title"
        assert updated.importance == 0.9
    
    @pytest.mark.asyncio
    async def test_delete_entry(self, metadata_index, mock_db):
        """Test deleting entry"""
        scope = Scope(user_id="user123")
        await metadata_index.index_resource(
            uri="mem://user123/_/_/documents/doc-001",
            scope=scope,
            target_type="documents",
            target_id="doc-001",
            title="Test Document",
        )
        
        deleted = await metadata_index.delete("mem://user123/_/_/documents/doc-001")
        assert deleted is True
        
        entry = await metadata_index.get_by_uri("mem://user123/_/_/documents/doc-001")
        assert entry is None
    
    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, metadata_index, mock_db):
        """Test deleting non-existent entry"""
        deleted = await metadata_index.delete("mem://user123/_/_/documents/nonexistent")
        assert deleted is False
    
    @pytest.mark.asyncio
    async def test_filter_by_scope(self, metadata_index, mock_db):
        """Test filtering by scope"""
        scope = Scope(user_id="user123")
        await metadata_index.index_resource(
            uri="mem://user123/_/_/documents/doc-001",
            scope=scope,
            target_type="documents",
            target_id="doc-001",
            title="Document 1",
        )
        await metadata_index.index_resource(
            uri="mem://user123/_/_/documents/doc-002",
            scope=scope,
            target_type="documents",
            target_id="doc-002",
            title="Document 2",
        )
        
        entries = await metadata_index.filter_by_scope(scope)
        assert len(entries) >= 2


class TestMetadataIndexHelpers:
    """Test helper methods"""
    
    def test_build_scope_conditions(self, metadata_index):
        """Test scope condition building"""
        scope = Scope(user_id="user123")
        result = metadata_index._build_scope_conditions(scope)
        
        assert "user_id = :user_id" in result["conditions"]
        assert result["params"]["user_id"] == "user123"
    
    def test_build_scope_conditions_with_agent(self, metadata_index):
        """Test scope condition with agent"""
        scope = Scope(user_id="user123", agent_id="agent1")
        result = metadata_index._build_scope_conditions(scope)
        
        assert len(result["conditions"]) == 2
        assert "agent_id" in result["params"]
    
    def test_build_text_search_conditions(self, metadata_index):
        """Test text search condition building"""
        result = metadata_index._build_text_search_conditions("test query")
        
        assert result is not None
        assert len(result["conditions"]) == 1
        assert "OR" in result["conditions"][0]
    
    def test_build_text_search_conditions_empty(self, metadata_index):
        """Test empty query returns None"""
        result = metadata_index._build_text_search_conditions("")
        assert result is None
    
    def test_row_to_entry(self, metadata_index):
        """Test row conversion"""
        row = {
            "uri": "mem://user123/_/_/documents/doc-001",
            "user_id": "user123",
            "target_type": "documents",
            "target_id": "doc-001",
            "title": "Test",
            "importance": 0.5,
            "created_at": 1700000000,
            "updated_at": 1700000000,
        }
        entry = metadata_index._row_to_entry(row)
        assert entry.uri == row["uri"]
        assert entry.title == row["title"]