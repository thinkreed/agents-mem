"""
Tests for identity.auth module.

Tests Permission enum, PermissionRule, AccessControl, and PermissionDeniedError.
"""

import pytest

from agents_mem.core.types import Scope
from agents_mem.identity.auth import (
    Permission,
    PermissionRule,
    PERMISSION_RULES,
    AccessControl,
    PermissionDeniedError,
)


class TestPermission:
    """Permission enum tests."""

    def test_permission_values(self):
        """Test permission values."""
        assert Permission.READ.value == "read"
        assert Permission.READ_L0.value == "read_l0"
        assert Permission.READ_L1.value == "read_l1"
        assert Permission.READ_L2.value == "read_l2"
        assert Permission.CREATE.value == "create"
        assert Permission.UPDATE.value == "update"
        assert Permission.DELETE.value == "delete"
        assert Permission.MANAGE_TEAM.value == "manage_team"
        assert Permission.MANAGE_AGENT.value == "manage_agent"
        assert Permission.MANAGE_USER.value == "manage_user"
        assert Permission.ADMIN.value == "admin"
        assert Permission.GLOBAL_READ.value == "global_read"

    def test_permission_from_string(self):
        """Test creating Permission from string."""
        assert Permission("read") == Permission.READ
        assert Permission("create") == Permission.CREATE
        assert Permission("admin") == Permission.ADMIN

    def test_permission_invalid_string(self):
        """Test invalid permission string raises ValueError."""
        with pytest.raises(ValueError):
            Permission("invalid_permission")


class TestPermissionRule:
    """PermissionRule model tests."""

    def test_permission_rule_creation(self):
        """Test PermissionRule creation."""
        rule = PermissionRule(
            permission=Permission.READ,
            requires_user=True,
            description="Basic read permission",
        )
        assert rule.permission == Permission.READ
        assert rule.requires_user is True
        assert rule.requires_agent is False
        assert rule.requires_team is False
        assert rule.requires_global is False
        assert rule.description == "Basic read permission"

    def test_permission_rule_defaults(self):
        """Test PermissionRule defaults."""
        rule = PermissionRule(permission=Permission.READ)
        assert rule.requires_user is True  # Default True
        assert rule.requires_agent is False
        assert rule.requires_team is False
        assert rule.requires_global is False
        assert rule.description == ""

    def test_permission_rule_frozen(self):
        """Test PermissionRule is frozen."""
        rule = PermissionRule(permission=Permission.READ)
        with pytest.raises(Exception):
            rule.requires_user = False


class TestPermissionRules:
    """PERMISSION_RULES constant tests."""

    def test_all_permissions_have_rules(self):
        """Test all Permission values have rules."""
        for perm in Permission:
            assert perm in PERMISSION_RULES

    def test_read_rules(self):
        """Test read permission rules."""
        read_rule = PERMISSION_RULES[Permission.READ]
        assert read_rule.requires_user is True
        assert read_rule.requires_agent is False
        assert read_rule.requires_team is False

    def test_manage_team_requires_team(self):
        """Test manage_team requires team_id."""
        rule = PERMISSION_RULES[Permission.MANAGE_TEAM]
        assert rule.requires_user is True
        assert rule.requires_team is True

    def test_manage_agent_requires_agent(self):
        """Test manage_agent requires agent_id."""
        rule = PERMISSION_RULES[Permission.MANAGE_AGENT]
        assert rule.requires_user is True
        assert rule.requires_agent is True

    def test_global_read_requires_global(self):
        """Test global_read requires is_global."""
        rule = PERMISSION_RULES[Permission.GLOBAL_READ]
        assert rule.requires_user is True
        assert rule.requires_global is True


class TestAccessControl:
    """AccessControl class tests."""

    def test_access_control_creation(self):
        """Test AccessControl creation."""
        ac = AccessControl()
        assert ac._rules == PERMISSION_RULES

    def test_access_control_custom_rules(self):
        """Test AccessControl with custom rules."""
        custom_rules = {
            Permission.READ: PermissionRule(
                permission=Permission.READ,
                requires_user=False,
            )
        }
        ac = AccessControl(rules=custom_rules)
        assert ac._rules == custom_rules

    def test_check_permission_read(self):
        """Test check_permission for read."""
        ac = AccessControl()
        scope = Scope(user_id="user123")
        assert ac.check_permission(scope, "read") is True

    def test_check_permission_create(self):
        """Test check_permission for create."""
        ac = AccessControl()
        scope = Scope(user_id="user123")
        assert ac.check_permission(scope, "create") is True

    def test_check_permission_delete(self):
        """Test check_permission for delete."""
        ac = AccessControl()
        scope = Scope(user_id="user123")
        assert ac.check_permission(scope, "delete") is True

    def test_check_permission_unknown_action(self):
        """Test check_permission for unknown action."""
        ac = AccessControl()
        scope = Scope(user_id="user123")
        assert ac.check_permission(scope, "unknown") is False

    def test_check_permission_missing_user_id(self):
        """Test check_permission with missing user_id."""
        ac = AccessControl()
        scope = Scope(user_id="")  # Empty user_id
        assert ac.check_permission(scope, "read") is False

    def test_check_permission_manage_team_without_team(self):
        """Test manage_team without team_id."""
        ac = AccessControl()
        scope = Scope(user_id="user123")  # No team_id
        assert ac.check_permission(scope, "manage_team") is False

    def test_check_permission_manage_team_with_team(self):
        """Test manage_team with team_id."""
        ac = AccessControl()
        scope = Scope(user_id="user123", team_id="team1")
        assert ac.check_permission(scope, "manage_team") is True

    def test_check_permission_manage_agent_without_agent(self):
        """Test manage_agent without agent_id."""
        ac = AccessControl()
        scope = Scope(user_id="user123")  # No agent_id
        assert ac.check_permission(scope, "manage_agent") is False

    def test_check_permission_manage_agent_with_agent(self):
        """Test manage_agent with agent_id."""
        ac = AccessControl()
        scope = Scope(user_id="user123", agent_id="agent1")
        assert ac.check_permission(scope, "manage_agent") is True

    def test_check_permission_global_read_without_global(self):
        """Test global_read without is_global."""
        ac = AccessControl()
        scope = Scope(user_id="user123")  # is_global=False
        assert ac.check_permission(scope, "global_read") is False

    def test_check_permission_global_read_with_global(self):
        """Test global_read with is_global."""
        ac = AccessControl()
        scope = Scope(user_id="user123", is_global=True)
        assert ac.check_permission(scope, "global_read") is True

    def test_get_required_fields_read(self):
        """Test get_required_fields for read."""
        ac = AccessControl()
        fields = ac.get_required_fields("read")
        assert fields == ["user_id"]

    def test_get_required_fields_manage_team(self):
        """Test get_required_fields for manage_team."""
        ac = AccessControl()
        fields = ac.get_required_fields("manage_team")
        assert "user_id" in fields
        assert "team_id" in fields

    def test_get_required_fields_manage_agent(self):
        """Test get_required_fields for manage_agent."""
        ac = AccessControl()
        fields = ac.get_required_fields("manage_agent")
        assert "user_id" in fields
        assert "agent_id" in fields

    def test_get_required_fields_global_read(self):
        """Test get_required_fields for global_read."""
        ac = AccessControl()
        fields = ac.get_required_fields("global_read")
        assert "user_id" in fields
        assert "is_global" in fields

    def test_get_required_fields_unknown(self):
        """Test get_required_fields for unknown action."""
        ac = AccessControl()
        fields = ac.get_required_fields("unknown")
        assert fields == ["user_id"]

    def test_validate_scope_or_raise_valid(self):
        """Test validate_scope_or_raise with valid scope."""
        ac = AccessControl()
        scope = Scope(user_id="user123")
        ac.validate_scope_or_raise(scope, "read")  # Should not raise

    def test_validate_scope_or_raise_invalid(self):
        """Test validate_scope_or_raise with invalid scope."""
        ac = AccessControl()
        scope = Scope(user_id="")  # Empty user_id
        
        # The Scope model with frozen=True won't allow empty user_id
        # But we test the validation logic
        with pytest.raises(Exception):
            scope = Scope(user_id="")
            ac.validate_scope_or_raise(scope, "read")


class TestPermissionDeniedError:
    """PermissionDeniedError tests."""

    def test_error_creation(self):
        """Test PermissionDeniedError creation."""
        scope = Scope(user_id="user123")
        error = PermissionDeniedError(
            message="Permission denied",
            scope=scope,
            action="admin",
        )
        assert error.message == "Permission denied"
        assert isinstance(error, PermissionDeniedError)

    def test_error_with_details(self):
        """Test PermissionDeniedError with details."""
        scope = Scope(user_id="user123", agent_id="agent1")
        error = PermissionDeniedError(
            message="Cannot perform action",
            details={"reason": "insufficient_privileges"},
            scope=scope,
            action="delete",
        )
        assert "reason" in error.details
        assert "scope" in error.details
        assert "action" in error.details

    def test_error_inherits_from_scope_error(self):
        """Test PermissionDeniedError inherits from ScopeError."""
        from agents_mem.core.exceptions import ScopeError
        
        error = PermissionDeniedError("Test")
        assert isinstance(error, ScopeError)

    def test_error_scope_in_details(self):
        """Test scope is included in details."""
        scope = Scope(user_id="user123", agent_id="agent1")
        error = PermissionDeniedError(
            message="Error",
            scope=scope,
        )
        assert error.details["scope"] == str(scope)