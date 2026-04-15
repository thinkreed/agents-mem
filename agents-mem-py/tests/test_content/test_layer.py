"""
Tests for content.layer module.

Tests ContentLayer CRUD operations, search, and tiered views.
"""

import pytest
import pytest_asyncio
import time

from agents_mem.core.types import Scope, ContentType, TierLevel
from agents_mem.content.layer import (
    ContentLayer,
    ContentCreateInput,
    ContentUpdateInput,
    ContentSearchQuery,
    parse_resource_type,
)


class TestContentCreateInput:
    """ContentCreateInput tests."""

    def test_create_input_defaults(self):
        """Test ContentCreateInput defaults."""
        input = ContentCreateInput(resource_type="document", content="Test content")
        assert input.content == "Test content"
        assert input.title is None
        assert input.doc_type == "note"
        assert input.metadata == {}
        assert input.is_global is False

    def test_create_input_full(self):
        """Test ContentCreateInput with all fields."""
        input = ContentCreateInput(
            resource_type="document",
            title="Test Document",
            content="Full content",
            doc_type="article",
            source_url="https://example.com",
            metadata={"key": "value"},
            is_global=True,
        )
        assert input.title == "Test Document"
        assert input.doc_type == "article"
        assert input.is_global is True


class TestContentUpdateInput:
    """ContentUpdateInput tests."""

    def test_update_input_partial(self):
        """Test ContentUpdateInput with partial fields."""
        input = ContentUpdateInput(title="New Title")
        assert input.title == "New Title"
        assert input.content is None
        assert input.metadata is None

    def test_update_input_full(self):
        """Test ContentUpdateInput with all fields."""
        input = ContentUpdateInput(
            title="New Title",
            content="New content",
            metadata={"updated": True},
        )
        assert input.title == "New Title"
        assert input.content == "New content"


class TestContentSearchQuery:
    """ContentSearchQuery tests."""

    def test_search_query_defaults(self):
        """Test ContentSearchQuery defaults."""
        scope = Scope(user_id="user123")
        query = ContentSearchQuery(query="test", scope=scope)
        assert query.query == "test"
        assert query.tier is None
        assert query.mode == "hybrid"
        assert query.limit == 10

    def test_search_query_with_tier(self):
        """Test ContentSearchQuery with tier."""
        scope = Scope(user_id="user123")
        query = ContentSearchQuery(
            query="test",
            scope=scope,
            tier=TierLevel.L0,
        )
        assert query.tier == TierLevel.L0


class TestParseResourceType:
    """parse_resource_type tests."""

    def test_parse_documents(self):
        """Test parse documents."""
        from agents_mem.core.types import EntityType
        result = parse_resource_type(EntityType.DOCUMENTS)
        assert result == "document"

    def test_parse_conversations(self):
        """Test parse conversations."""
        from agents_mem.core.types import EntityType
        result = parse_resource_type(EntityType.CONVERSATIONS)
        assert result == "conversation"

    def test_parse_facts(self):
        """Test parse facts."""
        from agents_mem.core.types import EntityType
        result = parse_resource_type(EntityType.FACTS)
        assert result == "fact"


class MockDBForContent:
    """Mock database for content tests."""

    def __init__(self):
        self._documents = {}
        self._conversations = {}
        self._messages = {}

    async def run(self, sql, params=None):
        """Run SQL."""
        params = params or []
        sql_upper = sql.upper()
        sql_lower = sql.lower()
        
        if "INSERT" in sql_upper and "documents" in sql_lower:
            if len(params) >= 2:
                doc_id = params[0]
                self._documents[doc_id] = {
                    "id": doc_id,
                    "user_id": params[1],
                    "title": params[8] if len(params) > 8 else "Untitled",
                    "content": params[9] if len(params) > 9 else "",
                    "doc_type": params[5] if len(params) > 5 else "note",
                    "created_at": params[12] if len(params) > 12 else int(time.time()),
                    "updated_at": params[13] if len(params) > 13 else int(time.time()),
                }
        
        if "INSERT" in sql_upper and "conversations" in sql_lower:
            if len(params) >= 2:
                conv_id = params[0]
                self._conversations[conv_id] = {
                    "id": conv_id,
                    "user_id": params[1],
                    "agent_id": params[2],
                    "title": params[4] if len(params) > 4 else None,
                    "started_at": params[9] if len(params) > 9 else int(time.time()),
                }
        
        if "DELETE" in sql_upper:
            if "documents" in sql_lower and params:
                doc_id = params[0]
                if doc_id in self._documents:
                    del self._documents[doc_id]
            if "conversations" in sql_lower and params:
                conv_id = params[0]
                if conv_id in self._conversations:
                    del self._conversations[conv_id]
        
        class MockCursor:
            rowcount = 1
        
        return MockCursor()

    async def query(self, sql, params=None):
        """Query all rows."""
        params = params or []
        sql_lower = sql.lower()
        
        if "documents" in sql_lower:
            return list(self._documents.values())
        
        return []

    async def query_one(self, sql, params=None):
        """Query single row."""
        params = params or []
        sql_lower = sql.lower()
        
        if "documents" in sql_lower:
            if params:
                doc_id = params[0]
                return self._documents.get(doc_id)
        
        if "conversations" in sql_lower:
            if params:
                conv_id = params[0]
                return self._conversations.get(conv_id)
        
        return None


class TestContentLayer:
    """ContentLayer tests."""

    @pytest_asyncio.fixture
    async def mock_content_db(self):
        """Create mock DB for content tests."""
        return MockDBForContent()

    @pytest_asyncio.fixture
    async def content_layer(self, mock_content_db):
        """Create ContentLayer instance."""
        from agents_mem.llm import MockLLMClient
        return ContentLayer(db=mock_content_db, llm_client=MockLLMClient())

    @pytest.mark.asyncio
    async def test_create_document(self, content_layer):
        """Test create document."""
        scope = Scope(user_id="user123")
        data = {
            "title": "Test Document",
            "content": "Test content",
        }
        
        content = await content_layer.create("document", scope, data)
        
        assert content.title == "Test Document"
        assert content.user_id == "user123"

    @pytest.mark.asyncio
    async def test_create_conversation(self, content_layer):
        """Test create conversation."""
        scope = Scope(user_id="user123", agent_id="agent1")
        data = {
            "title": "Test Conversation",
        }
        
        content = await content_layer.create("conversation", scope, data)
        
        assert content.user_id == "user123"

    @pytest.mark.asyncio
    async def test_create_conversation_requires_agent(self, content_layer):
        """Test create conversation requires agent_id."""
        from agents_mem.core.exceptions import ScopeError
        
        scope = Scope(user_id="user123")  # No agent_id
        
        with pytest.raises(ScopeError):
            await content_layer.create("conversation", scope, {"title": "Test"})

    @pytest.mark.asyncio
    async def test_create_validates_user_id(self, content_layer):
        """Test create validates user_id."""
        from agents_mem.core.exceptions import ScopeError
        
        scope = Scope(user_id="")  # Empty user_id
        
        with pytest.raises(ScopeError):
            await content_layer.create("document", scope, {"content": "Test"})

    @pytest.mark.asyncio
    async def test_delete_document(self, content_layer, mock_content_db):
        """Test delete document."""
        # First create a document
        scope = Scope(user_id="user123")
        content = await content_layer.create(
            "document",
            scope,
            {"title": "Test", "content": "Test content"},
        )
        
        # Then delete it
        deleted = await content_layer.delete(content.uri)
        assert deleted is True

    @pytest.mark.asyncio
    async def test_list_documents(self, content_layer):
        """Test list documents."""
        scope = Scope(user_id="user123")
        
        # Create some documents
        await content_layer.create("document", scope, {"title": "Doc1", "content": "Content1"})
        await content_layer.create("document", scope, {"title": "Doc2", "content": "Content2"})
        
        results = await content_layer.list(scope, resource_type="document")
        
        assert len(results) >= 2

    def test_tiered_property(self, content_layer):
        """Test tiered property."""
        from agents_mem.content.capabilities.tiered import TieredViewCapability
        
        assert hasattr(content_layer, 'tiered')
        assert isinstance(content_layer.tiered, TieredViewCapability)

    def test_clear_tiered_cache(self, content_layer):
        """Test clear_tiered_cache."""
        content_layer.clear_tiered_cache()
        
        stats = content_layer.get_tiered_cache_stats()
        assert stats["l0"]["size"] == 0
        assert stats["l1"]["size"] == 0


class TestContentLayerTieredView:
    """ContentLayer tiered view tests."""

    @pytest.fixture
    def sample_content(self):
        """Create sample content."""
        from agents_mem.core.types import Content, ContentType
        from datetime import datetime
        
        return Content(
            id="content-001",
            uri="mem://user123/_/_/documents/content-001",
            title="Test Document",
            body="This is the full content of the document with detailed information.",
            content_type=ContentType.NOTE,
            user_id="user123",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

    @pytest.mark.asyncio
    async def test_get_tiered_view_l0(self, content_layer, sample_content):
        """Test get_tiered_view L0."""
        view = await content_layer.get_tiered_view(sample_content, TierLevel.L0)
        
        assert isinstance(view, str)
        assert len(view) > 0

    @pytest.mark.asyncio
    async def test_get_tiered_view_l1(self, content_layer, sample_content):
        """Test get_tiered_view L1."""
        view = await content_layer.get_tiered_view(sample_content, TierLevel.L1)
        
        assert isinstance(view, str)
        assert len(view) > 0

    @pytest.mark.asyncio
    async def test_get_tiered_view_l2_returns_body(self, content_layer, sample_content):
        """Test get_tiered_view L2 returns original body."""
        view = await content_layer.get_tiered_view(sample_content, TierLevel.L2)
        
        # L2 should return the original body
        assert view == sample_content.body