"""
Markdown Export Module

Exports memory data to Markdown format for human readability and Git version control.

Architecture:
- L2 Content Layer exports: Documents, Conversations, Tiered Views
- L3 Knowledge Layer exports: Facts, Entities, Traces

Export Directory Structure:
~/.agents_mem/export/{user_id}/
├── README.md                    # Export overview
├── L2-content/                  # Content layer exports
│   ├── documents/
│   │   └── {YYYY-MM}/
│   │       └── {doc-id}.md
│   └── conversations/
│       └── {YYYY-MM}/
│           └── {conv-id}.md
├── L3-knowledge/                # Knowledge layer exports
│   ├── facts/
│   │   ├── {YYYY-MM}/
│   │   │   └── {fact-id}.md
│   │   └── by-type/
│   │       ├── preferences.md
│   │       ├── decisions.md
│   │       └── observations.md
│   ├── entities/
│   │   └── entity-graph.md
│   └── traces/
│       └── {trace-id}.md
└── metadata.json                # Export metadata
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Literal, Optional

from jinja2 import Environment, PackageLoader
from pydantic import BaseModel, Field

from agents_mem.core.types import Scope


# ============================================================================
# Export Types
# ============================================================================

ExportLayer = Literal["L2", "L3", "all"]


class ExportResult(BaseModel):
    """Export result model"""

    status: str = "ok"
    export_path: str
    L2_content: dict[str, int] = {}
    L3_knowledge: dict[str, int] = {}
    exported_at: datetime = Field(default_factory=datetime.now)
    total_files: int = 0
    total_tokens: int = 0
    errors: list[str] = []


# ============================================================================
# MarkdownExporter Main Class
# ============================================================================


class MarkdownExporter:
    """
    Markdown Exporter

    Exports 4-layer architecture data to Markdown format.

    Features:
    - L2 Content exports with embedded L0/L1/L2 tiered views
    - L3 Knowledge exports (Facts, Entities, Traces)
    - Jinja2 template-based rendering
    - Git-friendly structure (monthly directories)
    - Cross-linking between exported content

    Usage:
        exporter = MarkdownExporter(
            identity_layer, index_layer, content_layer, knowledge_layer
        )
        result = await exporter.export_all(scope)
    """

    def __init__(
        self,
        identity_layer: Any,
        index_layer: Any,
        content_layer: Any,
        knowledge_layer: Any,
        export_dir: Path | str | None = None,
    ):
        """
        Initialize Markdown Exporter

        Args:
            identity_layer: L0 Identity Layer for scope validation
            index_layer: L1 Index Layer for metadata queries
            content_layer: L2 Content Layer for content retrieval
            knowledge_layer: L3 Knowledge Layer for facts/entities
            export_dir: Custom export directory (default: ~/.agents_mem/export)
        """
        self.L0 = identity_layer
        self.L1 = index_layer
        self.L2 = content_layer
        self.L3 = knowledge_layer

        # Set export directory
        if export_dir is None:
            self._export_dir = Path.home() / ".agents_mem" / "export"
        elif isinstance(export_dir, str):
            self._export_dir = Path(export_dir)
        else:
            self._export_dir = export_dir

        # Initialize Jinja2 environment
        self._jinja_env = Environment(
            loader=PackageLoader("agents_mem.export", "templates"),
            autoescape=False,
            trim_blocks=True,
            lstrip_blocks=True,
        )

        # Add custom filters
        self._jinja_env.filters["datetime_format"] = self._datetime_format
        self._jinja_env.filters["relative_path"] = self._relative_path

    @property
    def export_dir(self) -> Path:
        """Get export directory"""
        return self._export_dir

    def _datetime_format(self, value: datetime | None, format_str: str = "%Y-%m-%d %H:%M UTC") -> str:
        """Format datetime for display"""
        if value is None:
            return "N/A"
        return value.strftime(format_str)

    def _relative_path(self, from_path: str, to_path: str) -> str:
        """Calculate relative path between two paths"""
        try:
            from pathlib import PurePath
            return str(PurePath(from_path).relative_to(PurePath(to_path)))
        except Exception:
            return to_path

    # =========================================================================
    # L2 Content Layer Export
    # =========================================================================

    async def export_layer_2(
        self,
        scope: Scope,
        content_type: Optional[str] = None,
        include_tiered: bool = True,
    ) -> dict[str, Any]:
        """
        Export L2 Content Layer

        Exports documents and conversations with optional tiered views (L0/L1/L2).

        Args:
            scope: Export scope (user_id required)
            content_type: Filter by content type ("document", "conversation", None=all)
            include_tiered: Include L0/L1 tiered views in export

        Returns:
            Export statistics dict with counts
        """
        # Validate scope
        self.L0.validate_scope_or_raise(scope)

        # Create export directory
        user_export_dir = self._export_dir / scope.user_id / "L2-content"
        user_export_dir.mkdir(parents=True, exist_ok=True)

        stats: dict[str, int] = {
            "documents": 0,
            "conversations": 0,
            "tiered_views_generated": 0,
        }

        # Export documents
        if content_type is None or content_type == "document":
            doc_count = await self._export_documents(scope, user_export_dir, include_tiered)
            stats["documents"] = doc_count
            if include_tiered:
                stats["tiered_views_generated"] += doc_count

        # Export conversations
        if content_type is None or content_type == "conversation":
            conv_count = await self._export_conversations(scope, user_export_dir, include_tiered)
            stats["conversations"] = conv_count

        return stats

    async def _export_documents(
        self,
        scope: Scope,
        export_dir: Path,
        include_tiered: bool,
    ) -> int:
        """Export documents with tiered views"""
        documents_dir = export_dir / "documents"
        documents_dir.mkdir(parents=True, exist_ok=True)

        # List documents from content layer
        contents = await self.L2.list(scope, resource_type="document", limit=1000)

        count = 0
        for content in contents:
            # Determine month directory
            month_dir = documents_dir / content.created_at.strftime("%Y-%m")
            month_dir.mkdir(parents=True, exist_ok=True)

            # Get tiered views if requested
            l0_view: str | None = None
            l1_view: str | None = None

            if include_tiered and hasattr(self.L2, "get_tiered_view"):
                try:
                    l0_view = await self.L2.get_tiered_view(content, "L0")
                    l1_view = await self.L2.get_tiered_view(content, "L1")
                except Exception:
                    pass

            # Get related facts from L3
            related_facts: list[dict[str, Any]] = []
            if hasattr(self.L3, "get_facts_by_content"):
                try:
                    facts = await self.L3.get_facts_by_content(content.uri)
                    related_facts = [
                        {
                            "id": f.id,
                            "content": f.content[:100] + "..." if len(f.content) > 100 else f.content,
                            "fact_type": f.fact_type.value,
                            "confidence": f.confidence,
                        }
                        for f in facts[:5]  # Limit to 5 facts
                    ]
                except Exception:
                    pass

            # Render template
            template = self._jinja_env.get_template("content.md.j2")
            md_content = template.render(
                content=content,
                l0_view=l0_view,
                l1_view=l1_view,
                l2_view=content.body,
                related_facts=related_facts,
                layer="L2",
                scope=scope,
            )

            # Write file
            file_path = month_dir / f"{content.id}.md"
            file_path.write_text(md_content, encoding="utf-8")
            count += 1

        return count

    async def _export_conversations(
        self,
        scope: Scope,
        export_dir: Path,
        include_tiered: bool,
    ) -> int:
        """Export conversations with messages"""
        if not scope.agent_id:
            # Conversations require agent_id
            return 0

        conversations_dir = export_dir / "conversations"
        conversations_dir.mkdir(parents=True, exist_ok=True)

        # List conversations
        contents = await self.L2.list(scope, resource_type="conversation", limit=1000)

        count = 0
        for content in contents:
            # Determine month directory
            month_dir = conversations_dir / content.created_at.strftime("%Y-%m")
            month_dir.mkdir(parents=True, exist_ok=True)

            # Get messages
            messages: list[Any] = []
            if hasattr(self.L2, "get_messages"):
                try:
                    messages = await self.L2.get_messages(content.uri, limit=100)
                except Exception:
                    pass

            # Render template (reuse content template)
            template = self._jinja_env.get_template("content.md.j2")
            md_content = template.render(
                content=content,
                l0_view=None,
                l1_view=None,
                l2_view=content.body,
                messages=messages,
                related_facts=[],
                layer="L2",
                scope=scope,
            )

            # Write file
            file_path = month_dir / f"{content.id}.md"
            file_path.write_text(md_content, encoding="utf-8")
            count += 1

        return count

    # =========================================================================
    # L3 Knowledge Layer Export
    # =========================================================================

    async def export_layer_3(
        self,
        scope: Scope,
        fact_type: Optional[str] = None,
        include_entities: bool = True,
    ) -> dict[str, Any]:
        """
        Export L3 Knowledge Layer

        Exports facts, entity graph, and trace chains.

        Args:
            scope: Export scope
            fact_type: Filter by fact type ("preference", "decision", "observation", None=all)
            include_entities: Include entity graph export

        Returns:
            Export statistics dict
        """
        # Validate scope
        self.L0.validate_scope_or_raise(scope)

        # Create export directory
        user_export_dir = self._export_dir / scope.user_id / "L3-knowledge"
        user_export_dir.mkdir(parents=True, exist_ok=True)

        stats: dict[str, int] = {
            "facts": 0,
            "entities": 0,
            "traces": 0,
        }

        # Export facts
        fact_count = await self._export_facts(scope, user_export_dir, fact_type)
        stats["facts"] = fact_count

        # Export facts by type (aggregated view)
        await self._export_facts_by_type(scope, user_export_dir)

        # Export entity graph
        if include_entities:
            entity_count = await self._export_entity_graph(scope, user_export_dir)
            stats["entities"] = entity_count

        return stats

    async def _export_facts(
        self,
        scope: Scope,
        export_dir: Path,
        fact_type: Optional[str],
    ) -> int:
        """Export individual fact files"""
        facts_dir = export_dir / "facts"
        facts_dir.mkdir(parents=True, exist_ok=True)

        # Get facts from knowledge layer
        from agents_mem.core.types import FactType

        fact_type_enum: FactType | None = None
        if fact_type:
            try:
                fact_type_enum = FactType(fact_type)
            except ValueError:
                pass

        facts = await self.L3.search_facts("", scope, fact_type_enum)

        count = 0
        for fact in facts:
            # Determine month directory
            month_dir = facts_dir / fact.created_at.strftime("%Y-%m")
            month_dir.mkdir(parents=True, exist_ok=True)

            # Build trace chain (optional)
            trace: dict[str, Any] = {}
            if hasattr(self.L3, "trace_fact"):
                try:
                    trace_result = await self.L3.trace_fact(fact.id)
                    trace = {
                        "l0_abstract": trace_result.l0_abstract,
                        "l1_overview": trace_result.l1_overview,
                        "trace_chain": trace_result.trace_chain,
                        "source_uri": fact.source_uri,
                    }
                except Exception:
                    pass

            # Get related facts
            related_facts: list[dict[str, Any]] = []
            # Find facts with same entities
            for entity in fact.entities[:3]:
                entity_facts = await self.L3.search_facts(entity, scope)
                related_facts.extend([
                    {"id": f.id, "content": f.content[:50] + "..."}
                    for f in entity_facts[:2]
                    if f.id != fact.id
                ])

            # Render template
            template = self._jinja_env.get_template("fact.md.j2")
            md_content = template.render(
                fact=fact,
                trace=trace,
                related_facts=related_facts,
                layer="L3",
                scope=scope,
            )

            # Write file
            file_path = month_dir / f"{fact.id}.md"
            file_path.write_text(md_content, encoding="utf-8")
            count += 1

        return count

    async def _export_facts_by_type(
        self,
        scope: Scope,
        export_dir: Path,
    ) -> None:
        """Export aggregated facts by type"""
        by_type_dir = export_dir / "facts" / "by-type"
        by_type_dir.mkdir(parents=True, exist_ok=True)

        from agents_mem.core.types import FactType

        # Export each fact type
        for ft in [FactType.PREFERENCE, FactType.DECISION, FactType.OBSERVATION, FactType.CONCLUSION]:
            facts = await self.L3.search_facts("", scope, ft)

            if not facts:
                continue

            # Render aggregated template
            template = self._jinja_env.get_template("facts_by_type.md.j2")
            md_content = template.render(
                facts=facts,
                fact_type=ft.value,
                layer="L3",
                scope=scope,
            )

            # Write file
            file_path = by_type_dir / f"{ft.value}.md"
            file_path.write_text(md_content, encoding="utf-8")

    async def _export_entity_graph(
        self,
        scope: Scope,
        export_dir: Path,
    ) -> int:
        """Export entity relationship graph"""
        entities_dir = export_dir / "entities"
        entities_dir.mkdir(parents=True, exist_ok=True)

        # Get entity tree
        if hasattr(self.L3, "aggregate_entities"):
            entity_tree = await self.L3.aggregate_entities(scope)
        elif hasattr(self.L3, "get_entity_tree"):
            entity_tree = await self.L3.get_entity_tree(scope)
        else:
            return 0

        if not entity_tree or not entity_tree.nodes:
            return 0

        # Build entity data for template
        entities: list[dict[str, Any]] = []
        for _node_id, node in entity_tree.nodes.items():
            entities.append({
                "id": node.id,
                "name": node.name,
                "type": node.entity_type,
                "fact_count": node.fact_count,
                "importance": node.importance,
                "depth": node.depth,
                "parent_id": node.parent_id,
                "children": node.children,
                "attributes": {},
            })

        # Build mermaid graph
        mermaid_graph = self._build_mermaid_graph(entity_tree)

        # Render template
        template = self._jinja_env.get_template("entities.md.j2")
        md_content = template.render(
            entities=entities,
            entity_tree=entity_tree,
            mermaid_graph=mermaid_graph,
            layer="L3",
            scope=scope,
        )

        # Write file
        file_path = entities_dir / "entity-graph.md"
        file_path.write_text(md_content, encoding="utf-8")

        return len(entities)

    def _build_mermaid_graph(self, entity_tree: Any) -> str:
        """Build Mermaid flowchart from entity tree"""
        lines = ["```mermaid", "flowchart TD"]

        # Add nodes
        for node_id, node in entity_tree.nodes.items():
            label = node.name.replace('"', "'")
            node_type = node.entity_type
            # Escape special characters for Mermaid
            safe_id = node_id.replace("-", "_")
            lines.append(f"    {safe_id}[\"{label}<br/><small>{node_type}</small>\"]")

        # Add relationships
        for node_id, node in entity_tree.nodes.items():
            safe_id = node_id.replace("-", "_")
            if node.parent_id:
                safe_parent = node.parent_id.replace("-", "_")
                lines.append(f"    {safe_parent} --> {safe_id}")

        # Add child relationships
        for node_id, node in entity_tree.nodes.items():
            safe_id = node_id.replace("-", "_")
            for child_id in node.children:
                safe_child = child_id.replace("-", "_")
                lines.append(f"    {safe_id} --> {safe_child}")

        lines.append("```")
        return "\n".join(lines)

    # =========================================================================
    # Full Export
    # =========================================================================

    async def export_all(
        self,
        scope: Scope,
    ) -> dict[str, Any]:
        """
        Export all layers (L2 + L3)

        Complete export including:
        - L2 Content (documents, conversations, tiered views)
        - L3 Knowledge (facts, entities, traces)
        - README overview
        - metadata.json

        Args:
            scope: Export scope

        Returns:
            Complete export result with statistics
        """
        # Validate scope
        self.L0.validate_scope_or_raise(scope)

        # Create user export directory
        user_export_dir = self._export_dir / scope.user_id
        user_export_dir.mkdir(parents=True, exist_ok=True)

        # Export L2 Content
        l2_stats = await self.export_layer_2(scope, include_tiered=True)

        # Export L3 Knowledge
        l3_stats = await self.export_layer_3(scope, include_entities=True)

        # Generate README
        await self._export_readme(scope, user_export_dir, l2_stats, l3_stats)

        # Generate metadata.json
        await self._export_metadata(scope, user_export_dir, l2_stats, l3_stats)

        # Calculate totals
        total_files = (
            l2_stats.get("documents", 0)
            + l2_stats.get("conversations", 0)
            + l3_stats.get("facts", 0)
            + (1 if l3_stats.get("entities", 0) > 0 else 0)
            + 2  # README + metadata.json
        )

        return {
            "status": "ok",
            "export_path": str(user_export_dir),
            "L2_content": l2_stats,
            "L3_knowledge": l3_stats,
            "total_files": total_files,
            "exported_at": datetime.now().isoformat(),
        }

    async def _export_readme(
        self,
        scope: Scope,
        export_dir: Path,
        l2_stats: dict[str, int],
        l3_stats: dict[str, int],
    ) -> None:
        """Generate README.md overview"""
        template = self._jinja_env.get_template("README.md.j2")

        # Get statistics from L3
        knowledge_stats: dict[str, Any] = {}
        if hasattr(self.L3, "get_statistics"):
            try:
                knowledge_stats = await self.L3.get_statistics(scope)
            except Exception:
                pass

        md_content = template.render(
            scope=scope,
            l2_stats=l2_stats,
            l3_stats=l3_stats,
            knowledge_stats=knowledge_stats,
            exported_at=datetime.now(),
        )

        file_path = export_dir / "README.md"
        file_path.write_text(md_content, encoding="utf-8")

    async def _export_metadata(
        self,
        scope: Scope,
        export_dir: Path,
        l2_stats: dict[str, int],
        l3_stats: dict[str, int],
    ) -> None:
        """Generate metadata.json"""
        metadata = {
            "version": "2.0",
            "exported_at": datetime.now().isoformat(),
            "scope": {
                "user_id": scope.user_id,
                "agent_id": scope.agent_id,
                "team_id": scope.team_id,
                "is_global": scope.is_global,
            },
            "L2_content": l2_stats,
            "L3_knowledge": l3_stats,
            "export_structure": {
                "L2-content": ["documents", "conversations"],
                "L3-knowledge": ["facts", "entities"],
            },
        }

        file_path = export_dir / "metadata.json"
        file_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")


# ============================================================================
# Module exports
# ============================================================================

__all__ = [
    "MarkdownExporter",
    "ExportLayer",
    "ExportResult",
]