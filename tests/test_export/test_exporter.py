"""
Tests for Markdown Export Module

Tests the export functionality:
- MarkdownExporter initialization
- Template rendering
- Export directory structure
"""

import tempfile
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agents_mem.core.types import Scope, ContentType, FactType, EntityType, Fact, Content
from agents_mem.export.exporter import MarkdownExporter, ExportResult


# ============================================================================
# Mock Layers
# ============================================================================


class MockIdentityLayer:
    """Mock L0 Identity Layer"""

    def validate_scope_or_raise(self, scope: Scope) -> None:
        if not scope.user_id:
            raise ValueError("user_id required")


class MockIndexLayer:
    """Mock L1 Index Layer"""

    async def list_by_scope(self, scope: Scope, target_type: str | None = None) -> list:
        return []


class MockContentLayer:
    """Mock L2 Content Layer"""

    async def list(self, scope: Scope, resource_type: str | None = None, limit: int = 100) -> list[Content]:
        return [
            Content(
                id="doc-001",
                uri=f"mem://{scope.user_id}/_/_/documents/doc-001",
                title="Test Document",
                body="This is the full content of the test document.",
                content_type=ContentType.NOTE,
                user_id=scope.user_id,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            ),
        ]

    async def get_tiered_view(self, content: Content, tier: str) -> str:
        if tier == "L0":
            return "Quick summary: This is a test document."
        elif tier == "L1":
            return "Detailed overview: This document contains test content for export functionality."
        return ""

    async def get_messages(self, uri: str, limit: int = 100) -> list:
        return []


class MockKnowledgeLayer:
    """Mock L3 Knowledge Layer"""

    async def search_facts(self, query: str, scope: Scope, fact_type: FactType | None = None) -> list[Fact]:
        return [
            Fact(
                id="fact-001",
                content="User prefers vegetarian food",
                fact_type=FactType.PREFERENCE,
                user_id=scope.user_id,
                source_uri=f"mem://{scope.user_id}/_/_/documents/doc-001",
                confidence=0.95,
                entities=["vegetarian", "food"],
                created_at=datetime.now(),
            ),
        ]

    async def get_facts_by_content(self, uri: str) -> list[Fact]:
        return []

    async def trace_fact(self, fact_id: str) -> dict:
        return {
            "l0_abstract": "Quick summary",
            "l1_overview": "Detailed overview",
            "trace_chain": ["mem://user123/_/_/facts/fact-001", "mem://user123/_/_/documents/doc-001"],
            "source_uri": "mem://user123/_/_/documents/doc-001",
        }

    async def aggregate_entities(self, scope: Scope) -> MagicMock:
        tree = MagicMock()
        tree.nodes = {}
        tree.total_entities = 0
        tree.total_facts = 0
        tree.max_depth = 0
        tree.threshold_base = 0.7
        return tree

    async def get_statistics(self, scope: Scope) -> dict:
        return {
            "total_facts": 1,
            "average_confidence": 0.95,
            "facts_by_type": {"preference": 1},
        }


# ============================================================================
# Test Cases
# ============================================================================


@pytest.fixture
def mock_layers():
    """Create mock layers for testing"""
    return {
        "identity": MockIdentityLayer(),
        "index": MockIndexLayer(),
        "content": MockContentLayer(),
        "knowledge": MockKnowledgeLayer(),
    }


@pytest.fixture
def test_scope():
    """Create test scope"""
    return Scope(user_id="test-user-001")


@pytest.fixture
def temp_export_dir():
    """Create temporary export directory"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


def test_exporter_init(mock_layers, temp_export_dir):
    """Test MarkdownExporter initialization"""
    exporter = MarkdownExporter(
        identity_layer=mock_layers["identity"],
        index_layer=mock_layers["index"],
        content_layer=mock_layers["content"],
        knowledge_layer=mock_layers["knowledge"],
        export_dir=temp_export_dir,
    )

    assert exporter.L0 == mock_layers["identity"]
    assert exporter.L1 == mock_layers["index"]
    assert exporter.L2 == mock_layers["content"]
    assert exporter.L3 == mock_layers["knowledge"]
    assert exporter.export_dir == temp_export_dir


def test_export_result_model():
    """Test ExportResult model"""
    result = ExportResult(
        status="ok",
        export_path="/test/path",
        L2_content={"documents": 1},
        L3_knowledge={"facts": 2},
        total_files=5,
    )

    assert result.status == "ok"
    assert result.export_path == "/test/path"
    assert result.L2_content["documents"] == 1
    assert result.L3_knowledge["facts"] == 2


@pytest.mark.asyncio
async def test_export_layer_2_documents(mock_layers, test_scope, temp_export_dir):
    """Test L2 Content Layer export for documents"""
    exporter = MarkdownExporter(
        identity_layer=mock_layers["identity"],
        index_layer=mock_layers["index"],
        content_layer=mock_layers["content"],
        knowledge_layer=mock_layers["knowledge"],
        export_dir=temp_export_dir,
    )

    stats = await exporter.export_layer_2(test_scope, content_type="document", include_tiered=True)

    assert stats["documents"] >= 0
    # Check directory structure
    l2_dir = temp_export_dir / test_scope.user_id / "L2-content"
    assert l2_dir.exists()


@pytest.mark.asyncio
async def test_export_layer_3_facts(mock_layers, test_scope, temp_export_dir):
    """Test L3 Knowledge Layer export for facts"""
    exporter = MarkdownExporter(
        identity_layer=mock_layers["identity"],
        index_layer=mock_layers["index"],
        content_layer=mock_layers["content"],
        knowledge_layer=mock_layers["knowledge"],
        export_dir=temp_export_dir,
    )

    stats = await exporter.export_layer_3(test_scope, fact_type=None, include_entities=False)

    assert stats["facts"] >= 0
    # Check directory structure
    l3_dir = temp_export_dir / test_scope.user_id / "L3-knowledge"
    assert l3_dir.exists()


@pytest.mark.asyncio
async def test_export_all(mock_layers, test_scope, temp_export_dir):
    """Test full export (L2 + L3)"""
    exporter = MarkdownExporter(
        identity_layer=mock_layers["identity"],
        index_layer=mock_layers["index"],
        content_layer=mock_layers["content"],
        knowledge_layer=mock_layers["knowledge"],
        export_dir=temp_export_dir,
    )

    result = await exporter.export_all(test_scope)

    assert result["status"] == "ok"
    assert Path(result["export_path"]).exists()

    # Check README exists
    readme = Path(result["export_path"]) / "README.md"
    assert readme.exists()

    # Check metadata.json exists
    metadata = Path(result["export_path"]) / "metadata.json"
    assert metadata.exists()


def test_datetime_format_filter(mock_layers, temp_export_dir):
    """Test custom datetime format filter"""
    exporter = MarkdownExporter(
        identity_layer=mock_layers["identity"],
        index_layer=mock_layers["index"],
        content_layer=mock_layers["content"],
        knowledge_layer=mock_layers["knowledge"],
        export_dir=temp_export_dir,
    )

    dt = datetime(2025, 4, 15, 10, 30, 0)
    formatted = exporter._datetime_format(dt)
    assert "2025-04-15" in formatted


def test_build_mermaid_graph(mock_layers, temp_export_dir):
    """Test Mermaid graph generation"""
    exporter = MarkdownExporter(
        identity_layer=mock_layers["identity"],
        index_layer=mock_layers["index"],
        content_layer=mock_layers["content"],
        knowledge_layer=mock_layers["knowledge"],
        export_dir=temp_export_dir,
    )

    # Create mock entity tree
    tree = MagicMock()
    node1 = MagicMock()
    node1.id = "entity-1"
    node1.name = "User"
    node1.entity_type = "person"
    node1.parent_id = None
    node1.children = ["entity-2"]

    node2 = MagicMock()
    node2.id = "entity-2"
    node2.name = "Project"
    node2.entity_type = "concept"
    node2.parent_id = "entity-1"
    node2.children = []

    tree.nodes = {"entity-1": node1, "entity-2": node2}

    mermaid = exporter._build_mermaid_graph(tree)

    assert "```mermaid" in mermaid
    assert "flowchart TD" in mermaid
    assert "```" in mermaid


def test_scope_validation(mock_layers, temp_export_dir):
    """Test scope validation"""
    exporter = MarkdownExporter(
        identity_layer=mock_layers["identity"],
        index_layer=mock_layers["index"],
        content_layer=mock_layers["content"],
        knowledge_layer=mock_layers["knowledge"],
        export_dir=temp_export_dir,
    )

    # Valid scope
    valid_scope = Scope(user_id="valid-user")
    exporter.L0.validate_scope_or_raise(valid_scope)  # Should not raise

    # Invalid scope (empty user_id)
    with pytest.raises(Exception):
        exporter.L0.validate_scope_or_raise(Scope(user_id=""))


# ============================================================================
# Template Tests
# ============================================================================


def test_content_template_rendering(mock_layers, temp_export_dir):
    """Test content.md.j2 template rendering"""
    exporter = MarkdownExporter(
        identity_layer=mock_layers["identity"],
        index_layer=mock_layers["index"],
        content_layer=mock_layers["content"],
        knowledge_layer=mock_layers["knowledge"],
        export_dir=temp_export_dir,
    )

    content = Content(
        id="test-doc",
        uri="mem://test/_/_/documents/test-doc",
        title="Test Title",
        body="Test content body",
        content_type=ContentType.NOTE,
        user_id="test",
        created_at=datetime.now(),
    )

    template = exporter._jinja_env.get_template("content.md.j2")
    rendered = template.render(
        content=content,
        l0_view="Quick summary",
        l1_view="Detailed overview",
        l2_view=content.body,
        related_facts=[],
        layer="L2",
        scope=Scope(user_id="test"),
    )

    assert content.id in rendered
    assert content.title in rendered
    assert "L0 快速摘要" in rendered


def test_fact_template_rendering(mock_layers, temp_export_dir):
    """Test fact.md.j2 template rendering"""
    exporter = MarkdownExporter(
        identity_layer=mock_layers["identity"],
        index_layer=mock_layers["index"],
        content_layer=mock_layers["content"],
        knowledge_layer=mock_layers["knowledge"],
        export_dir=temp_export_dir,
    )

    fact = Fact(
        id="fact-test",
        content="Test fact content",
        fact_type=FactType.PREFERENCE,
        user_id="test",
        confidence=0.95,
        entities=["entity1"],
        created_at=datetime.now(),
    )

    template = exporter._jinja_env.get_template("fact.md.j2")
    rendered = template.render(
        fact=fact,
        trace={"source_uri": "mem://test/_/_/documents/doc-1"},
        related_facts=[],
        layer="L3",
        scope=Scope(user_id="test"),
    )

    assert fact.id in rendered
    assert "preference" in rendered
    assert "置信度" in rendered


def test_entities_template_rendering(mock_layers, temp_export_dir):
    """Test entities.md.j2 template rendering"""
    exporter = MarkdownExporter(
        identity_layer=mock_layers["identity"],
        index_layer=mock_layers["index"],
        content_layer=mock_layers["content"],
        knowledge_layer=mock_layers["knowledge"],
        export_dir=temp_export_dir,
    )

    entities = [
        {"id": "e1", "name": "User", "type": "person", "fact_count": 5, "importance": 0.9, "depth": 0, "children": []},
    ]

    template = exporter._jinja_env.get_template("entities.md.j2")
    rendered = template.render(
        entities=entities,
        entity_tree=MagicMock(total_entities=1, total_facts=5, max_depth=0, threshold_base=0.7),
        mermaid_graph="```mermaid\nflowchart TD\n```",
        layer="L3",
        scope=Scope(user_id="test"),
        exported_at=datetime.now(),
    )

    assert "实体关联图谱" in rendered
    assert "User" in rendered