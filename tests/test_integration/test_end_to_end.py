"""
End-to-end integration tests.

Tests complete workflows from creation to retrieval across all layers.
"""

import pytest
import pytest_asyncio
import json
import time
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from agents_mem.core.types import (
    Scope,
    ContentType,
    TierLevel,
    EntityType,
    FactType,
    Content,
    Fact,
)
from agents_mem.core.uri import URISystem


# ============================================================================
# Mock In-Memory Database for Integration Tests
# ============================================================================


class InMemoryTestDB:
    """In-memory database for integration tests."""

    def __init__(self):
        self.tables = {
            "documents": {},
            "conversations": {},
            "messages": {},
            "facts": {},
            "tiered_content": {},
            "memory_index": {},
        }

    async def run(self, sql, params=None):
        """Execute SQL with parameters."""
        params = params or []
        sql_upper = sql.upper()

        # Handle INSERT
        if "INSERT" in sql_upper:
            table = self._extract_table(sql)
            if table and table in self.tables:
                row = self._params_to_row(sql, params)
                id_val = params[0] if params else str(len(self.tables[table]))
                self.tables[table][id_val] = row

        # Handle DELETE
        if "DELETE" in sql_upper:
            table = self._extract_table(sql)
            if table and table in self.tables and params:
                id_val = params[0]
                if id_val in self.tables[table]:
                    del self.tables[table][id_val]

        # Handle UPDATE
        if "UPDATE" in sql_upper:
            table = self._extract_table(sql)
            if table and table in self.tables and params:
                id_val = params[-1]  # Last param is usually id
                if id_val in self.tables[table]:
                    self._apply_update(sql, self.tables[table][id_val], params)

        class MockCursor:
            rowcount = 1

        return MockCursor()

    async def query(self, sql, params=None):
        """Query and return all rows."""
        params = params or []
        table = self._extract_table(sql)

        if table and table in self.tables:
            results = list(self.tables[table].values())

            # Apply WHERE filters
            if "WHERE" in sql.upper():
                results = self._apply_where(sql, results, params)

            # Apply LIKE search
            if "LIKE" in sql.upper():
                results = self._apply_like(sql, results, params)

            return results

        return []

    async def query_one(self, sql, params=None):
        """Query and return single row."""
        results = await self.query(sql, params)
        return results[0] if results else None

    def _extract_table(self, sql):
        """Extract table name from SQL."""
        sql_upper = sql.upper()
        for keyword in ["INSERT INTO", "UPDATE", "DELETE FROM", "FROM"]:
            if keyword in sql_upper:
                idx = sql_upper.find(keyword) + len(keyword)
                rest = sql[idx:].strip()
                words = rest.split()
                return words[0] if words else None
        return None

    def _params_to_row(self, sql, params):
        """Convert params to row dict."""
        if "(" in sql and ")" in sql:
            cols_part = sql.split("(")[1].split(")")[0]
            cols = [c.strip() for c in cols_part.split(",")]
            row = {}
            for i, col in enumerate(cols):
                if i < len(params):
                    row[col] = params[i]
            return row
        return {"id": params[0] if params else ""}

    def _apply_where(self, sql, results, params):
        """Apply WHERE filter."""
        filtered = []
        sql_lower = sql.lower()
        
        # Extract WHERE clause columns
        if "where" in sql_lower:
            where_clause = sql_lower.split("where")[1]
            # Parse column names from WHERE clause
            conditions = []
            for cond in where_clause.split("and"):
                cond = cond.strip()
                if "=" in cond:
                    col_name = cond.split("=")[0].strip()
                    conditions.append(col_name)
            
            # Match based on conditions order
            for row in results:
                match = True
                param_idx = 0
                for col in conditions:
                    if param_idx < len(params):
                        if row.get(col) != params[param_idx]:
                            match = False
                            break
                        param_idx += 1
                if match:
                    filtered.append(row)
            return filtered
        
        # No WHERE clause, return all
        return results

    def _apply_like(self, sql, results, params):
        """Apply LIKE search."""
        filtered = []
        for row in results:
            # Simple search in title and content
            search_term = params[-2] if len(params) >= 2 else ""
            if search_term and "%" in search_term:
                term = search_term.replace("%", "")
                title = str(row.get("title", ""))
                content = str(row.get("content", ""))
                if term.lower() in title.lower() or term.lower() in content.lower():
                    filtered.append(row)
            else:
                filtered.append(row)
        return filtered

    def _apply_update(self, sql, row, params):
        """Apply update to row."""
        # Simple update - apply params to row
        if "SET" in sql.upper():
            set_part = sql.upper().split("SET")[1].split("WHERE")[0]
            cols = [c.strip().split("=")[0].lower() for c in set_part.split(",")]
            for i, col in enumerate(cols):
                if i < len(params) - 1:
                    row[col] = params[i]

    # Convenience methods for tests
    def insert_document(self, doc_id, user_id, title, content):
        """Insert a document directly."""
        now = int(time.time())
        self.tables["documents"][doc_id] = {
            "id": doc_id,
            "user_id": user_id,
            "title": title,
            "content": content,
            "doc_type": "note",
            "created_at": now,
            "updated_at": now,
        }

    def insert_fact(self, fact_id, user_id, content, fact_type, source_id):
        """Insert a fact directly."""
        now = int(time.time())
        self.tables["facts"][fact_id] = {
            "id": fact_id,
            "user_id": user_id,
            "content": content,
            "fact_type": fact_type,
            "source_type": "documents",
            "source_id": source_id,
            "entities": json.dumps([]),
            "importance": 0.5,
            "confidence": 0.8,
            "created_at": now,
            "updated_at": now,
        }


# ============================================================================
# Integration Test Fixtures
# ============================================================================


@pytest_asyncio.fixture
async def integration_db():
    """Create integration test database."""
    return InMemoryTestDB()


@pytest.fixture
def test_scope():
    """Create test scope."""
    return Scope(user_id="integration-test-user")


@pytest.fixture
def agent_scope():
    """Create scope with agent."""
    return Scope(user_id="integration-test-user", agent_id="test-agent")


# ============================================================================
# End-to-End Tests
# ============================================================================


class TestDocumentLifecycle:
    """Test complete document lifecycle: create -> read -> update -> delete."""

    @pytest.mark.asyncio
    async def test_create_document(self, integration_db, test_scope):
        """Test creating a document."""
        from agents_mem.content.layer import ContentLayer
        from agents_mem.llm import MockLLMClient

        content_layer = ContentLayer(db=integration_db, llm_client=MockLLMClient())

        # Create document
        doc = await content_layer.create(
            "document",
            test_scope,
            {"title": "Integration Test Doc", "content": "Test content for integration"},
        )

        assert doc.id is not None
        assert doc.title == "Integration Test Doc"
        assert doc.user_id == test_scope.user_id

        # Verify stored in database
        stored = await integration_db.query_one(
            "SELECT * FROM documents WHERE id = ?",
            [doc.id],
        )
        assert stored is not None

    @pytest.mark.asyncio
    async def test_read_document(self, integration_db, test_scope):
        """Test reading a document."""
        # Setup: Insert document directly
        integration_db.insert_document(
            "doc-001",
            test_scope.user_id,
            "Test Document",
            "Test content",
        )

        from agents_mem.content.layer import ContentLayer
        from agents_mem.llm import MockLLMClient

        content_layer = ContentLayer(db=integration_db, llm_client=MockLLMClient())

        # Build URI and read
        uri = f"mem://{test_scope.user_id}/_/_/documents/doc-001"
        result = await content_layer.get(uri)

        assert result is not None
        assert result.id == "doc-001"

    @pytest.mark.asyncio
    async def test_update_document(self, integration_db, test_scope):
        """Test updating a document."""
        # Setup
        integration_db.insert_document(
            "doc-001",
            test_scope.user_id,
            "Original Title",
            "Original content",
        )

        from agents_mem.content.layer import ContentLayer
        from agents_mem.llm import MockLLMClient

        content_layer = ContentLayer(db=integration_db, llm_client=MockLLMClient())

        # Update
        uri = f"mem://{test_scope.user_id}/_/_/documents/doc-001"
        updated = await content_layer.update(uri, {"title": "Updated Title"})

        assert updated.title == "Updated Title"

    @pytest.mark.asyncio
    async def test_delete_document(self, integration_db, test_scope):
        """Test deleting a document."""
        # Setup
        integration_db.insert_document(
            "doc-001",
            test_scope.user_id,
            "Test",
            "Content",
        )

        from agents_mem.content.layer import ContentLayer
        from agents_mem.llm import MockLLMClient

        content_layer = ContentLayer(db=integration_db, llm_client=MockLLMClient())

        # Delete
        uri = f"mem://{test_scope.user_id}/_/_/documents/doc-001"
        deleted = await content_layer.delete(uri)

        assert deleted is True

        # Verify deleted
        stored = await integration_db.query_one(
            "SELECT * FROM documents WHERE id = ?",
            ["doc-001"],
        )
        assert stored is None


class TestConversationLifecycle:
    """Test conversation lifecycle."""

    @pytest.mark.asyncio
    async def test_create_conversation(self, integration_db, agent_scope):
        """Test creating a conversation."""
        from agents_mem.content.layer import ContentLayer
        from agents_mem.llm import MockLLMClient

        content_layer = ContentLayer(db=integration_db, llm_client=MockLLMClient())

        conv = await content_layer.create(
            "conversation",
            agent_scope,
            {"title": "Test Conversation"},
        )

        assert conv.id is not None
        assert conv.user_id == agent_scope.user_id


class TestTieredViewWorkflow:
    """Test tiered view workflow."""

    @pytest.fixture
    def sample_content(self):
        """Create sample content for tiered view."""
        return Content(
            id="doc-001",
            uri="mem://test-user/_/_/documents/doc-001",
            title="Test Document for Tiered View",
            body="This is a long document with detailed content that needs tiered views for efficient loading.",
            content_type=ContentType.NOTE,
            user_id="test-user",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

    @pytest.mark.asyncio
    async def test_generate_l0_view(self, sample_content):
        """Test generating L0 view."""
        from agents_mem.content.capabilities.tiered import TieredViewCapability
        from agents_mem.llm import MockLLMClient

        tiered = TieredViewCapability(llm_client=MockLLMClient())

        l0 = await tiered.get_view(sample_content, TierLevel.L0)

        assert isinstance(l0, str)
        assert len(l0) > 0

    @pytest.mark.asyncio
    async def test_generate_l1_view(self, sample_content):
        """Test generating L1 view."""
        from agents_mem.content.capabilities.tiered import TieredViewCapability
        from agents_mem.llm import MockLLMClient

        tiered = TieredViewCapability(llm_client=MockLLMClient())

        l1 = await tiered.get_view(sample_content, TierLevel.L1)

        assert isinstance(l1, str)
        assert len(l1) > len(await tiered.get_view(sample_content, TierLevel.L0))

    @pytest.mark.asyncio
    async def test_l2_returns_original(self, sample_content):
        """Test L2 returns original body."""
        from agents_mem.content.capabilities.tiered import TieredViewCapability
        from agents_mem.llm import MockLLMClient

        tiered = TieredViewCapability(llm_client=MockLLMClient())

        l2 = await tiered.get_view(sample_content, TierLevel.L2)

        assert l2 == sample_content.body

    @pytest.mark.asyncio
    async def test_tiered_caching(self, sample_content):
        """Test tiered view caching."""
        from agents_mem.content.capabilities.tiered import TieredViewCapability
        from agents_mem.llm import MockLLMClient

        tiered = TieredViewCapability(llm_client=MockLLMClient())

        # First call
        l0_first = await tiered.get_view(sample_content, TierLevel.L0)

        # Second call should hit cache
        l0_second = await tiered.get_view(sample_content, TierLevel.L0)

        # Both should return same result
        assert l0_first == l0_second

        # Check cache stats
        stats = tiered.get_cache_stats()
        assert stats["l0"]["total_hits"] >= 1


class TestFactExtractionWorkflow:
    """Test fact extraction workflow."""

    @pytest.mark.asyncio
    async def test_extract_facts_from_content(self):
        """Test extracting facts from content."""
        from agents_mem.knowledge.facts import FactExtractor
        from tests.conftest import MockLLMClient

        extractor = FactExtractor(MockLLMClient())

        content_text = "用户偏好使用 Python 进行数据分析，并决定采用异步架构处理大规模数据。"

        facts = await extractor.extract(content_text)

        assert isinstance(facts, list)
        for fact in facts:
            assert fact.content
            assert fact.fact_type in [FactType.PREFERENCE, FactType.DECISION, 
                                       FactType.OBSERVATION, FactType.CONCLUSION]


class TestURISystemIntegration:
    """Test URI system integration."""

    def test_uri_build_and_parse_cycle(self, test_scope):
        """Test URI build and parse cycle."""
        uri = URISystem.build(test_scope, "document", "doc-001")

        parsed = URISystem.parse(uri)

        assert parsed.user_id == test_scope.user_id
        assert parsed.resource_type == "document"
        assert parsed.resource_id == "doc-001"

    def test_uri_validation(self, test_scope):
        """Test URI validation."""
        valid_uri = URISystem.build(test_scope, "document", "doc-001")
        invalid_uri = "invalid://format"

        assert URISystem.validate(valid_uri) is True
        assert URISystem.validate(invalid_uri) is False


class TestCrossLayerWorkflow:
    """Test workflows that span multiple layers."""

    @pytest.mark.asyncio
    async def test_document_to_fact_workflow(self, integration_db, test_scope):
        """Test document to fact extraction workflow."""
        from agents_mem.content.layer import ContentLayer
        from agents_mem.knowledge.layer import KnowledgeLayer
        from agents_mem.llm import MockLLMClient

        # Setup content layer
        content_layer = ContentLayer(db=integration_db, llm_client=MockLLMClient())

        # Create document
        doc = await content_layer.create(
            "document",
            test_scope,
            {"title": "Preferences Doc", "content": "User prefers Python"},
        )

        # Setup knowledge layer (mocked)
        mock_content = MagicMock()
        mock_content.get = AsyncMock(return_value={"content": "User prefers Python"})

        knowledge_layer = KnowledgeLayer(
            content_layer=mock_content,
            db_connection=integration_db,
            llm_client=MockLLMClient(),
        )

        # Extract facts would normally require actual LLM
        # Here we test the layer setup
        assert knowledge_layer._fact_extractor is not None

    @pytest.mark.asyncio
    async def test_full_crud_workflow(self, integration_db, test_scope):
        """Test full CRUD workflow."""
        from agents_mem.content.layer import ContentLayer
        from agents_mem.llm import MockLLMClient

        content_layer = ContentLayer(db=integration_db, llm_client=MockLLMClient())

        # Create
        doc = await content_layer.create(
            "document",
            test_scope,
            {"title": "Workflow Test", "content": "Initial content"},
        )

        # Read
        read_result = await content_layer.get(doc.uri)
        assert read_result is not None

        # Update
        updated = await content_layer.update(doc.uri, {"content": "Updated content"})
        assert updated.body == "Updated content"

        # Delete
        deleted = await content_layer.delete(doc.uri)
        assert deleted is True

        # Verify deletion
        verify = await content_layer.get(doc.uri)
        assert verify is None