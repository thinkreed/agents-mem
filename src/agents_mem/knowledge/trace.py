"""
追溯链模块 (Trace Chain)

构建事实的完整追溯链路:
Fact → L2 Content → L0/L1 视图 → 原始文档

追溯深度:
- 事实本身
- 分层内容 (tiered_content)
- 原始文档/资产 (documents/assets)

关键约束:
- L3 只读访问 L2
- 不修改原始内容
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from agents_mem.core.types import Content, TieredContent, TraceResult, Fact, EntityType, FactType, ContentType
from agents_mem.knowledge.facts import FactRecord, get_fact_by_id


# ============================================================================
# TraceChain 数据模型
# ============================================================================


class TraceChain(BaseModel):
    """
    追溯链

    表示单个事实的完整追溯路径。

    链路结构:
    1. fact: 原始事实
    2. tiered_content: 分层内容 (L0/L1)
    3. source_content: 原始来源内容
    """

    # 事实
    fact: FactRecord | None = Field(default=None, description="原始事实")

    # 分层内容
    tiered_content: TieredContent | None = Field(default=None, description="分层内容")

    # 原始来源
    source_content: Content | None = Field(default=None, description="原始来源内容")

    # 追溯链 URI
    trace_chain: list[str] = Field(
        default_factory=list,
        description="追溯链 URI 列表",
    )

    # L0/L1 摘要
    l0_abstract: str | None = Field(default=None, description="L0 抽象摘要")
    l1_overview: str | None = Field(default=None, description="L1 概要")

    # 统计信息
    depth: int = Field(default=0, description="追溯深度")
    total_tokens: int | None = Field(default=None, description="总 token 数")

    # 状态
    complete: bool = Field(default=False, description="是否完整追溯")
    missing_links: list[str] = Field(
        default_factory=list,
        description="缺失的链路节点",
    )

    def to_trace_result(self) -> TraceResult:
        """转换为 TraceResult 模型"""
        # 将 FactRecord 转换为 Fact
        fact_model: Fact | None = None
        if self.fact:
            # 转换 fact_type 从 str 到 FactType
            fact_type_enum: FactType
            try:
                fact_type_enum = FactType(self.fact.fact_type)
            except ValueError:
                fact_type_enum = FactType.OBSERVATION

            # 转换 source_type 从 str 到 EntityType
            source_type_enum: EntityType | None = None
            if self.fact.source_type:
                try:
                    source_type_enum = EntityType(self.fact.source_type.upper())
                except ValueError:
                    source_type_enum = EntityType.DOCUMENTS

            fact_model = Fact(
                id=self.fact.id,
                content=self.fact.content,
                fact_type=fact_type_enum,
                source_uri=self.fact.source_uri,
                source_type=source_type_enum,
                source_id=self.fact.source_id,
                user_id=self.fact.user_id,
                agent_id=self.fact.agent_id,
                team_id=self.fact.team_id,
                entities=self.fact.entities,
                importance=self.fact.importance,
                confidence=self.fact.confidence,
                verified=self.fact.verified,
            )

        return TraceResult(
            fact=fact_model,
            source_content=self.source_content,
            l0_abstract=self.l0_abstract,
            l1_overview=self.l1_overview,
            trace_chain=self.trace_chain,
            depth=self.depth,
            total_tokens=self.total_tokens,
        )


# ============================================================================
# TraceBuilder 类
# ============================================================================


class TraceBuilder:
    """
    追溯链构建器

    构建事实到原始来源的完整追溯链路。

    链路层级:
    - L3: 事实本身
    - L2: 分层内容 (tiered_content)
    - L0/L1: 原始文档/资产

    特性:
    - 只读访问原始内容
    - 支持 documents/assets 来源
    - 自动填充缺失链路信息

    用法:
        builder = TraceBuilder(db_connection)
        chain = await builder.build_trace(fact_id)
    """

    def __init__(self, db_connection: Any, openviking_client: Any | None = None):
        """
        初始化追溯链构建器

        Args:
            db_connection: 数据库连接
            openviking_client: OpenViking 客户端 (可选，用于获取 L0/L1)
        """
        self._db = db_connection
        self._openviking = openviking_client

    async def build_trace(self, fact_id: str) -> TraceChain:
        """
        构建事实的追溯链

        Args:
            fact_id: 事实 ID

        Returns:
            完整的追溯链
        """
        chain = TraceChain()

        # 1. 获取事实
        fact = await get_fact_by_id(fact_id, self._db)
        if not fact:
            chain.missing_links.append("fact")
            return chain

        chain.fact = fact
        chain.trace_chain.append(f"mem://{fact.user_id}/_/_/facts/{fact.id}")
        chain.depth = 1

        # 2. 获取分层内容
        tiered = await self._get_tiered_content(fact.source_type, fact.source_id)
        if tiered:
            chain.tiered_content = tiered
            chain.l0_abstract = tiered.abstract
            chain.l1_overview = tiered.overview
            chain.trace_chain.append(tiered.original_uri or "")
            chain.depth = 2

            # 尝试从 OpenViking 获取更详细的 L0/L1
            if self._openviking and tiered.original_uri:
                await self._fetch_from_openviking(chain, tiered.original_uri)
        else:
            chain.missing_links.append("tiered_content")

        # 3. 获取原始来源内容
        source_content = await self._get_source_content(fact.source_type, fact.source_id)
        if source_content:
            chain.source_content = source_content
            chain.trace_chain.append(source_content.uri)
            chain.depth = 3
            chain.complete = True
        else:
            chain.missing_links.append("source_content")

        # 计算总 token 数
        chain.total_tokens = self._estimate_tokens(chain)

        return chain

    async def build_trace_for_facts(
        self,
        fact_ids: list[str],
    ) -> list[TraceChain]:
        """
        批量构建追溯链

        Args:
            fact_ids: 事实 ID 列表

        Returns:
            追溯链列表
        """
        chains: list[TraceChain] = []
        for fact_id in fact_ids:
            chain = await self.build_trace(fact_id)
            chains.append(chain)
        return chains

    async def _get_tiered_content(
        self,
        source_type: str,
        source_id: str,
    ) -> TieredContent | None:
        """获取分层内容"""
        row = await self._db.query_one(
            """SELECT * FROM tiered_content
               WHERE source_type = ? AND source_id = ?""",
            [source_type, source_id],
        )

        if not row:
            return None

        # 处理时间戳
        created_at_ts = row.get("created_at")
        if isinstance(created_at_ts, (int, float)):
            created_at = datetime.fromtimestamp(created_at_ts)
        else:
            created_at = datetime.now()

        updated_at_ts = row.get("updated_at")
        if isinstance(updated_at_ts, (int, float)):
            updated_at = datetime.fromtimestamp(updated_at_ts)
        else:
            updated_at = datetime.now()

        return TieredContent(
            id=row["id"],
            source_type=EntityType(row["source_type"]),
            source_id=row["source_id"],
            original_uri=row.get("original_uri"),
            user_id=row["user_id"],
            agent_id=row.get("agent_id"),
            team_id=row.get("team_id"),
            abstract=row.get("abstract", ""),
            overview=row.get("overview"),
            importance=row.get("importance", 0.5),
            created_at=created_at,
            updated_at=updated_at,
        )

    async def _get_source_content(
        self,
        source_type: str,
        source_id: str,
    ) -> Content | None:
        """获取原始来源内容"""
        if source_type == "documents":
            row = await self._db.query_one(
                "SELECT * FROM documents WHERE id = ?",
                [source_id],
            )
        elif source_type == "assets":
            row = await self._db.query_one(
                "SELECT * FROM assets WHERE id = ?",
                [source_id],
            )
        else:
            return None

        if not row:
            return None

        # 构建 URI
        agent = row.get("agent_id") or "_"
        team = row.get("team_id") or "_"
        uri = f"mem://{row['user_id']}/{agent}/{team}/{source_type}/{source_id}"

        # 处理时间戳
        created_at_ts = row.get("created_at")
        if isinstance(created_at_ts, (int, float)):
            created_at = datetime.fromtimestamp(created_at_ts)
        else:
            created_at = datetime.now()

        updated_at_ts = row.get("updated_at")
        if isinstance(updated_at_ts, (int, float)):
            updated_at = datetime.fromtimestamp(updated_at_ts)
        else:
            updated_at = datetime.now()

        # 处理 content_type
        content_type_raw = row.get("doc_type") or row.get("file_type") or "note"
        try:
            content_type = ContentType(content_type_raw) if content_type_raw in ["article", "note", "url", "file", "conversation"] else ContentType.NOTE
        except ValueError:
            content_type = ContentType.NOTE

        return Content(
            id=row["id"],
            uri=uri,
            title=row.get("title", ""),
            body=row.get("content") or row.get("extracted_text") or "",
            content_type=content_type,
            user_id=row["user_id"],
            agent_id=row.get("agent_id"),
            team_id=row.get("team_id"),
            token_count=row.get("token_count"),
            created_at=created_at,
            updated_at=updated_at,
            source_url=row.get("source_url"),
            source_path=row.get("source_path"),
        )

    async def _fetch_from_openviking(
        self,
        chain: TraceChain,
        uri: str,
    ) -> None:
        """从 OpenViking 获取 L0/L1 内容"""
        if not self._openviking:
            return

        try:
            # 获取 L0 abstract
            if hasattr(self._openviking, "get_abstract"):
                abstract = await self._openviking.get_abstract(uri)
                if abstract and not chain.l0_abstract:
                    chain.l0_abstract = abstract

            # 获取 L1 overview
            if hasattr(self._openviking, "get_overview"):
                overview = await self._openviking.get_overview(uri)
                if overview and not chain.l1_overview:
                    chain.l1_overview = overview

        except Exception:
            pass

    def _estimate_tokens(self, chain: TraceChain) -> int:
        """估算总 token 数"""
        total = 0

        # 事实内容
        if chain.fact:
            total += len(chain.fact.content.split()) * 1.5

        # L0 摘要
        if chain.l0_abstract:
            total += len(chain.l0_abstract.split()) * 1.5

        # L1 概要
        if chain.l1_overview:
            total += len(chain.l1_overview.split()) * 1.5

        return int(total)


# ============================================================================
# 追溯辅助函数
# ============================================================================


async def trace_fact_to_source(
    fact_id: str,
    db_connection: Any,
    openviking_client: Any | None = None,
) -> TraceChain:
    """
    追溯事实到原始来源

    Args:
        fact_id: 事实 ID
        db_connection: 数据库连接
        openviking_client: OpenViking 客户端 (可选)

    Returns:
        追溯链
    """
    builder = TraceBuilder(db_connection, openviking_client)
    return await builder.build_trace(fact_id)


async def trace_all_facts_for_source(
    source_type: str,
    source_id: str,
    db_connection: Any,
) -> list[TraceChain]:
    """
    追溯来源的所有事实

    Args:
        source_type: 来源类型
        source_id: 来源 ID
        db_connection: 数据库连接

    Returns:
        追溯链列表
    """
    from agents_mem.knowledge.facts import get_facts_by_source

    facts = await get_facts_by_source(source_type, source_id, db_connection)
    builder = TraceBuilder(db_connection)

    chains: list[TraceChain] = []
    for fact in facts:
        chain = await builder.build_trace(fact.id)
        chains.append(chain)

    return chains


__all__ = [
    "TraceChain",
    "TraceBuilder",
    "trace_fact_to_source",
    "trace_all_facts_for_source",
]