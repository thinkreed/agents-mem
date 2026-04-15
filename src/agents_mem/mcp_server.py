"""
agents-mem-py MCP Server

使用 FastMCP 实现的 MCP 服务器，提供记忆系统工具。
"""

from mcp.server.fastmcp import FastMCP

from agents_mem.tools.handlers.create import mem_create
from agents_mem.tools.handlers.read import mem_read
from agents_mem.tools.handlers.update import mem_update
from agents_mem.tools.handlers.delete import mem_delete
from agents_mem.tools.handlers.export import mem_export


def create_mcp_server() -> FastMCP:
    """
    创建并配置 MCP 服务器
    
    Returns:
        FastMCP: 配置好的 MCP 服务器实例
    """
    # 创建服务器
    mcp = FastMCP("agents-mem-py")
    
    # 注册工具
    mcp.tool()(mem_create)
    mcp.tool()(mem_read)
    mcp.tool()(mem_update)
    mcp.tool()(mem_delete)
    mcp.tool()(mem_export)
    
    return mcp


# 导出工具函数供外部使用
__all__ = [
    "create_mcp_server",
    "mem_create",
    "mem_read",
    "mem_update",
    "mem_delete",
    "mem_export",
]
