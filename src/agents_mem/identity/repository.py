"""
身份仓库模块

实现 L0 Identity Layer 的数据访问层：
- UserRepository (users 表操作)
- AgentRepository (agents 表操作)
- TeamRepository (teams 表操作)
- TeamMemberRepository (team_members 表操作)
"""

from datetime import datetime
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field

from agents_mem.core.types import Scope
from agents_mem.core.exceptions import NotFoundError, ScopeError
from agents_mem.identity.layer import IdentityLayer


# ============================================================================
# 数据模型
# ============================================================================


class User(BaseModel):
    """用户模型"""

    model_config = ConfigDict(frozen=True)

    id: str = Field(..., description="用户唯一标识")
    name: str = Field(..., description="用户名称")
    email: str | None = Field(default=None, description="用户邮箱")
    created_at: int = Field(..., description="创建时间 (Unix 秒)")
    updated_at: int = Field(..., description="更新时间 (Unix 秒)")
    is_active: bool = Field(default=True, description="是否活跃")
    metadata: dict[str, Any] = Field(default_factory=dict, description="额外元数据")


class Agent(BaseModel):
    """Agent 模型"""

    model_config = ConfigDict(frozen=True)

    id: str = Field(..., description="Agent 唯一标识")
    user_id: str = Field(..., description="所属用户 ID")
    name: str = Field(..., description="Agent 名称")
    description: str | None = Field(default=None, description="Agent 描述")
    created_at: int = Field(..., description="创建时间 (Unix 秒)")
    updated_at: int = Field(..., description="更新时间 (Unix 秒)")
    is_active: bool = Field(default=True, description="是否活跃")
    metadata: dict[str, Any] = Field(default_factory=dict, description="额外元数据")


class Team(BaseModel):
    """团队模型"""

    model_config = ConfigDict(frozen=True)

    id: str = Field(..., description="团队唯一标识")
    user_id: str = Field(..., description="创建者用户 ID")
    name: str = Field(..., description="团队名称")
    description: str | None = Field(default=None, description="团队描述")
    created_at: int = Field(..., description="创建时间 (Unix 秒)")
    updated_at: int = Field(..., description="更新时间 (Unix 秒)")
    is_active: bool = Field(default=True, description="是否活跃")
    metadata: dict[str, Any] = Field(default_factory=dict, description="额外元数据")


class TeamMember(BaseModel):
    """团队成员模型"""

    model_config = ConfigDict(frozen=True)

    id: str = Field(..., description="成员记录唯一标识")
    team_id: str = Field(..., description="团队 ID")
    agent_id: str = Field(..., description="Agent ID")
    user_id: str = Field(..., description="用户 ID")
    role: str = Field(default="member", description="成员角色")
    joined_at: int = Field(..., description="加入时间 (Unix 秒)")
    is_active: bool = Field(default=True, description="是否活跃")


# ============================================================================
# 数据库连接协议
# ============================================================================


class DatabaseConnection(Protocol):
    """数据库连接协议"""

    async def execute(
        self, query: str, params: dict[str, Any] | None = None
    ) -> Any: ...

    async def fetch_one(
        self, query: str, params: dict[str, Any] | None = None
    ) -> dict[str, Any] | None: ...

    async def fetch_all(
        self, query: str, params: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]: ...


# ============================================================================
# 基础仓库类
# ============================================================================


class BaseRepository:
    """基础仓库类"""

    def __init__(self, db: DatabaseConnection, identity_layer: IdentityLayer):
        self._db = db
        self._identity = identity_layer

    def _get_timestamp(self) -> int:
        """获取当前 Unix 秒时间戳"""
        return int(datetime.now().timestamp())

    def _validate_scope_for_user(self, scope: Scope, user_id: str) -> None:
        """验证 Scope 是否匹配用户"""
        if scope.user_id != user_id:
            raise ScopeError(
                message="Scope user_id does not match resource user_id",
                details={"scope_user_id": scope.user_id, "resource_user_id": user_id},
            )


# ============================================================================
# UserRepository
# ============================================================================


class UserRepository(BaseRepository):
    """用户仓库"""

    TABLE_NAME = "users"

    async def create(
        self,
        id: str,
        name: str,
        email: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> User:
        """
        创建用户

        Args:
            id: 用户唯一标识
            name: 用户名称
            email: 用户邮箱 (可选)
            metadata: 额外元数据 (可选)

        Returns:
            创建的用户对象
        """
        now = self._get_timestamp()
        await self._db.execute(
            f"""
            INSERT INTO {self.TABLE_NAME} (id, name, email, created_at, updated_at, is_active, metadata)
            VALUES (:id, :name, :email, :created_at, :updated_at, :is_active, :metadata)
            """,
            {
                "id": id,
                "name": name,
                "email": email,
                "created_at": now,
                "updated_at": now,
                "is_active": True,
                "metadata": metadata or {},
            },
        )
        return User(
            id=id,
            name=name,
            email=email,
            created_at=now,
            updated_at=now,
            is_active=True,
            metadata=metadata or {},
        )

    async def get(self, id: str) -> User | None:
        """
        获取用户

        Args:
            id: 用户 ID

        Returns:
            用户对象，不存在返回 None
        """
        row = await self._db.fetch_one(
            f"SELECT * FROM {self.TABLE_NAME} WHERE id = :id",
            {"id": id},
        )
        if not row:
            return None
        return User(**row)

    async def get_or_raise(self, id: str) -> User:
        """
        获取用户或抛出异常

        Args:
            id: 用户 ID

        Returns:
            用户对象

        Raises:
            NotFoundError: 用户不存在
        """
        user = await self.get(id)
        if not user:
            raise NotFoundError(
                message=f"User not found: {id}",
                resource_type="user",
                resource_id=id,
            )
        return user

    async def update(
        self,
        id: str,
        name: str | None = None,
        email: str | None = None,
        is_active: bool | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> User:
        """
        更新用户

        Args:
            id: 用户 ID
            name: 新名称 (可选)
            email: 新邮箱 (可选)
            is_active: 活跃状态 (可选)
            metadata: 新元数据 (可选)

        Returns:
            更新后的用户对象

        Raises:
            NotFoundError: 用户不存在
        """
        user = await self.get_or_raise(id)
        now = self._get_timestamp()

        updates: dict[str, Any] = {"updated_at": now}
        if name is not None:
            updates["name"] = name
        if email is not None:
            updates["email"] = email
        if is_active is not None:
            updates["is_active"] = is_active
        if metadata is not None:
            updates["metadata"] = metadata

        # 构建 UPDATE 语句
        set_clause = ", ".join(f"{k} = :{k}" for k in updates.keys())
        await self._db.execute(
            f"UPDATE {self.TABLE_NAME} SET {set_clause} WHERE id = :id",
            {"id": id, **updates},
        )

        return User(
            id=id,
            name=updates.get("name", user.name),
            email=updates.get("email", user.email),
            created_at=user.created_at,
            updated_at=now,
            is_active=updates.get("is_active", user.is_active),
            metadata=updates.get("metadata", user.metadata),
        )

    async def delete(self, id: str) -> bool:
        """
        删除用户

        Args:
            id: 用户 ID

        Returns:
            是否成功删除
        """
        result = await self._db.execute(
            f"DELETE FROM {self.TABLE_NAME} WHERE id = :id",
            {"id": id},
        )
        return result > 0

    async def list_all(self, limit: int = 100, offset: int = 0) -> list[User]:
        """
        列出所有用户

        Args:
            limit: 返回数量限制
            offset: 偏移量

        Returns:
            用户列表
        """
        rows = await self._db.fetch_all(
            f"""
            SELECT * FROM {self.TABLE_NAME}
            WHERE is_active = true
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
            """,
            {"limit": limit, "offset": offset},
        )
        return [User(**row) for row in rows]


# ============================================================================
# AgentRepository
# ============================================================================


class AgentRepository(BaseRepository):
    """Agent 仓库"""

    TABLE_NAME = "agents"

    async def create(
        self,
        scope: Scope,
        id: str,
        name: str,
        description: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Agent:
        """
        创建 Agent

        Args:
            scope: 作用域 (用于验证)
            id: Agent 唯一标识
            name: Agent 名称
            description: Agent 描述 (可选)
            metadata: 额外元数据 (可选)

        Returns:
            创建的 Agent 对象

        Raises:
            ScopeError: Scope 验证失败
        """
        # 验证 Scope
        self._identity.validate_scope_or_raise(scope)

        now = self._get_timestamp()
        await self._db.execute(
            f"""
            INSERT INTO {self.TABLE_NAME} (id, user_id, name, description, created_at, updated_at, is_active, metadata)
            VALUES (:id, :user_id, :name, :description, :created_at, :updated_at, :is_active, :metadata)
            """,
            {
                "id": id,
                "user_id": scope.user_id,
                "name": name,
                "description": description,
                "created_at": now,
                "updated_at": now,
                "is_active": True,
                "metadata": metadata or {},
            },
        )
        return Agent(
            id=id,
            user_id=scope.user_id,
            name=name,
            description=description,
            created_at=now,
            updated_at=now,
            is_active=True,
            metadata=metadata or {},
        )

    async def get(self, scope: Scope, id: str) -> Agent | None:
        """
        获取 Agent

        Args:
            scope: 作用域
            id: Agent ID

        Returns:
            Agent 对象，不存在返回 None
        """
        self._identity.validate_scope_or_raise(scope)

        row = await self._db.fetch_one(
            f"SELECT * FROM {self.TABLE_NAME} WHERE id = :id AND user_id = :user_id",
            {"id": id, "user_id": scope.user_id},
        )
        if not row:
            return None
        return Agent(**row)

    async def get_or_raise(self, scope: Scope, id: str) -> Agent:
        """
        获取 Agent 或抛出异常

        Args:
            scope: 作用域
            id: Agent ID

        Returns:
            Agent 对象

        Raises:
            NotFoundError: Agent 不存在
        """
        agent = await self.get(scope, id)
        if not agent:
            raise NotFoundError(
                message=f"Agent not found: {id}",
                resource_type="agent",
                resource_id=id,
            )
        return agent

    async def update(
        self,
        scope: Scope,
        id: str,
        name: str | None = None,
        description: str | None = None,
        is_active: bool | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Agent:
        """
        更新 Agent

        Args:
            scope: 作用域
            id: Agent ID
            name: 新名称 (可选)
            description: 新描述 (可选)
            is_active: 活跃状态 (可选)
            metadata: 新元数据 (可选)

        Returns:
            更新后的 Agent 对象

        Raises:
            NotFoundError: Agent 不存在
        """
        agent = await self.get_or_raise(scope, id)
        now = self._get_timestamp()

        updates: dict[str, Any] = {"updated_at": now}
        if name is not None:
            updates["name"] = name
        if description is not None:
            updates["description"] = description
        if is_active is not None:
            updates["is_active"] = is_active
        if metadata is not None:
            updates["metadata"] = metadata

        set_clause = ", ".join(f"{k} = :{k}" for k in updates.keys())
        await self._db.execute(
            f"UPDATE {self.TABLE_NAME} SET {set_clause} WHERE id = :id AND user_id = :user_id",
            {"id": id, "user_id": scope.user_id, **updates},
        )

        return Agent(
            id=id,
            user_id=scope.user_id,
            name=updates.get("name", agent.name),
            description=updates.get("description", agent.description),
            created_at=agent.created_at,
            updated_at=now,
            is_active=updates.get("is_active", agent.is_active),
            metadata=updates.get("metadata", agent.metadata),
        )

    async def delete(self, scope: Scope, id: str) -> bool:
        """
        删除 Agent

        Args:
            scope: 作用域
            id: Agent ID

        Returns:
            是否成功删除
        """
        self._identity.validate_scope_or_raise(scope)
        result = await self._db.execute(
            f"DELETE FROM {self.TABLE_NAME} WHERE id = :id AND user_id = :user_id",
            {"id": id, "user_id": scope.user_id},
        )
        return result > 0

    async def list_by_user(self, scope: Scope, limit: int = 100, offset: int = 0) -> list[Agent]:
        """
        列出用户的 Agents

        Args:
            scope: 作用域
            limit: 返回数量限制
            offset: 偏移量

        Returns:
            Agent 列表
        """
        self._identity.validate_scope_or_raise(scope)
        rows = await self._db.fetch_all(
            f"""
            SELECT * FROM {self.TABLE_NAME}
            WHERE user_id = :user_id AND is_active = true
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
            """,
            {"user_id": scope.user_id, "limit": limit, "offset": offset},
        )
        return [Agent(**row) for row in rows]


# ============================================================================
# TeamRepository
# ============================================================================


class TeamRepository(BaseRepository):
    """团队仓库"""

    TABLE_NAME = "teams"

    async def create(
        self,
        scope: Scope,
        id: str,
        name: str,
        description: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Team:
        """
        创建团队

        Args:
            scope: 作用域
            id: 团队唯一标识
            name: 团队名称
            description: 团队描述 (可选)
            metadata: 额外元数据 (可选)

        Returns:
            创建的团队对象

        Raises:
            ScopeError: Scope 验证失败
        """
        self._identity.validate_scope_or_raise(scope)

        now = self._get_timestamp()
        await self._db.execute(
            f"""
            INSERT INTO {self.TABLE_NAME} (id, user_id, name, description, created_at, updated_at, is_active, metadata)
            VALUES (:id, :user_id, :name, :description, :created_at, :updated_at, :is_active, :metadata)
            """,
            {
                "id": id,
                "user_id": scope.user_id,
                "name": name,
                "description": description,
                "created_at": now,
                "updated_at": now,
                "is_active": True,
                "metadata": metadata or {},
            },
        )
        return Team(
            id=id,
            user_id=scope.user_id,
            name=name,
            description=description,
            created_at=now,
            updated_at=now,
            is_active=True,
            metadata=metadata or {},
        )

    async def get(self, scope: Scope, id: str) -> Team | None:
        """
        获取团队

        Args:
            scope: 作用域
            id: 团队 ID

        Returns:
            团队对象，不存在返回 None
        """
        self._identity.validate_scope_or_raise(scope)

        row = await self._db.fetch_one(
            f"SELECT * FROM {self.TABLE_NAME} WHERE id = :id AND user_id = :user_id",
            {"id": id, "user_id": scope.user_id},
        )
        if not row:
            return None
        return Team(**row)

    async def get_or_raise(self, scope: Scope, id: str) -> Team:
        """
        获取团队或抛出异常

        Args:
            scope: 作用域
            id: 团队 ID

        Returns:
            团队对象

        Raises:
            NotFoundError: 团队不存在
        """
        team = await self.get(scope, id)
        if not team:
            raise NotFoundError(
                message=f"Team not found: {id}",
                resource_type="team",
                resource_id=id,
            )
        return team

    async def update(
        self,
        scope: Scope,
        id: str,
        name: str | None = None,
        description: str | None = None,
        is_active: bool | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Team:
        """
        更新团队

        Args:
            scope: 作用域
            id: 团队 ID
            name: 新名称 (可选)
            description: 新描述 (可选)
            is_active: 活跃状态 (可选)
            metadata: 新元数据 (可选)

        Returns:
            更新后的团队对象

        Raises:
            NotFoundError: 团队不存在
        """
        team = await self.get_or_raise(scope, id)
        now = self._get_timestamp()

        updates: dict[str, Any] = {"updated_at": now}
        if name is not None:
            updates["name"] = name
        if description is not None:
            updates["description"] = description
        if is_active is not None:
            updates["is_active"] = is_active
        if metadata is not None:
            updates["metadata"] = metadata

        set_clause = ", ".join(f"{k} = :{k}" for k in updates.keys())
        await self._db.execute(
            f"UPDATE {self.TABLE_NAME} SET {set_clause} WHERE id = :id AND user_id = :user_id",
            {"id": id, "user_id": scope.user_id, **updates},
        )

        return Team(
            id=id,
            user_id=scope.user_id,
            name=updates.get("name", team.name),
            description=updates.get("description", team.description),
            created_at=team.created_at,
            updated_at=now,
            is_active=updates.get("is_active", team.is_active),
            metadata=updates.get("metadata", team.metadata),
        )

    async def delete(self, scope: Scope, id: str) -> bool:
        """
        删除团队

        Args:
            scope: 作用域
            id: 团队 ID

        Returns:
            是否成功删除
        """
        self._identity.validate_scope_or_raise(scope)
        result = await self._db.execute(
            f"DELETE FROM {self.TABLE_NAME} WHERE id = :id AND user_id = :user_id",
            {"id": id, "user_id": scope.user_id},
        )
        return result > 0

    async def list_by_user(self, scope: Scope, limit: int = 100, offset: int = 0) -> list[Team]:
        """
        列出用户的团队

        Args:
            scope: 作用域
            limit: 返回数量限制
            offset: 偏移量

        Returns:
            团队列表
        """
        self._identity.validate_scope_or_raise(scope)
        rows = await self._db.fetch_all(
            f"""
            SELECT * FROM {self.TABLE_NAME}
            WHERE user_id = :user_id AND is_active = true
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
            """,
            {"user_id": scope.user_id, "limit": limit, "offset": offset},
        )
        return [Team(**row) for row in rows]


# ============================================================================
# TeamMemberRepository
# ============================================================================


class TeamMemberRepository(BaseRepository):
    """团队成员仓库"""

    TABLE_NAME = "team_members"

    async def create(
        self,
        scope: Scope,
        team_id: str,
        agent_id: str,
        role: str = "member",
    ) -> TeamMember:
        """
        添加团队成员

        Args:
            scope: 作用域
            team_id: 团队 ID
            agent_id: Agent ID
            role: 成员角色 (默认 "member")

        Returns:
            创建的团队成员对象

        Raises:
            ScopeError: Scope 验证失败
        """
        self._identity.validate_scope_or_raise(scope)

        now = self._get_timestamp()
        # 生成唯一 ID
        member_id = f"{team_id}_{agent_id}"

        await self._db.execute(
            f"""
            INSERT INTO {self.TABLE_NAME} (id, team_id, agent_id, user_id, role, joined_at, is_active)
            VALUES (:id, :team_id, :agent_id, :user_id, :role, :joined_at, :is_active)
            """,
            {
                "id": member_id,
                "team_id": team_id,
                "agent_id": agent_id,
                "user_id": scope.user_id,
                "role": role,
                "joined_at": now,
                "is_active": True,
            },
        )
        return TeamMember(
            id=member_id,
            team_id=team_id,
            agent_id=agent_id,
            user_id=scope.user_id,
            role=role,
            joined_at=now,
            is_active=True,
        )

    async def get(self, scope: Scope, team_id: str, agent_id: str) -> TeamMember | None:
        """
        获取团队成员

        Args:
            scope: 作用域
            team_id: 团队 ID
            agent_id: Agent ID

        Returns:
            团队成员对象，不存在返回 None
        """
        self._identity.validate_scope_or_raise(scope)

        member_id = f"{team_id}_{agent_id}"
        row = await self._db.fetch_one(
            f"""
            SELECT * FROM {self.TABLE_NAME}
            WHERE id = :id AND user_id = :user_id
            """,
            {"id": member_id, "user_id": scope.user_id},
        )
        if not row:
            return None
        return TeamMember(**row)

    async def get_by_team(self, scope: Scope, team_id: str) -> list[TeamMember]:
        """
        获取团队所有成员

        Args:
            scope: 作用域
            team_id: 团队 ID

        Returns:
            团队成员列表
        """
        self._identity.validate_scope_or_raise(scope)

        rows = await self._db.fetch_all(
            f"""
            SELECT * FROM {self.TABLE_NAME}
            WHERE team_id = :team_id AND user_id = :user_id AND is_active = true
            ORDER BY joined_at ASC
            """,
            {"team_id": team_id, "user_id": scope.user_id},
        )
        return [TeamMember(**row) for row in rows]

    async def update_role(
        self,
        scope: Scope,
        team_id: str,
        agent_id: str,
        role: str,
    ) -> TeamMember:
        """
        更新成员角色

        Args:
            scope: 作用域
            team_id: 团队 ID
            agent_id: Agent ID
            role: 新角色

        Returns:
            更新后的团队成员对象

        Raises:
            NotFoundError: 成员不存在
        """
        self._identity.validate_scope_or_raise(scope)

        member = await self.get(scope, team_id, agent_id)
        if not member:
            raise NotFoundError(
                message=f"Team member not found: team_id={team_id}, agent_id={agent_id}",
                resource_type="team_member",
                resource_id=f"{team_id}_{agent_id}",
            )

        member_id = f"{team_id}_{agent_id}"
        await self._db.execute(
            f"""
            UPDATE {self.TABLE_NAME}
            SET role = :role
            WHERE id = :id AND user_id = :user_id
            """,
            {"id": member_id, "user_id": scope.user_id, "role": role},
        )

        return TeamMember(
            id=member_id,
            team_id=team_id,
            agent_id=agent_id,
            user_id=scope.user_id,
            role=role,
            joined_at=member.joined_at,
            is_active=member.is_active,
        )

    async def remove(self, scope: Scope, team_id: str, agent_id: str) -> bool:
        """
        移除团队成员

        Args:
            scope: 作用域
            team_id: 团队 ID
            agent_id: Agent ID

        Returns:
            是否成功移除
        """
        self._identity.validate_scope_or_raise(scope)

        member_id = f"{team_id}_{agent_id}"
        result = await self._db.execute(
            f"""
            DELETE FROM {self.TABLE_NAME}
            WHERE id = :id AND user_id = :user_id
            """,
            {"id": member_id, "user_id": scope.user_id},
        )
        return result > 0


__all__ = [
    # 数据模型
    "User",
    "Agent",
    "Team",
    "TeamMember",
    # 协议
    "DatabaseConnection",
    # 仓库
    "BaseRepository",
    "UserRepository",
    "AgentRepository",
    "TeamRepository",
    "TeamMemberRepository",
]