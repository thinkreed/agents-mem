"""
mem_read MCP 工具处理器

读取/搜索/列表/分层

参数:
- resource: 资源类型
- query: 查询参数
  - id: 按ID读取
  - search: 搜索关键词
  - search_mode: fts/semantic/hybrid
  - tier: L0/L1/L2 (分层视图)
  - filters: 过滤条件
  - trace: 追溯事实来源 (仅 fact 资源)
- scope: 作用域

返回:
- 资源或资源列表
"""

from typing import Any

from mcp.server.fastmcp import FastMCP

from agents_mem.core.types import Scope, TierLevel
from agents_mem.core.exceptions import AgentMemError, ScopeError, NotFoundError
from agents_mem.core.uri import URISystem, Scope as URIScope
from agents_mem.identity.layer import IdentityLayer
from agents_mem.content.layer import ContentLayer
from agents_mem.sqlite.connection import get_connection
from agents_mem.embedder import OllamaEmbedder


def _to_uri_scope(scope: Scope) -> URIScope:
    """转换 Scope 到 URIScope"""
    return URIScope(user_id=scope.user_id, agent_id=scope.agent_id, team_id=scope.team_id)


# ============================================================================
# 输入解析
# ============================================================================


def _parse_scope(scope_data: dict[str, Any]) -> Scope:
    """解析 scope 参数"""
    if not scope_data:
        raise ScopeError(
            message="scope is required",
            required_fields=["user_id"],
        )
    
    user_id = scope_data.get("user_id") or scope_data.get("userId")
    if not user_id:
        raise ScopeError(
            message="user_id is required in scope",
            required_fields=["user_id"],
        )
    
    return Scope(
        user_id=user_id,
        agent_id=scope_data.get("agent_id") or scope_data.get("agentId"),
        team_id=scope_data.get("team_id") or scope_data.get("teamId"),
        is_global=scope_data.get("is_global") or scope_data.get("isGlobal") or False,
    )


def _parse_search_mode(mode: str | None) -> str:
    """解析搜索模式"""
    if not mode:
        return "hybrid"
    valid_modes = ["fts", "semantic", "hybrid", "progressive"]
    return mode if mode in valid_modes else "hybrid"


def _parse_tier(tier: str | None) -> TierLevel | None:
    """解析分层级别"""
    if not tier:
        return None
    
    valid_tiers = ["L0", "L1", "L2"]
    if tier in valid_tiers:
        return TierLevel(tier)
    
    return None


def _content_to_dict(content: Any, tier: TierLevel | None = None) -> dict[str, Any]:
    """将 Content 对象转换为字典"""
    if hasattr(content, "model_dump"):
        result = content.model_dump()
    elif hasattr(content, "to_dict"):
        result = content.to_dict()
    else:
        result = {
            "id": getattr(content, "id", ""),
            "uri": getattr(content, "uri", ""),
            "title": getattr(content, "title", ""),
            "body": getattr(content, "body", ""),
            "content_type": getattr(content, "content_type", ""),
            "user_id": getattr(content, "user_id", ""),
            "agent_id": getattr(content, "agent_id"),
            "team_id": getattr(content, "team_id"),
            "created_at": str(getattr(content, "created_at", "")),
            "updated_at": str(getattr(content, "updated_at", "")),
        }
    
    # 添加分层视图信息
    if tier:
        result["tier"] = tier.value
    
    return result


# ============================================================================
# 读取操作
# ============================================================================


async def _read_by_id(
    content_layer: ContentLayer,
    scope: Scope,
    resource: str,
    resource_id: str,
    tier: TierLevel | None,
) -> dict[str, Any]:
    """按 ID 读取资源"""
    uri_scope = _to_uri_scope(scope)
    uri = URISystem.build(scope=uri_scope, resource_type=resource, resource_id=resource_id)
    
    # 获取内容
    result = await content_layer.get(uri, tier=tier)
    
    if result is None:
        raise NotFoundError(
            message=f"Resource not found: {uri}",
            resource_type=resource,
            resource_id=resource_id,
        )
    
    # 如果是字符串 (分层视图)，返回摘要
    if isinstance(result, str):
        return {
            "id": resource_id,
            "uri": uri,
            "tier": tier.value if tier else "L2",
            "content": result,
            "token_count": len(result) // 4,  # 估算
        }
    
    # 返回完整内容
    return _content_to_dict(result, tier)


async def _search_resources(
    content_layer: ContentLayer,
    scope: Scope,
    resource: str,
    query_text: str,
    search_mode: str,
    tier: TierLevel | None,
    limit: int,
) -> list[dict[str, Any]]:
    """搜索资源"""
    tier_level = tier or TierLevel.L0
    rt: str | None = resource if resource != "all" else None
    results = await content_layer.search(
        query=query_text,
        scope=scope,
        tier=tier_level,
        mode=search_mode,  # type: ignore
        limit=limit,
        resource_type=rt,  # type: ignore
    )
    return [_content_to_dict(r, tier) for r in results]


async def _list_resources(
    content_layer: ContentLayer,
    scope: Scope,
    resource: str,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    """列出资源"""
    rt: str | None = resource if resource != "all" else None
    results = await content_layer.list(scope=scope, resource_type=rt, limit=limit, offset=offset)  # type: ignore
    return [_content_to_dict(r) for r in results]


async def _read_fact(
    scope: Scope,
    query: dict[str, Any],
    db: Any,
    content_layer: ContentLayer,
) -> dict[str, Any]:
    """读取/搜索事实 - 使用 KnowledgeLayer"""
    from agents_mem.knowledge.layer import KnowledgeLayer
    from agents_mem.knowledge.facts import get_fact_by_id
    
    fact_id = query.get("id")
    do_trace = query.get("trace") or False
    
    if fact_id:
        # 使用 KnowledgeLayer 获取事实
        knowledge_layer = KnowledgeLayer(content_layer, db, None)
        
        try:
            # 获取事实
            fact = await knowledge_layer.get_fact(fact_id)
            if not fact:
                return {"error": f"Fact {fact_id} not found"}
            
            # 验证 scope
            if fact.user_id != scope.user_id:
                return {"error": "Fact not in scope"}
            if scope.agent_id and fact.agent_id != scope.agent_id:
                return {"error": "Fact not in scope"}
            if scope.team_id and fact.team_id != scope.team_id:
                return {"error": "Fact not in scope"}
            
            # 构建结果
            result: dict[str, Any] = {
                "id": fact.id,
                "content": fact.content,
                "fact_type": fact.fact_type.value,
                "source_uri": fact.source_uri,
                "source_type": fact.source_type.value if fact.source_type else None,
                "source_id": fact.source_id,
                "confidence": fact.confidence,
                "verified": fact.verified,
                "user_id": fact.user_id,
                "created_at": fact.created_at,
            }
            
            # 如果请求追溯，添加 trace 信息
            if do_trace:
                try:
                    trace_result = await knowledge_layer.trace_fact(fact_id)
                    # Convert TraceResult to dict for serialization
                    trace_dict: dict[str, Any] = trace_result.model_dump() if hasattr(trace_result, "model_dump") else {
                        "fact_id": fact_id,
                        "source_content": None,
                        "trace_chain": [],
                    }
                    result["trace"] = trace_dict
                except Exception:
                    # Trace 不可用时返回基本信息
                    trace_dict = {
                        "fact_id": fact_id,
                        "source_uri": fact.source_uri,
                        "trace_available": False,
                    }
                    result["trace"] = trace_dict
            
            return result
        
        except Exception as e:
            # Fallback: 直接查询数据库
            record = await get_fact_by_id(fact_id, db)
            if not record:
                return {"error": f"Fact {fact_id} not found"}
            
            # 验证 scope
            if record.user_id != scope.user_id:
                return {"error": "Fact not in scope"}
            
            return {
                "id": record.id,
                "content": record.content,
                "fact_type": record.fact_type,
                "source_uri": record.source_uri,
                "confidence": record.confidence,
                "user_id": record.user_id,
                "created_at": record.created_at,
            }
    
    # 搜索事实
    search_text = query.get("search")
    if search_text:
        from agents_mem.core.types import FactType
        fact_type_str = query.get("fact_type") or query.get("factType")
        fact_type = FactType(fact_type_str) if fact_type_str else None
        
        knowledge_layer = KnowledgeLayer(content_layer, db, None)
        facts = await knowledge_layer.search_facts(search_text, scope, fact_type)
        
        return {
            "facts": [
                {
                    "id": f.id,
                    "content": f.content,
                    "fact_type": f.fact_type.value,
                    "confidence": f.confidence,
                }
                for f in facts
            ],
            "count": len(facts),
            "query": search_text,
        }
    
    # 列出事实
    if query.get("list"):
        from agents_mem.knowledge.facts import get_facts_by_scope
        records = await get_facts_by_scope(scope, db)
        return {
            "facts": [
                {
                    "id": r.id,
                    "content": r.content,
                    "fact_type": r.fact_type,
                    "confidence": r.confidence,
                }
                for r in records
            ],
            "count": len(records),
        }
    
    return {"error": "No operation specified for fact. Provide id, search, or list."}


# ============================================================================
# 工具注册
# ============================================================================


def register_read_tool(mcp: FastMCP) -> None:
    """注册 mem_read 工具"""
    
    @mcp.tool()
    async def mem_read(
        resource: str,
        query: dict[str, Any],
        scope: dict[str, Any],
    ) -> dict[str, Any]:
        """
        读取/搜索/列表/分层
        
        支持的操作:
        - 按ID读取: query.id
        - 搜索: query.search + query.search_mode
        - 分层视图: query.tier (L0/L1/L2)
        - 列表: query.list=true
        - 事实追溯: query.trace=true (仅 fact 资源)
        
        Args:
            resource: 资源类型 (document, asset, conversation, message, fact, team, all)
            query: 查询参数
                - id: 资源ID (按ID读取)
                - search: 搜索关键词
                - search_mode: fts/semantic/hybrid (默认 hybrid)
                - tier: L0/L1/L2 (分层视图)
                - filters: 过滤条件
                - list: 是否列出
                - limit: 返回数量 (默认 10)
                - offset: 偏移量
                - trace: 追溯事实来源 (仅 fact)
            scope: 作用域 {userId: 必填}
        
        Returns:
            资源或资源列表
        
        Examples:
            # 按ID读取
            mem_read("document", {"id": "doc-001"}, {"userId": "user123"})
            
            # 分层读取 (L0摘要)
            mem_read("document", {"id": "doc-001", "tier": "L0"}, {"userId": "user123"})
            
            # 搜索
            mem_read("document", {"search": "关键词", "search_mode": "hybrid"}, {"userId": "user123"})
            
            # 分层搜索 (返回L0摘要)
            mem_read("document", {"search": "关键词", "tier": "L0", "limit": 5}, {"userId": "user123"})
            
            # 列出所有文档
            mem_read("document", {"list": true, "limit": 20}, {"userId": "user123"})
            
            # 事实追溯
            mem_read("fact", {"id": "fact-001", "trace": true}, {"userId": "user123"})
        """
        try:
            # 解析参数
            parsed_scope = _parse_scope(scope)
            
            # 验证 Scope
            identity_layer = IdentityLayer()
            identity_layer.validate_scope_or_raise(parsed_scope)
            
            # 解析查询参数
            resource_id = query.get("id")
            search_text = query.get("search")
            search_mode = _parse_search_mode(query.get("search_mode") or query.get("searchMode"))
            tier = _parse_tier(query.get("tier"))
            limit = query.get("limit") or 10
            offset = query.get("offset") or 0
            do_list = query.get("list") or False
            filters = query.get("filters") or {}
            
            # 获取数据库连接
            db = await get_connection()

            # 初始化 Content Layer
            embedder = OllamaEmbedder()
            content_layer = ContentLayer(db=db, embedder=embedder)
            
            # 处理 fact 资源
            if resource == "fact":
                return await _read_fact(parsed_scope, query, db, content_layer)
            
            # 按ID读取
            if resource_id:
                return await _read_by_id(
                    content_layer,
                    parsed_scope,
                    resource,
                    resource_id,
                    tier,
                )
            
            # 列出资源
            if do_list:
                results = await _list_resources(
                    content_layer,
                    parsed_scope,
                    resource,
                    limit,
                    offset,
                )
                return {
                    "results": results,
                    "count": len(results),
                    "limit": limit,
                    "offset": offset,
                }
            
            # 搜索资源
            if search_text:
                results = await _search_resources(
                    content_layer,
                    parsed_scope,
                    resource,
                    search_text,
                    search_mode,
                    tier,
                    limit,
                )
                return {
                    "results": results,
                    "count": len(results),
                    "query": search_text,
                    "search_mode": search_mode,
                    "tier": tier.value if tier else None,
                }
            
            # 无操作指定，返回提示
            return {
                "error": "No operation specified. Provide id, search, or list in query.",
                "valid_operations": ["id", "search", "list"],
            }
        
        except AgentMemError as e:
            return {
                "error": e.message,
                "details": e.details,
            }
        
        except Exception as e:
            return {
                "error": str(e),
                "type": type(e).__name__,
            }


__all__ = ["register_read_tool"]