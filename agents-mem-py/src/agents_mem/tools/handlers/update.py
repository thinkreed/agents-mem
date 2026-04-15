"""
mem_update MCP 工具处理器

更新资源
"""

import time
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


def _content_to_dict(content: Any) -> dict[str, Any]:
    if hasattr(content, "model_dump"):
        return content.model_dump()
    return {
        "id": getattr(content, "id", ""),
        "uri": getattr(content, "uri", ""),
        "title": getattr(content, "title", ""),
        "body": getattr(content, "body", ""),
    }


def register_update_tool(mcp: FastMCP) -> None:
    """注册 mem_update 工具"""
    
    @mcp.tool()
    async def mem_update(
        resource: str,
        id: str,
        data: dict[str, Any],
        scope: dict[str, Any],
    ) -> dict[str, Any]:
        """
        更新资源
        
        Args:
            resource: 资源类型
            id: 资源ID
            data: 更新数据
            scope: 作用域
        
        Returns:
            更新后的资源
        
        Examples:
            mem_update("document", "doc-001", {"title": "New Title"}, {"userId": "user123"})
            mem_update("fact", "fact-001", {"verified": True}, {"userId": "user123"})
        """
        try:
            parsed_scope = _parse_scope(scope)
            IdentityLayer().validate_scope_or_raise(parsed_scope)
            
            if not id:
                raise ValidationError(message="id is required")
            
            valid_resources = ["document", "asset", "conversation", "fact", "team"]
            if resource not in valid_resources:
                raise ValidationError(message=f"Invalid resource: {resource}")
            
            db = await get_connection()
            content_layer = ContentLayer(db=db)
            uri_scope = _to_uri_scope(parsed_scope)
            
            if resource in ["document", "asset"]:
                rt = "document" if resource == "asset" else resource
                uri = URISystem.build(uri_scope, rt, id)
                update_data: dict[str, Any] = {}
                if "title" in data:
                    update_data["title"] = data["title"]
                if "content" in data or "body" in data:
                    update_data["content"] = data.get("content") or data.get("body")
                content = await content_layer.update(uri, update_data)
                result = _content_to_dict(content)
                if resource == "asset" and "uri" in result:
                    result["uri"] = result["uri"].replace("/documents/", "/assets/")
                return result
            
            elif resource == "conversation":
                uri = URISystem.build(uri_scope, "conversation", id)
                content = await content_layer.update(uri, {"title": data.get("title")})
                return _content_to_dict(content)
            
            elif resource == "fact":
                update_fields: list[str] = []
                update_values: list[Any] = []
                if "content" in data:
                    update_fields.append("content = ?")
                    update_values.append(data["content"])
                if "verified" in data:
                    update_fields.append("verified = ?")
                    update_values.append(1 if data["verified"] else 0)
                update_fields.append("updated_at = ?")
                update_values.append(int(time.time()))
                sql = f"UPDATE facts SET {', '.join(update_fields)} WHERE id = ?"
                await db.run(sql, update_values + [id])
                uri = URISystem.build(uri_scope, "fact", id)
                return {"id": id, "uri": uri, "updated": True}
            
            elif resource == "team":
                uri = URISystem.build(uri_scope, "team", id)
                return {"id": id, "uri": uri, "updated": True}
            
            raise ValidationError(message=f"Unsupported resource: {resource}")
        
        except AgentMemError as e:
            return {"error": e.message, "details": e.details, "updated": False}
        except Exception as e:
            return {"error": str(e), "type": type(e).__name__, "updated": False}


__all__ = ["register_update_tool"]