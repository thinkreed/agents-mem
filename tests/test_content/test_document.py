"""
Tests for content.resources.document module.

Tests DocumentRepository, Document, DocumentCreateInput, DocumentUpdateInput.
"""

import pytest
import pytest_asyncio
import time
from typing import Any, Protocol

from agents_mem.core.types import Scope, ContentType, TierLevel
from agents_mem.content.resources.document import (
    Document,
    DocumentCreateInput,
    DocumentUpdateInput,
    DocumentRepository,
)
from agents_mem.content.capabilities.tiered import TieredViewCapability
from agents_mem.llm import MockLLMClient


class MockDBConnection:
    """Mock database"""
    
    def __init__(self):
        self._documents: dict[str, dict] = {}
    
    async def run(self, sql: str, params: list | None = None):
        if "INSERT" in sql:
            doc_id = params[0] if params else ""
            self._documents[doc_id] = {
                "id": doc_id,
                "user_id": params[1] if len(params) > 1 else "",
                "title": params[4] if len(params) > 4 else "",
                "content": params[5] if len(params) > 5 else "",
            }
        return None
    
    async def query(self, sql: str, params: list | None = None):
        return list(self._documents.values())
    
    async def query_one(self, sql: str, params: list | None = None):
        if "WHERE id =" in sql or "WHERE id=" in sql:
            doc_id = params[0] if params else ""
            return self._documents.get(doc_id)
        return None


@pytest.fixture
def mock_db():
    return MockDBConnection()


@pytest.fixture
def tiered():
    return TieredViewCapability(MockLLMClient())


@pytest.fixture
def doc_repo(mock_db, tiered):
    return DocumentRepository(mock_db, tiered)


@pytest.fixture
def sample_scope():
    return Scope(user_id="user123")


class TestDocument:
    """Document model tests"""
    
    def test_document_creation(self):
        """Test creating document"""
        doc = Document(
            id="doc-001",
            user_id="user123",
            title="Test Document",
            content="Test content",
        )
        assert doc.id == "doc-001"
        assert doc.user_id == "user123"
        assert doc.title == "Test Document"
    
    def test_document_uri(self):
        """Test URI generation"""
        doc = Document(
            id="doc-001",
            user_id="user123",
            title="Test",
            content="Test",
        )
        uri = doc.uri
        assert uri.startswith("mem://")
        assert "user123" in uri
        assert "doc-001" in uri
    
    def test_document_defaults(self):
        """Test default values"""
        doc = Document(
            id="doc-001",
            user_id="user123",
            title="Test",
            content="Test",
        )
        assert doc.doc_type == "note"
        assert doc.is_global is False
        assert doc.metadata == {}
    
    def test_document_timestamps(self):
        """Test timestamps"""
        doc = Document(
            id="doc-001",
            user_id="user123",
            title="Test",
            content="Test",
        )
        assert doc.created_at > 0
        assert doc.updated_at > 0


class TestDocumentCreateInput:
    """DocumentCreateInput tests"""
    
    def test_create_input_defaults(self):
        """Test default values"""
        input = DocumentCreateInput(
            title="Test",
            content="Content",
        )
        assert input.doc_type == "note"
        assert input.source_url is None
        assert input.is_global is False
    
    def test_create_input_custom(self):
        """Test custom values"""
        input = DocumentCreateInput(
            title="Test",
            content="Content",
            doc_type="article",
            source_url="https://example.com",
            metadata={"key": "value"},
        )
        assert input.doc_type == "article"
        assert input.source_url == "https://example.com"


class TestDocumentUpdateInput:
    """DocumentUpdateInput tests"""
    
    def test_update_input_defaults(self):
        """Test all fields optional"""
        input = DocumentUpdateInput()
        assert input.title is None
        assert input.content is None
        assert input.metadata is None
    
    def test_update_input_custom(self):
        """Test custom values"""
        input = DocumentUpdateInput(
            title="New Title",
            content="New Content",
        )
        assert input.title == "New Title"
        assert input.content == "New Content"


class TestDocumentRepository:
    """DocumentRepository tests"""
    
    def test_initialization(self, mock_db, tiered):
        """Test initialization"""
        repo = DocumentRepository(mock_db, tiered)
        assert repo._db == mock_db
        assert repo._tiered == tiered
    
    @pytest.mark.asyncio
    async def test_create(self, doc_repo, sample_scope):
        """Test creating document"""
        input = DocumentCreateInput(
            title="Test Document",
            content="Test content for document",
        )
        doc = await doc_repo.create(sample_scope, input)
        
        assert doc.title == "Test Document"
        assert doc.user_id == "user123"
    
    @pytest.mark.asyncio
    async def test_get(self, doc_repo, sample_scope, mock_db):
        """Test getting document"""
        # Create first
        input = DocumentCreateInput(title="Test", content="Content")
        doc = await doc_repo.create(sample_scope, input)
        
        # Get
        result = await doc_repo.get(sample_scope, doc.id)
        assert result is not None
    
    @pytest.mark.asyncio
    async def test_get_nonexistent(self, doc_repo, sample_scope):
        """Test getting nonexistent"""
        result = await doc_repo.get(sample_scope, "nonexistent")
        assert result is None
    
    @pytest.mark.asyncio
    async def test_update(self, doc_repo, sample_scope, mock_db):
        """Test updating document"""
        # Create
        input = DocumentCreateInput(title="Original", content="Original content")
        doc = await doc_repo.create(sample_scope, input)
        
        # Update
        update_input = DocumentUpdateInput(title="Updated")
        updated = await doc_repo.update(sample_scope, doc.id, update_input)
        assert updated.title == "Updated"
    
    @pytest.mark.asyncio
    async def test_delete(self, doc_repo, sample_scope, mock_db):
        """Test deleting document"""
        # Create
        input = DocumentCreateInput(title="Test", content="Content")
        doc = await doc_repo.create(sample_scope, input)
        
        # Delete
        deleted = await doc_repo.delete(sample_scope, doc.id)
        assert deleted is True
    
    @pytest.mark.asyncio
    async def test_list(self, doc_repo, sample_scope):
        """Test listing documents"""
        # Create multiple
        for i in range(3):
            input = DocumentCreateInput(title=f"Doc {i}", content="Content")
            await doc_repo.create(sample_scope, input)
        
        docs = await doc_repo.list(sample_scope, limit=10)
        assert len(docs) >= 3
    
    @pytest.mark.asyncio
    async def test_search(self, doc_repo, sample_scope):
        """Test searching documents"""
        # Create
        input = DocumentCreateInput(title="Python Tutorial", content="Python programming guide")
        await doc_repo.create(sample_scope, input)
        
        results = await doc_repo.search(sample_scope, "Python", "fts", 10)
        assert isinstance(results, list)


class TestTieredViewIntegration:
    """Tiered view integration tests"""
    
    @pytest.mark.asyncio
    async def test_get_with_tier(self, doc_repo, sample_scope, mock_db):
        """Test getting with tier"""
        # Create
        input = DocumentCreateInput(title="Test", content="Long content for tiered view")
        doc = await doc_repo.create(sample_scope, input)
        
        # Get L0
        result = await doc_repo.get(sample_scope, doc.id, TierLevel.L0)
        assert result is not None