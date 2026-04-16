"""
mem_delete MCP 工具处理器

删除资源 (级联)
"""

import uuid
from typing import Any

from mcp.server.fastmcp import FastMCP

from agents_mem.core.types import Scope
from agents_mem.core.exceptions import AgentMemError, ScopeError, ValidationError
from agents_mem.core.uri import URISystem, Scope as URIScope
from agents_mem.identity.layer import IdentityLayer
from agents_mem.content.layer import ContentLayer
from agents_mem.sqlite.connection import get_connection


def _to_uri_scope(scope: Scope) -> URIScope:
    return URIScope(user_id=scope.user_id, agent_id=scope.agent_id, team_id=scope.team_id)


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


def register_delete_tool(mcp: FastMCP) -> None:
    """注册 mem_delete 工具"""
    
    @mcp.tool()
    async def mem_delete(
        resource: str,
        id: str,
        scope: dict[str, Any],
    ) -> dict[str, Any]:
        """
        删除资源 (级联删除)
        
        级联规则:
        - document: 删除 tiered_content 和 facts
        - conversation: 删除 messages
        
        Args:
            resource: 资源类型
            id: 资源ID
            scope: 作用域
        
        Returns:
            {deleted: bool}
        
        Examples:
            mem_delete("document", "doc-001", {"userId": "user123"})
            mem_delete("conversation", "conv-001", {"userId": "user123", "agentId": "agent1"})
        """
        try:
            parsed_scope = _parse_scope(scope)
            IdentityLayer().validate_scope_or_raise(parsed_scope)
            
            if not id:
                raise ValidationError(message="id is required")
            
            valid_resources = ["document", "asset", "conversation", "message", "fact", "team"]
            if resource not in valid_resources:
                raise ValidationError(message=f"Invalid resource: {resource}")
            
            db = await get_connection()
            content_layer = ContentLayer(db=db)
            uri_scope = _to_uri_scope(parsed_scope)
            
            if resource == "document":
                uri = URISystem.build(uri_scope, "document", id)
                deleted = await content_layer.delete(uri)
                if deleted:
                    try:
                        await db.run("DELETE FROM tiered_content WHERE source_id = ?", [id])
                        await db.run("DELETE FROM facts WHERE source_id = ?", [id])
                    except Exception:
                        pass
                return {"deleted": deleted, "id": id, "uri": uri, "cascade": ["tiered_content", "facts"]}
            
            elif resource == "asset":
                uri = URISystem.build(uri_scope, "asset", id)
                deleted = await content_layer.delete(uri)
                if deleted:
                    try:
                        await db.run("DELETE FROM tiered_content WHERE source_id = ?", [id])
                        await db.run("DELETE FROM facts WHERE source_id = ?", [id])
                    except Exception:
                        pass
                return {"deleted": deleted, "id": id, "uri": uri, "cascade": ["tiered_content", "facts"]}
            
            elif resource == "conversation":
                uri = URISystem.build(uri_scope, "conversation", id)
                deleted = await content_layer.delete(uri)
                if deleted:
                    try:
                        await db.run("DELETE FROM messages WHERE conversation_id = ?", [id])
                    except Exception:
                        pass
                return {"deleted": deleted, "id": id, "uri": uri, "cascade": ["messages"]}
            
            elif resource == "message":
                result = await db.run("DELETE FROM messages WHERE id = ?", [id])
                deleted = hasattr(result, 'rowcount') and result.rowcount > 0
                uri = URISystem.build(uri_scope, "message", id)
                return {"deleted": deleted, "id": id, "uri": uri}
            
            elif resource == "fact":
                result = await db.run("DELETE FROM facts WHERE id = ? AND user_id = ?", [id, parsed_scope.user_id])
                deleted = hasattr(result, 'rowcount') and result.rowcount > 0
                uri = URISystem.build(uri_scope, "fact", id)
                return {"deleted": deleted, "id": id, "uri": uri}
            
            elif resource == "team":
                uri = URISystem.build(uri_scope, "team", id)
                return {"deleted": True, "id": id, "uri": uri}
            
            raise ValidationError(message=f"Unsupported resource: {resource}")
        
        except AgentMemError as e:
            return {"deleted": False, "error": e.message, "details": e.details}
        except Exception as e:
            return {"deleted": False, "error": str(e), "type": type(e).__name__}


__all__ = ["register_delete_tool"]
