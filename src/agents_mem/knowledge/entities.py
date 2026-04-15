"""
实体聚合模块 (Entity Aggregation)

构建实体关联网络，使用阈值树进行层级聚合。

阈值公式: θ(d) = θ₀ × e^(λd)
- θ₀ = 0.7 (基础阈值)
- λ = 0.1 (衰减系数)
- d = 深度层级

深度阈值示例:
- d=0: θ=0.70
- d=1: θ=0.77
- d=2: θ=0.85
- d=3: θ=0.93
"""

import json
import math
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from agents_mem.core.types import Scope
from agents_mem.knowledge.facts import FactRecord


# ============================================================================
# 阈值参数
# ============================================================================

# 基础阈值 (θ₀)
THRESHOLD_BASE = 0.7

# 衰减系数 (λ)
THRESHOLD_LAMBDA = 0.1


def compute_threshold(depth: int, theta_0: float = THRESHOLD_BASE, lambda_: float = THRESHOLD_LAMBDA) -> float:
    """
    计算深度阈值

    公式: θ(d) = θ₀ × e^(λd)

    Args:
        depth: 深度层级 (0, 1, 2, ...)
        theta_0: 基础阈值 (默认 0.7)
        lambda_: 衰减系数 (默认 0.1)

    Returns:
        该深度的阈值值
    """
    return theta_0 * math.exp(lambda_ * depth)


# ============================================================================
# EntityNode 数据模型
# ============================================================================


class EntityNode(BaseModel):
    """
    实体节点

    实体树中的单个节点，包含:
    - 实体名称和类型
    - 关联事实
    - 子节点
    - 聚合内容
    """

    # 基本属性
    id: str = Field(..., description="节点唯一标识")
    name: str = Field(..., description="实体名称")
    entity_type: str = Field(default="unknown", description="实体类型")

    # Scope
    user_id: str = Field(..., description="用户 ID")
    agent_id: str | None = Field(default=None, description="代理 ID")
    team_id: str | None = Field(default=None, description="团队 ID")

    # 关联信息
    fact_ids: list[str] = Field(default_factory=list, description="关联事实 ID")
    fact_count: int = Field(default=0, description="事实数量")

    # 层级信息
    depth: int = Field(default=0, ge=0, description="深度层级")
    parent_id: str | None = Field(default=None, description="父节点 ID")
    children: list[str] = Field(default_factory=list, description="子节点 ID 列表")

    # 聚合内容
    aggregated_content: str | None = Field(default=None, description="聚合后的内容摘要")
    importance: float = Field(default=0.5, ge=0.0, le=1.0, description="重要性")

    # 时间戳
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")

    def get_threshold(self) -> float:
        """获取当前深度的阈值"""
        return compute_threshold(self.depth)

    def can_add_child(self, child_importance: float) -> bool:
        """
        检查是否可以添加子节点

        子节点的重要性必须超过当前深度的阈值才能添加。

        Args:
            child_importance: 子节点重要性

        Returns:
            是否满足阈值要求
        """
        threshold = self.get_threshold()
        return child_importance >= threshold


# ============================================================================
# EntityTree 数据模型
# ============================================================================


class EntityTree(BaseModel):
    """
    实体树

    实体聚合的结果，包含:
    - 根节点列表
    - 所有节点映射
    - 统计信息
    """

    # Scope
    user_id: str = Field(..., description="用户 ID")
    agent_id: str | None = Field(default=None, description="代理 ID")
    team_id: str | None = Field(default=None, description="团队 ID")

    # 树结构
    root_nodes: list[str] = Field(default_factory=list, description="根节点 ID 列表")
    nodes: dict[str, EntityNode] = Field(default_factory=dict, description="节点映射")

    # 统计信息
    total_entities: int = Field(default=0, description="总实体数")
    total_facts: int = Field(default=0, description="总事实数")
    max_depth: int = Field(default=0, description="最大深度")

    # 元数据
    threshold_base: float = Field(default=THRESHOLD_BASE, description="基础阈值")
    threshold_lambda: float = Field(default=THRESHOLD_LAMBDA, description="衰减系数")

    def get_node(self, node_id: str) -> EntityNode | None:
        """获取节点"""
        return self.nodes.get(node_id)

    def get_root_nodes(self) -> list[EntityNode]:
        """获取所有根节点"""
        return [self.nodes[id_] for id_ in self.root_nodes if id_ in self.nodes]

    def get_children(self, node_id: str) -> list[EntityNode]:
        """获取节点的子节点"""
        node = self.get_node(node_id)
        if not node:
            return []
        return [self.nodes[id_] for id_ in node.children if id_ in self.nodes]

    def get_fact_count(self, node_id: str) -> int:
        """获取节点及其子节点的总事实数"""
        node = self.get_node(node_id)
        if not node:
            return 0

        count = node.fact_count
        for child_id in node.children:
            count += self.get_fact_count(child_id)
        return count


# ============================================================================
# EntityAggregator 类
# ============================================================================


class EntityAggregator:
    """
    实体聚合器

    从事实中提取实体，构建实体关联网络。

    特性:
    - 实体提取 (从事实中识别实体名称)
    - 阈值树构建 (基于重要性层级聚合)
    - 实体类型推断

    用法:
        aggregator = EntityAggregator(llm_client)
        entities = aggregator.extract_entities(facts)
        tree = aggregator.build_tree(entities, threshold=0.7)
    """

    def __init__(self, llm_client: Any | None = None):
        """
        初始化实体聚合器

        Args:
            llm_client: LLM 客户端 (可选，用于实体类型推断)
        """
        self._llm_client = llm_client

    def extract_entities(self, facts: list[FactRecord]) -> list[dict[str, Any]]:
        """
        从事实列表中提取实体

        Args:
            facts: 事实记录列表

        Returns:
            实体信息列表 [{name, type, importance, fact_ids}]
        """
        entity_map: dict[str, dict[str, Any]] = {}

        for fact in facts:
            for entity_name in fact.entities:
                entity_name = entity_name.strip()
                if not entity_name:
                    continue

                if entity_name not in entity_map:
                    entity_map[entity_name] = {
                        "name": entity_name,
                        "type": "unknown",
                        "importance": fact.importance,
                        "confidence": fact.confidence,
                        "fact_ids": [fact.id],
                        "user_id": fact.user_id,
                        "agent_id": fact.agent_id,
                        "team_id": fact.team_id,
                    }
                else:
                    # 合并信息
                    existing = entity_map[entity_name]
                    existing["importance"] = max(existing["importance"], fact.importance)
                    existing["confidence"] = max(existing["confidence"], fact.confidence)
                    existing["fact_ids"].append(fact.id)

        return list(entity_map.values())

    def build_tree(
        self,
        entities: list[dict[str, Any]],
        threshold: float = THRESHOLD_BASE,
    ) -> EntityTree:
        """
        构建实体树

        Args:
            entities: 实体信息列表
            threshold: 根节点阈值 (θ₀)

        Returns:
            构建的实体树
        """
        if not entities:
            # 返回空树
            first_entity = entities[0] if entities else {}
            return EntityTree(
                user_id=first_entity.get("user_id", ""),
                agent_id=first_entity.get("agent_id"),
                team_id=first_entity.get("team_id"),
            )

        # 获取 scope
        first_entity = entities[0]
        user_id = first_entity.get("user_id", "")
        agent_id = first_entity.get("agent_id")
        team_id = first_entity.get("team_id")

        # 创建节点映射
        nodes: dict[str, EntityNode] = {}
        entity_to_node: dict[str, str] = {}

        # 为每个实体创建节点
        import uuid

        for entity in entities:
            node_id = str(uuid.uuid4())
            entity_name = entity["name"]

            node = EntityNode(
                id=node_id,
                name=entity_name,
                entity_type=entity.get("type", "unknown"),
                user_id=user_id,
                agent_id=agent_id,
                team_id=team_id,
                fact_ids=entity.get("fact_ids", []),
                fact_count=len(entity.get("fact_ids", [])),
                depth=0,  # 初始为根节点候选
                importance=entity.get("importance", 0.5),
            )

            nodes[node_id] = node
            entity_to_node[entity_name] = node_id

        # 按重要性排序
        sorted_entities = sorted(
            entities,
            key=lambda e: e.get("importance", 0.5),
            reverse=True,
        )

        # 确定根节点 (重要性超过阈值)
        root_nodes: list[str] = []
        assigned_children: set[str] = set()

        for entity in sorted_entities:
            node_id = entity_to_node.get(entity["name"])
            if not node_id:
                continue

            node = nodes[node_id]
            node.importance = entity.get("importance", 0.5)

            # 如果重要性超过阈值且未被分配为子节点
            if node.importance >= threshold and node_id not in assigned_children:
                root_nodes.append(node_id)
                node.depth = 0
                node.parent_id = None

        # 如果没有根节点，选择最重要的作为根
        if not root_nodes and sorted_entities:
            most_important = sorted_entities[0]
            node_id = entity_to_node.get(most_important["name"])
            if node_id:
                root_nodes.append(node_id)
                nodes[node_id].depth = 0
                nodes[node_id].parent_id = None

        # 构建层级结构 (简化实现: 所有非根节点作为根节点的子节点)
        for entity in sorted_entities:
            node_id = entity_to_node.get(entity["name"])
            if not node_id or node_id in root_nodes:
                continue

            node = nodes[node_id]

            # 找到可以接受的父节点
            parent_found = False
            for root_id in root_nodes:
                parent = nodes[root_id]
                if parent.can_add_child(node.importance):
                    node.depth = parent.depth + 1
                    node.parent_id = root_id
                    parent.children.append(node_id)
                    assigned_children.add(node_id)
                    parent_found = True
                    break

            # 如果没有找到父节点，作为根节点
            if not parent_found:
                root_nodes.append(node_id)
                node.depth = 0
                node.parent_id = None

        # 计算统计信息
        total_entities = len(nodes)
        total_facts = sum(n.fact_count for n in nodes.values())
        max_depth = max(n.depth for n in nodes.values()) if nodes else 0

        return EntityTree(
            user_id=user_id,
            agent_id=agent_id,
            team_id=team_id,
            root_nodes=root_nodes,
            nodes=nodes,
            total_entities=total_entities,
            total_facts=total_facts,
            max_depth=max_depth,
            threshold_base=threshold,
            threshold_lambda=THRESHOLD_LAMBDA,
        )

    async def infer_entity_types(
        self,
        entities: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """
        推断实体类型 (使用 LLM)

        Args:
            entities: 实体信息列表

        Returns:
            带有推断类型的实体列表
        """
        if not self._llm_client or not entities:
            return entities

        # 构建实体名称列表
        entity_names = [e["name"] for e in entities]
        prompt = f"""Classify the following entities into types (person, project, concept, tool, organization, location, other):

Entities: {json.dumps(entity_names)}

Output as JSON array of objects with name and type fields."""

        try:
            if hasattr(self._llm_client, "generate_json"):
                result: Any = await self._llm_client.generate_json(prompt, [])
            elif hasattr(self._llm_client, "generate"):
                text = await self._llm_client.generate(prompt)
                result = json.loads(text.strip())
            else:
                return entities

            # 更新实体类型
            if isinstance(result, list):
                type_map: dict[str, str] = {}
                for r in result:
                    if isinstance(r, dict):
                        name = r.get("name")
                        type_val = r.get("type", "unknown")
                        if name and isinstance(name, str) and isinstance(type_val, str):
                            type_map[name] = type_val

                for entity in entities:
                    inferred_type = type_map.get(entity["name"])
                    if inferred_type:
                        entity["type"] = inferred_type

            return entities

        except Exception:
            return entities


# ============================================================================
# 实体数据库操作辅助函数
# ============================================================================


async def save_entity_tree(
    tree: EntityTree,
    db_connection: Any,
) -> list[str]:
    """
    保存实体树到数据库

    Args:
        tree: 实体树
        db_connection: 数据库连接

    Returns:
        保存的节点 ID 列表
    """
    node_ids: list[str] = []
    now = datetime.now().timestamp()

    for node_id, node in tree.nodes.items():
        await db_connection.run(
            """INSERT OR REPLACE INTO entity_nodes (
                id, user_id, agent_id, team_id,
                name, entity_type, depth, parent_id,
                fact_ids, fact_count, importance,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                node_id,
                node.user_id,
                node.agent_id,
                node.team_id,
                node.name,
                node.entity_type,
                node.depth,
                node.parent_id,
                json.dumps(node.fact_ids),
                node.fact_count,
                node.importance,
                now,
                now,
            ],
        )
        node_ids.append(node_id)

    return node_ids


async def get_entity_nodes_by_scope(
    scope: Scope,
    db_connection: Any,
) -> list[EntityNode]:
    """根据作用域获取实体节点"""
    sql = "SELECT * FROM entity_nodes WHERE user_id = ?"
    params: list[Any] = [scope.user_id]

    if scope.agent_id:
        sql += " AND agent_id = ?"
        params.append(scope.agent_id)

    if scope.team_id:
        sql += " AND team_id = ?"
        params.append(scope.team_id)

    rows = await db_connection.query(sql, params)
    return [_row_to_entity_node(row) for row in rows]


def _row_to_entity_node(row: dict[str, Any]) -> EntityNode:
    """将数据库行转换为 EntityNode"""
    fact_ids_raw = row.get("fact_ids", "[]")
    fact_ids: list[str]
    if isinstance(fact_ids_raw, str):
        parsed: Any = json.loads(fact_ids_raw)
        fact_ids = parsed if isinstance(parsed, list) else []
    else:
        fact_ids = list(fact_ids_raw) if fact_ids_raw else []

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

    return EntityNode(
        id=row["id"],
        name=row["name"],
        entity_type=row.get("entity_type", "unknown"),
        user_id=row["user_id"],
        agent_id=row.get("agent_id"),
        team_id=row.get("team_id"),
        fact_ids=fact_ids,
        fact_count=row.get("fact_count", len(fact_ids)),
        depth=row.get("depth", 0),
        parent_id=row.get("parent_id"),
        children=[],  # 需要后续填充
        importance=row.get("importance", 0.5),
        created_at=created_at,
        updated_at=updated_at,
    )


__all__ = [
    "EntityNode",
    "EntityTree",
    "EntityAggregator",
    "compute_threshold",
    "THRESHOLD_BASE",
    "THRESHOLD_LAMBDA",
    "save_entity_tree",
    "get_entity_nodes_by_scope",
]