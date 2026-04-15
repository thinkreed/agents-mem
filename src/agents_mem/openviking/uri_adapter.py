"""
URI Adapter - URI 转换工具

提供 mem:// URI 和 viking:// URI 之间的转换。
用于 OpenViking 向量搜索服务的 URI 格式适配。

URI 格式:
- mem://: mem://{userId}/{agentId?}/{teamId?}/{type}/{id}
- viking://: viking://{account}/{userId}/{agentId?}/{resourceType}/{path}

转换规则:
- documents, assets, tiered -> resources
- conversations, messages, facts -> memories
"""

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from agents_mem.core.types import EntityType


class VikingResourceType(str, Enum):
    """OpenViking 资源类型"""

    RESOURCES = "resources"
    MEMORIES = "memories"
    SKILLS = "skills"


# EntityType 到 VikingResourceType 的映射
ENTITY_TO_VIKING: dict[EntityType, VikingResourceType] = {
    EntityType.DOCUMENTS: VikingResourceType.RESOURCES,
    EntityType.ASSETS: VikingResourceType.RESOURCES,
    EntityType.CONVERSATIONS: VikingResourceType.MEMORIES,
    EntityType.MESSAGES: VikingResourceType.MEMORIES,
    EntityType.FACTS: VikingResourceType.MEMORIES,
    EntityType.TIERED: VikingResourceType.RESOURCES,
    EntityType.ENTITY_NODES: VikingResourceType.RESOURCES,
}

# 路径到 EntityType 的反向映射
PATH_TO_ENTITY: dict[str, EntityType] = {
    "documents": EntityType.DOCUMENTS,
    "assets": EntityType.ASSETS,
    "conversations": EntityType.CONVERSATIONS,
    "messages": EntityType.MESSAGES,
    "facts": EntityType.FACTS,
    "tiered": EntityType.TIERED,
    "entity_nodes": EntityType.ENTITY_NODES,
}


@dataclass
class VikingURI:
    """Viking URI 组件"""

    account: str
    user: str
    agent: str | None = None
    resource_type: VikingResourceType = VikingResourceType.RESOURCES
    path: list[str] = field(default_factory=list)

    def to_string(self) -> str:
        """转换为 viking:// URI 字符串"""
        parts = [self.account, self.user]

        if self.agent:
            parts.append(self.agent)

        parts.append(self.resource_type.value)
        parts.extend(self.path)

        return "viking://" + "/".join(parts)


@dataclass
class MemURI:
    """mem:// URI 组件"""

    user_id: str
    agent_id: str | None = None
    team_id: str | None = None
    entity_type: EntityType = EntityType.DOCUMENTS
    resource_id: str = ""

    def to_string(self) -> str:
        """转换为 mem:// URI 字符串"""
        agent = self.agent_id or "_"
        team = self.team_id or "_"
        return (
            f"mem://{self.user_id}/{agent}/{team}/"
            f"{self.entity_type.value}/{self.resource_id}"
        )


class URIAdapter:
    """
    URI 转换适配器

    提供 mem:// 和 viking:// URI 之间的双向转换。
    """

    # URI 解析正则
    MEM_URI_PATTERN = re.compile(
        r"^mem://([^/]+)/([^/]+)/([^/]+)/([^/]+)/([^/]+)$"
    )
    # Viking URI: viking://account/user/{agent?}/{resourceType}/path
    # Need to handle both cases: with agent and without agent
    # Resource types: resources, memories, skills
    VIKING_URI_PATTERN = re.compile(
        r"^viking://([^/]+)/([^/]+)/(resources|memories|skills)/(.+)$"
    )
    VIKING_URI_WITH_AGENT_PATTERN = re.compile(
        r"^viking://([^/]+)/([^/]+)/([^/]+)/(resources|memories|skills)/(.+)$"
    )

    def __init__(self, account: str = "default"):
        """
        初始化适配器

        Args:
            account: OpenViking 账户名
        """
        self.account = account

    # =========================================================================
    # URI 转换方法
    # =========================================================================

    def to_viking_uri(
        self,
        mem_uri: str,
        user_id: str,
        agent_id: str | None = None,
    ) -> str:
        """
        将 mem:// URI 转换为 viking:// URI

        Args:
            mem_uri: mem:// URI 字符串
            user_id: 用户 ID
            agent_id: 代理 ID (可选)

        Returns:
            viking:// URI 字符串

        Raises:
            ValueError: URI 格式无效

        Example:
            >>> adapter = URIAdapter()
            >>> adapter.to_viking_uri(
            ...     "mem://user123/agent1/_/documents/doc-456",
            ...     "user123", "agent1"
            ... )
            'viking://default/user123/agent1/resources/documents/doc-456'
        """
        parsed = self.parse_mem_uri(mem_uri)
        if not parsed:
            raise ValueError(f"Invalid mem:// URI: {mem_uri}")

        # 构建 Viking URI
        viking_uri = VikingURI(
            account=self.account,
            user=parsed.user_id,
            agent=parsed.agent_id or agent_id,
            resource_type=ENTITY_TO_VIKING.get(
                parsed.entity_type, VikingResourceType.RESOURCES
            ),
            path=self._build_viking_path(parsed.entity_type, parsed.resource_id),
        )

        return viking_uri.to_string()

    def to_mem_uri(
        self,
        viking_uri: str,
        team_id: str | None = None,
    ) -> str:
        """
        将 viking:// URI 转换为 mem:// URI

        Args:
            viking_uri: viking:// URI 字符串
            team_id: 团队 ID (可选)

        Returns:
            mem:// URI 字符串

        Raises:
            ValueError: URI 格式无效

        Example:
            >>> adapter = URIAdapter()
            >>> adapter.to_mem_uri(
            ...     "viking://default/user123/agent1/resources/documents/doc-456",
            ...     team_id="team5"
            ... )
            'mem://user123/agent1/team5/documents/doc-456'
        """
        parsed = self.parse_viking_uri(viking_uri)
        if not parsed:
            raise ValueError(f"Invalid viking:// URI: {viking_uri}")

        # 从路径提取实体类型和 ID
        entity_type, resource_id = self._extract_from_path(parsed.path)

        mem_uri = MemURI(
            user_id=parsed.user,
            agent_id=parsed.agent,
            team_id=team_id,
            entity_type=entity_type,
            resource_id=resource_id,
        )

        return mem_uri.to_string()

    # =========================================================================
    # 目标 URI 构建 (用于搜索)
    # =========================================================================

    def build_target_uri(
        self,
        user_id: str,
        agent_id: str | None = None,
        entity_type: EntityType = EntityType.DOCUMENTS,
    ) -> str:
        """
        构建搜索目标 URI (不含具体资源 ID)

        用于 OpenViking find API 的 target_uri 参数。

        Args:
            user_id: 用户 ID
            agent_id: 代理 ID (可选)
            entity_type: 实体类型

        Returns:
            viking:// 目标 URI

        Example:
            >>> adapter = URIAdapter()
            >>> adapter.build_target_uri("user123", None, EntityType.DOCUMENTS)
            'viking://default/user123/resources/documents'
        """
        resource_type = ENTITY_TO_VIKING.get(
            entity_type, VikingResourceType.RESOURCES
        )
        base_path = self._get_base_path(entity_type)

        parts = [self.account, user_id]

        if agent_id:
            parts.append(agent_id)

        parts.append(resource_type.value)
        parts.extend(base_path)

        return "viking://" + "/".join(parts)

    def build_resource_uri(
        self,
        user_id: str,
        agent_id: str | None = None,
        entity_type: EntityType = EntityType.DOCUMENTS,
        resource_id: str = "",
    ) -> str:
        """
        构建完整资源 URI

        Args:
            user_id: 用户 ID
            agent_id: 代理 ID (可选)
            entity_type: 实体类型
            resource_id: 资源 ID

        Returns:
            viking:// 资源 URI
        """
        target_uri = self.build_target_uri(user_id, agent_id, entity_type)
        if resource_id:
            return f"{target_uri}/{resource_id}"
        return target_uri

    # =========================================================================
    # URI 解析方法
    # =========================================================================

    def parse_mem_uri(self, uri: str) -> MemURI | None:
        """
        解析 mem:// URI

        Args:
            uri: URI 字符串

        Returns:
            MemURI 组件，解析失败返回 None
        """
        match = self.MEM_URI_PATTERN.match(uri)
        if not match:
            return None

        user_id = match.group(1)
        agent_id = match.group(2) if match.group(2) != "_" else None
        team_id = match.group(3) if match.group(3) != "_" else None

        try:
            entity_type = EntityType(match.group(4))
        except ValueError:
            return None

        resource_id = match.group(5)

        return MemURI(
            user_id=user_id,
            agent_id=agent_id,
            team_id=team_id,
            entity_type=entity_type,
            resource_id=resource_id,
        )

    def parse_viking_uri(self, uri: str) -> VikingURI | None:
        """
        解析 viking:// URI

        Args:
            uri: URI 字符串

        Returns:
            VikingURI 组件，解析失败返回 None
        """
        # First try with agent pattern
        match = self.VIKING_URI_WITH_AGENT_PATTERN.match(uri)
        if match:
            account = match.group(1)
            user = match.group(2)
            agent = match.group(3)
            try:
                resource_type = VikingResourceType(match.group(4))
            except ValueError:
                return None
            path = match.group(5).split("/")
            
            return VikingURI(
                account=account,
                user=user,
                agent=agent,
                resource_type=resource_type,
                path=path,
            )
        
        # Then try without agent pattern
        match = self.VIKING_URI_PATTERN.match(uri)
        if match:
            account = match.group(1)
            user = match.group(2)
            try:
                resource_type = VikingResourceType(match.group(3))
            except ValueError:
                return None
            path = match.group(4).split("/")
            
            return VikingURI(
                account=account,
                user=user,
                agent=None,
                resource_type=resource_type,
                path=path,
            )
        
        return None

    # =========================================================================
    # ID 提取方法
    # =========================================================================

    def extract_id_from_uri(self, uri: str) -> str:
        """
        从 URI 提取资源 ID

        Args:
            uri: URI 字符串 (mem:// 或 viking://)

        Returns:
            资源 ID
        """
        if uri.startswith("viking://"):
            parsed = self.parse_viking_uri(uri)
            if parsed and parsed.path:
                return parsed.path[-1]
        elif uri.startswith("mem://"):
            parsed = self.parse_mem_uri(uri)
            if parsed:
                return parsed.resource_id

        return ""

    def extract_scope_from_uri(self, uri: str) -> dict[str, Any]:
        """
        从 URI 提取 Scope 信息

        Args:
            uri: URI 字符串

        Returns:
            Scope 字典 {user_id, agent_id, team_id}
        """
        if uri.startswith("mem://"):
            parsed = self.parse_mem_uri(uri)
            if parsed:
                return {
                    "user_id": parsed.user_id,
                    "agent_id": parsed.agent_id,
                    "team_id": parsed.team_id,
                }
        elif uri.startswith("viking://"):
            parsed = self.parse_viking_uri(uri)
            if parsed:
                return {
                    "user_id": parsed.user,
                    "agent_id": parsed.agent,
                    "team_id": None,
                    "account": parsed.account,
                }

        return {}

    # =========================================================================
    # 内部方法
    # =========================================================================

    def _build_viking_path(
        self, entity_type: EntityType, resource_id: str
    ) -> list[str]:
        """构建 Viking URI 路径"""
        base_path = self._get_base_path(entity_type)
        if resource_id:
            return [*base_path, resource_id]
        return base_path

    def _get_base_path(self, entity_type: EntityType) -> list[str]:
        """获取实体类型的基础路径"""
        return [entity_type.value]

    def _extract_from_path(
        self, path: list[str]
    ) -> tuple[EntityType, str]:
        """从 Viking 路径提取实体类型和 ID"""
        if not path:
            return EntityType.DOCUMENTS, ""

        # 第一个路径段是实体类型目录
        first_segment = path[0]
        entity_type = PATH_TO_ENTITY.get(first_segment, EntityType.DOCUMENTS)

        # 最后一个路径段是资源 ID
        resource_id = path[-1] if len(path) > 1 else ""

        return entity_type, resource_id


# =============================================================================
# 单例管理 (兼容旧代码)
# =============================================================================

_adapter_instance: URIAdapter | None = None


def get_uri_adapter(account: str = "default") -> URIAdapter:
    """
    获取单例适配器

    Args:
        account: 账户名

    Returns:
        URIAdapter 实例
    """
    global _adapter_instance
    if not _adapter_instance:
        _adapter_instance = URIAdapter(account)
    return _adapter_instance


def reset_uri_adapter() -> None:
    """重置单例适配器"""
    global _adapter_instance
    _adapter_instance = None