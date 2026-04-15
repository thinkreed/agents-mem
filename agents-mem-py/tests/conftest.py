"""
pytest configuration and shared fixtures for agents-mem-py tests.

Provides:
- event_loop fixture (async)
- db_connection fixture (in-memory SQLite)
- mock_openviking fixture
- mock_llm fixture
- Layer fixtures (identity_layer, index_layer, content_layer, knowledge_layer)
"""

import asyncio
import json
import sqlite3
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio

# ============================================================================
# Event Loop Configuration
# ============================================================================


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


# ============================================================================
# Mock Classes
# ============================================================================


class MockCursor:
    """Mock SQLite cursor with rowcount."""
    rowcount = 1


class MockDBConnection:
    """Mock database connection for testing."""
    
    _data: dict[str, dict] = {}
    _tables: dict[str, list[dict]] = {}
    
    def __init__(self):
        self._data = {}
        self._tables = {}
    
    async def connect(self) -> None:
        """Connect to database."""
        pass
    
    async def close(self) -> None:
        """Close connection."""
        pass
    
    def is_open(self) -> bool:
        """Check if open."""
        return True
    
    async def exec(self, sql: str) -> None:
        """Execute SQL script."""
        pass
    
    async def run(self, sql: str, params: list[Any] | None = None) -> MockCursor:
        """Run SQL with parameters."""
        params = params or []
        table = self._extract_table(sql)
        
        if "INSERT" in sql.upper() and params:
            if table not in self._tables:
                self._tables[table] = []
            row = self._params_to_row(sql, params)
            self._tables[table].append(row)
            self._data[params[0] if params else str(len(self._tables[table]))] = row
        
        elif "DELETE" in sql.upper() and params:
            if table and table in self._tables:
                # Remove matching rows
                id_param = params[0] if params else None
                self._tables[table] = [
                    r for r in self._tables[table]
                    if r.get('id') != id_param
                ]
                if id_param in self._data:
                    del self._data[id_param]
        
        elif "UPDATE" in sql.upper() and params:
            if table and table in self._tables:
                id_param = params[-1] if len(params) > 0 else None
                for row in self._tables[table]:
                    if row.get('id') == id_param:
                        # Apply updates
                        self._apply_updates(sql, row, params)
        
        return MockCursor()
    
    async def query(self, sql: str, params: list[Any] | None = None) -> list[dict]:
        """Query and return all rows."""
        params = params or []
        table = self._extract_table(sql)
        
        if table and table in self._tables:
            results = self._tables[table]
            
            # Apply WHERE filters
            if "WHERE" in sql.upper():
                results = self._apply_where(sql, results, params)
            
            return results
        
        return []
    
    async def query_one(self, sql: str, params: list[Any] | None = None) -> dict | None:
        """Query and return single row."""
        results = await self.query(sql, params)
        return results[0] if results else None
    
    async def transaction(self) -> "MockTransaction":
        """Start transaction."""
        return MockTransaction(self)
    
    def _extract_table(self, sql: str) -> str | None:
        """Extract table name from SQL."""
        sql_upper = sql.upper()
        for keyword in ["INSERT INTO", "UPDATE", "DELETE FROM", "FROM"]:
            if keyword in sql_upper:
                start = sql_upper.find(keyword) + len(keyword)
                rest = sql[start:].strip()
                # Extract first word (table name)
                table = rest.split()[0] if rest.split() else None
                return table
        return None
    
    def _params_to_row(self, sql: str, params: list[Any]) -> dict:
        """Convert params to row dict."""
        # Extract column names from INSERT statement
        if "(" in sql and ")" in sql:
            cols_part = sql.split("(")[1].split(")")[0]
            cols = [c.strip() for c in cols_part.split(",")]
            row = {}
            for i, col in enumerate(cols):
                if i < len(params):
                    row[col] = params[i]
            return row
        return {"id": params[0] if params else ""}
    
    def _apply_where(self, sql: str, results: list[dict], params: list[Any]) -> list[dict]:
        """Apply WHERE filter to results."""
        filtered = []
        for row in results:
            match = True
            # Simple filtering based on params
            if "user_id" in sql.lower() and params:
                if row.get('user_id') != params[0] if params else None:
                    match = False
            if match:
                filtered.append(row)
        return filtered
    
    def _apply_updates(self, sql: str, row: dict, params: list[Any]) -> None:
        """Apply updates to row."""
        # Extract SET clause columns
        if "SET" in sql.upper():
            set_part = sql.upper().split("SET")[1].split("WHERE")[0]
            cols = [c.strip().split("=")[0] for c in set_part.split(",")]
            for i, col in enumerate(cols):
                if i < len(params) - 1:  # Last param is id
                    row[col.lower()] = params[i]


class MockTransaction:
    """Mock transaction context manager."""
    
    def __init__(self, db: MockDBConnection):
        self._db = db
    
    async def __aenter__(self) -> "MockTransaction":
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        pass
    
    async def exec(self, sql: str) -> None:
        pass
    
    async def run(self, sql: str, params: list[Any] | None = None) -> None:
        await self._db.run(sql, params)


class MockLLMClient:
    """Mock LLM client for testing."""
    
    async def generate(
        self,
        prompt: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> str:
        """Generate mock text response."""
        if "摘要" in prompt or "abstract" in prompt.lower():
            return "这是一个简短的摘要。"
        elif "概览" in prompt or "overview" in prompt.lower():
            return "这是一个详细的概览，包含主要内容和关键信息。"
        elif "fact" in prompt.lower():
            return json.dumps([
                {"content": "用户偏好使用 Python", "fact_type": "preference", "entities": ["Python"], "confidence": 0.9},
                {"content": "决定采用异步架构", "fact_type": "decision", "entities": ["异步架构"], "confidence": 0.85},
            ])
        return f"[Mock Response] {prompt[:100]}"
    
    async def generate_json(self, prompt: str, default: list) -> list:
        """Generate mock JSON response."""
        text = await self.generate(prompt)
        try:
            return json.loads(text.strip())
        except json.JSONDecodeError:
            return default
    
    async def generate_stream(
        self,
        prompt: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> Any:
        """Generate mock stream."""
        result = await self.generate(prompt, max_tokens, temperature, **kwargs)
        for char in result:
            yield char
    
    def count_tokens(self, text: str) -> int:
        """Count tokens (simple estimation)."""
        return len(text) // 4


class MockOpenVikingClient:
    """Mock OpenViking client for testing."""
    
    async def search(self, query: str, target_uri: str, limit: int = 10) -> list[dict]:
        """Mock search."""
        return [
            {"uri": "viking://test/1", "score": 0.9, "abstract": "摘要1"},
            {"uri": "viking://test/2", "score": 0.8, "abstract": "摘要2"},
        ]
    
    async def index(
        self,
        uri: str,
        embedding: list[float],
        metadata: dict | None = None,
        content: str | None = None,
    ) -> dict:
        """Mock index."""
        return {"root_uri": uri, "task_id": "task-123", "status": "pending"}
    
    async def delete(self, uri: str) -> bool:
        """Mock delete."""
        return True
    
    async def get_abstract(self, uri: str) -> str:
        """Mock get abstract."""
        return "L0 摘要内容"
    
    async def get_overview(self, uri: str) -> str:
        """Mock get overview."""
        return "L1 概览内容"
    
    async def health_check(self) -> tuple[bool, str]:
        """Mock health check."""
        return True, "OK"


# ============================================================================
# Database Fixtures
# ============================================================================


@pytest_asyncio.fixture
async def db_connection():
    """Create in-memory SQLite connection for testing."""
    import aiosqlite
    
    # Use in-memory database
    db = await aiosqlite.connect(":memory:")
    
    # Enable foreign keys
    await db.execute("PRAGMA foreign_keys = ON")
    
    # Create schema
    from agents_mem.sqlite.schema import get_schema_statements
    for stmt in get_schema_statements():
        if stmt.strip():
            await db.executescript(stmt)
    
    # Set row factory
    db.row_factory = aiosqlite.Row
    
    yield db
    
    await db.close()


@pytest_asyncio.fixture
async def mock_db():
    """Create mock database connection."""
    return MockDBConnection()


# ============================================================================
# Client Fixtures
# ============================================================================


@pytest.fixture
def mock_llm():
    """Create mock LLM client."""
    return MockLLMClient()


@pytest.fixture
def mock_openviking():
    """Create mock OpenViking client."""
    return MockOpenVikingClient()


# ============================================================================
# Layer Fixtures
# ============================================================================


@pytest.fixture
def identity_layer():
    """Create IdentityLayer instance."""
    from agents_mem.identity.layer import IdentityLayer
    return IdentityLayer()


@pytest_asyncio.fixture
async def index_layer(db_connection, identity_layer, mock_openviking):
    """Create IndexLayer instance."""
    from agents_mem.index.layer import IndexLayer
    
    class MockOVClient:
        async def search(self, query, target_uri, limit=10):
            return []
        async def index(self, uri, embedding, metadata=None, content=None):
            return {"task_id": "task-1"}
        async def delete(self, uri):
            return True
    
    return IndexLayer(
        identity_layer=identity_layer,
        db=db_connection,
        openviking_client=MockOVClient(),
    )


@pytest_asyncio.fixture
async def content_layer(db_connection, mock_llm):
    """Create ContentLayer instance."""
    from agents_mem.content.layer import ContentLayer
    return ContentLayer(db=db_connection, llm_client=mock_llm)


@pytest_asyncio.fixture
async def knowledge_layer(mock_db, mock_llm, mock_openviking):
    """Create KnowledgeLayer instance."""
    from agents_mem.knowledge.layer import KnowledgeLayer
    from agents_mem.content.layer import ContentLayer
    
    # Create mock content layer
    class MockContentLayer:
        async def get(self, uri: str) -> dict:
            return {"content": "测试内容", "body": "正文内容"}
        
        async def get_by_id(self, id: str) -> dict:
            return {"content": "测试内容"}
        
        async def get_tiered(self, id: str, tier: str) -> dict:
            if tier == "L0":
                return {"abstract": "摘要"}
            elif tier == "L1":
                return {"overview": "概览"}
            return {"content": "完整内容"}
    
    return KnowledgeLayer(
        content_layer=MockContentLayer(),
        db_connection=mock_db,
        llm_client=mock_llm,
        openviking_client=mock_openviking,
    )


# ============================================================================
# Scope Fixtures
# ============================================================================


@pytest.fixture
def basic_scope():
    """Create basic Scope with user_id only."""
    from agents_mem.core.types import Scope
    return Scope(user_id="user123")


@pytest.fixture
def agent_scope():
    """Create Scope with user_id and agent_id."""
    from agents_mem.core.types import Scope
    return Scope(user_id="user123", agent_id="agent1")


@pytest.fixture
def full_scope():
    """Create full Scope with all fields."""
    from agents_mem.core.types import Scope
    return Scope(user_id="user123", agent_id="agent1", team_id="team1")


@pytest.fixture
def global_scope():
    """Create global Scope."""
    from agents_mem.core.types import Scope
    return Scope(user_id="user123", is_global=True)


# ============================================================================
# Content Fixtures
# ============================================================================


@pytest.fixture
def sample_content():
    """Create sample Content."""
    from agents_mem.core.types import Content, ContentType
    return Content(
        id="content-001",
        uri="mem://user123/_/_/documents/content-001",
        title="Sample Document",
        body="This is the full content of the sample document with multiple paragraphs and detailed information.",
        content_type=ContentType.NOTE,
        user_id="user123",
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


@pytest.fixture
def sample_fact():
    """Create sample Fact."""
    from agents_mem.core.types import Fact, FactType, EntityType
    return Fact(
        id="fact-001",
        content="User prefers Python for data analysis",
        fact_type=FactType.PREFERENCE,
        user_id="user123",
        source_uri="mem://user123/_/_/documents/doc-001",
        source_type=EntityType.DOCUMENTS,
        source_id="doc-001",
        entities=["Python", "data analysis"],
        importance=0.8,
        confidence=0.9,
        created_at=datetime.now(),
    )


# ============================================================================
# Helper Functions
# ============================================================================


def create_test_document(db, scope, doc_id="doc-001"):
    """Helper to create a test document."""
    import time
    now = int(time.time())
    return db.run(
        """INSERT INTO documents (
            id, user_id, agent_id, team_id, doc_type, title, content, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [doc_id, scope.user_id, scope.agent_id, scope.team_id, "note", "Test Doc", "Test content", now, now],
    )


def create_test_conversation(db, scope, conv_id="conv-001"):
    """Helper to create a test conversation."""
    import time
    now = int(time.time())
    return db.run(
        """INSERT INTO conversations (
            id, user_id, agent_id, team_id, title, source, message_count, started_at, last_message_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [conv_id, scope.user_id, scope.agent_id or "agent1", scope.team_id, "Test Conv", "mcp", 0, now, now],
    )


def create_test_fact(db, scope, fact_id="fact-001"):
    """Helper to create a test fact."""
    import time
    import json
    now = int(time.time())
    return db.run(
        """INSERT INTO facts (
            id, user_id, agent_id, team_id, source_type, source_id, source_uri, 
            content, fact_type, entities, importance, confidence, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [fact_id, scope.user_id, scope.agent_id, scope.team_id, "documents", "doc-001", 
         "mem://user123/_/_/documents/doc-001", "Test fact", "preference", json.dumps(["entity1"]), 
         0.8, 0.9, now, now],
    )


# ============================================================================
# Test Directory Setup
# ============================================================================


@pytest.fixture
def temp_dir():
    """Create temporary directory for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def temp_export_dir(temp_dir):
    """Create temporary export directory."""
    export_dir = temp_dir / "export"
    export_dir.mkdir(parents=True, exist_ok=True)
    return export_dir