"""
核心类型定义模块

定义 agents-mem 项目中使用的所有 Pydantic 数据模型。
使用 Pydantic v2 和 Python 3.11+ 类型注解。
"""

from datetime import datetime
from enum import Enum
from typing import Any, Self

from pydantic import BaseModel, ConfigDict, Field


# ============================================================================
# 枚举类型
# ============================================================================


class EntityType(str, Enum):
    """实体类型枚举"""

    DOCUMENTS = "documents"
    ASSETS = "assets"
    CONVERSATIONS = "conversations"
    MESSAGES = "messages"
    FACTS = "facts"
    TIERED = "tiered"
    ENTITY_NODES = "entity_nodes"


class ContentType(str, Enum):
    """内容类型枚举"""

    ARTICLE = "article"
    NOTE = "note"
    URL = "url"
    FILE = "file"
    CONVERSATION = "conversation"


class FactType(str, Enum):
    """事实类型枚举"""

    PREFERENCE = "preference"
    DECISION = "decision"
    OBSERVATION = "observation"
    CONCLUSION = "conclusion"


class SearchMode(str, Enum):
    """搜索模式枚举"""

    FTS = "fts"
    SEMANTIC = "semantic"
    HYBRID = "hybrid"
    PROGRESSIVE = "progressive"


class TierLevel(str, Enum):
    """分层级别枚举"""

    L0 = "L0"
    L1 = "L1"
    L2 = "L2"


# ============================================================================
# Scope - 作用域定义
# ============================================================================


class Scope(BaseModel):
    """
    作用域定义模型
    
    用于用户/代理/团队隔离，userId 必填，agentId/teamId 可选。
    使用 frozen=True 确保不可变性。
    """

    model_config = ConfigDict(frozen=True)

    user_id: str = Field(..., description="用户ID，必填")
    agent_id: str | None = Field(default=None, description="代理ID，可选")
    team_id: str | None = Field(default=None, description="团队ID，可选")
    is_global: bool = Field(default=False, description="是否全局作用域")

    def __str__(self) -> str:
        """返回 URI 格式的字符串表示"""
        agent = self.agent_id or "_"
        team = self.team_id or "_"
        return f"mem://{self.user_id}/{agent}/{team}"

    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        return {
            "userId": self.user_id,
            "agentId": self.agent_id,
            "teamId": self.team_id,
            "isGlobal": self.is_global,
        }


# ============================================================================
# MaterialURI - URI 结构
# ============================================================================


class MaterialURI(BaseModel):
    """
    Material URI 模型
    
    格式: mem://{userId}/{agentId}/{teamId}/{type}/{id}
    """

    model_config = ConfigDict(frozen=True)

    scheme: str = Field(default="mem", description="URI 方案")
    user_id: str = Field(..., description="用户ID")
    agent_id: str | None = Field(default=None, description="代理ID")
    team_id: str | None = Field(default=None, description="团队ID")
    entity_type: EntityType = Field(..., description="实体类型")
    resource_id: str = Field(..., description="资源ID")

    def to_string(self) -> str:
        """转换为 URI 字符串"""
        agent = self.agent_id or "_"
        team = self.team_id or "_"
        return (
            f"mem://{self.user_id}/{agent}/{team}/"
            f"{self.entity_type.value}/{self.resource_id}"
        )

    @classmethod
    def from_string(cls, uri: str) -> Self:
        """从 URI 字符串解析"""
        # mem://user123/agent1/_/documents/doc-456
        parts = uri.replace("mem://", "").split("/")
        if len(parts) < 5:
            raise ValueError(f"Invalid URI format: {uri}")

        user_id = parts[0]
        agent_id = parts[1] if parts[1] != "_" else None
        team_id = parts[2] if parts[2] != "_" else None
        entity_type = EntityType(parts[3])
        resource_id = parts[4]

        return cls(
            scheme="mem",
            user_id=user_id,
            agent_id=agent_id,
            team_id=team_id,
            entity_type=entity_type,
            resource_id=resource_id,
        )


# ============================================================================
# Content - 内容模型
# ============================================================================


class Content(BaseModel):
    """
    内容/文档模型
    
    对应系统中的文档、资产、对话等内容的核心模型。
    """

    model_config = ConfigDict(frozen=False)

    id: str = Field(..., description="内容唯一标识")
    uri: str = Field(..., description="Material URI")
    title: str = Field(..., description="内容标题")
    body: str = Field(..., description="内容主体")
    content_type: ContentType = Field(..., description="内容类型")

    # Scope 字段
    user_id: str = Field(..., description="用户ID")
    agent_id: str | None = Field(default=None, description="代理ID")
    team_id: str | None = Field(default=None, description="团队ID")
    is_global: bool = Field(default=False, description="是否全局")

    # 元数据
    token_count: int | None = Field(default=None, description="Token 数量")
    tier: TierLevel = Field(default=TierLevel.L2, description="分层级别")
    metadata: dict[str, Any] = Field(default_factory=dict, description="额外元数据")

    # 时间戳
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")

    # 来源信息
    source_url: str | None = Field(default=None, description="原始URL")
    source_path: str | None = Field(default=None, description="原始路径")

    # LanceDB ID (向量存储用)
    lance_id: str | None = Field(default=None, description="LanceDB 向量ID")

    def model_post_init(self, __context: Any) -> None:
        """Post-init 处理"""
        # 自动更新 updated_at
        self.updated_at = datetime.now()


# ============================================================================
# Fact - 事实模型
# ============================================================================


class Fact(BaseModel):
    """
    事实模型
    
    表示从内容中提取的原子事实，用于知识追溯。
    """

    model_config = ConfigDict(frozen=False)

    id: str = Field(..., description="事实唯一标识")
    content: str = Field(..., description="事实内容")

    # 类型与来源
    fact_type: FactType = Field(..., description="事实类型")
    source_uri: str | None = Field(default=None, description="来源 URI")
    source_type: EntityType | None = Field(default=None, description="来源类型")
    source_id: str | None = Field(default=None, description="来源ID")

    # Scope 字段
    user_id: str = Field(..., description="用户ID")
    agent_id: str | None = Field(default=None, description="代理ID")
    team_id: str | None = Field(default=None, description="团队ID")
    is_global: bool = Field(default=False, description="是否全局")

    # 事实属性
    entities: list[str] = Field(default_factory=list, description="关联实体列表")
    importance: float = Field(default=0.5, ge=0.0, le=1.0, description="重要性评分")
    confidence: float = Field(default=0.5, ge=0.0, le=1.0, description="置信度")
    verified: bool = Field(default=False, description="是否已验证")

    # 提取信息
    extraction_mode: str | None = Field(
        default=None,
        description="提取模式: async_batch | on_demand | realtime",
    )
    extracted_at: datetime | None = Field(default=None, description="提取时间")

    # 时间戳
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")


# ============================================================================
# SearchResult - 搜索结果
# ============================================================================


class SearchResult(BaseModel):
    """
    搜索结果模型
    
    表示语义搜索或混合搜索的返回结果。
    """

    model_config = ConfigDict(frozen=True)

    uri: str = Field(..., description="资源 URI")
    score: float = Field(..., ge=0.0, le=1.0, description="相关性分数")

    # 内容摘要
    title: str | None = Field(default=None, description="标题")
    content: str | None = Field(default=None, description="内容摘要")

    # 元数据
    metadata: dict[str, Any] = Field(default_factory=dict, description="额外元数据")
    entity_type: EntityType | None = Field(default=None, description="实体类型")
    resource_id: str | None = Field(default=None, description="资源ID")


# ============================================================================
# TraceResult - 追溯结果
# ============================================================================


class TraceResult(BaseModel):
    """
    追溯结果模型
    
    用于事实追溯，返回完整上下文链：
    fact -> tiered content -> source content
    """

    model_config = ConfigDict(frozen=True)

    # 事实
    fact: Fact | None = Field(default=None, description="关联的事实")

    # 原始内容
    source_content: Content | None = Field(default=None, description="原始内容")

    # 分层摘要
    l0_abstract: str | None = Field(default=None, description="L0 抽象摘要")
    l1_overview: str | None = Field(default=None, description="L1 概要")

    # 追溯链
    trace_chain: list[str] = Field(
        default_factory=list,
        description="追溯链 URI 列表",
    )

    # 元数据
    depth: int = Field(default=0, description="追溯深度")
    total_tokens: int | None = Field(default=None, description="总 token 数")


# ============================================================================
# Entity - 实体模型
# ============================================================================


class Entity(BaseModel):
    """
    实体模型
    
    表示知识图谱中的实体节点。
    """

    model_config = ConfigDict(frozen=False)

    id: str = Field(..., description="实体唯一标识")
    name: str = Field(..., description="实体名称")
    entity_type: str = Field(..., description="实体类型")

    # Scope 字段
    user_id: str = Field(..., description="用户ID")
    agent_id: str | None = Field(default=None, description="代理ID")
    team_id: str | None = Field(default=None, description="团队ID")

    # 属性与关系
    attributes: dict[str, Any] = Field(default_factory=dict, description="实体属性")
    relations: list[dict[str, Any]] = Field(
        default_factory=list,
        description="关联关系列表",
    )

    # 重要性与置信度
    importance: float = Field(default=0.5, ge=0.0, le=1.0, description="重要性评分")
    confidence: float = Field(default=0.5, ge=0.0, le=1.0, description="置信度")

    # 时间戳
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")

    # 嵌入向量 (可选，用于语义搜索)
    embedding: list[float] | None = Field(default=None, description="嵌入向量")


# ============================================================================
# TieredContent - 分层内容
# ============================================================================


class TieredContent(BaseModel):
    """
    分层内容模型
    
    包装原始内容的 L0/L1/L2 分层摘要。
    """

    model_config = ConfigDict(frozen=False)

    id: str = Field(..., description="分层内容唯一标识")

    # 来源信息
    source_type: EntityType = Field(..., description="来源实体类型")
    source_id: str = Field(..., description="来源ID")
    original_uri: str | None = Field(default=None, description="原始 URI")

    # Scope 字段
    user_id: str = Field(..., description="用户ID")
    agent_id: str | None = Field(default=None, description="代理ID")
    team_id: str | None = Field(default=None, description="团队ID")

    # 分层内容
    abstract: str = Field(..., description="L0 抽象摘要 (~50-100 tokens)")
    overview: str | None = Field(default=None, description="L1 概要 (~500-2000 tokens)")

    # 生成信息
    importance: float = Field(default=0.5, ge=0.0, le=1.0, description="重要性评分")
    generation_mode: str | None = Field(
        default=None,
        description="生成模式: realtime | async_batch | on_demand",
    )

    # LanceDB IDs
    lance_id_l0: str | None = Field(default=None, description="L0 LanceDB ID")
    lance_id_l1: str | None = Field(default=None, description="L1 LanceDB ID")

    # 生成时间
    l0_generated_at: datetime | None = Field(default=None, description="L0 生成时间")
    l1_generated_at: datetime | None = Field(default=None, description="L1 生成时间")

    # 时间戳
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")


# ============================================================================
# 导出
# ============================================================================

__all__ = [
    # 枚举
    "EntityType",
    "ContentType",
    "FactType",
    "SearchMode",
    "TierLevel",
    # 模型
    "Scope",
    "MaterialURI",
    "Content",
    "Fact",
    "SearchResult",
    "TraceResult",
    "Entity",
    "TieredContent",
]
