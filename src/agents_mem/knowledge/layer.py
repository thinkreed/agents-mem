"""
L3 Knowledge Layer 主模块

知识层核心功能整合:
- 事实提取 (从 L2 内容)
- 实体聚合 (构建实体关联网络)
- 知识追溯 (Fact → Source → Content 完整链路)

关键约束:
- L3 只能读取 L2，不能修改原始内容
- 通过 content_layer.get() 获取 L2 内容
"""

from typing import Any

from agents_mem.core.types import Scope, Fact, TraceResult, FactType, EntityType
from agents_mem.core.uri import URISystem
from agents_mem.knowledge.facts import (
    FactExtractor,
    FactRecord,
    ExtractedFact,
    get_fact_by_id,
    get_facts_by_scope,
    search_facts,
)
from agents_mem.knowledge.entities import (
    EntityTree,
    EntityNode,
    EntityAggregator,
    THRESHOLD_BASE,
    save_entity_tree,
)
from agents_mem.knowledge.trace import (
    TraceBuilder,
    TraceChain,
)


# ============================================================================
# ContentLayer 接口协议
# ============================================================================


class ContentLayerProtocol:
    """
    Content Layer 接口协议 (Protocol)

    L3 通过此接口读取 L2 内容，不修改原始数据。

    必需方法:
    - get(content_uri): 获取内容
    - get_by_id(content_id): 根据 ID 获取内容
    - get_tiered(content_id, tier): 获取分层内容
    """

    async def get(self, content_uri: str) -> Any:
        """根据 URI 获取内容"""
        raise NotImplementedError

    async def get_by_id(self, content_id: str) -> Any:
        """根据 ID 获取内容"""
        raise NotImplementedError

    async def get_tiered(self, content_id: str, tier: str) -> Any:
        """获取分层内容 (L0/L1/L2)"""
        raise NotImplementedError


# ============================================================================
# KnowledgeLayer 主类
# ============================================================================


class KnowledgeLayer:
    """
    L3 Knowledge Layer 主类

    整合事实提取、实体聚合和知识追溯功能。

    职责:
    - 事实提取: 从 L2 内容中提取原子事实
    - 实体聚合: 构建实体关联网络
    - 知识追溯: Fact → Source → Content 完整链路

    关键约束:
    - L3 只读访问 L2 (通过 content_layer.get())
    - 不修改原始内容
    - Facts 独立存储

    用法:
        layer = KnowledgeLayer(content_layer, db_connection, llm_client)

        # 提取事实
        facts = await layer.extract_facts(content_uri, scope)

        # 获取事实
        fact = await layer.get_fact(fact_id)

        # 搜索事实
        facts = await layer.search_facts(query, scope)

        # 追溯事实
        trace = await layer.trace_fact(fact_id)

        # 实体聚合
        tree = await layer.aggregate_entities(scope)
    """

    def __init__(
        self,
        content_layer: Any,
        db_connection: Any,
        llm_client: Any,
        openviking_client: Any | None = None,
    ):
        """
        初始化 Knowledge Layer

        Args:
            content_layer: L2 Content Layer 实例 (只读访问)
            db_connection: 数据库连接
            llm_client: LLM 客户端 (用于事实提取)
            openviking_client: OpenViking 客户端 (可选，用于追溯)
        """
        self._content_layer = content_layer
        self._db = db_connection
        self._llm = llm_client
        self._openviking = openviking_client

        # 子模块实例
        self._fact_extractor = FactExtractor(llm_client)
        self._entity_aggregator = EntityAggregator(llm_client)
        self._trace_builder = TraceBuilder(db_connection, openviking_client)

    # =========================================================================
    # 事实提取
    # =========================================================================

    async def extract_facts(
        self,
        content_uri: str,
        scope: Scope,
    ) -> list[Fact]:
        """
        从内容中提取事实

        流程:
        1. 通过 content_layer.get() 获取 L2 内容
        2. 使用 LLM 提取原子事实
        3. 存储事实到数据库

        Args:
            content_uri: 内容 URI (mem:// 格式)
            scope: 作用域

        Returns:
            提取的事实列表
        """
        # 解析 URI 获取来源信息
        try:
            uri_obj = URISystem.parse(content_uri)
            # resource_type 对应 EntityType，需要转换
            resource_type = uri_obj.resource_type
            # 将 resource_type 转换为 EntityType
            try:
                source_type = EntityType(resource_type.upper())
            except ValueError:
                # 默认使用 DOCUMENTS
                source_type = EntityType.DOCUMENTS
            source_id = uri_obj.resource_id
        except Exception:
            # 如果 URI 解析失败，尝试从 content_layer 获取
            source_type = EntityType.DOCUMENTS
            source_id = ""

        # 从 L2 获取内容 (只读)
        content_data = await self._get_content_from_layer(content_uri, source_id)

        if not content_data:
            return []

        # 提取内容文本
        content_text = self._extract_text(content_data)
        if not content_text:
            return []

        # 使用 LLM 提取事实
        extracted_facts = await self._fact_extractor.extract(content_text)

        # 保存事实到数据库
        fact_records = await self._save_facts(
            extracted_facts,
            scope,
            source_type,
            source_id,
            content_uri,
        )

        # 转换为 Fact 模型
        return self._records_to_facts(fact_records)

    async def _get_content_from_layer(
        self,
        content_uri: str,
        source_id: str,
    ) -> Any:
        """从 Content Layer 获取内容 (只读)"""
        # 尝试使用 content_layer 的 get 方法
        if hasattr(self._content_layer, "get"):
            return await self._content_layer.get(content_uri)

        # 尝试使用 get_by_id 方法
        if hasattr(self._content_layer, "get_by_id") and source_id:
            return await self._content_layer.get_by_id(source_id)

        # 直接查询数据库
        if source_id:
            row = await self._db.query_one(
                "SELECT * FROM documents WHERE id = ?",
                [source_id],
            )
            return row

        return None

    def _extract_text(self, content_data: Any) -> str:
        """从内容数据中提取文本"""
        if isinstance(content_data, dict):
            text: Any = content_data.get("content") or content_data.get("body") or ""
            return str(text) if text else ""
        if hasattr(content_data, "content"):
            return str(content_data.content)
        if hasattr(content_data, "body"):
            return str(content_data.body)
        return str(content_data) if content_data else ""

    async def _save_facts(
        self,
        extracted_facts: list[ExtractedFact],
        scope: Scope,
        source_type: EntityType,
        source_id: str,
        source_uri: str,
    ) -> list[FactRecord]:
        """保存提取的事实到数据库"""
        import uuid
        import json
        from datetime import datetime

        fact_records: list[FactRecord] = []
        now = datetime.now()

        for fact in extracted_facts:
            fact_id = str(uuid.uuid4())

            # 插入数据库
            await self._db.run(
                """INSERT INTO facts (
                    id, user_id, agent_id, team_id, is_global,
                    source_type, source_id, source_uri,
                    content, fact_type, entities,
                    importance, confidence, verified,
                    extraction_mode, extracted_at,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [
                    fact_id,
                    scope.user_id,
                    scope.agent_id,
                    scope.team_id,
                    scope.is_global,
                    source_type.value,
                    source_id,
                    source_uri,
                    fact.content,
                    fact.fact_type.value,
                    json.dumps(fact.entities),
                    0.5,
                    fact.confidence,
                    False,
                    "on_demand",
                    now.timestamp(),
                    now.timestamp(),
                    now.timestamp(),
                ],
            )

            # 创建 FactRecord
            fact_records.append(
                FactRecord(
                    id=fact_id,
                    user_id=scope.user_id,
                    agent_id=scope.agent_id,
                    team_id=scope.team_id,
                    is_global=scope.is_global,
                    source_type=source_type.value,
                    source_id=source_id,
                    source_uri=source_uri,
                    content=fact.content,
                    fact_type=fact.fact_type.value,
                    entities=fact.entities,
                    importance=0.5,
                    confidence=fact.confidence,
                    verified=False,
                    extraction_mode="on_demand",
                    extracted_at=now,
                    created_at=now,
                    updated_at=now,
                )
            )

        return fact_records

    def _records_to_facts(self, records: list[FactRecord]) -> list[Fact]:
        """将 FactRecord 转换为 Fact 模型"""
        facts: list[Fact] = []

        for record in records:
            fact_type = FactType(record.fact_type)
            facts.append(
                Fact(
                    id=record.id,
                    content=record.content,
                    fact_type=fact_type,
                    source_uri=record.source_uri,
                    source_type=EntityType(record.source_type),
                    source_id=record.source_id,
                    user_id=record.user_id,
                    agent_id=record.agent_id,
                    team_id=record.team_id,
                    is_global=record.is_global,
                    entities=record.entities,
                    importance=record.importance,
                    confidence=record.confidence,
                    verified=record.verified,
                    extraction_mode=record.extraction_mode,
                    extracted_at=record.extracted_at,
                    created_at=record.created_at,
                    updated_at=record.updated_at,
                )
            )

        return facts

    # =========================================================================
    # 事实读取
    # =========================================================================

    async def get_fact(self, fact_id: str) -> Fact | None:
        """
        根据 ID 获取事实

        Args:
            fact_id: 事实 ID

        Returns:
            事实模型，不存在时返回 None
        """
        record = await get_fact_by_id(fact_id, self._db)
        if not record:
            return None

        return self._record_to_fact(record)

    def _record_to_fact(self, record: FactRecord) -> Fact:
        """将单个 FactRecord 转换为 Fact"""
        return Fact(
            id=record.id,
            content=record.content,
            fact_type=FactType(record.fact_type),
            source_uri=record.source_uri,
            source_type=EntityType(record.source_type),
            source_id=record.source_id,
            user_id=record.user_id,
            agent_id=record.agent_id,
            team_id=record.team_id,
            is_global=record.is_global,
            entities=record.entities,
            importance=record.importance,
            confidence=record.confidence,
            verified=record.verified,
            extraction_mode=record.extraction_mode,
            extracted_at=record.extracted_at,
            created_at=record.created_at,
            updated_at=record.updated_at,
        )

    async def search_facts(
        self,
        query: str,
        scope: Scope,
        fact_type: FactType | None = None,
    ) -> list[Fact]:
        """
        搜索事实

        Args:
            query: 搜索关键词
            scope: 作用域
            fact_type: 过滤事实类型 (可选)

        Returns:
            匹配的事实列表
        """
        records = await search_facts(
            query,
            scope,
            self._db,
            fact_type,
        )
        return self._records_to_facts(records)

    async def get_facts_by_content(
        self,
        content_uri: str,
    ) -> list[Fact]:
        """
        根据内容 URI 获取关联事实

        Args:
            content_uri: 内容 URI

        Returns:
            关联的事实列表
        """
        try:
            uri_obj = URISystem.parse(content_uri)
            source_type = uri_obj.resource_type
            source_id = uri_obj.resource_id
        except Exception:
            return []

        from agents_mem.knowledge.facts import get_facts_by_source

        records = await get_facts_by_source(source_type, source_id, self._db)
        return self._records_to_facts(records)

    # =========================================================================
    # 知识追溯
    # =========================================================================

    async def trace_fact(self, fact_id: str) -> TraceResult:
        """
        追溯事实到原始来源

        追溯链: Fact → L2 Content → L0/L1 视图 → 原始文档

        Args:
            fact_id: 事实 ID

        Returns:
            追溯结果
        """
        chain = await self._trace_builder.build_trace(fact_id)
        return chain.to_trace_result()

    async def trace_fact_chain(self, fact_id: str) -> TraceChain:
        """
        追溯事实链 (详细版本)

        返回完整的 TraceChain 对象，包含:
        - fact: 原始事实
        - tiered_content: 分层内容
        - source_content: 原始来源
        - trace_chain: URI 链路
        - 完整性状态

        Args:
            fact_id: 事实 ID

        Returns:
            追溯链对象
        """
        return await self._trace_builder.build_trace(fact_id)

    # =========================================================================
    # 实体聚合
    # =========================================================================

    async def aggregate_entities(
        self,
        scope: Scope,
        threshold: float = THRESHOLD_BASE,
    ) -> EntityTree:
        """
        实体聚合

        从事实中提取实体，构建实体关联网络。

        流程:
        1. 获取 scope 内的所有事实
        2. 提取实体信息
        3. 构建阈值树

        Args:
            scope: 作用域
            threshold: 基础阈值 (θ₀)

        Returns:
            实体树
        """
        # 获取事实
        fact_records = await get_facts_by_scope(scope, self._db)

        if not fact_records:
            return EntityTree(
                user_id=scope.user_id,
                agent_id=scope.agent_id,
                team_id=scope.team_id,
            )

        # 提取实体
        entities = self._entity_aggregator.extract_entities(fact_records)

        # 推断实体类型 (可选)
        if self._llm:
            entities = await self._entity_aggregator.infer_entity_types(entities)

        # 构建实体树
        tree = self._entity_aggregator.build_tree(entities, threshold)

        # 保存到数据库
        await save_entity_tree(tree, self._db)

        return tree

    async def get_entity_tree(
        self,
        scope: Scope,
    ) -> EntityTree | None:
        """
        获取已有的实体树

        Args:
            scope: 作用域

        Returns:
            实体树 (如果存在)
        """
        from agents_mem.knowledge.entities import get_entity_nodes_by_scope

        nodes = await get_entity_nodes_by_scope(scope, self._db)

        if not nodes:
            return None

        # 重建树结构
        node_map: dict[str, EntityNode] = {n.id: n for n in nodes}
        root_nodes: list[str] = [n.id for n in nodes if n.parent_id is None]

        # 填充子节点关系
        for node in nodes:
            if node.parent_id and node.parent_id in node_map:
                node_map[node.parent_id].children.append(node.id)

        max_depth = max(n.depth for n in nodes) if nodes else 0
        total_entities = len(nodes)
        total_facts = sum(n.fact_count for n in nodes)

        return EntityTree(
            user_id=scope.user_id,
            agent_id=scope.agent_id,
            team_id=scope.team_id,
            root_nodes=root_nodes,
            nodes=node_map,
            total_entities=total_entities,
            total_facts=total_facts,
            max_depth=max_depth,
        )

    # =========================================================================
    # Content Layer 只读访问
    # =========================================================================

    async def get_content(self, content_uri: str) -> Any:
        """
        获取 L2 内容 (只读)

        通过 content_layer 获取，不修改原始数据。

        Args:
            content_uri: 内容 URI

        Returns:
            内容数据
        """
        return await self._get_content_from_layer(content_uri, "")

    async def get_tiered_content(
        self,
        content_id: str,
        tier: str,
    ) -> Any:
        """
        获取分层内容 (L0/L1/L2)

        Args:
            content_id: 内容 ID
            tier: 层级 (L0, L1, L2)

        Returns:
            分层内容
        """
        if hasattr(self._content_layer, "get_tiered"):
            return await self._content_layer.get_tiered(content_id, tier)

        # 直接查询数据库
        if tier == "L2":
            return await self._db.query_one(
                "SELECT * FROM documents WHERE id = ?",
                [content_id],
            )

        if tier in ("L0", "L1"):
            row = await self._db.query_one(
                "SELECT * FROM tiered_content WHERE source_id = ?",
                [content_id],
            )
            if row:
                return {
                    "abstract": row.get("abstract"),
                    "overview": row.get("overview"),
                }

        return None

    # =========================================================================
    # 统计与状态
    # =========================================================================

    async def get_statistics(self, scope: Scope) -> dict[str, Any]:
        """
        获取知识层统计信息

        Args:
            scope: 作用域

        Returns:
            统计信息字典
        """
        facts = await get_facts_by_scope(scope, self._db)

        # 按类型统计
        type_counts: dict[str, int] = {}
        for fact in facts:
            type_counts[fact.fact_type] = type_counts.get(fact.fact_type, 0) + 1

        # 平均置信度
        avg_confidence = 0.0
        if facts:
            avg_confidence = sum(f.confidence for f in facts) / len(facts)

        # 实体统计
        entity_tree = await self.get_entity_tree(scope)

        return {
            "total_facts": len(facts),
            "facts_by_type": type_counts,
            "average_confidence": avg_confidence,
            "total_entities": entity_tree.total_entities if entity_tree else 0,
            "max_depth": entity_tree.max_depth if entity_tree else 0,
        }


__all__ = [
    "KnowledgeLayer",
    "ContentLayerProtocol",
]