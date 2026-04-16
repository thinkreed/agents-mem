"""
Conversation Repository - 对话资源仓库

提供 Conversation 和 Message 资源的 CRUD 操作：
- 创建对话
- 读取对话 (支持分层视图)
- 更新对话
- 删除对话
- 消息管理 (添加/删除/查询)
"""

from __future__ import annotations

import time
import uuid
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field

from agents_mem.core.types import Scope as TypesScope, Content, ContentType, TierLevel
from agents_mem.core.exceptions import NotFoundError, ValidationError, ScopeError
from agents_mem.core.uri import URISystem, Scope as URIScope
from agents_mem.core.constants import RESOURCE_CONVERSATION
from agents_mem.content.capabilities.tiered import TieredViewCapability

# 使用 types.Scope 作为主要 Scope 类型
Scope = TypesScope


# ============================================================================
# 数据模型
# ============================================================================

class Conversation(BaseModel):
    """对话模型 (对应 conversations 表)"""
    
    model_config = ConfigDict(frozen=False)
    
    # 主键
    id: str = Field(..., description="对话唯一标识")
    
    # Scope 字段
    user_id: str = Field(..., description="用户ID")
    agent_id: str = Field(..., description="代理ID (对话必须有 agent)")
    team_id: str | None = Field(default=None, description="团队ID")
    
    # 内容字段
    title: str | None = Field(default=None, description="对话标题")
    source: str = Field(default="mcp", description="对话来源")
    
    # 统计信息
    message_count: int = Field(default=0, description="消息数量")
    token_count_input: int = Field(default=0, description="输入 token 数")
    token_count_output: int = Field(default=0, description="输出 token 数")
    
    # 时间戳 (Unix 秒)
    started_at: int = Field(default_factory=lambda: int(time.time()), description="开始时间")
    ended_at: int | None = Field(default=None, description="结束时间")
    last_message_at: int | None = Field(default=None, description="最后消息时间")
    
    @property
    def uri(self) -> str:
        """生成 mem:// URI"""
        uri_scope = URIScope(
            user_id=self.user_id,
            agent_id=self.agent_id,
            team_id=self.team_id,
        )
        return URISystem.build(uri_scope, RESOURCE_CONVERSATION, self.id)


class Message(BaseModel):
    """消息模型 (对应 messages 表)"""
    
    model_config = ConfigDict(frozen=False)
    
    # 主键
    id: str = Field(..., description="消息唯一标识")
    
    # 关联字段
    conversation_id: str = Field(..., description="所属对话 ID")
    
    # 内容字段
    role: str = Field(..., description="角色: user, assistant, system, tool")
    content: str | None = Field(default=None, description="消息内容")
    
    # Tool 相关
    tool_calls: dict[str, Any] | None = Field(default=None, description="工具调用")
    tool_results: dict[str, Any] | None = Field(default=None, description="工具结果")
    
    # 推理内容
    reasoning: str | None = Field(default=None, description="推理过程")
    
    # 统计信息
    tokens_input: int | None = Field(default=None, description="输入 token")
    tokens_output: int | None = Field(default=None, description="输出 token")
    
    # 关联
    source_document_id: str | None = Field(default=None, description="来源文档 ID")
    tiered_id: str | None = Field(default=None, description="分层内容 ID")
    openviking_uri: str | None = Field(default=None, description="OpenViking URI")
    
    # 时间戳 (Unix 秒)
    timestamp: int = Field(default_factory=lambda: int(time.time()), description="消息时间")
    
    @property
    def uri(self) -> str:
        """生成 mem:// URI"""
        # 消息 URI 需要对话的 scope
        return f"{self.conversation_id}/messages/{self.id}"


class ConversationCreateInput(BaseModel):
    """创建对话输入"""
    
    title: str | None = Field(default=None, description="对话标题")
    source: str = Field(default="mcp", description="对话来源")


class MessageCreateInput(BaseModel):
    """创建消息输入"""
    
    role: str = Field(..., description="角色: user, assistant, system, tool")
    content: str | None = Field(default=None, description="消息内容")
    tool_calls: dict[str, Any] | None = Field(default=None, description="工具调用")
    tool_results: dict[str, Any] | None = Field(default=None, description="工具结果")
    reasoning: str | None = Field(default=None, description="推理过程")
    tokens_input: int | None = Field(default=None, description="输入 token")
    tokens_output: int | None = Field(default=None, description="输出 token")
    source_document_id: str | None = Field(default=None, description="来源文档 ID")


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
# ConversationRepository 类
# ============================================================================

class ConversationRepository:
    """
    对话仓库
    
    提供对话资源的 CRUD 操作，支持：
    - 分层视图 (L0/L1/L2)
    - Scope 验证
    - 消息管理
    """
    
    TABLE_NAME = "conversations"
    
    def __init__(
        self,
        db: DatabaseConnectionProtocol,
        message_repo: "MessageRepository | None" = None,
        tiered: TieredViewCapability | None = None,
    ):
        """
        初始化对话仓库
        
        Args:
            db: 数据库连接
            message_repo: 消息仓库 (可选)
            tiered: 分层视图能力 (可选)
        """
        self._db = db
        self._message_repo = message_repo
        self._tiered = tiered
    
    # =========================================================================
    # CRUD 操作
    # =========================================================================
    
    async def create(
        self,
        scope: Scope,
        input: ConversationCreateInput,
        id: str | None = None,
    ) -> Conversation:
        """
        创建对话
        
        Args:
            scope: 作用域 (必须包含 agent_id)
            input: 创建输入
            id: 自定义 ID
            
        Returns:
            创建的对话对象
            
        Raises:
            ValidationError: 输入验证失败
            ScopeError: Scope 验证失败
        """
        # 验证 Scope - 对话必须有 agent_id
        if not scope.user_id:
            raise ScopeError(
                message="user_id is required",
                required_fields=["user_id"],
            )
        if not scope.agent_id:
            raise ScopeError(
                message="agent_id is required for conversations",
                required_fields=["user_id", "agent_id"],
            )
        
        # 生成 ID
        conv_id = id or f"conv-{uuid.uuid4().hex[:12]}"
        now = int(time.time())
        
        # 插入数据库
        await self._db.run(
            f"""
            INSERT INTO {self.TABLE_NAME} (
                id, user_id, agent_id, team_id, title, source,
                message_count, token_count_input, token_count_output,
                started_at, last_message_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                conv_id,
                scope.user_id,
                scope.agent_id,
                scope.team_id,
                input.title,
                input.source,
                0,  # message_count
                0,  # token_count_input
                0,  # token_count_output
                now,  # started_at
                now,  # last_message_at
            ],
        )
        
        return Conversation(
            id=conv_id,
            user_id=scope.user_id,
            agent_id=scope.agent_id,
            team_id=scope.team_id,
            title=input.title,
            source=input.source,
            message_count=0,
            started_at=now,
            last_message_at=now,
        )
    
    async def get(
        self,
        scope: Scope,
        id: str,
        include_messages: bool = False,
        tier: TierLevel | str | None = None,
    ) -> Conversation | tuple[Conversation, list[Message]] | str | None:
        """
        获取对话
        
        Args:
            scope: 作用域
            id: 对话 ID
            include_messages: 是否包含消息列表
            tier: 分层级别
            
        Returns:
            对话对象、或对话+消息列表、或分层视图字符串
        """
        # 查询数据库
        row = await self._db.query_one(
            f"""
            SELECT * FROM {self.TABLE_NAME}
            WHERE id = ? AND user_id = ? AND agent_id = ?
            """,
            [id, scope.user_id, scope.agent_id],
        )
        
        if not row:
            return None
        
        # 验证 team_id
        if scope.team_id and row.get("team_id") != scope.team_id:
            return None
        
        conv = self._row_to_conversation(row)
        
        # 如果需要分层视图
        if tier and self._tiered and self._message_repo:
            messages: list[Message] = await self._message_repo.list(conv.id)
            content_text = self._messages_to_text(conv, messages)
            content = Content(
                id=conv.id,
                uri=conv.uri,
                title=conv.title or f"Conversation {conv.id}",
                body=content_text,
                content_type=ContentType.CONVERSATION,
                user_id=conv.user_id,
                agent_id=conv.agent_id,
                team_id=conv.team_id,
            )
            return await self._tiered.get_view(content, tier)
        
        # 如果需要包含消息
        if include_messages and self._message_repo:
            messages: list[Message] = await self._message_repo.list(conv.id)
            return conv, messages
        
        return conv
    
    async def get_or_raise(
        self,
        scope: Scope,
        id: str,
        include_messages: bool = False,
        tier: TierLevel | str | None = None,
    ) -> Conversation:
        """
        获取对话或抛出异常
        
        注意: tier 和 include_messages 参数仅用于验证存在性。
        如果需要分层视图或消息列表，请使用 get() 方法。
        """
        # 使用 tier=None, include_messages=False 获取完整对话对象
        result = await self.get(scope, id, include_messages=False, tier=None)
        if result is None:
            raise NotFoundError(
                message=f"Conversation not found: {id}",
                resource_type="conversation",
                resource_id=id,
            )
        # result 应该是 Conversation 类型
        return result  # type: ignore[return-value]
    
    async def update(
        self,
        scope: Scope,
        id: str,
        title: str | None = None,
        ended_at: int | None = None,
    ) -> Conversation:
        """
        更新对话
        
        Args:
            scope: 作用域
            id: 对话 ID
            title: 新标题
            ended_at: 结束时间
            
        Returns:
            更新后的对话
        """
        # 验证对话存在
        await self.get_or_raise(scope, id)
        
        now = int(time.time())
        updates: dict[str, Any] = {"last_message_at": now}
        
        if title is not None:
            updates["title"] = title
        if ended_at is not None:
            updates["ended_at"] = ended_at
        
        set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
        params = list(updates.values()) + [id, scope.user_id, scope.agent_id]
        
        await self._db.run(
            f"UPDATE {self.TABLE_NAME} SET {set_clause} WHERE id = ? AND user_id = ? AND agent_id = ?",
            params,
        )
        
        return await self.get_or_raise(scope, id)
    
    async def delete(self, scope: Scope, id: str) -> bool:
        """
        删除对话 (级联删除消息)
        
        Args:
            scope: 作用域
            id: 对话 ID
            
        Returns:
            是否成功删除
        """
        # 验证对话存在
        conv = await self.get(scope, id)
        if not conv:
            return False
        
        # 删除消息 (如果有消息仓库)
        if self._message_repo:
            await self._message_repo.delete_all(id)
        
        # 删除对话
        await self._db.run(
            f"DELETE FROM {self.TABLE_NAME} WHERE id = ? AND user_id = ? AND agent_id = ?",
            [id, scope.user_id, scope.agent_id],
        )
        
        return True
    
    # =========================================================================
    # 列表操作
    # =========================================================================
    
    async def list(
        self,
        scope: Scope,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Conversation]:
        """
        列出对话
        
        Args:
            scope: 作用域
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            对话列表
        """
        rows = await self._db.query(
            f"""
            SELECT * FROM {self.TABLE_NAME}
            WHERE user_id = ? AND agent_id = ?
              AND (team_id = ? OR team_id IS NULL)
            ORDER BY started_at DESC
            LIMIT ? OFFSET ?
            """,
            [scope.user_id, scope.agent_id, scope.team_id, limit, offset],
        )
        
        return [self._row_to_conversation(row) for row in rows]
    
    # =========================================================================
    # 统计更新
    # =========================================================================
    
    async def update_stats(
        self,
        conversation_id: str,
        message_delta: int = 1,
        input_tokens_delta: int = 0,
        output_tokens_delta: int = 0,
    ) -> None:
        """
        更新对话统计信息
        
        Args:
            conversation_id: 对话 ID
            message_delta: 消息数量增量
            input_tokens_delta: 输入 token 增量
            output_tokens_delta: 输出 token 增量
        """
        await self._db.run(
            f"""
            UPDATE {self.TABLE_NAME}
            SET message_count = message_count + ?,
                token_count_input = token_count_input + ?,
                token_count_output = token_count_output + ?,
                last_message_at = ?
            WHERE id = ?
            """,
            [message_delta, input_tokens_delta, output_tokens_delta, int(time.time()), conversation_id],
        )
    
    # =========================================================================
    # 内部方法
    # =========================================================================
    
    def _row_to_conversation(self, row: dict[str, Any]) -> Conversation:
        """将数据库行转换为 Conversation 对象"""
        return Conversation(
            id=row["id"],
            user_id=row["user_id"],
            agent_id=row["agent_id"],
            team_id=row.get("team_id"),
            title=row.get("title"),
            source=row.get("source", "mcp"),
            message_count=row.get("message_count", 0),
            token_count_input=row.get("token_count_input", 0),
            token_count_output=row.get("token_count_output", 0),
            started_at=row["started_at"],
            ended_at=row.get("ended_at"),
            last_message_at=row.get("last_message_at"),
        )
    
    def _messages_to_text(self, conv: Conversation, messages: list[Message]) -> str:
        """将消息列表转换为文本 (用于分层视图)"""
        lines = [f"Conversation: {conv.title or conv.id}"]
        lines.append(f"Started: {conv.started_at}")
        lines.append(f"Messages: {len(messages)}")
        lines.append("-" * 40)
        
        for msg in messages:
            lines.append(f"[{msg.role}] {msg.content or ''}")
            if msg.tool_calls:
                lines.append(f"  Tool calls: {msg.tool_calls}")
            if msg.reasoning:
                lines.append(f"  Reasoning: {msg.reasoning[:200]}...")
        
        return "\n".join(lines)


# ============================================================================
# MessageRepository 类
# ============================================================================

class MessageRepository:
    """
    消息仓库
    
    提供消息资源的 CRUD 操作。
    """
    
    TABLE_NAME = "messages"
    
    def __init__(
        self,
        db: DatabaseConnectionProtocol,
        conversation_repo: ConversationRepository | None = None,
    ):
        """
        初始化消息仓库
        
        Args:
            db: 数据库连接
            conversation_repo: 对话仓库 (用于更新统计)
        """
        self._db = db
        self._conversation_repo = conversation_repo
    
    # =========================================================================
    # CRUD 操作
    # =========================================================================
    
    async def create(
        self,
        conversation_id: str,
        input: MessageCreateInput,
        id: str | None = None,
    ) -> Message:
        """
        创建消息
        
        Args:
            conversation_id: 所属对话 ID
            input: 创建输入
            id: 自定义 ID
            
        Returns:
            创建的消息对象
        """
        # 验证输入
        if not input.role:
            raise ValidationError(
                message="role is required",
                field="role",
            )
        
        # 生成 ID
        msg_id = id or f"msg-{uuid.uuid4().hex[:12]}"
        now = int(time.time())
        
        # 插入数据库
        await self._db.run(
            f"""
            INSERT INTO {self.TABLE_NAME} (
                id, conversation_id, role, content, tool_calls, tool_results,
                reasoning, tokens_input, tokens_output, timestamp, source_document_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                msg_id,
                conversation_id,
                input.role,
                input.content,
                input.tool_calls,
                input.tool_results,
                input.reasoning,
                input.tokens_input,
                input.tokens_output,
                now,
                input.source_document_id,
            ],
        )
        
        # 更新对话统计
        if self._conversation_repo:
            await self._conversation_repo.update_stats(
                conversation_id,
                message_delta=1,
                input_tokens_delta=input.tokens_input or 0,
                output_tokens_delta=input.tokens_output or 0,
            )
        
        return Message(
            id=msg_id,
            conversation_id=conversation_id,
            role=input.role,
            content=input.content,
            tool_calls=input.tool_calls,
            tool_results=input.tool_results,
            reasoning=input.reasoning,
            tokens_input=input.tokens_input,
            tokens_output=input.tokens_output,
            timestamp=now,
            source_document_id=input.source_document_id,
        )
    
    async def get(self, id: str) -> Message | None:
        """
        获取消息
        
        Args:
            id: 消息 ID
            
        Returns:
            消息对象或 None
        """
        row = await self._db.query_one(
            f"SELECT * FROM {self.TABLE_NAME} WHERE id = ?",
            [id],
        )
        
        if not row:
            return None
        
        return self._row_to_message(row)
    
    async def get_or_raise(self, id: str) -> Message:
        """
        获取消息或抛出异常
        """
        msg = await self.get(id)
        if not msg:
            raise NotFoundError(
                message=f"Message not found: {id}",
                resource_type="message",
                resource_id=id,
            )
        return msg
    
    async def list(
        self,
        conversation_id: str,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Message]:
        """
        列出对话的消息
        
        Args:
            conversation_id: 对话 ID
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            消息列表
        """
        rows = await self._db.query(
            f"""
            SELECT * FROM {self.TABLE_NAME}
            WHERE conversation_id = ?
            ORDER BY timestamp ASC
            LIMIT ? OFFSET ?
            """,
            [conversation_id, limit, offset],
        )
        
        return [self._row_to_message(row) for row in rows]
    
    async def delete(self, id: str) -> bool:
        """
        删除单条消息
        
        Args:
            id: 消息 ID
            
        Returns:
            是否成功删除
        """
        msg = await self.get(id)
        if not msg:
            return False
        
        await self._db.run(
            f"DELETE FROM {self.TABLE_NAME} WHERE id = ?",
            [id],
        )
        
        # 更新对话统计
        if self._conversation_repo:
            await self._conversation_repo.update_stats(
                msg.conversation_id,
                message_delta=-1,
                input_tokens_delta=-(msg.tokens_input or 0),
                output_tokens_delta=-(msg.tokens_output or 0),
            )
        
        return True
    
    async def delete_all(self, conversation_id: str) -> int:
        """
        删除对话的所有消息
        
        Args:
            conversation_id: 对话 ID
            
        Returns:
            删除的消息数量
        """
        # 先获取消息数量
        count_row = await self._db.query_one(
            f"SELECT COUNT(*) as count FROM {self.TABLE_NAME} WHERE conversation_id = ?",
            [conversation_id],
        )
        count = count_row.get("count", 0) if count_row else 0
        
        # 删除所有消息
        await self._db.run(
            f"DELETE FROM {self.TABLE_NAME} WHERE conversation_id = ?",
            [conversation_id],
        )
        
        return count
    
    # =========================================================================
    # 内部方法
    # =========================================================================
    
    def _row_to_message(self, row: dict[str, Any]) -> Message:
        """将数据库行转换为 Message 对象"""
        return Message(
            id=row["id"],
            conversation_id=row["conversation_id"],
            role=row["role"],
            content=row.get("content"),
            tool_calls=row.get("tool_calls"),
            tool_results=row.get("tool_results"),
            reasoning=row.get("reasoning"),
            tokens_input=row.get("tokens_input"),
            tokens_output=row.get("tokens_output"),
            timestamp=row["timestamp"],
            source_document_id=row.get("source_document_id"),
            tiered_id=row.get("tiered_id"),
            openviking_uri=row.get("openviking_uri"),
        )


__all__ = [
    "Conversation",
    "Message",
    "ConversationCreateInput",
    "MessageCreateInput",
    "ConversationRepository",
    "MessageRepository",
    "DatabaseConnectionProtocol",
]