"""
URI Adapter Tests

测试 URI 转换功能。
"""

import pytest

from agents_mem.core.types import EntityType
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


class TestVikingURI:
    """测试 VikingURI"""

    def test_to_string_basic(self):
        """基本 URI 构建"""
        uri = VikingURI(
            account="default",
            user="user123",
            resource_type=VikingResourceType.RESOURCES,
            path=["documents", "doc-1"],
        )
        result = uri.to_string()
        assert result == "viking://default/user123/resources/documents/doc-1"

    def test_to_string_with_agent(self):
        """带代理的 URI"""
        uri = VikingURI(
            account="default",
            user="user123",
            agent="agent1",
            resource_type=VikingResourceType.MEMORIES,
            path=["facts", "fact-1"],
        )
        result = uri.to_string()
        assert result == "viking://default/user123/agent1/memories/facts/fact-1"


class TestMemURI:
    """测试 MemURI"""

    def test_to_string_basic(self):
        """基本 URI 构建"""
        uri = MemURI(
            user_id="user123",
            entity_type=EntityType.DOCUMENTS,
            resource_id="doc-1",
        )
        result = uri.to_string()
        assert result == "mem://user123/_/_/documents/doc-1"

    def test_to_string_with_agent(self):
        """带代理的 URI"""
        uri = MemURI(
            user_id="user123",
            agent_id="agent1",
            team_id="team5",
            entity_type=EntityType.FACTS,
            resource_id="fact-1",
        )
        result = uri.to_string()
        assert result == "mem://user123/agent1/team5/facts/fact-1"


class TestEntityToVikingMapping:
    """测试 EntityType 到 VikingResourceType 映射"""

    def test_documents_to_resources(self):
        """documents -> resources"""
        assert ENTITY_TO_VIKING[EntityType.DOCUMENTS] == VikingResourceType.RESOURCES

    def test_assets_to_resources(self):
        """assets -> resources"""
        assert ENTITY_TO_VIKING[EntityType.ASSETS] == VikingResourceType.RESOURCES

    def test_conversations_to_memories(self):
        """conversations -> memories"""
        assert ENTITY_TO_VIKING[EntityType.CONVERSATIONS] == VikingResourceType.MEMORIES

    def test_messages_to_memories(self):
        """messages -> memories"""
        assert ENTITY_TO_VIKING[EntityType.MESSAGES] == VikingResourceType.MEMORIES

    def test_facts_to_memories(self):
        """facts -> memories"""
        assert ENTITY_TO_VIKING[EntityType.FACTS] == VikingResourceType.MEMORIES


class TestURIAdapter:
    """测试 URIAdapter"""

    def test_init_default_account(self):
        """默认账户"""
        adapter = URIAdapter()
        assert adapter.account == "default"

    def test_init_custom_account(self):
        """自定义账户"""
        adapter = URIAdapter(account="custom")
        assert adapter.account == "custom"

    def test_parse_mem_uri_valid(self):
        """解析有效 mem:// URI"""
        adapter = URIAdapter()
        result = adapter.parse_mem_uri("mem://user123/agent1/team5/documents/doc-1")

        assert result is not None
        assert result.user_id == "user123"
        assert result.agent_id == "agent1"
        assert result.team_id == "team5"
        assert result.entity_type == EntityType.DOCUMENTS
        assert result.resource_id == "doc-1"

    def test_parse_mem_uri_placeholder(self):
        """解析带占位符的 mem:// URI"""
        adapter = URIAdapter()
        result = adapter.parse_mem_uri("mem://user123/_/_/documents/doc-1")

        assert result is not None
        assert result.user_id == "user123"
        assert result.agent_id is None
        assert result.team_id is None

    def test_parse_mem_uri_invalid(self):
        """解析无效 URI"""
        adapter = URIAdapter()
        result = adapter.parse_mem_uri("invalid://uri")
        assert result is None

    def test_parse_viking_uri_valid(self):
        """解析有效 viking:// URI"""
        adapter = URIAdapter()
        result = adapter.parse_viking_uri(
            "viking://default/user123/resources/documents/doc-1"
        )

        assert result is not None
        assert result.account == "default"
        assert result.user == "user123"
        assert result.resource_type == VikingResourceType.RESOURCES
        assert result.path == ["documents", "doc-1"]

    def test_build_target_uri_basic(self):
        """构建基本目标 URI"""
        adapter = URIAdapter()
        result = adapter.build_target_uri("user123", None, EntityType.DOCUMENTS)

        assert result == "viking://default/user123/resources/documents"

    def test_build_target_uri_with_agent(self):
        """构建带代理的目标 URI"""
        adapter = URIAdapter()
        result = adapter.build_target_uri("user123", "agent1", EntityType.FACTS)

        assert result == "viking://default/user123/agent1/memories/facts"

    def test_build_resource_uri(self):
        """构建资源 URI"""
        adapter = URIAdapter()
        result = adapter.build_resource_uri(
            "user123", "agent1", EntityType.DOCUMENTS, "doc-456"
        )

        assert result == "viking://default/user123/agent1/resources/documents/doc-456"

    def test_to_viking_uri(self):
        """转换 mem:// 到 viking://"""
        adapter = URIAdapter()
        result = adapter.to_viking_uri(
            "mem://user123/agent1/_/documents/doc-456",
            "user123",
            "agent1",
        )

        assert result == "viking://default/user123/agent1/resources/documents/doc-456"

    def test_to_mem_uri(self):
        """转换 viking:// 到 mem://"""
        adapter = URIAdapter()
        result = adapter.to_mem_uri(
            "viking://default/user123/agent1/resources/documents/doc-456",
            team_id="team5",
        )

        assert result == "mem://user123/agent1/team5/documents/doc-456"

    def test_extract_id_from_viking_uri(self):
        """从 viking:// URI 提取 ID"""
        adapter = URIAdapter()
        result = adapter.extract_id_from_uri(
            "viking://default/user123/resources/documents/doc-456"
        )

        assert result == "doc-456"

    def test_extract_id_from_mem_uri(self):
        """从 mem:// URI 提取 ID"""
        adapter = URIAdapter()
        result = adapter.extract_id_from_uri(
            "mem://user123/_/_/documents/doc-456"
        )

        assert result == "doc-456"

    def test_extract_scope_from_viking_uri(self):
        """从 viking:// URI 提取 Scope"""
        adapter = URIAdapter()
        result = adapter.extract_scope_from_uri(
            "viking://default/user123/agent1/resources/documents/doc-456"
        )

        assert result["user_id"] == "user123"
        assert result["agent_id"] == "agent1"
        assert result["account"] == "default"

    def test_extract_scope_from_mem_uri(self):
        """从 mem:// URI 提取 Scope"""
        adapter = URIAdapter()
        result = adapter.extract_scope_from_uri(
            "mem://user123/agent1/team5/documents/doc-456"
        )

        assert result["user_id"] == "user123"
        assert result["agent_id"] == "agent1"
        assert result["team_id"] == "team5"


class TestSingleton:
    """测试单例管理"""

    def test_get_uri_adapter(self):
        """获取单例适配器"""
        reset_uri_adapter()
        adapter1 = get_uri_adapter()
        adapter2 = get_uri_adapter()

        assert adapter1 is adapter2

    def test_reset_uri_adapter(self):
        """重置单例适配器"""
        adapter1 = get_uri_adapter()
        reset_uri_adapter()
        adapter2 = get_uri_adapter()

        assert adapter1 is not adapter2