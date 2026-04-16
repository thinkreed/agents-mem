"""
Tests for knowledge.entities module.

Tests EntityTree, EntityNode, EntityAggregator.
"""

import pytest
from datetime import datetime

from agents_mem.core.types import Scope
from agents_mem.knowledge.entities import (
    EntityTree,
    EntityNode,
    EntityAggregator,
    THRESHOLD_BASE,
    THRESHOLD_LAMBDA,
    save_entity_tree,
    get_entity_nodes_by_scope,
)


class MockLLMClient:
    """Mock LLM client"""
    
    async def generate(self, prompt: str, **kwargs):
        return "person"


@pytest.fixture
def mock_llm():
    return MockLLMClient()


@pytest.fixture
def entity_aggregator(mock_llm):
    return EntityAggregator(mock_llm)


@pytest.fixture
def sample_scope():
    return Scope(user_id="user123")


class TestEntityNode:
    """EntityNode tests"""
    
    def test_entity_node_creation(self):
        """Test creating entity node"""
        node = EntityNode(
            id="entity-001",
            user_id="user123",
            name="Python",
            entity_type="technology",
            fact_count=5,
            depth=0,
        )
        assert node.id == "entity-001"
        assert node.name == "Python"
        assert node.entity_type == "technology"
        assert node.fact_count == 5
    
    def test_entity_node_defaults(self):
        """Test default values"""
        node = EntityNode(
            id="entity-001",
            user_id="user123",
            name="Test",
            entity_type="unknown",
        )
        assert node.fact_count == 0
        assert node.depth == 0
        assert node.parent_id is None
        assert node.children == []
    
    def test_entity_node_with_parent(self):
        """Test node with parent"""
        node = EntityNode(
            id="entity-002",
            user_id="user123",
            name="React",
            entity_type="technology",
            parent_id="entity-001",
            depth=1,
        )
        assert node.parent_id == "entity-001"
        assert node.depth == 1


class TestEntityTree:
    """EntityTree tests"""
    
    def test_entity_tree_creation(self):
        """Test creating entity tree"""
        tree = EntityTree(
            user_id="user123",
            root_nodes=["entity-001"],
            nodes={"entity-001": EntityNode(id="entity-001", user_id="user123", name="Test", entity_type="unknown")},
            total_entities=1,
            total_facts=5,
            max_depth=0,
        )
        assert tree.user_id == "user123"
        assert tree.total_entities == 1
        assert tree.total_facts == 5
    
    def test_entity_tree_defaults(self):
        """Test default values"""
        tree = EntityTree(user_id="user123")
        assert tree.agent_id is None
        assert tree.team_id is None
        assert tree.root_nodes == []
        assert tree.nodes == {}
        assert tree.total_entities == 0
    
    def test_entity_tree_get_node(self):
        """Test getting node"""
        node = EntityNode(id="entity-001", user_id="user123", name="Test", entity_type="unknown")
        tree = EntityTree(
            user_id="user123",
            nodes={"entity-001": node},
        )
        result = tree.get_node("entity-001")
        assert result == node
    
    def test_entity_tree_get_root_nodes(self):
        """Test getting root nodes"""
        node1 = EntityNode(id="entity-001", user_id="user123", name="Test", entity_type="unknown")
        tree = EntityTree(
            user_id="user123",
            root_nodes=["entity-001"],
            nodes={"entity-001": node1},
        )
        roots = tree.get_root_nodes()
        assert len(roots) == 1
        assert roots[0] == node1


class TestEntityAggregator:
    """EntityAggregator tests"""
    
    def test_initialization(self, mock_llm):
        """Test initialization"""
        aggregator = EntityAggregator(mock_llm)
        assert aggregator._llm == mock_llm
    
    def test_threshold_calculation(self, entity_aggregator):
        """Test threshold formula"""
        # θ(d) = θ₀ × e^(λd)
        base = THRESHOLD_BASE
        lambda_val = THRESHOLD_LAMBDA
        
        theta_0 = base  # θ(0) = 0.70
        theta_1 = base * (2.718 ** lambda_val)  # θ(1)
        theta_2 = base * (2.718 ** (lambda_val * 2))  # θ(2)
        
        assert theta_0 >= 0.7
        assert theta_1 > theta_0
        assert theta_2 > theta_1
    
    def test_extract_entities(self, entity_aggregator):
        """Test entity extraction"""
        from agents_mem.knowledge.facts import FactRecord
        
        facts = [
            FactRecord(
                id="fact-001",
                user_id="user123",
                source_type="documents",
                source_id="doc-001",
                content="User prefers Python for backend development",
                fact_type="preference",
                entities=["Python", "backend"],
            ),
        ]
        
        entities = entity_aggregator.extract_entities(facts)
        assert len(entities) > 0
    
    def test_build_tree(self, entity_aggregator):
        """Test building entity tree"""
        from agents_mem.knowledge.entities import EntityInfo
        
        entities = [
            EntityInfo(name="Python", entity_type="technology", fact_ids=["fact-001"]),
        ]
        
        tree = entity_aggregator.build_tree(entities, 0.7)
        assert isinstance(tree, EntityTree)
        assert tree.total_entities >= 1
    
    @pytest.mark.asyncio
    async def test_infer_entity_types(self, entity_aggregator):
        """Test type inference"""
        from agents_mem.knowledge.entities import EntityInfo
        
        entities = [
            EntityInfo(name="Python", entity_type="unknown", fact_ids=[]),
        ]
        
        result = await entity_aggregator.infer_entity_types(entities)
        assert len(result) == 1
        # Type may be inferred by LLM


class TestThresholdConstants:
    """Threshold constant tests"""
    
    def test_threshold_base(self):
        """Test base threshold"""
        assert THRESHOLD_BASE == 0.7
    
    def test_threshold_lambda(self):
        """Test lambda value"""
        assert THRESHOLD_LAMBDA >= 0.05


class MockDBConnection:
    """Mock database"""
    
    async def run(self, sql: str, params: list | None = None):
        return None
    
    async def query(self, sql: str, params: list | None = None):
        return []
    
    async def query_one(self, sql: str, params: list | None = None):
        return None


class TestDatabaseFunctions:
    """Database function tests"""
    
    @pytest.mark.asyncio
    async def test_save_entity_tree(self, sample_scope):
        """Test saving entity tree"""
        db = MockDBConnection()
        tree = EntityTree(user_id="user123")
        
        await save_entity_tree(tree, db)
        # Should execute without error
    
    @pytest.mark.asyncio
    async def test_get_entity_nodes_by_scope(self, sample_scope):
        """Test getting nodes by scope"""
        db = MockDBConnection()
        
        nodes = await get_entity_nodes_by_scope(sample_scope, db)
        assert nodes == []