"""
L2 Content Layer - 内容层主类 ⭐核心价值

L2 是核心价值层，负责：
- 原始内容存储 (Documents, Assets, Conversations, Messages)
- Tiered Views 内置能力 (L0摘要~100tokens, L1概览~2000tokens)
- CRUD 操作 (Create, Read, Update, Delete)
- 搜索操作 (FTS, Hybrid, Semantic)

架构依赖：
- L2 Content 依赖 L1 Index (索引层)
- L3 Knowledge 只读依赖 L2

接口设计：
- get(uri, tier) -> Content: 获取内容，支持分层视图
- search(query, scope, tier, mode) -> list[Content]: 搜索内容
- create(resource_type, data, scope) -> Content: 创建资源
- update(uri, data) -> Content: 更新资源
- delete(uri) -> bool: 删除资源
"""

import time
from typing import Any, Protocol, Literal

from pydantic import BaseModel, Field

from agents_mem.core.types import Scope, Content, ContentType, TierLevel, EntityType, SearchResult
from agents_mem.core.exceptions import NotFoundError, ValidationError, ScopeError
from agents_mem.core.uri import URISystem
from agents_mem.content.capabilities.tiered import TieredViewCapability, TieredCacheConfig
from agents_mem.content.resources.document import (
    DocumentRepository,
    Document,
    DocumentCreateInput,
    DocumentUpdateInput,
)
from agents_mem.content.resources.conversation import (
    ConversationRepository,
    MessageRepository,
    Conversation,
    Message,
    ConversationCreateInput,
    MessageCreateInput,
)
from agents_mem.llm import LLMClientProtocol, OllamaLLMClient, MockLLMClient
from agents_mem.sqlite.connection import DatabaseConnection


# ============================================================================
# 类型定义
# ============================================================================

# 资源类型
ResourceType = Literal[
    "document",
    "asset",
    "conversation",
    "message",
    "fact",
    "team",
]

# 搜索模式
SearchMode = Literal[
    "fts",
    "semantic",
    "hybrid",
    "progressive",
]


# ============================================================================
# Index Layer 协议 (L1 依赖)
# ============================================================================

class IndexLayerProtocol(Protocol):
    """
    L1 Index Layer 协议
    
    L2 Content Layer 依赖 L1 Index Layer 进行：
    - URI 索引管理
    - 元数据查询
    - 快速资源定位
    """
    
    async def get_index(self, uri: str) -> dict[str, Any] | None:
        """获取索引条目"""
        ...
    
    async def create_index(
        self,
        uri: str,
        scope: Scope,
        target_type: str,
        target_id: str,
        title: str,
        **metadata: Any,
    ) -> dict[str, Any]:
        """创建索引条目"""
        ...
    
    async def delete_index(self, uri: str) -> bool:
        """删除索引条目"""
        ...
    
    async def search_index(
        self,
        scope: Scope,
        query: str,
        mode: SearchMode,
        limit: int,
    ) -> list[SearchResult]:
        """搜索索引"""
        ...


# ============================================================================
# Content 创建/更新输入
# ============================================================================

class ContentCreateInput(BaseModel):
    """创建内容输入"""
    
    resource_type: ResourceType = Field(..., description="资源类型")
    title: str | None = Field(default=None, description="标题")
    content: str = Field(..., description="内容")
    doc_type: str = Field(default="note", description="文档类型")
    source_url: str | None = Field(default=None, description="来源 URL")
    source_path: str | None = Field(default=None, description="来源路径")
    metadata: dict[str, Any] = Field(default_factory=dict, description="元数据")
    is_global: bool = Field(default=False, description="是否全局")


class ContentUpdateInput(BaseModel):
    """更新内容输入"""
    
    title: str | None = Field(default=None, description="新标题")
    content: str | None = Field(default=None, description="新内容")
    metadata: dict[str, Any] | None = Field(default=None, description="新元数据")


class ContentSearchQuery(BaseModel):
    """搜索查询输入"""
    
    query: str = Field(..., description="搜索查询")
    scope: Scope = Field(..., description="作用域")
    tier: TierLevel | None = Field(default=None, description="分层级别")
    mode: SearchMode = Field(default="hybrid", description="搜索模式")
    limit: int = Field(default=10, description="返回数量")
    offset: int = Field(default=0, description="偏移量")
    resource_type: ResourceType | None = Field(default=None, description="资源类型过滤")


# ============================================================================
# ContentLayer 主类
# ============================================================================

class ContentLayer:
    """
    L2 Content Layer 主类
    
    核心价值层，提供：
    - 原始内容存储
    - 分层视图能力 (L0/L1/L2)
    - CRUD 操作
    - 搜索操作
    
    依赖关系：
    - 依赖 L1 IndexLayer (可选，通过协议注入)
    - 提供数据给 L3 Knowledge Layer
    
    使用示例:
    ```python
    # 初始化
    db = await get_connection()
    content_layer = ContentLayer(db=db)
    
    # 创建文档
    doc = await content_layer.create(
        resource_type="document",
        scope=Scope(user_id="user123"),
        data={"title": "My Doc", "content": "..."}
    )
    
    # 获取 L0 视图
    l0_view = await content_layer.get(doc.uri, tier="L0")
    
    # 搜索
    results = await content_layer.search(
        query="关键词",
        scope=Scope(user_id="user123"),
        tier="L0",
        mode="hybrid"
    )
    ```
    """
    
    def __init__(
        self,
        db: DatabaseConnection,
        index_layer: IndexLayerProtocol | None = None,
        llm_client: LLMClientProtocol | None = None,
        tiered_cache_config: TieredCacheConfig | None = None,
    ):
        """
        初始化 Content Layer
        
        Args:
            db: 数据库连接
            index_layer: L1 Index Layer (可选)
            llm_client: LLM 客户端 (用于分层视图生成)
            tiered_cache_config: 分层视图缓存配置
        """
        self._db = db
        
        # 初始化分层视图能力
        # 优先使用提供的 llm_client，否则尝试创建 Ollama 客户端，最后回退到 Mock
        if llm_client is None:
            try:
                llm_client = OllamaLLMClient()
            except Exception:
                llm_client = MockLLMClient()
        
        self._tiered = TieredViewCapability(
            llm_client=llm_client,
            cache_config=tiered_cache_config,
        )
        
        # 初始化仓库
        self._document_repo = DocumentRepository(db, self._tiered)
        self._message_repo = MessageRepository(db)
        self._conversation_repo = ConversationRepository(
            db, self._message_repo, self._tiered
        )
        
        # L1 Index Layer (可选)
        self._index_layer = index_layer
    
    # =========================================================================
    # 核心方法: CRUD
    # =========================================================================
    
    async def get(
        self,
        uri: str,
        tier: TierLevel | str | None = None,
    ) -> Content | str | None:
        """
        获取内容
        
        支持分层视图：
        - tier=None: 返回完整 Content 对象
        - tier=L0: 返回 L0 抽象摘要字符串
        - tier=L1: 返回 L1 概览字符串
        - tier=L2: 返回完整内容字符串
        
        Args:
            uri: 资源 URI (mem:// 格式)
            tier: 分层级别
            
        Returns:
            内容对象或分层视图字符串
            
        Raises:
            URIValidationError: URI 格式无效
            NotFoundError: 资源不存在
        """
        # 解析 URI
        parsed = URISystem.parse(uri)
        scope = Scope(
            user_id=parsed.user_id,
            agent_id=parsed.agent_id,
            team_id=parsed.team_id,
        )
        
        resource_type = parsed.resource_type
        resource_id = parsed.resource_id
        
        # 根据资源类型获取
        if resource_type == "document" or resource_type == "documents":
            result = await self._document_repo.get(scope, resource_id, tier)
            if result is None:
                return None
            if isinstance(result, str):
                return result
            return self._document_to_content(result)
        
        if resource_type == "conversation" or resource_type == "conversations":
            result = await self._conversation_repo.get(scope, resource_id, tier=tier)
            if result is None:
                return None
            if isinstance(result, str):
                return result
            # result 应该是 Conversation 类型 (因为 include_messages=False)
            if isinstance(result, tuple):
                # 返回 tuple 时，只取第一个元素 (Conversation)
                conv = result[0]
                return self._conversation_to_content(conv)
            return self._conversation_to_content(result)
        
        # 其他资源类型
        raise NotFoundError(
            message=f"Unsupported resource type: {resource_type}",
            resource_type=resource_type,
            resource_id=resource_id,
        )
    
    async def get_or_raise(
        self,
        uri: str,
        tier: TierLevel | str | None = None,
    ) -> Content | str:
        """
        获取内容或抛出异常
        """
        result = await self.get(uri, tier)
        if result is None:
            parsed = URISystem.parse(uri)
            raise NotFoundError(
                message=f"Content not found: {uri}",
                resource_type=parsed.resource_type,
                resource_id=parsed.resource_id,
            )
        return result
    
    async def create(
        self,
        resource_type: ResourceType,
        scope: Scope,
        data: dict[str, Any],
    ) -> Content:
        """
        创建资源
        
        Args:
            resource_type: 资源类型
            scope: 作用域
            data: 创建数据
            
        Returns:
            创建的内容对象
            
        Raises:
            ValidationError: 数据验证失败
            ScopeError: Scope 验证失败
        """
        # 验证 Scope
        if not scope.user_id:
            raise ScopeError(
                message="user_id is required",
                required_fields=["user_id"],
            )
        
        if resource_type == "document":
            input = DocumentCreateInput(**data)
            doc = await self._document_repo.create(scope, input)
            return self._document_to_content(doc)
        
        if resource_type == "conversation":
            # 对话必须有 agent_id
            if not scope.agent_id:
                raise ScopeError(
                    message="agent_id is required for conversations",
                    required_fields=["user_id", "agent_id"],
                )
            input = ConversationCreateInput(**data)
            conv = await self._conversation_repo.create(scope, input)
            return self._conversation_to_content(conv)
        
        raise ValidationError(
            message=f"Unsupported resource type: {resource_type}",
            field="resource_type",
            value=resource_type,
        )
    
    async def update(
        self,
        uri: str,
        data: dict[str, Any],
    ) -> Content:
        """
        更新资源
        
        Args:
            uri: 资源 URI
            data: 更新数据
            
        Returns:
            更新后的内容对象
        """
        # 解析 URI
        parsed = URISystem.parse(uri)
        scope = Scope(
            user_id=parsed.user_id,
            agent_id=parsed.agent_id,
            team_id=parsed.team_id,
        )
        
        resource_type = parsed.resource_type
        resource_id = parsed.resource_id
        
        if resource_type == "document" or resource_type == "documents":
            input = DocumentUpdateInput(**data)
            doc = await self._document_repo.update(scope, resource_id, input)
            return self._document_to_content(doc)
        
        if resource_type == "conversation" or resource_type == "conversations":
            title = data.get("title")
            ended_at = data.get("ended_at")
            conv = await self._conversation_repo.update(scope, resource_id, title, ended_at)
            return self._conversation_to_content(conv)
        
        raise NotFoundError(
            message=f"Unsupported resource type: {resource_type}",
            resource_type=resource_type,
            resource_id=resource_id,
        )
    
    async def delete(self, uri: str) -> bool:
        """
        删除资源
        
        Args:
            uri: 资源 URI
            
        Returns:
            是否成功删除
        """
        # 解析 URI
        parsed = URISystem.parse(uri)
        scope = Scope(
            user_id=parsed.user_id,
            agent_id=parsed.agent_id,
            team_id=parsed.team_id,
        )
        
        resource_type = parsed.resource_type
        resource_id = parsed.resource_id
        
        if resource_type == "document" or resource_type == "documents":
            return await self._document_repo.delete(scope, resource_id)
        
        if resource_type == "conversation" or resource_type == "conversations":
            return await self._conversation_repo.delete(scope, resource_id)
        
        return False
    
    # =========================================================================
    # 核心方法: 搜索
    # =========================================================================
    
    async def search(
        self,
        query: str,
        scope: Scope,
        tier: TierLevel | str = "L0",
        mode: SearchMode = "hybrid",
        limit: int = 10,
        resource_type: ResourceType | None = None,
    ) -> list[Content]:
        """
        搜索内容
        
        支持多种搜索模式：
        - fts: 全文搜索 (SQLite FTS)
        - hybrid: 混合搜索 (FTS + 语义)
        - semantic: 语义搜索 (OpenViking)
        - progressive: 渐进式搜索
        
        Args:
            query: 搜索查询
            scope: 作用域
            tier: 分层级别 (默认 L0)
            mode: 搜索模式
            limit: 返回数量
            resource_type: 资源类型过滤
            
        Returns:
            搜索结果列表
        """
        results: list[Content] = []
        
        # 搜索文档
        if resource_type == None or resource_type == "document":
            docs = await self._document_repo.search(scope, query, mode, limit)
            for doc in docs:
                content = self._document_to_content(doc)
                if tier:
                    # 获取分层视图
                    view = await self._tiered.get_view(content, tier)
                    # 转换 tier 为 TierLevel
                    tier_level: TierLevel
                    if isinstance(tier, str):  # type: ignore[reportUnnecessaryIsInstance]
                        tier_level = TierLevel(tier)
                    else:
                        tier_level = tier
                    # 返回带分层视图的 Content
                    results.append(Content(
                        id=content.id,
                        uri=content.uri,
                        title=content.title,
                        body=view,
                        content_type=content.content_type,
                        user_id=content.user_id,
                        agent_id=content.agent_id,
                        team_id=content.team_id,
                        tier=tier_level,
                    ))
                else:
                    results.append(content)
        
        # 如果有 L1 Index Layer，使用它进行搜索
        if self._index_layer:
            _ = await self._index_layer.search_index(scope, query, mode, limit)
            # 这里可以合并结果，暂不实现
        
        return results
    
    async def list(
        self,
        scope: Scope,
        resource_type: ResourceType | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Content]:
        """
        列出内容
        
        Args:
            scope: 作用域
            resource_type: 资源类型过滤
            limit: 返回数量
            offset: 偏移量
            
        Returns:
            内容列表
        """
        results: list[Content] = []
        
        if resource_type == None or resource_type == "document":
            docs = await self._document_repo.list(scope, limit, offset)
            results.extend([self._document_to_content(doc) for doc in docs])
        
        if resource_type == None or resource_type == "conversation":
            if scope.agent_id:
                convs = await self._conversation_repo.list(scope, limit, offset)
                results.extend([self._conversation_to_content(conv) for conv in convs])
        
        return results
    
    # =========================================================================
    # 消息操作 (对话专用)
    # =========================================================================
    
    async def add_message(
        self,
        conversation_uri: str,
        data: dict[str, Any],
    ) -> Message:
        """
        向对话添加消息
        
        Args:
            conversation_uri: 对话 URI
            data: 消息数据
            
        Returns:
            创建的消息对象
        """
        # 解析 URI
        parsed = URISystem.parse(conversation_uri)
        conversation_id = parsed.resource_id
        
        input = MessageCreateInput(**data)
        return await self._message_repo.create(conversation_id, input)
    
    async def get_messages(
        self,
        conversation_uri: str,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Message]:
        """
        获取对话的消息列表
        
        Args:
            conversation_uri: 对话 URI
            limit: 返回数量
            offset: 偏移量
            
        Returns:
            消息列表
        """
        parsed = URISystem.parse(conversation_uri)
        conversation_id = parsed.resource_id
        return await self._message_repo.list(conversation_id, limit, offset)
    
    # =========================================================================
    # 分层视图能力
    # =========================================================================
    
    @property
    def tiered(self) -> TieredViewCapability:
        """获取分层视图能力"""
        return self._tiered
    
    async def get_tiered_view(
        self,
        content: Content,
        tier: TierLevel | str,
    ) -> str:
        """
        获取分层视图
        
        Args:
            content: 内容对象
            tier: 分层级别
            
        Returns:
            分层视图字符串
        """
        return await self._tiered.get_view(content, tier)
    
    def clear_tiered_cache(self) -> None:
        """清空分层视图缓存"""
        self._tiered.clear_cache()
    
    def get_tiered_cache_stats(self) -> dict[str, Any]:
        """获取分层视图缓存统计"""
        return self._tiered.get_cache_stats()
    
    # =========================================================================
    # 内部转换方法
    # =========================================================================
    
    def _document_to_content(self, doc: Document) -> Content:
        """将 Document 转换为 Content"""
        return Content(
            id=doc.id,
            uri=doc.uri,
            title=doc.title,
            body=doc.content,
            content_type=ContentType.NOTE,
            user_id=doc.user_id,
            agent_id=doc.agent_id,
            team_id=doc.team_id,
            is_global=doc.is_global,
            token_count=doc.token_count,
            source_url=doc.source_url,
            source_path=doc.source_path,
            metadata=doc.metadata,
        )
    
    def _conversation_to_content(self, conv: Conversation) -> Content:
        """将 Conversation 转换为 Content"""
        return Content(
            id=conv.id,
            uri=conv.uri,
            title=conv.title or f"Conversation {conv.id}",
            body=f"Conversation with {conv.message_count} messages",
            content_type=ContentType.CONVERSATION,
            user_id=conv.user_id,
            agent_id=conv.agent_id,
            team_id=conv.team_id,
            metadata={
                "source": conv.source,
                "message_count": conv.message_count,
                "token_count_input": conv.token_count_input,
                "token_count_output": conv.token_count_output,
            },
        )
    
    def _get_timestamp(self) -> int:
        """获取当前 Unix 秒时间戳"""
        return int(time.time())


# ============================================================================
# 辅助函数
# ============================================================================

def parse_resource_type(entity_type: EntityType) -> ResourceType:
    """将 EntityType 转换为 ResourceType"""
    mapping: dict[EntityType, ResourceType] = {
        EntityType.DOCUMENTS: "document",
        EntityType.ASSETS: "asset",
        EntityType.CONVERSATIONS: "conversation",
        EntityType.MESSAGES: "message",
        EntityType.FACTS: "fact",
    }
    return mapping.get(entity_type, "document")


__all__ = [
    "ContentLayer",
    "IndexLayerProtocol",
    "ResourceType",
    "SearchMode",
    "ContentCreateInput",
    "ContentUpdateInput",
    "ContentSearchQuery",
    "parse_resource_type",
]