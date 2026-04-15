"""
L3 Knowledge Layer Module

实现知识层核心功能:
- 事实提取 (从 L2 内容)
- 实体聚合 (构建实体关联网络)
- 知识追溯 (Fact → Source → Content 完整链路)

关键约束: L3 只能读取 L2，不能修改原始内容。
"""

from agents_mem.knowledge.layer import KnowledgeLayer
from agents_mem.knowledge.facts import FactExtractor, ExtractedFact
from agents_mem.knowledge.entities import EntityTree, EntityNode
from agents_mem.knowledge.trace import TraceBuilder, TraceChain

__all__ = [
    "KnowledgeLayer",
    "FactExtractor",
    "ExtractedFact",
    "EntityTree",
    "EntityNode",
    "TraceBuilder",
    "TraceChain",
]