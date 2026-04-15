"""
L0 Identity Layer 模块

实现身份层核心功能：
- Scope 验证
- 权限控制
- 多租户隔离
- Scope Hash 生成
- 用户/Agent/团队仓库
"""

from agents_mem.identity.auth import (
    Permission,
    PermissionRule,
    PERMISSION_RULES,
    AccessControl,
    PermissionDeniedError,
)
from agents_mem.identity.layer import (
    IdentityLayer,
    ScopeBuilder,
)
from agents_mem.identity.repository import (
    User,
    Agent,
    Team,
    TeamMember,
    DatabaseConnection,
    BaseRepository,
    UserRepository,
    AgentRepository,
    TeamRepository,
    TeamMemberRepository,
)

__all__ = [
    # Auth
    "Permission",
    "PermissionRule",
    "PERMISSION_RULES",
    "AccessControl",
    "PermissionDeniedError",
    # Layer
    "IdentityLayer",
    "ScopeBuilder",
    # Repository Models
    "User",
    "Agent",
    "Team",
    "TeamMember",
    # Repository Protocol
    "DatabaseConnection",
    # Repositories
    "BaseRepository",
    "UserRepository",
    "AgentRepository",
    "TeamRepository",
    "TeamMemberRepository",
]