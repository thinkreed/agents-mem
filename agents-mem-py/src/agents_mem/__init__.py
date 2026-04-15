"""
agents-mem-py: 4层渐进式记忆系统

面向 Agents 的记忆系统，支持分层内容加载 (L0/L1/L2)，
节省 80-91% Token 成本。

架构:
- L0: Identity Layer (身份层)
- L1: Index Layer (索引层)
- L2: Content Layer (内容层)
- L3: Knowledge Layer (知识层) ⭐
"""

__version__ = "1.0.0"
__author__ = "agents-mem team"

from agents_mem.core.types import Scope, Content, Fact, TraceResult
from agents_mem.core.uri import URISystem, MaterialURI
from agents_mem.knowledge import KnowledgeLayer

__all__ = ["Scope", "Content", "Fact", "TraceResult", "URISystem", "MaterialURI", "KnowledgeLayer"]
