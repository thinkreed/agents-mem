"""
mem_create MCP 工具处理器

创建资源 (document, asset, conversation, message, fact, team)
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
    """转换 Scope 到 URIScope"""
    return URIScope(
        user_id=scope.user_id,
        agent_id=scope.agent_id,
        team_id=scope.team_id,
    )


def _parse_scope(scope_data: dict[str, Any]) -> Scope:
    """解析 scope 参数"""
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


def register_create_tool(mcp: FastMCP) -> None:
    """注册 mem_create 工具"""
    
    @mcp.tool()
    async def mem_create(
        resource: str,
        data: dict[str, Any],
        scope: dict[str, Any],
    ) -> dict[str, Any]:
        """
        创建资源
        
        支持的资源类型: document, asset, conversation, message, fact, team
        
        Args:
            resource: 资源类型
            data: 创建数据
            scope: 作用域 {userId: 必填}
        
        Returns:
            {id, uri}
        
        Examples:
            mem_create("document", {"title": "My Doc", "content": "..."}, {"userId": "user123"})
            mem_create("conversation", {"title": "Chat"}, {"userId": "user123", "agentId": "agent1"})
        """
        try:
            parsed_scope = _parse_scope(scope)
            IdentityLayer().validate_scope_or_raise(parsed_scope)
            
            db = await get_connection()
            content_layer = ContentLayer(db=db)
            uri_scope = _to_uri_scope(parsed_scope)
            
            if resource == "document":
                create_data = {
                    "title": data.get("title") or "Untitled",
                    "content": data.get("content") or data.get("body") or "",
                    "doc_type": data.get("doc_type") or "note",
                    "metadata": data.get("metadata") or {},
                    "is_global": parsed_scope.is_global,
                }
                content = await content_layer.create("document", parsed_scope, create_data)
                return {"id": content.id, "uri": content.uri}
            
            elif resource == "conversation":
                if not parsed_scope.agent_id:
                    raise ScopeError(message="agent_id required for conversations")
                create_data = {
                    "title": data.get("title") or "Untitled Conversation",
                    "source": data.get("source") or "unknown",
                }
                content = await content_layer.create("conversation", parsed_scope, create_data)
                return {"id": content.id, "uri": content.uri}
            
            elif resource == "message":
                conv_id = data.get("conversation_id")
                if not conv_id:
                    raise ValidationError(message="conversation_id required")
                conv_uri = URISystem.build(uri_scope, "conversation", conv_id)
                msg = await content_layer.add_message(conv_uri, {
                    "role": data.get("role") or "user",
                    "content": data.get("content") or "",
                })
                msg_uri = URISystem.build(uri_scope, "message", msg.id)
                return {"id": msg.id, "uri": msg_uri}
            
            elif resource == "fact":
                source_type = data.get("source_type") or "documents"
                source_id = data.get("source_id") or str(uuid.uuid4())
                fact_id = str(uuid.uuid4())
                source_uri = URISystem.build(uri_scope, source_type, source_id)
                fact_uri = URISystem.build(uri_scope, "fact", fact_id)
                return {"id": fact_id, "uri": fact_uri, "source_uri": source_uri}
            
            elif resource == "asset":
                # Required fields for asset
                if "filename" not in data:
                    return {"error": "Asset requires 'filename' field"}
                if "file_type" not in data:
                    return {"error": "Asset requires 'file_type' field"}
                
                create_data = {
                    "title": data.get("title") or data.get("filename"),
                    "content": data.get("content") or "",
                    "doc_type": "file",
                    "metadata": {
                        "filename": data.get("filename"),
                        "file_type": data.get("file_type"),
                        "asset_type": data.get("asset_type") or "file",
                    },
                }
                content = await content_layer.create("asset", parsed_scope, create_data)
                return {"id": content.id, "uri": content.uri}
            
            elif resource == "team":
                team_id = str(uuid.uuid4())
                team_uri = URISystem.build(uri_scope, "team", team_id)
                return {"id": team_id, "uri": team_uri}
            
            else:
                raise ValidationError(message=f"Unsupported resource: {resource}")
        
        except AgentMemError as e:
            return {"error": e.message, "details": e.details}
        except Exception as e:
            return {"error": str(e), "type": type(e).__name__}


__all__ = ["register_create_tool"]