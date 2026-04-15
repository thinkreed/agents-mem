"""
权限控制模块

定义 L0 Identity Layer 的权限枚举和访问控制逻辑。
基于 Scope 实现多租户隔离和权限检查。
"""

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict

from agents_mem.core.types import Scope
from agents_mem.core.exceptions import ScopeError


class Permission(str, Enum):
    """
    权限枚举

    定义系统中所有操作的权限级别。
    """

    # 读取权限
    READ = "read"  # 读取资源
    READ_L0 = "read_l0"  # 读取 L0 概览
    READ_L1 = "read_l1"  # 读取 L1 概要
    READ_L2 = "read_l2"  # 读取 L2 完整内容

    # 写入权限
    CREATE = "create"  # 创建资源
    UPDATE = "update"  # 更新资源
    DELETE = "delete"  # 删除资源

    # 管理权限
    MANAGE_TEAM = "manage_team"  # 管理团队
    MANAGE_AGENT = "manage_agent"  # 管理 Agent
    MANAGE_USER = "manage_user"  # 管理用户

    # 特殊权限
    ADMIN = "admin"  # 管理员权限
    GLOBAL_READ = "global_read"  # 全局读取


class PermissionRule(BaseModel):
    """
    权限规则模型

    定义特定权限的访问控制规则。
    """

    model_config = ConfigDict(frozen=True)

    permission: Permission
    requires_user: bool = True  # 是否需要用户 ID
    requires_agent: bool = False  # 是否需要 Agent ID
    requires_team: bool = False  # 是否需要 Team ID
    requires_global: bool = False  # 是否需要全局权限
    description: str = ""


# 权限规则表
PERMISSION_RULES: dict[Permission, PermissionRule] = {
    # 读取权限
    Permission.READ: PermissionRule(
        permission=Permission.READ,
        requires_user=True,
        description="读取资源 - 需要 userId",
    ),
    Permission.READ_L0: PermissionRule(
        permission=Permission.READ_L0,
        requires_user=True,
        description="读取 L0 概览 - 需要 userId",
    ),
    Permission.READ_L1: PermissionRule(
        permission=Permission.READ_L1,
        requires_user=True,
        description="读取 L1 概要 - 需要 userId",
    ),
    Permission.READ_L2: PermissionRule(
        permission=Permission.READ_L2,
        requires_user=True,
        description="读取 L2 完整内容 - 需要 userId",
    ),
    # 写入权限
    Permission.CREATE: PermissionRule(
        permission=Permission.CREATE,
        requires_user=True,
        description="创建资源 - 需要 userId",
    ),
    Permission.UPDATE: PermissionRule(
        permission=Permission.UPDATE,
        requires_user=True,
        description="更新资源 - 需要 userId",
    ),
    Permission.DELETE: PermissionRule(
        permission=Permission.DELETE,
        requires_user=True,
        description="删除资源 - 需要 userId",
    ),
    # 管理权限
    Permission.MANAGE_TEAM: PermissionRule(
        permission=Permission.MANAGE_TEAM,
        requires_user=True,
        requires_team=True,
        description="管理团队 - 需要 userId + teamId",
    ),
    Permission.MANAGE_AGENT: PermissionRule(
        permission=Permission.MANAGE_AGENT,
        requires_user=True,
        requires_agent=True,
        description="管理 Agent - 需要 userId + agentId",
    ),
    Permission.MANAGE_USER: PermissionRule(
        permission=Permission.MANAGE_USER,
        requires_user=True,
        description="管理用户 - 需要 userId",
    ),
    # 特殊权限
    Permission.ADMIN: PermissionRule(
        permission=Permission.ADMIN,
        requires_user=True,
        description="管理员权限 - 需要 userId",
    ),
    Permission.GLOBAL_READ: PermissionRule(
        permission=Permission.GLOBAL_READ,
        requires_user=True,
        requires_global=True,
        description="全局读取 - 需要 userId + is_global",
    ),
}


class AccessControl:
    """
    访问控制类

    实现基于 Scope 的权限检查逻辑。
    """

    def __init__(self, rules: dict[Permission, PermissionRule] | None = None):
        """
        初始化访问控制器

        Args:
            rules: 自定义权限规则表，默认使用 PERMISSION_RULES
        """
        self._rules = rules or PERMISSION_RULES

    def check_permission(self, scope: Scope, action: str) -> bool:
        """
        检查权限

        Args:
            scope: 作用域
            action: 操作名称 (如 "read", "create")

        Returns:
            是否有权限执行该操作

        Raises:
            ScopeError: Scope 验证失败
        """
        # 转换 action 到 Permission
        try:
            permission = Permission(action)
        except ValueError:
            # 未知的操作，拒绝
            return False

        # 获取权限规则
        rule = self._rules.get(permission)
        if not rule:
            # 未定义的权限，拒绝
            return False

        # 验证 Scope
        if not self._validate_scope_for_rule(scope, rule):
            return False

        return True

    def _validate_scope_for_rule(self, scope: Scope, rule: PermissionRule) -> bool:
        """
        根据权限规则验证 Scope

        Args:
            scope: 作用域
            rule: 权限规则

        Returns:
            Scope 是否满足权限规则要求
        """
        # userId 必填检查
        if rule.requires_user:
            if not scope.user_id or scope.user_id.strip() == "":
                return False

        # agentId 检查
        if rule.requires_agent:
            if not scope.agent_id or scope.agent_id.strip() == "":
                return False

        # teamId 检查
        if rule.requires_team:
            if not scope.team_id or scope.team_id.strip() == "":
                return False

        # is_global 检查
        if rule.requires_global:
            if not scope.is_global:
                return False

        return True

    def get_required_fields(self, action: str) -> list[str]:
        """
        获取操作所需的 Scope 字段

        Args:
            action: 操作名称

        Returns:
            必需的字段列表
        """
        try:
            permission = Permission(action)
        except ValueError:
            return ["user_id"]

        rule = self._rules.get(permission)
        if not rule:
            return ["user_id"]

        required: list[str] = []
        if rule.requires_user:
            required.append("user_id")
        if rule.requires_agent:
            required.append("agent_id")
        if rule.requires_team:
            required.append("team_id")
        if rule.requires_global:
            required.append("is_global")

        return required

    def validate_scope_or_raise(self, scope: Scope, action: str) -> None:
        """
        验证 Scope 或抛出异常

        Args:
            scope: 作用域
            action: 操作名称

        Raises:
            ScopeError: Scope 验证失败
        """
        required_fields = self.get_required_fields(action)

        # 检查 user_id
        if "user_id" in required_fields:
            if not scope.user_id or scope.user_id.strip() == "":
                raise ScopeError(
                    message="user_id is required for this action",
                    required_fields=required_fields,
                )

        # 检查 agent_id
        if "agent_id" in required_fields:
            if not scope.agent_id or scope.agent_id.strip() == "":
                raise ScopeError(
                    message="agent_id is required for this action",
                    required_fields=required_fields,
                )

        # 检查 team_id
        if "team_id" in required_fields:
            if not scope.team_id or scope.team_id.strip() == "":
                raise ScopeError(
                    message="team_id is required for this action",
                    required_fields=required_fields,
                )

        # 检查 is_global
        if "is_global" in required_fields:
            if not scope.is_global:
                raise ScopeError(
                    message="is_global=true is required for this action",
                    required_fields=required_fields,
                )


class PermissionDeniedError(ScopeError):
    """
    权限拒绝错误

    当权限检查失败时抛出。
    """

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
        scope: Scope | None = None,
        action: str | None = None,
    ):
        if scope or action:
            details = details or {}
            if scope:
                details["scope"] = str(scope)
            if action:
                details["action"] = action
        super().__init__(message, details)


__all__ = [
    "Permission",
    "PermissionRule",
    "PERMISSION_RULES",
    "AccessControl",
    "PermissionDeniedError",
]