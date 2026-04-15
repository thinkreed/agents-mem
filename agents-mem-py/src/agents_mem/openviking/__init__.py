"""
OpenViking Integration Module

提供 OpenViking 向量搜索服务的集成模块，包括:
- HTTP Client: 异步客户端，支持搜索/索引/删除
- URI Adapter: mem:// 和 viking:// URI 转换
- Scope Mapper: Scope 到 OpenViking 过滤器映射

使用示例:
    from agents_mem.openviking import OpenVikingClient, URIAdapter

    # 创建客户端
    config = OpenVikingConfig(base_url="http://localhost:1933")
    client = OpenVikingClient(config)

    # 构建 URI
    adapter = URIAdapter()
    target_uri = adapter.build_target_uri("user123", None, EntityType.DOCUMENTS)

    # 执行搜索
    async with client:
        results = await client.search("query", target_uri, limit=10)
"""

# Client
from agents_mem.openviking.client import (
    AddResourceResult,
    ContentResult,
    FindResult,
    OpenVikingClient,
    OpenVikingConfig,
    SearchResult,
    VikingError,
    VikingErrorType,
    get_client,
    reset_client,
)

# URI Adapter
from agents_mem.openviking.uri_adapter import (
    ENTITY_TO_VIKING,
    MemURI,
    PATH_TO_ENTITY,
    URIAdapter,
    VikingResourceType,
    VikingURI,
    get_uri_adapter,
    reset_uri_adapter,
)

# Scope Mapper
from agents_mem.openviking.scope_mapper import (
    ScopeMapper,
    ScopeValidation,
    VikingScope,
    get_scope_mapper,
    reset_scope_mapper,
)

__all__ = [
    # Client
    "OpenVikingClient",
    "OpenVikingConfig",
    "SearchResult",
    "FindResult",
    "ContentResult",
    "AddResourceResult",
    "VikingError",
    "VikingErrorType",
    "get_client",
    "reset_client",
    # URI Adapter
    "URIAdapter",
    "VikingURI",
    "MemURI",
    "VikingResourceType",
    "ENTITY_TO_VIKING",
    "PATH_TO_ENTITY",
    "get_uri_adapter",
    "reset_uri_adapter",
    # Scope Mapper
    "ScopeMapper",
    "VikingScope",
    "ScopeValidation",
    "get_scope_mapper",
    "reset_scope_mapper",
]