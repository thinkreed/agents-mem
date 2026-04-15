"""
L2 Content Layer (内容层) ⭐核心价值

负责原始内容存储和 Tiered Views 分层视图能力：
- Documents (文档)
- Assets (资产/附件)
- Conversations (对话)
- Messages (消息)

分层视图：
- L0 概览 (~100 tokens)
- L1 概要 (~2000 tokens)
- L2 完整内容 (原始)

架构依赖：
- L2 Content 依赖 L1 Index (索引层)
- L3 Knowledge 只读依赖 L2
"""

from agents_mem.content.layer import ContentLayer
from agents_mem.content.capabilities.tiered import TieredViewCapability
from agents_mem.content.resources.document import DocumentRepository
from agents_mem.content.resources.conversation import (
    ConversationRepository,
    MessageRepository,
)

__all__ = [
    "ContentLayer",
    "TieredViewCapability",
    "DocumentRepository",
    "ConversationRepository",
    "MessageRepository",
]