"""
L0 Identity Layer 主模块

实现身份层核心功能：
- Scope 验证
- 权限控制
- 多租户隔离
- Scope Hash 生成（用于数据库索引）
"""

import hashlib

from pydantic import BaseModel, ConfigDict

from agents_mem.core.types import Scope
from agents_mem.core.exceptions import ScopeError
from agents_mem.identity.auth import AccessControl, PermissionDeniedError


class IdentityLayer:
    """
    Identity Layer 主类

    L0 层是 4 层架构的基础层，负责：
    - Scope 验证 (user_id 必填, agent_id/team_id 可选)
    - 权限控制 (基于 action 的访问控制)
    - 多租户隔离 (Scope Hash 用于数据库索引)
    """

    def __init__(self, access_control: AccessControl | None = None):
        """
        初始化 Identity Layer

        Args:
            access_control: 自定义访问控制器，默认使用 AccessControl()
        """
        self._access_control = access_control or AccessControl()

    @property
    def access_control(self) -> AccessControl:
        """获取访问控制器"""
        return self._access_control

    def validate_scope(self, scope: Scope) -> bool:
        """
        验证 Scope

        Scope 必须满足以下条件：
        - user_id 必填且非空
        - agent_id 和 team_id 可选，但如果有值必须非空

        Args:
            scope: 待验证的作用域

        Returns:
            Scope 是否有效
        """
        # user_id 必填检查
        if not scope.user_id or scope.user_id.strip() == "":
            return False

        # agent_id 可选但非空检查
        if scope.agent_id is not None and scope.agent_id.strip() == "":
            return False

        # team_id 可选但非空检查
        if scope.team_id is not None and scope.team_id.strip() == "":
            return False

        return True

    def validate_scope_or_raise(self, scope: Scope) -> None:
        """
        验证 Scope 或抛出异常

        Args:
            scope: 待验证的作用域

        Raises:
            ScopeError: Scope 验证失败
        """
        if not scope.user_id or scope.user_id.strip() == "":
            raise ScopeError(
                message="user_id is required and cannot be empty",
                required_fields=["user_id"],
            )

        if scope.agent_id is not None and scope.agent_id.strip() == "":
            raise ScopeError(
                message="agent_id cannot be empty string when provided",
                details={"agent_id": scope.agent_id},
            )

        if scope.team_id is not None and scope.team_id.strip() == "":
            raise ScopeError(
                message="team_id cannot be empty string when provided",
                details={"team_id": scope.team_id},
            )

    def check_permission(self, scope: Scope, action: str) -> bool:
        """
        检查权限

        基于 Scope 和 action 验证是否有执行权限。

        Args:
            scope: 作用域
            action: 操作名称 (如 "read", "create", "delete")

        Returns:
            是否有权限执行该操作
        """
        # 先验证 Scope
        if not self.validate_scope(scope):
            return False

        # 使用 AccessControl 检查权限
        return self.access_control.check_permission(scope, action)

    def check_permission_or_raise(self, scope: Scope, action: str) -> None:
        """
        检查权限或抛出异常

        Args:
            scope: 作用域
            action: 操作名称

        Raises:
            ScopeError: Scope 验证失败
            PermissionDeniedError: 权限不足
        """
        # 验证 Scope
        self.validate_scope_or_raise(scope)

        # 检查权限
        if not self.access_control.check_permission(scope, action):
            raise PermissionDeniedError(
                message=f"Permission denied for action '{action}'",
                scope=scope,
                action=action,
            )

    def get_scope_hash(self, scope: Scope) -> str:
        """
        生成 Scope Hash

        用于数据库索引，确保多租户数据隔离。
        Hash 算法使用 SHA256，基于 user_id + agent_id + team_id。

        Args:
            scope: 作用域

        Returns:
            16 字符的 Hash 字符串 (SHA256 前 16 位)
        """
        # 构建 Hash 输入
        hash_input = f"{scope.user_id}/{scope.agent_id or '_'}/{scope.team_id or '_'}"

        # 生成 SHA256 Hash
        hash_bytes = hashlib.sha256(hash_input.encode("utf-8")).digest()

        # 取前 16 位作为索引 (16 hex chars = 64 bits)
        return hash_bytes[:8].hex()

    def get_scope_hash_full(self, scope: Scope) -> str:
        """
        生成完整 Scope Hash

        返回完整的 SHA256 Hash (64 字符)。

        Args:
            scope: 作用域

        Returns:
            64 字符的完整 Hash 字符串
        """
        hash_input = f"{scope.user_id}/{scope.agent_id or '_'}/{scope.team_id or '_'}"
        return hashlib.sha256(hash_input.encode("utf-8")).hexdigest()

    def scope_contains(self, scope: Scope, target: Scope) -> bool:
        """
        检查 Scope 是否包含目标 Scope

        用于验证访问权限，target 必须是 scope 的子集。

        Args:
            scope: 当前作用域
            target: 目标作用域

        Returns:
            target 是否在 scope 的范围内
        """
        # userId 必须匹配
        if scope.user_id != target.user_id:
            return False

        # 如果 target 有 agentId，scope 必须有相同 agentId
        if target.agent_id and scope.agent_id != target.agent_id:
            return False

        # 如果 target 有 teamId，scope 必须有相同 teamId
        if target.team_id and scope.team_id != target.team_id:
            return False

        return True

    def scope_equals(self, a: Scope, b: Scope) -> bool:
        """
        检查两个 Scope 是否相等

        Args:
            a: 第一个 Scope
            b: 第二个 Scope

        Returns:
            两个 Scope 是否完全相等
        """
        return (
            a.user_id == b.user_id
            and (a.agent_id or None) == (b.agent_id or None)
            and (a.team_id or None) == (b.team_id or None)
            and (a.is_global or False) == (b.is_global or False)
        )

    def scope_to_uri_path(self, scope: Scope) -> str:
        """
        将 Scope 转换为 URI 路径

        Args:
            scope: 作用域

        Returns:
            URI 路径格式: user_id/agent_id/team_id
        """
        agent = scope.agent_id or "_"
        team = scope.team_id or "_"
        return f"{scope.user_id}/{agent}/{team}"

    def is_global_scope(self, scope: Scope) -> bool:
        """
        检查是否为全局 Scope

        Args:
            scope: 作用域

        Returns:
            是否为全局作用域
        """
        return scope.is_global is True

    def is_agent_scope(self, scope: Scope) -> bool:
        """
        检查是否为 Agent Scope

        Args:
            scope: 作用域

        Returns:
            是否包含 agentId
        """
        return scope.agent_id is not None and scope.agent_id.strip() != ""

    def is_team_scope(self, scope: Scope) -> bool:
        """
        检查是否为 Team Scope

        Args:
            scope: 作用域

        Returns:
            是否包含 teamId
        """
        return scope.team_id is not None and scope.team_id.strip() != ""

    def get_scope_level(self, scope: Scope) -> str:
        """
        获取 Scope 层级

        Args:
            scope: 作用域

        Returns:
            层级字符串: "user" | "agent" | "team" | "global"
        """
        if self.is_global_scope(scope):
            return "global"
        if self.is_team_scope(scope):
            return "team"
        if self.is_agent_scope(scope):
            return "agent"
        return "user"


class ScopeBuilder(BaseModel):
    """
    Scope 构建器

    用于构建和验证 Scope 对象。
    """

    model_config = ConfigDict(frozen=False)

    user_id: str = ""
    agent_id: str | None = None
    team_id: str | None = None
    is_global: bool = False

    def with_user(self, user_id: str) -> "ScopeBuilder":
        """设置 user_id"""
        self.user_id = user_id
        return self

    def with_agent(self, agent_id: str) -> "ScopeBuilder":
        """设置 agent_id"""
        self.agent_id = agent_id
        return self

    def with_team(self, team_id: str) -> "ScopeBuilder":
        """设置 team_id"""
        self.team_id = team_id
        return self

    def as_global(self) -> "ScopeBuilder":
        """设置为全局 Scope"""
        self.is_global = True
        return self

    def build(self) -> Scope:
        """
        构建 Scope 对象

        Raises:
            ScopeError: user_id 为空时抛出

        Returns:
            构建的 Scope 对象
        """
        if not self.user_id or self.user_id.strip() == "":
            raise ScopeError(
                message="user_id is required for building Scope",
                required_fields=["user_id"],
            )

        return Scope(
            user_id=self.user_id,
            agent_id=self.agent_id,
            team_id=self.team_id,
            is_global=self.is_global,
        )


__all__ = [
    "IdentityLayer",
    "ScopeBuilder",
]