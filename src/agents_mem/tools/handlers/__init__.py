"""
MCP 工具处理器模块
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from mcp.server.fastmcp import FastMCP

from agents_mem.tools.handlers.create import register_create_tool
from agents_mem.tools.handlers.read import register_read_tool
from agents_mem.tools.handlers.update import register_update_tool
from agents_mem.tools.handlers.delete import register_delete_tool
from agents_mem.tools.handlers.export import register_export_tool


def register_all_tools(mcp: "FastMCP") -> None:
    register_create_tool(mcp)
    register_read_tool(mcp)
    register_update_tool(mcp)
    register_delete_tool(mcp)
    register_export_tool(mcp)


__all__ = ["register_all_tools"]
