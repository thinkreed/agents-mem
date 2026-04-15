"""
MCP 工具模块

提供 5 个 MCP 工具:
- mem_create: 创建资源
- mem_read: 读取/搜索/列表/分层
- mem_update: 更新资源
- mem_delete: 删除资源 (级联)
- mem_export: Markdown 导出
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from mcp.server.fastmcp import FastMCP

from agents_mem.tools.handlers import (
    register_all_tools,
    register_create_tool,
    register_read_tool,
    register_update_tool,
    register_delete_tool,
    register_export_tool,
)


def create_mcp_server(name: str = "agents-mem-py") -> "FastMCP":
    """
    创建 MCP 服务器实例
    
    Args:
        name: 服务器名称
    
    Returns:
        FastMCP 实例 (已注册所有工具)
    """
    from mcp.server.fastmcp import FastMCP
    
    mcp = FastMCP(name)
    register_all_tools(mcp)
    
    return mcp


__all__ = [
    "create_mcp_server",
    "register_all_tools",
    "register_create_tool",
    "register_read_tool",
    "register_update_tool",
    "register_delete_tool",
    "register_export_tool",
]