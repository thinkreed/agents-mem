"""
Scope Mapper Tests

测试 Scope 映射功能。
"""

import pytest

from agents_mem.core.types import Scope
from agents_mem.openviking.scope_mapper import (
    ScopeMapper,
    ScopeValidation,
    VikingScope,
    get_scope_mapper,
    reset_scope_mapper,
)


class TestVikingScope:
    """测试 VikingScope"""

    def test_default_values(self):
        """默认值"""
        scope = VikingScope(user="user123")
        assert scope.account == "default"
        assert scope.user == "user123"
        assert scope.agent is None


class TestScopeValidation:
    """测试 ScopeValidation"""

    def test_valid_scope(self):
        """有效 Scope"""
        validation = ScopeValidation(valid=True)
        assert validation.valid == True
        assert validation.errors == []

    def test_invalid_scope(self):
        """无效 Scope"""
        validation = ScopeValidation(valid=False, errors=["userId required"])
        assert validation.valid == False
        assert "userId required" in validation.errors


class TestScopeMapper:
    """测试 ScopeMapper"""

    def test_init_default_account(self):
        """默认账户"""
        mapper = ScopeMapper()
        assert mapper.account == "default"

    def test_init_custom_account(self):
        """自定义账户"""
        mapper = ScopeMapper(account="custom")
        assert mapper.account == "custom"

    def test_map_to_viking_scope_basic(self):
        """基本映射"""
        mapper = ScopeMapper()
        scope = Scope(user_id="user123")
        result = mapper.map_to_viking_scope(scope)

        assert result.account == "default"
        assert result.user == "user123"
        assert result.agent is None

    def test_map_to_viking_scope_with_agent(self):
        """带代理映射"""
        mapper = ScopeMapper()
        scope = Scope(user_id="user123", agent_id="agent1")
        result = mapper.map_to_viking_scope(scope)

        assert result.agent == "agent1"

    def test_scope_to_filters_basic(self):
        """基本过滤器"""
        mapper = ScopeMapper()
        scope = Scope(user_id="user123")
        result = mapper.scope_to_filters(scope)

        assert result["user"] == "user123"
        assert "agent" not in result

    def test_scope_to_filters_with_agent(self):
        """带代理过滤器"""
        mapper = ScopeMapper()
        scope = Scope(user_id="user123", agent_id="agent1", team_id="team5")
        result = mapper.scope_to_filters(scope)

        assert result["user"] == "user123"
        assert result["agent"] == "agent1"
        assert result["team"] == "team5"

    def test_scope_to_headers_basic(self):
        """基本请求头"""
        mapper = ScopeMapper()
        scope = Scope(user_id="user123")
        result = mapper.scope_to_headers(scope)

        assert result["X-Account"] == "default"
        assert result["X-User"] == "user123"
        assert "X-Agent" not in result

    def test_scope_to_headers_with_agent(self):
        """带代理请求头"""
        mapper = ScopeMapper()
        scope = Scope(user_id="user123", agent_id="agent1", team_id="team5")
        result = mapper.scope_to_headers(scope)

        assert result["X-Agent"] == "agent1"
        assert result["X-Team"] == "team5"

    def test_build_target_uri_basic(self):
        """基本目标 URI"""
        mapper = ScopeMapper()
        scope = Scope(user_id="user123")
        result = mapper.build_target_uri(scope)

        assert result == "viking://default/user123/memories"

    def test_build_target_uri_with_agent(self):
        """带代理目标 URI"""
        mapper = ScopeMapper()
        scope = Scope(user_id="user123", agent_id="agent1")
        result = mapper.build_target_uri(scope, resource_type="resources")

        assert result == "viking://default/user123/agent1/resources"

    def test_validate_scope_valid(self):
        """验证有效 Scope"""
        mapper = ScopeMapper()
        scope = Scope(user_id="user123", agent_id="agent1")
        result = mapper.validate_scope(scope)

        assert result.valid == True
        assert result.errors == []

    def test_validate_scope_invalid_format(self):
        """验证无效格式"""
        mapper = ScopeMapper()
        # 直接构建有问题的 scope (绕过 Pydantic 验证)
        scope = Scope(user_id="user@invalid")
        result = mapper.validate_scope(scope)

        assert result.valid == False

    def test_extract_scope_from_uri(self):
        """从 URI 提取 Scope"""
        mapper = ScopeMapper()
        result = mapper.extract_scope_from_uri(
            "viking://default/user123/agent1/resources"
        )

        assert result["user_id"] == "user123"
        assert result["agent_id"] == "agent1"
        assert result["account"] == "default"

    def test_extract_scope_from_uri_no_agent(self):
        """从 URI 提取 Scope (无代理)"""
        mapper = ScopeMapper()
        result = mapper.extract_scope_from_uri(
            "viking://default/user123/resources/documents"
        )

        assert result["user_id"] == "user123"
        assert result["agent_id"] is None

    def test_is_same_user(self):
        """检查同一用户"""
        mapper = ScopeMapper()
        scope1 = Scope(user_id="user123", agent_id="agent1")
        scope2 = Scope(user_id="user123", agent_id="agent2")

        assert mapper.is_same_user(scope1, scope2) == True

    def test_is_same_user_different(self):
        """检查不同用户"""
        mapper = ScopeMapper()
        scope1 = Scope(user_id="user123")
        scope2 = Scope(user_id="user456")

        assert mapper.is_same_user(scope1, scope2) == False

    def test_is_same_agent(self):
        """检查同一代理"""
        mapper = ScopeMapper()
        scope1 = Scope(user_id="user123", agent_id="agent1")
        scope2 = Scope(user_id="user123", agent_id="agent1")

        assert mapper.is_same_agent(scope1, scope2) == True

    def test_is_same_agent_different(self):
        """检查不同代理"""
        mapper = ScopeMapper()
        scope1 = Scope(user_id="user123", agent_id="agent1")
        scope2 = Scope(user_id="user123", agent_id="agent2")

        assert mapper.is_same_agent(scope1, scope2) == False

    def test_scope_overlaps_same_user(self):
        """同一用户重叠"""
        mapper = ScopeMapper()
        scope1 = Scope(user_id="user123", agent_id="agent1")
        scope2 = Scope(user_id="user123", agent_id="agent2")

        # 不同代理不重叠
        assert mapper.scope_overlaps(scope1, scope2) == False

    def test_scope_overlaps_global_agent(self):
        """全局代理重叠"""
        mapper = ScopeMapper()
        scope1 = Scope(user_id="user123", agent_id="agent1")
        scope2 = Scope(user_id="user123", agent_id=None)

        # 全局代理与特定代理重叠
        assert mapper.scope_overlaps(scope1, scope2) == True


class TestSingleton:
    """测试单例管理"""

    def test_get_scope_mapper(self):
        """获取单例映射器"""
        reset_scope_mapper()
        mapper1 = get_scope_mapper()
        mapper2 = get_scope_mapper()

        assert mapper1 is mapper2

    def test_reset_scope_mapper(self):
        """重置单例映射器"""
        mapper1 = get_scope_mapper()
        reset_scope_mapper()
        mapper2 = get_scope_mapper()

        assert mapper1 is not mapper2