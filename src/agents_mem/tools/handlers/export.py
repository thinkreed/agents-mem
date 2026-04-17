"""
mem_export MCP 工具处理器

Markdown 导出
"""

from datetime import datetime
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

from agents_mem.core.types import Scope, FactType
from agents_mem.core.exceptions import AgentMemError, ScopeError, ValidationError
from agents_mem.core.uri import URISystem, Scope as URIScope
from agents_mem.identity.layer import IdentityLayer
from agents_mem.content.layer import ContentLayer
from agents_mem.sqlite.connection import get_connection
from agents_mem.embedder import OllamaEmbedder


def _to_uri_scope(scope: Scope) -> URIScope:
    return URIScope(user_id=scope.user_id, agent_id=scope.agent_id, team_id=scope.team_id)


def get_export_dir() -> Path:
    home = Path.home() / ".agents_mem" / "export"
    home.mkdir(parents=True, exist_ok=True)
    return home


def _parse_scope(scope_data: dict[str, Any]) -> Scope:
    if not scope_data:
        raise ScopeError(message="scope is required", required_fields=["user_id"])
    user_id = scope_data.get("user_id") or scope_data.get("userId")
    if not user_id:
        raise ScopeError(message="user_id is required", required_fields=["user_id"])
    return Scope(
        user_id=user_id,
        agent_id=scope_data.get("agent_id") or scope_data.get("agentId"),
        team_id=scope_data.get("team_id") or scope_data.get("teamId"),
        is_global=scope_data.get("is_global") or scope_data.get("isGlobal") or False,
    )


def _parse_fact_type(fact_type: str | None) -> FactType | None:
    if not fact_type:
        return None
    valid = ["preference", "decision", "observation", "conclusion"]
    return FactType(fact_type) if fact_type in valid else None


def _generate_document_md(doc: dict[str, Any], include_tiered: bool) -> str:
    lines = [
        f"# {doc.get('title', 'Untitled')}",
        "",
        f"**URI**: {doc.get('uri', '')}",
        f"**ID**: {doc.get('id', '')}",
        "",
        "---",
        "",
    ]
    if include_tiered:
        lines.extend([
            "## L0 Abstract",
            "",
            doc.get("l0_abstract", "Not generated"),
            "",
            "## L1 Overview",
            "",
            doc.get("l1_overview", "Not generated"),
            "",
        ])
    lines.extend(["## L2 Content", "", doc.get("body", ""), ""])
    return "\n".join(lines)


def _generate_fact_md(fact: dict[str, Any]) -> str:
    lines = [
        f"# Fact: {fact.get('id', '')}",
        "",
        f"**Type**: {fact.get('fact_type', '')}",
        f"**Confidence**: {fact.get('confidence', 0.5)}",
        "",
        "---",
        "",
        "## Content",
        "",
        fact.get("content", ""),
    ]
    return "\n".join(lines)


def _generate_readme_md(scope: Scope, time: str, stats: dict[str, Any]) -> str:
    return f"""# Export for {scope.user_id}

**Export Time**: {time}

---

## Statistics

- **Documents**: {stats.get('documents', 0)}
- **Facts**: {stats.get('facts', 0)}
"""


def register_export_tool(mcp: FastMCP) -> None:
    """注册 mem_export 工具"""
    
    @mcp.tool()
    async def mem_export(
        scope: dict[str, Any],
        layer: str = "all",
        content_type: str | None = None,
        fact_type: str | None = None,
        include_tiered: bool = False,
        include_entities: bool = False,
    ) -> dict[str, Any]:
        """
        Markdown 导出
        
        Args:
            scope: 作用域
            layer: L2/L3/all
            fact_type: preference/decision/observation/conclusion
            include_tiered: 包含 L0/L1/L2 视图
            include_entities: 包含实体图谱
        
        Returns:
            {status, export_path}
        
        Examples:
            mem_export({"userId": "user123"}, layer="L2")
            mem_export({"userId": "user123"}, layer="all", include_tiered=True)
        """
        try:
            parsed_scope = _parse_scope(scope)
            IdentityLayer().validate_scope_or_raise(parsed_scope)
            
            if layer not in ["L2", "L3", "all"]:
                raise ValidationError(message=f"Invalid layer: {layer}")
            
            export_dir = get_export_dir() / parsed_scope.user_id
            export_dir.mkdir(parents=True, exist_ok=True)
            
            db = await get_connection()
            embedder = OllamaEmbedder()
            content_layer = ContentLayer(db=db, embedder=embedder)
            
            l2_dir = export_dir / "L2-content"
            l3_dir = export_dir / "L3-knowledge"
            
            stats: dict[str, Any] = {"documents": 0, "facts": 0}
            
            # L2 导出
            if layer in ["L2", "all"]:
                docs_dir = l2_dir / "documents"
                docs_dir.mkdir(parents=True, exist_ok=True)
                
                docs = await content_layer.list(parsed_scope, "document", 100)
                stats["documents"] = len(docs)
                
                for doc in docs:
                    doc_dict = doc.model_dump() if hasattr(doc, "model_dump") else {"id": getattr(doc, "id", ""), "title": getattr(doc, "title", ""), "body": getattr(doc, "body", "")}
                    md = _generate_document_md(doc_dict, include_tiered)
                    month = docs_dir / datetime.now().strftime("%Y-%m")
                    month.mkdir(parents=True, exist_ok=True)
                    (month / f"{doc_dict['id']}.md").write_text(md, encoding="utf-8")
            
            # L3 导出
            if layer in ["L3", "all"]:
                facts_dir = l3_dir / "facts"
                facts_dir.mkdir(parents=True, exist_ok=True)
                
                parsed_ft = _parse_fact_type(fact_type)
                facts = await db.query(
                    "SELECT * FROM facts WHERE user_id = ? ORDER BY created_at DESC LIMIT 100",
                    [parsed_scope.user_id],
                )
                stats["facts"] = len(facts)
                
                for fact in facts:
                    md = _generate_fact_md(fact)
                    month = facts_dir / datetime.now().strftime("%Y-%m")
                    month.mkdir(parents=True, exist_ok=True)
                    (month / f"{fact['id']}.md").write_text(md, encoding="utf-8")
            
            # Entity nodes export (L3 Knowledge Layer)
            if include_entities:
                from agents_mem.knowledge.layer import KnowledgeLayer
                
                try:
                    # Create KnowledgeLayer for entity export
                    knowledge_layer = KnowledgeLayer(content_layer, db, None)
                    
                    # Get entity tree for this scope
                    entity_tree = await knowledge_layer.get_entity_tree(parsed_scope)
                    
                    if entity_tree and entity_tree.nodes:
                        entities_dir = l3_dir / "entities"
                        entities_dir.mkdir(parents=True, exist_ok=True)
                        
                        # Generate entity nodes markdown
                        entities_md = "# Entity Nodes\n\n"
                        entities_md += f"**Total Entities**: {entity_tree.total_entities}\n"
                        entities_md += f"**Total Facts**: {entity_tree.total_facts}\n"
                        entities_md += f"**Max Depth**: {entity_tree.max_depth}\n\n"
                        entities_md += "---\n\n"
                        
                        # List all entity nodes
                        for node_id, node in entity_tree.nodes.items():
                            entities_md += f"## {node.name}\n\n"
                            entities_md += f"- **ID**: {node.id}\n"
                            entities_md += f"- **Type**: {node.entity_type}\n"
                            entities_md += f"- **Depth**: {node.depth}\n"
                            entities_md += f"- **Fact Count**: {node.fact_count}\n"
                            if node.parent_id:
                                entities_md += f"- **Parent**: {node.parent_id}\n"
                            if node.children:
                                entities_md += f"- **Children**: {', '.join(node.children)}\n"
                            entities_md += "\n"
                        
                        # Write entities file
                        (entities_dir / "entities.md").write_text(entities_md, encoding="utf-8")
                        stats["entities"] = entity_tree.total_entities
                except Exception:
                    pass  # Entities export is optional
            
            # README
            readme = _generate_readme_md(parsed_scope, datetime.now().isoformat(), stats)
            (export_dir / "README.md").write_text(readme, encoding="utf-8")
            
            return {
                "status": "success",
                "export_path": str(export_dir),
                "L2_content": {"directory": str(l2_dir), "stats": {"documents": stats["documents"]}},
                "L3_knowledge": {"directory": str(l3_dir), "stats": {"facts": stats["facts"], "entities": stats.get("entities", 0)}},
            }
        
        except AgentMemError as e:
            return {"status": "error", "error": e.message, "details": e.details}
        except Exception as e:
            return {"status": "error", "error": str(e), "type": type(e).__name__}


__all__ = ["register_export_tool"]
