"""
Asset Repository - 资产资源仓库

提供 Asset 资源的 CRUD 操作：
- 创建资产 (二进制文件)
- 读取资产 (支持分层视图)
- 更新资产
- 删除资产
- 搜索资产 (FTS, 语义, 混合)
"""

import json
import time
import uuid
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field

from agents_mem.core.types import Content, ContentType, TierLevel, Scope as TypesScope
from agents_mem.core.exceptions import NotFoundError, ValidationError, ScopeError
from agents_mem.core.uri import URISystem, Scope as URIScope
from agents_mem.core.constants import RESOURCE_ASSET
from agents_mem.content.capabilities.tiered import TieredViewCapability

# 使用 types.Scope 作为主要 Scope 类型
Scope = TypesScope


# ============================================================================
# 数据模型
# ============================================================================

class Asset(BaseModel):
    """资产模型 (对应 assets 表)"""

    model_config = ConfigDict(frozen=False)

    # 主键
    id: str = Field(..., description="资产唯一标识")

    # Scope 字段
    user_id: str = Field(..., description="用户ID")
    agent_id: str | None = Field(default=None, description="代理ID")
    team_id: str | None = Field(default=None, description="团队ID")
    is_global: bool = Field(default=False, description="是否全局")

    # 文件信息
    filename: str = Field(..., description="文件名")
    file_type: str = Field(..., description="文件类型 (MIME type)")
    file_size: int = Field(..., description="文件大小 (bytes)")

    # 来源信息
    source_url: str | None = Field(default=None, description="原始URL")
    source_path: str | None = Field(default=None, description="原始路径")

    # 存储路径
    storage_path: str = Field(..., description="存储路径")

    # 文本提取
    extracted_text: str | None = Field(default=None, description="提取的文本内容")
    text_extracted: bool = Field(default=False, description="是否已提取文本")

    # 元信息
    title: str | None = Field(default=None, description="资产标题")
    description: str | None = Field(default=None, description="资产描述")

    # 元数据
    metadata: dict[str, Any] = Field(default_factory=dict, description="额外元数据")

    # OpenViking URI (向量存储)
    openviking_uri: str | None = Field(default=None, description="OpenViking URI")

    # 时间戳 (Unix 秒)
    created_at: int = Field(default_factory=lambda: int(time.time()), description="创建时间")
    updated_at: int = Field(default_factory=lambda: int(time.time()), description="更新时间")

    @property
    def uri(self) -> str:
        """生成 mem:// URI"""
        uri_scope = URIScope(
            user_id=self.user_id,
            agent_id=self.agent_id,
            team_id=self.team_id,
        )
        return URISystem.build(uri_scope, RESOURCE_ASSET, self.id)


class AssetCreateInput(BaseModel):
    """创建资产输入"""

    filename: str = Field(..., description="文件名")
    file_type: str = Field(..., description="文件类型 (MIME type)")
    file_size: int = Field(..., description="文件大小 (bytes)")
    title: str | None = Field(default=None, description="资产标题")
    description: str | None = Field(default=None, description="资产描述")
    source_url: str | None = Field(default=None, description="原始URL")
    source_path: str | None = Field(default=None, description="原始路径")
    metadata: dict[str, Any] | None = Field(default=None, description="额外元数据")
    is_global: bool = Field(default=False, description="是否全局")


class AssetUpdateInput(BaseModel):
    """更新资产输入"""

    title: str | None = Field(default=None, description="新标题")
    description: str | None = Field(default=None, description="新描述")
    metadata: dict[str, Any] | None = Field(default=None, description="新元数据")


# ============================================================================
# 数据库连接协议
# ============================================================================

class DatabaseConnectionProtocol(Protocol):
    """数据库连接协议"""

    async def run(
        self, sql: str, params: list[Any] | None = None
    ) -> Any: ...

    async def query(
        self, sql: str, params: list[Any] | None = None
    ) -> list[dict[str, Any]]: ...

    async def query_one(
        self, sql: str, params: list[Any] | None = None
    ) -> dict[str, Any] | None: ...


# ============================================================================
# AssetRepository 类
# ============================================================================

class AssetRepository:
    """
    资产仓库

    提供资产资源的 CRUD 操作，支持：
    - 分层视图 (L0/L1/L2)
    - Scope 验证
    - FTS 全文搜索
    """

    TABLE_NAME = "assets"

    def __init__(
        self,
        db: DatabaseConnectionProtocol,
        tiered: TieredViewCapability | None = None,
    ):
        """
        初始化资产仓库

        Args:
            db: 数据库连接
            tiered: 分层视图能力 (可选)
        """
        self._db = db
        self._tiered = tiered

    # =========================================================================
    # CRUD 操作
    # =========================================================================

    async def create(
        self,
        scope: Scope,
        input: AssetCreateInput,
        id: str | None = None,
        storage_path: str | None = None,
    ) -> Asset:
        """
        创建资产

        Args:
            scope: 作用域
            input: 创建输入
            id: 自定义 ID (可选，默认自动生成)
            storage_path: 存储路径 (可选，默认自动生成)

        Returns:
            创建的资产对象

        Raises:
            ValidationError: 输入验证失败
            ScopeError: Scope 验证失败
        """
        # 验证 Scope
        if not scope.user_id:
            raise ScopeError(
                message="user_id is required",
                required_fields=["user_id"],
            )

        # 验证输入
        if not input.filename or input.filename.strip() == "":
            raise ValidationError(
                message="filename is required",
                field="filename",
            )

        if not input.file_type:
            raise ValidationError(
                message="file_type is required",
                field="file_type",
            )

        if input.file_size <= 0:
            raise ValidationError(
                message="file_size must be positive",
                field="file_size",
            )

        # 生成 ID
        asset_id = id or f"asset-{uuid.uuid4().hex[:12]}"
        now = int(time.time())

        # 生成存储路径 (默认)
        if not storage_path:
            storage_path = f"assets/{scope.user_id}/{asset_id}/{input.filename}"

        # 处理 metadata
        metadata = json.dumps(input.metadata) if input.metadata else "{}"

        # 插入数据库
        await self._db.run(
            f"""
            INSERT INTO {self.TABLE_NAME} (
                id, user_id, agent_id, team_id, is_global,
                filename, file_type, file_size, source_url, source_path,
                storage_path, title, description, metadata,
                text_extracted, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                asset_id,
                scope.user_id,
                scope.agent_id,
                scope.team_id,
                input.is_global,
                input.filename,
                input.file_type,
                input.file_size,
                input.source_url,
                input.source_path,
                storage_path,
                input.title,
                input.description,
                metadata,
                False,  # text_extracted 默认为 False
                now,
                now,
            ],
        )

        return Asset(
            id=asset_id,
            user_id=scope.user_id,
            agent_id=scope.agent_id,
            team_id=scope.team_id,
            is_global=input.is_global,
            filename=input.filename,
            file_type=input.file_type,
            file_size=input.file_size,
            source_url=input.source_url,
            source_path=input.source_path,
            storage_path=storage_path,
            extracted_text=None,
            title=input.title,
            description=input.description,
            metadata=metadata,
            openviking_uri=None,
            text_extracted=False,
            created_at=now,
            updated_at=now,
        )

    async def get(
        self,
        scope: Scope,
        asset_id: str,
        tier: TierLevel | str | None = None,
    ) -> Asset | str | None:
        """
        获取资产

        Args:
            scope: 作用域
            asset_id: 资产 ID
            tier: 分层级别 (可选)

        Returns:
            如果 tier=None: 返回完整 Asset 对象
            如果 tier=L0/L1: 返回分层视图字符串 (基于 extracted_text)
            如果不存在: 返回 None
        """
        # 查询数据库
        row = await self._db.query_one(
            f"""
            SELECT * FROM {self.TABLE_NAME}
            WHERE id = ? AND user_id = ?
            """,
            [asset_id, scope.user_id],
        )

        if not row:
            return None

        # 验证 Scope 匹配
        if scope.agent_id and row.get("agent_id") != scope.agent_id:
            return None
        if scope.team_id and row.get("team_id") != scope.team_id:
            return None

        # 构建 Asset 对象
        asset = self._row_to_asset(row)

        # 如果需要分层视图 (基于 extracted_text)
        if tier and self._tiered and asset.extracted_text:
            content = Content(
                id=asset.id,
                uri=asset.uri,
                title=asset.title or asset.filename,
                body=asset.extracted_text,
                content_type=ContentType.FILE,
                user_id=asset.user_id,
                agent_id=asset.agent_id,
                team_id=asset.team_id,
            )
            return await self._tiered.get_view(content, tier)

        return asset

    async def get_or_raise(
        self,
        scope: Scope,
        asset_id: str,
        tier: TierLevel | str | None = None,
    ) -> Asset:
        """
        获取资产或抛出异常

        注意: tier 参数仅用于验证存在性，不用于获取分层视图。
        如果需要分层视图，请使用 get() 方法。

        Args:
            scope: 作用域
            asset_id: 资产 ID
            tier: 分层级别 (仅验证存在性)

        Returns:
            资产对象

        Raises:
            NotFoundError: 资产不存在
        """
        # 使用 tier=None 获取完整资产对象
        result = await self.get(scope, asset_id, tier=None)
        if result is None:
            raise NotFoundError(
                message=f"Asset not found: {asset_id}",
                resource_type="asset",
                resource_id=asset_id,
            )
        # result 应该是 Asset 类型 (因为 tier=None)
        return result  # type: ignore[return-value]

    async def update(
        self,
        scope: Scope,
        asset_id: str,
        input: AssetUpdateInput,
    ) -> Asset:
        """
        更新资产

        Args:
            scope: 作用域
            asset_id: 资产 ID
            input: 更新输入

        Returns:
            更新后的资产对象

        Raises:
            NotFoundError: 资产不存在
        """
        # 验证资产存在
        await self.get_or_raise(scope, asset_id)

        now = int(time.time())

        # 构建更新字段
        updates: dict[str, Any] = {"updated_at": now}
        if input.title is not None:
            updates["title"] = input.title
        if input.description is not None:
            updates["description"] = input.description
        if input.metadata is not None:
            updates["metadata"] = json.dumps(input.metadata)

        # 构建 SQL
        set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
        params = list(updates.values()) + [asset_id, scope.user_id]

        await self._db.run(
            f"UPDATE {self.TABLE_NAME} SET {set_clause} WHERE id = ? AND user_id = ?",
            params,
        )

        # 返回更新后的资产
        return await self.get_or_raise(scope, asset_id)

    async def delete(self, scope: Scope, asset_id: str) -> bool:
        """
        删除资产

        Args:
            scope: 作用域
            asset_id: 资产 ID

        Returns:
            是否成功删除
        """
        # 验证资产存在
        asset = await self.get(scope, asset_id)
        if not asset:
            return False

        # 删除资产
        await self._db.run(
            f"DELETE FROM {self.TABLE_NAME} WHERE id = ? AND user_id = ?",
            [asset_id, scope.user_id],
        )

        return True

    # =========================================================================
    # 搜索操作
    # =========================================================================

    async def search(
        self,
        scope: Scope,
        query: str,
        mode: str = "hybrid",
        limit: int = 10,
    ) -> list[Asset]:
        """
        搜索资产

        Args:
            scope: 作用域
            query: 搜索查询
            mode: 搜索模式 (fts, hybrid)
            limit: 返回数量限制

        Returns:
            匹配的资产列表
        """
        # FTS 搜索 (SQLite FTS5 需要额外配置，这里使用 LIKE)
        # 搜索 filename, title, description, extracted_text
        rows = await self._db.query(
            f"""
            SELECT * FROM {self.TABLE_NAME}
            WHERE user_id = ?
              AND (agent_id = ? OR agent_id IS NULL)
              AND (team_id = ? OR team_id IS NULL)
              AND (filename LIKE ? OR title LIKE ? OR description LIKE ? OR extracted_text LIKE ?)
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            [
                scope.user_id,
                scope.agent_id,
                scope.team_id,
                f"%{query}%",
                f"%{query}%",
                f"%{query}%",
                f"%{query}%",
                limit,
            ],
        )

        return [self._row_to_asset(row) for row in rows]

    async def list(
        self,
        scope: Scope,
        limit: int = 10,
        offset: int = 0,
        file_type: str | None = None,
    ) -> list[Asset]:
        """
        列出资产

        Args:
            scope: 作用域
            limit: 返回数量限制
            offset: 偏移量
            file_type: 文件类型过滤

        Returns:
            资产列表
        """
        # 构建查询
        sql = f"""
        SELECT * FROM {self.TABLE_NAME}
        WHERE user_id = ?
          AND (agent_id = ? OR agent_id IS NULL)
          AND (team_id = ? OR team_id IS NULL)
        """
        params: list[Any] = [scope.user_id, scope.agent_id, scope.team_id]

        if file_type:
            sql += " AND file_type = ?"
            params.append(file_type)

        sql += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
        params.append(limit)
        params.append(offset)

        rows = await self._db.query(sql, params)
        return [self._row_to_asset(row) for row in rows]

    # =========================================================================
    # 内部方法
    # =========================================================================

    def _row_to_asset(self, row: dict[str, Any]) -> Asset:
        """将数据库行转换为 Asset 对象"""
        # 处理 metadata (可能是 JSON 字符串或 dict)
        raw_metadata = row.get("metadata", {})
        metadata_dict: dict[str, Any]
        if isinstance(raw_metadata, str):
            try:
                parsed = json.loads(raw_metadata)
                metadata_dict = parsed if isinstance(parsed, dict) else {}
            except json.JSONDecodeError:
                metadata_dict = {}
        else:
            metadata_dict = raw_metadata if isinstance(raw_metadata, dict) else {}

        return Asset(
            id=row["id"],
            user_id=row["user_id"],
            agent_id=row.get("agent_id"),
            team_id=row.get("team_id"),
            is_global=row.get("is_global", False),
            filename=row["filename"],
            file_type=row["file_type"],
            file_size=row["file_size"],
            source_url=row.get("source_url"),
            source_path=row.get("source_path"),
            storage_path=row["storage_path"],
            extracted_text=row.get("extracted_text"),
            title=row.get("title"),
            description=row.get("description"),
            metadata=metadata_dict,
            openviking_uri=row.get("openviking_uri"),
            text_extracted=row.get("text_extracted", False),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


__all__ = [
    "Asset",
    "AssetCreateInput",
    "AssetUpdateInput",
    "AssetRepository",
    "DatabaseConnectionProtocol",
]