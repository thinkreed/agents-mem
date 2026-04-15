"""
Scope Mapper - Scope 映射工具

提供 agents-mem Scope 到 OpenViking 搜索过滤器的转换。
用于向量搜索的上下文隔离和过滤。

Scope 定义:
- user_id: 必填，用户隔离
- agent_id: 可选，代理隔离
- team_id: 可选，团队隔离
"""

import re
from dataclasses import dataclass, field
from typing import Any

from agents_mem.core.types import Scope


@dataclass
class VikingScope:
    """OpenViking Scope 上下文"""

    account: str = "default"
    user: str = ""
    agent: str | None = None


@dataclass
class ScopeValidation:
    """Scope 验证结果"""

    valid: bool
    errors: list[str] = field(default_factory=list)


class ScopeMapper:
    """
    Scope 映射器

    将 agents-mem Scope 转换为 OpenViking 搜索过滤器。
    """

    # ID 格式验证正则
    ID_PATTERN = re.compile(r"^^[a-zA-Z0-9_-]+$")

    def __init__(self, account: str = "default"):
        """
        初始化映射器

        Args:
            account: OpenViking 账户名
        """
        self.account = account

    # =========================================================================
    # Scope 转换方法
    # =========================================================================

    def map_to_viking_scope(self, scope: Scope) -> VikingScope:
        """
        将 agents-mem Scope 映射到 VikingScope

        Args:
            scope: agents-mem Scope

        Returns:
            VikingScope 对象
        """
        return VikingScope(
            account=self.account,
            user=scope.user_id,
            agent=scope.agent_id,
        )

    def scope_to_filters(self, scope: Scope) -> dict[str, Any]:
        """
        将 Scope 转换为 OpenViking 搜索过滤器

        用于 find API 的过滤参数。

        Args:
            scope: agents-mem Scope

        Returns:
            过滤器字典

        Example:
            >>> mapper = ScopeMapper()
            >>> scope = Scope(user_id="user123", agent_id="agent1")
            >>> mapper.scope_to_filters(scope)
            {'user': 'user123', 'agent': 'agent1'}
        """
        filters: dict[str, Any] = {
            "user": scope.user_id,
        }

        if scope.agent_id:
            filters["agent"] = scope.agent_id

        if scope.team_id:
            filters["team"] = scope.team_id

        return filters

    def scope_to_headers(self, scope: Scope) -> dict[str, str]:
        """
        将 Scope 转换为 HTTP 请求头

        用于 OpenViking API 的上下文传递。

        Args:
            scope: agents-mem Scope

        Returns:
            HTTP 头字典
        """
        headers: dict[str, str] = {
            "X-Account": self.account,
            "X-User": scope.user_id,
        }

        if scope.agent_id:
            headers["X-Agent"] = scope.agent_id

        if scope.team_id:
            headers["X-Team"] = scope.team_id

        return headers

    # =========================================================================
    # 目标 URI 构建
    # =========================================================================

    def build_target_uri(
        self,
        scope: Scope,
        resource_type: str = "memories",
    ) -> str:
        """
        构建 OpenViking 搜索目标 URI

        Args:
            scope: agents-mem Scope
            resource_type: 资源类型 (memories, resources, skills)

        Returns:
            viking:// 目标 URI

        Example:
            >>> mapper = ScopeMapper()
            >>> scope = Scope(user_id="user123", agent_id="agent1")
            >>> mapper.build_target_uri(scope)
            'viking://default/user123/agent1/memories'
        """
        parts = [self.account, scope.user_id]

        if scope.agent_id:
            parts.append(scope.agent_id)

        parts.append(resource_type)

        return "viking://" + "/".join(parts)

    def build_target_for_type(
        self,
        scope: Scope,
        resource_type: str,
    ) -> str:
        """
        为特定资源类型构建目标 URI

        Args:
            scope: agents-mem Scope
            resource_type: 资源类型 (resources, memories, skills)

        Returns:
            viking:// 目标 URI
        """
        return self.build_target_uri(scope, resource_type)

    # =========================================================================
    # Scope 验证
    # =========================================================================

    def validate_scope(self, scope: Scope) -> ScopeValidation:
        """
        验证 Scope 与 OpenViking 的兼容性

        Args:
            scope: agents-mem Scope

        Returns:
            验证结果
        """
        errors: list[str] = []

        # userId 必填
        if not scope.user_id:
            errors.append("userId is required for OpenViking operations")

        # userId 格式验证
        if scope.user_id and not self.ID_PATTERN.match(scope.user_id):
            errors.append(
                "userId must contain only alphanumeric characters, "
                "underscores, and hyphens"
            )

        # agentId 格式验证
        if scope.agent_id and not self.ID_PATTERN.match(scope.agent_id):
            errors.append(
                "agentId must contain only alphanumeric characters, "
                "underscores, and hyphens"
            )

        # teamId 格式验证
        if scope.team_id and not self.ID_PATTERN.match(scope.team_id):
            errors.append(
                "teamId must contain only alphanumeric characters, "
                "underscores, and hyphens"
            )

        return ScopeValidation(
            valid=len(errors) == 0,
            errors=errors,
        )

    # =========================================================================
    # URI 解析方法
    # =========================================================================

    def extract_scope_from_uri(self, viking_uri: str) -> dict[str, Any]:
        """
        从 Viking URI 提取 Scope 信息

        Args:
            viking_uri: viking:// URI 字符串

        Returns:
            Scope 字典 {user_id, agent_id}
        """
        # 解析 viking://account/user/agent/...
        match = re.match(
            r"^viking://([^/]+)/([^/]+)(?:/([^/]+))?", viking_uri
        )

        if not match:
            return {}

        account = match.group(1)
        user = match.group(2)
        agent_or_resource = match.group(3)

        # 判断第三个段是代理还是资源类型
        resource_types = ["resources", "memories", "skills"]
        agent_id = (
            None if agent_or_resource in resource_types else agent_or_resource
        )

        return {
            "user_id": user,
            "agent_id": agent_id,
            "account": account,
        }

    # =========================================================================
    # Scope 比较
    # =========================================================================

    def is_same_user(self, scope1: Scope, scope2: Scope) -> bool:
        """
        检查两个 Scope 是否属于同一用户

        Args:
            scope1: 第一个 Scope
            scope2: 第二个 Scope

        Returns:
            是否同一用户
        """
        return scope1.user_id == scope2.user_id

    def is_same_agent(self, scope1: Scope, scope2: Scope) -> bool:
        """
        检查两个 Scope 是否属于同一代理

        Args:
            scope1: 第一个 Scope
            scope2: 第二个 Scope

        Returns:
            是否同一代理 (同一用户前提下)
        """
        return (
            scope1.user_id == scope2.user_id
            and scope1.agent_id == scope2.agent_id
        )

    def scope_overlaps(self, scope1: Scope, scope2: Scope) -> bool:
        """
        检查两个 Scope 是否重叠

        重叠定义:
        - 同一用户
        - 且代理不冲突 (相同或其中一个为全局)

        Args:
            scope1: 第一个 Scope
            scope2: 第二个 Scope

        Returns:
            是否重叠
        """
        # 不同用户不重叠
        if scope1.user_id != scope2.user_id:
            return False

        # 代理都存在且不同 -> 不重叠
        if (
            scope1.agent_id
            and scope2.agent_id
            and scope1.agent_id != scope2.agent_id
        ):
            return False

        # 其他情况重叠
        return True


# =============================================================================
# 单例管理 (兼容旧代码)
# =============================================================================

_mapper_instance: ScopeMapper | None = None


def get_scope_mapper(account: str = "default") -> ScopeMapper:
    """
    获取单例映射器

    Args:
        account: 账户名

    Returns:
        ScopeMapper 实例
    """
    global _mapper_instance
    if not _mapper_instance:
        _mapper_instance = ScopeMapper(account)
    return _mapper_instance


def reset_scope_mapper() -> None:
    """重置单例映射器"""
    global _mapper_instance
    _mapper_instance = None