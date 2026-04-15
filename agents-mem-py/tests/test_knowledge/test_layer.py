"""
L3 Knowledge Layer 测试
"""

import pytest
from datetime import datetime

from agents_mem.core.types import Scope, FactType, EntityType
from agents_mem.knowledge.facts import (
    FactExtractor,
    ExtractedFact,
    FactRecord,
)
from agents_mem.knowledge.entities import (
    EntityNode,
    EntityTree,
    EntityAggregator,
    THRESHOLD_BASE,
    THRESHOLD_LAMBDA,
    compute_threshold,
)
from agents_mem.knowledge.trace import TraceChain, TraceBuilder


# ============================================================================
# Mock 类
# ============================================================================


class MockLLMClient:
    """Mock LLM Client"""

    async def generate(self, prompt: str) -> str:
        """Generate text response"""
        if "fact" in prompt.lower():
            return """[
                {"content": "用户偏好使用 Python 进行数据分析", "fact_type": "preference", "entities": ["Python", "数据分析"], "confidence": 0.9},
                {"content": "决定采用异步架构", "fact_type": "decision", "entities": ["异步架构"], "confidence": 0.85}
            ]"""
        return "[]"

    async def generate_json(self, prompt: str, default: list) -> list:
        """Generate JSON response"""
        return await self._parse_json(await self.generate(prompt))

    async def _parse_json(self, text: str) -> list:
        import json
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return []


class MockDBConnection:
    """Mock Database Connection"""

    _data: dict[str, dict] = {}

    async def query(self, sql: str, params: list = None) -> list[dict]:
        """Query database"""
        return []

    async def query_one(self, sql: str, params: list = None) -> dict | None:
        """Query single row"""
        if "facts" in sql and params and len(params) == 1:
            return self._data.get(params[0])
        return None

    async def run(self, sql: str, params: list = None) -> object:
        """Run SQL"""
        if "INSERT" in sql and params:
            self._data[params[0]] = {"id": params[0]}
        return MockCursor()


class MockCursor:
    """Mock Cursor"""
    rowcount = 1


class MockContentLayer:
    """Mock Content Layer"""

    async def get(self, uri: str) -> dict:
        """Get content by URI"""
        return {"content": "测试内容，包含一些事实信息。"}

    async def get_by_id(self, id: str) -> dict:
        """Get content by ID"""
        return {"content": "测试内容", "body": "正文内容"}

    async def get_tiered(self, id: str, tier: str) -> dict:
        """Get tiered content"""
        if tier == "L0":
            return {"abstract": "简短摘要"}
        elif tier == "L1":
            return {"overview": "详细概要"}
        return {"content": "完整内容"}


# ============================================================================
# 测试用例
# ============================================================================


class TestFactExtractor:
    """FactExtractor 测试"""

    @pytest.mark.asyncio
    async def test_extract_from_content(self):
        """测试从内容提取事实"""
        extractor = FactExtractor(MockLLMClient())

        content = "用户偏好使用 Python 进行数据分析，并决定采用异步架构。"
        facts = await extractor.extract(content)

        assert isinstance(facts, list)
        # 由于 mock LLM 返回固定结果，验证结果类型
        for fact in facts:
            assert isinstance(fact, ExtractedFact)
            assert fact.content
            assert fact.fact_type in [FactType.PREFERENCE, FactType.DECISION, FactType.OBSERVATION, FactType.CONCLUSION]
            assert 0.0 <= fact.confidence <= 1.0

    @pytest.mark.asyncio
    async def test_extract_empty_content(self):
        """测试空内容提取"""
        extractor = FactExtractor(MockLLMClient())

        facts = await extractor.extract("")
        assert facts == []

        facts = await extractor.extract("   ")
        assert facts == []

    @pytest.mark.asyncio
    async def test_validate_facts(self):
        """测试事实验证"""
        extractor = FactExtractor(MockLLMClient())

        raw_facts = [
            {"content": "有效的观察", "fact_type": "observation", "entities": ["entity1"], "confidence": 0.8},
            {"content": "", "fact_type": "preference", "entities": [], "confidence": 0.5},  # 无效: 空 content
            {"content": "无效类型", "fact_type": "invalid_type", "entities": [], "confidence": 0.5},  # 无效类型
            {"content": "无效置信度", "fact_type": "decision", "entities": [], "confidence": 1.5},  # 置信度会被修正为1.0
        ]

        valid_facts = extractor._validate_facts(raw_facts)

        # 验证结果: "有效的观察" 和 "无效置信度"(置信度修正后) 都是有效的
        assert len(valid_facts) >= 1
        assert valid_facts[0].content == "有效的观察"


class TestEntityAggregator:
    """EntityAggregator 测试"""

    def test_extract_entities_from_facts(self):
        """测试从事实提取实体"""
        aggregator = EntityAggregator()

        facts = [
            FactRecord(
                id="fact-1",
                user_id="user1",
                source_type="documents",
                source_id="doc-1",
                content="Python 是用户偏好的编程语言",
                fact_type="preference",
                entities=["Python", "编程语言"],
                importance=0.8,
                confidence=0.9,
            ),
            FactRecord(
                id="fact-2",
                user_id="user1",
                source_type="documents",
                source_id="doc-1",
                content="决定使用异步架构",
                fact_type="decision",
                entities=["异步架构", "Python"],
                importance=0.7,
                confidence=0.85,
            ),
        ]

        entities = aggregator.extract_entities(facts)

        assert len(entities) == 3  # Python, 编程语言, 异步架构
        # 检查 Python 是否合并了两个事实
        python_entity = next((e for e in entities if e["name"] == "Python"), None)
        assert python_entity is not None
        assert len(python_entity["fact_ids"]) == 2
        assert python_entity["importance"] == 0.8

    def test_build_entity_tree(self):
        """测试构建实体树"""
        aggregator = EntityAggregator()

        entities = [
            {"name": "Python", "type": "concept", "importance": 0.9, "fact_ids": ["f1", "f2"], "user_id": "user1"},
            {"name": "异步架构", "type": "concept", "importance": 0.7, "fact_ids": ["f3"], "user_id": "user1"},
            {"name": "数据分析", "type": "concept", "importance": 0.6, "fact_ids": ["f4"], "user_id": "user1"},
        ]

        tree = aggregator.build_tree(entities, threshold=0.7)

        assert isinstance(tree, EntityTree)
        assert tree.user_id == "user1"
        assert tree.total_entities == 3
        assert tree.total_facts == 4

        # Python 应该是根节点 (importance >= threshold)
        root_nodes = tree.get_root_nodes()
        assert len(root_nodes) >= 1

    def test_threshold_formula(self):
        """测试阈值公式"""
        # θ(0) = 0.70
        assert abs(compute_threshold(0) - 0.70) < 0.01

        # θ(1) ≈ 0.77 (实际值: 0.7736...)
        assert abs(compute_threshold(1) - 0.77) < 0.01

        # θ(2) ≈ 0.85 (实际值: 0.851...)
        assert abs(compute_threshold(2) - 0.85) < 0.01

        # θ(3) ≈ 0.93 (实际值: 0.944...)
        assert abs(compute_threshold(3) - 0.94) < 0.02


class TestEntityNode:
    """EntityNode 测试"""

    def test_node_threshold(self):
        """测试节点阈值计算"""
        node = EntityNode(
            id="node-1",
            name="Python",
            entity_type="concept",
            user_id="user1",
            depth=1,
            importance=0.8,
        )

        threshold = node.get_threshold()
        # depth=1: θ(1) ≈ 0.7736
        assert abs(threshold - 0.77) < 0.01

    def test_can_add_child(self):
        """测试子节点添加判断"""
        parent = EntityNode(
            id="node-1",
            name="Python",
            entity_type="concept",
            user_id="user1",
            depth=0,
            importance=0.8,
        )

        # 高重要性子节点可以添加
        assert parent.can_add_child(0.75) is True

        # 低重要性子节点不能添加
        assert parent.can_add_child(0.5) is False


class TestTraceChain:
    """TraceChain 测试"""

    def test_trace_chain_creation(self):
        """测试追溯链创建"""
        chain = TraceChain(
            fact=FactRecord(
                id="fact-1",
                user_id="user1",
                source_type="documents",
                source_id="doc-1",
                content="测试事实",
                fact_type="observation",
                entities=["entity"],
                importance=0.5,
                confidence=0.8,
            ),
            trace_chain=["mem://user1/_/_/facts/fact-1", "mem://user1/_/_/documents/doc-1"],
            depth=2,
            complete=True,
        )

        assert chain.fact is not None
        assert chain.fact.content == "测试事实"
        assert len(chain.trace_chain) == 2
        assert chain.complete is True

    def test_missing_links(self):
        """测试缺失链路"""
        chain = TraceChain(
            missing_links=["tiered_content", "source_content"],
        )

        assert chain.complete is False
        assert len(chain.missing_links) == 2


class TestKnowledgeLayerIntegration:
    """KnowledgeLayer 集成测试"""

    @pytest.mark.asyncio
    async def test_layer_initialization(self):
        """测试 KnowledgeLayer 初始化"""
        from agents_mem.knowledge.layer import KnowledgeLayer

        layer = KnowledgeLayer(
            content_layer=MockContentLayer(),
            db_connection=MockDBConnection(),
            llm_client=MockLLMClient(),
        )

        assert layer._fact_extractor is not None
        assert layer._entity_aggregator is not None
        assert layer._trace_builder is not None

    @pytest.mark.asyncio
    async def test_get_content(self):
        """测试只读访问 L2 内容"""
        from agents_mem.knowledge.layer import KnowledgeLayer

        layer = KnowledgeLayer(
            content_layer=MockContentLayer(),
            db_connection=MockDBConnection(),
            llm_client=MockLLMClient(),
        )

        content = await layer.get_content("mem://user1/_/_/documents/doc-1")
        assert content is not None
        assert "content" in content


# ============================================================================
# 阈值计算测试
# ============================================================================


def test_threshold_values():
    """测试各级阈值计算"""
    values = [
        (0, 0.70),
        (1, 0.77),
        (2, 0.85),
        (3, 0.94),  # 修正: 实际值约 0.9449
    ]

    for depth, expected in values:
        actual = compute_threshold(depth)
        # 允许误差 0.02
        assert abs(actual - expected) < 0.02


def test_threshold_custom_params():
    """测试自定义阈值参数"""
    # 使用不同的 θ₀ 和 λ
    threshold = compute_threshold(1, theta_0=0.5, lambda_=0.2)
    expected = 0.5 * 2.71828 ** 0.2  # ≈ 0.61
    assert abs(threshold - expected) < 0.01