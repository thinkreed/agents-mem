"""
agents-mem-py MCP 服务器入口

启动 MCP 服务器，提供 5 个工具:
- mem_create: 创建资源
- mem_read: 读取/搜索/列表/分层
- mem_update: 更新资源
- mem_delete: 删除资源 (级联)
- mem_export: Markdown 导出
"""

import asyncio
import os
from pathlib import Path
from typing import Any

# 加载 .env 环境变量
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass


def main() -> None:
    """启动 MCP 服务器"""
    from agents_mem.tools import create_mcp_server
    from agents_mem.sqlite.connection import get_connection

    # 初始化数据库连接
    async def init_db() -> Any:
        return await get_connection()

    # 运行初始化
    asyncio.run(init_db())

    # 创建并运行 MCP 服务器
    mcp = create_mcp_server("agents-mem-py")
    mcp.run()


if __name__ == "__main__":
    main()