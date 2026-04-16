"""
Document Repository - 文档资源仓库

提供 Document 资源的 CRUD 操作：
- 创建文档
- 读取文档 (支持分层视图)
- 更新文档
- 删除文档
- 搜索文档 (FTS, 语义, 混合)
"""

import json
import time
import uuid
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field

from agents_mem.core.types import Content, ContentType, TierLevel, Scope as TypesScope
from agents_mem.core.exceptions import NotFoundError, ValidationError, ScopeError
from agents_mem.core.uri import URISystem, Scope as URIScope
from agents_mem.core.constants import RESOURCE_DOCUMENT
from agents_mem.content.capabilities.tiered import TieredViewCapability

# 使用 types.Scope 作为主要 Scope 类型
Scope = TypesScope


# ============================================================================
# 数据模型
# ============================================================================

class Document(BaseModel):
    """文档模型 (对应 documents 表)"""
    
    model_config = ConfigDict(frozen=False)
    
    # 主键
    id: str = Field(..., description="文档唯一标识")
    
    # Scope 字段
    user_id: str = Field(..., description="用户ID")
    agent_id: str | None = Field(default=None, description="代理ID")
    team_id: str | None = Field(default=None, description="团队ID")
    is_global: bool = Field(default=False, description="是否全局")
    
    # 内容字段
    doc_type: str = Field(default="note", description="文档类型")
    title: str = Field(..., description="文档标题")
    content: str = Field(..., description="文档内容")
    
    # 来源信息
    source_url: str | None = Field(default=None, description="原始URL")
    source_path: str | None = Field(default=None, description="原始路径")
    
    # 元数据
    metadata: dict[str, Any] = Field(default_factory=dict, description="额外元数据")
    
    # 统计信息
    content_length: int | None = Field(default=None, description="内容长度")
    token_count: int | None = Field(default=None, description="Token 数量")
    
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
        return URISystem.build(uri_scope, RESOURCE_DOCUMENT, self.id)


class DocumentCreateInput(BaseModel):
    """创建文档输入"""
    
    title: str = Field(..., description="文档标题")
    content: str = Field(..., description="文档内容")
    doc_type: str = Field(default="note", description="文档类型")
    source_url: str | None = Field(default=None, description="原始URL")
    source_path: str | None = Field(default=None, description="原始路径")
    metadata: dict[str, Any] = Field(default_factory=dict, description="额外元数据")
    is_global: bool = Field(default=False, description="是否全局")


class DocumentUpdateInput(BaseModel):
    """更新文档输入"""
    
    title: str | None = Field(default=None, description="新标题")
    content: str | None = Field(default=None, description="新内容")
    doc_type: str | None = Field(default=None, description="新类型")
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
# DocumentRepository 类
# ============================================================================

class DocumentRepository:
    """
    文档仓库
    
    提供文档资源的 CRUD 操作，支持：
    - 分层视图 (L0/L1/L2)
    - Scope 验证
    - FTS 全文搜索
    """
    
    TABLE_NAME = "documents"
    
    def __init__(
        self,
        db: DatabaseConnectionProtocol,
        tiered: TieredViewCapability | None = None,
    ):
        """
        初始化文档仓库
        
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
        input: DocumentCreateInput,
        id: str | None = None,
    ) -> Document:
        """
        创建文档
        
        Args:
            scope: 作用域
            input: 创建输入
            id: 自定义 ID (可选，默认自动生成)
            
        Returns:
            创建的文档对象
            
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
        if not input.title or input.title.strip() == "":
            raise ValidationError(
                message="title is required",
                field="title",
            )
        
        if not input.content:
            raise ValidationError(
                message="content is required",
                field="content",
            )
        
        # 生成 ID
        doc_id = id or f"doc-{uuid.uuid4().hex[:12]}"
        now = int(time.time())
        
        # 计算内容长度
        content_length = len(input.content)
        
        # 插入数据库
        await self._db.run(
            f"""
            INSERT INTO {self.TABLE_NAME} (
                id, user_id, agent_id, team_id, is_global,
                doc_type, source_url, source_path, title, content,
                metadata, content_length, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                doc_id,
                scope.user_id,
                scope.agent_id,
                scope.team_id,
                input.is_global,
                input.doc_type,
                input.source_url,
                input.source_path,
                input.title,
                input.content,
                json.dumps(input.metadata) if input.metadata else "{}",
                content_length,
                now,
                now,
            ],
        )
        
        return Document(
            id=doc_id,
            user_id=scope.user_id,
            agent_id=scope.agent_id,
            team_id=scope.team_id,
            is_global=input.is_global,
            doc_type=input.doc_type,
            title=input.title,
            content=input.content,
            source_url=input.source_url,
            source_path=input.source_path,
            metadata=input.metadata,
            content_length=content_length,
            created_at=now,
            updated_at=now,
        )
    
    async def get(
        self,
        scope: Scope,
        id: str,
        tier: TierLevel | str | None = None,
    ) -> Document | str | None:
        """
        获取文档
        
        Args:
            scope: 作用域
            id: 文档 ID
            tier: 分层级别 (可选)
            
        Returns:
            如果 tier=None: 返回完整 Document 对象
            如果 tier=L0/L1: 返回分层视图字符串
            如果不存在: 返回 None
        """
        # 查询数据库
        row = await self._db.query_one(
            f"""
            SELECT * FROM {self.TABLE_NAME}
            WHERE id = ? AND user_id = ?
            """,
            [id, scope.user_id],
        )
        
        if not row:
            return None
        
        # 验证 Scope 匹配
        if scope.agent_id and row.get("agent_id") != scope.agent_id:
            return None
        if scope.team_id and row.get("team_id") != scope.team_id:
            return None
        
        # 构建 Document 对象
        doc = self._row_to_document(row)
        
        # 如果需要分层视图
        if tier and self._tiered:
            content = Content(
                id=doc.id,
                uri=doc.uri,
                title=doc.title,
                body=doc.content,
                content_type=ContentType.NOTE,
                user_id=doc.user_id,
                agent_id=doc.agent_id,
                team_id=doc.team_id,
            )
            return await self._tiered.get_view(content, tier)
        
        return doc
    
    async def get_or_raise(
        self,
        scope: Scope,
        id: str,
        tier: TierLevel | str | None = None,
    ) -> Document:
        """
        获取文档或抛出异常
        
        注意: tier 参数仅用于验证存在性，不用于获取分层视图。
        如果需要分层视图，请使用 get() 方法。
        
        Args:
            scope: 作用域
            id: 文档 ID
            tier: 分层级别 (仅验证存在性)
            
        Returns:
            文档对象
            
        Raises:
            NotFoundError: 文档不存在
        """
        # 使用 tier=None 获取完整文档对象
        result = await self.get(scope, id, tier=None)
        if result is None:
            raise NotFoundError(
                message=f"Document not found: {id}",
                resource_type="document",
                resource_id=id,
            )
        # result 应该是 Document 类型 (因为 tier=None)
        return result  # type: ignore[return-value]
    
    async def update(
        self,
        scope: Scope,
        id: str,
        input: DocumentUpdateInput,
    ) -> Document:
        """
        更新文档
        
        Args:
            scope: 作用域
            id: 文档 ID
            input: 更新输入
            
        Returns:
            更新后的文档对象
            
        Raises:
            NotFoundError: 文档不存在
        """
        # 验证文档存在
        await self.get_or_raise(scope, id)
        
        now = int(time.time())
        
        # 构建更新字段
        updates: dict[str, Any] = {"updated_at": now}
        if input.title is not None:
            updates["title"] = input.title
        if input.content is not None:
            updates["content"] = input.content
            updates["content_length"] = len(input.content)
        if input.doc_type is not None:
            updates["doc_type"] = input.doc_type
        if input.metadata is not None:
            updates["metadata"] = json.dumps(input.metadata)
        
        # 构建 SQL
        set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
        params = list(updates.values()) + [id, scope.user_id]
        
        await self._db.run(
            f"UPDATE {self.TABLE_NAME} SET {set_clause} WHERE id = ? AND user_id = ?",
            params,
        )
        
        # 返回更新后的文档
        return await self.get_or_raise(scope, id)
    
    async def delete(self, scope: Scope, id: str) -> bool:
        """
        删除文档
        
        Args:
            scope: 作用域
            id: 文档 ID
            
        Returns:
            是否成功删除
        """
        # 验证文档存在
        doc = await self.get(scope, id)
        if not doc:
            return False
        
        # 删除文档
        await self._db.run(
            f"DELETE FROM {self.TABLE_NAME} WHERE id = ? AND user_id = ?",
            [id, scope.user_id],
        )
        
        return True
    
    # =========================================================================
    # 搜索操作
    # =========================================================================
    
    async def search(
        self,
        scope: Scope,
        query: str,
        mode: str = "fts",
        limit: int = 10,
    ) -> list[Document]:
        """
        搜索文档
        
        Args:
            scope: 作用域
            query: 搜索查询
            mode: 搜索模式 (fts, hybrid)
            limit: 返回数量限制
            
        Returns:
            匹配的文档列表
        """
        # FTS 搜索 (SQLite FTS5 需要额外配置，这里使用 LIKE)
        # 实际项目中应该使用 FTS5 或 OpenViking 语义搜索
        rows = await self._db.query(
            f"""
            SELECT * FROM {self.TABLE_NAME}
            WHERE user_id = ? 
              AND (agent_id = ? OR agent_id IS NULL)
              AND (team_id = ? OR team_id IS NULL)
              AND (title LIKE ? OR content LIKE ?)
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            [
                scope.user_id,
                scope.agent_id,
                scope.team_id,
                f"%{query}%",
                f"%{query}%",
                limit,
            ],
        )
        
        return [self._row_to_document(row) for row in rows]
    
    async def list(
        self,
        scope: Scope,
        limit: int = 100,
        offset: int = 0,
        doc_type: str | None = None,
    ) -> list[Document]:
        """
        列出文档
        
        Args:
            scope: 作用域
            limit: 返回数量限制
            offset: 偏移量
            doc_type: 文档类型过滤
            
        Returns:
            文档列表
        """
        # 构建查询
        sql = f"""
        SELECT * FROM {self.TABLE_NAME}
        WHERE user_id = ?
          AND (agent_id = ? OR agent_id IS NULL)
          AND (team_id = ? OR team_id IS NULL)
        """
        params: list[Any] = [scope.user_id, scope.agent_id, scope.team_id]
        
        if doc_type:
            sql += " AND doc_type = ?"
            params.append(doc_type)
        
        sql += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
        params.append(limit)
        params.append(offset)
        
        rows = await self._db.query(sql, params)
        return [self._row_to_document(row) for row in rows]
    
    # =========================================================================
    # 内部方法
    # =========================================================================
    
    def _row_to_document(self, row: dict[str, Any]) -> Document:
        """将数据库行转换为 Document 对象"""
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
        
        return Document(
            id=row["id"],
            user_id=row["user_id"],
            agent_id=row.get("agent_id"),
            team_id=row.get("team_id"),
            is_global=row.get("is_global", False),
            doc_type=row.get("doc_type", "note"),
            title=row["title"],
            content=row["content"],
            source_url=row.get("source_url"),
            source_path=row.get("source_path"),
            metadata=metadata_dict,
            content_length=row.get("content_length"),
            token_count=row.get("token_count"),
            openviking_uri=row.get("openviking_uri"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
    
    def _get_timestamp(self) -> int:
        """获取当前 Unix 秒时间戳"""
        return int(time.time())


__all__ = [
    "Document",
    "DocumentCreateInput",
    "DocumentUpdateInput",
    "DocumentRepository",
    "DatabaseConnectionProtocol",
]