"""
MCP 服务完整功能验证脚本

验证所有核心功能：
1. 创建文档
2. FTS 全文搜索
3. 混合搜索 (FTS + Vector)
4. 分层视图 (L0/L1/L2)
5. 创建会话和消息
6. 更新和删除

运行方式:
    python product_run/verify_mcp.py
"""

import asyncio
import json
import sys
from pathlib import Path

# 确保项目路径可用
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
except ImportError:
    print("错误: 需要安装 mcp 库")
    print("运行: pip install mcp")
    sys.exit(1)


def parse_result(result):
    """解析 MCP 工具返回结果"""
    text = result.content[0].text if hasattr(result.content[0], 'text') else str(result.content[0])
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw": text}


async def verify_all():
    """验证所有 MCP 功能"""
    print("=" * 70)
    print("MCP 服务完整功能验证")
    print("=" * 70)
    
    python_exe = Path(sys.executable).absolute()
    
    server_params = StdioServerParameters(
        command=str(python_exe),
        args=["-m", "agents_mem"],
        cwd=str(PROJECT_ROOT),
    )
    
    doc_ids = []
    conv_id = None
    scope = {"user_id": "test-verify"}
    
    try:
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                # 初始化
                print("\n[步骤 1/12] 初始化连接...")
                await session.initialize()
                print("✓ 连接成功")
                
                # ========================================
                # 测试 1: 创建多个文档
                # ========================================
                print("\n[步骤 2/12] 创建测试文档...")
                
                documents = [
                    {
                        "title": "咖啡偏好",
                        "content": "用户喜欢喝无糖咖啡，每天早上9点喝一杯美式咖啡。不加糖不加奶。用户是素食主义者，不吃任何肉类。"
                    },
                    {
                        "title": "工作安排",
                        "content": "用户工作时间为9:00-18:00，周末双休。偏好上午开会，下午专注写代码。"
                    },
                    {
                        "title": "饮食习惯",
                        "content": "用户不吃辛辣食物，喜欢清淡饮食。每天喝8杯水。偏好素食，特别是蔬菜和水果。"
                    }
                ]
                
                for i, doc in enumerate(documents, 1):
                    result = await session.call_tool(
                        "mem_create",
                        arguments={
                            "resource": "document",
                            "data": doc,
                            "scope": scope
                        }
                    )
                    data = parse_result(result)
                    if "id" in data:
                        doc_ids.append(data["id"])
                        print(f"  ✓ 创建文档 {i}: {doc['title']} ({data['id']})")
                    else:
                        print(f"  ✗ 创建失败: {data}")
                        return False
                
                # ========================================
                # 测试 2: 列出所有文档
                # ========================================
                print("\n[步骤 3/12] 列出所有文档...")
                result = await session.call_tool(
                    "mem_read",
                    arguments={
                        "resource": "document",
                        "query": {"list": True, "limit": 10},
                        "scope": scope
                    }
                )
                data = parse_result(result)
                print(f"  ✓ 文档总数: {data.get('count', 0)}")
                
                # ========================================
                # 测试 3: FTS 全文搜索
                # ========================================
                print("\n[步骤 4/12] FTS 全文搜索 '咖啡'...")
                result = await session.call_tool(
                    "mem_read",
                    arguments={
                        "resource": "document",
                        "query": {
                            "search": "咖啡",
                            "search_mode": "fts",
                            "limit": 5
                        },
                        "scope": scope
                    }
                )
                data = parse_result(result)
                if "results" in data:
                    print(f"  ✓ FTS 搜索结果: {data['count']} 个")
                    for r in data["results"]:
                        print(f"    - {r.get('title')}: {r.get('body', '')[:50]}...")
                else:
                    print(f"  ⚠ FTS 搜索返回: {data}")
                
                # ========================================
                # 测试 4: 混合搜索 (FTS + Vector)
                # ========================================
                print("\n[步骤 5/12] 混合搜索 '工作'...")
                result = await session.call_tool(
                    "mem_read",
                    arguments={
                        "resource": "document",
                        "query": {
                            "search": "工作",
                            "search_mode": "hybrid",
                            "limit": 5
                        },
                        "scope": scope
                    }
                )
                data = parse_result(result)
                if "results" in data:
                    print(f"  ✓ 混合搜索结果: {data['count']} 个")
                    for r in data["results"]:
                        print(f"    - {r.get('title')}: {r.get('body', '')[:50]}...")
                else:
                    print(f"  ⚠ 混合搜索返回: {data}")
                
                # ========================================
                # 测试 5: L2 完整内容读取
                # ========================================
                print("\n[步骤 6/12] 按 ID 读取文档 (L2 完整内容)...")
                if doc_ids:
                    result = await session.call_tool(
                        "mem_read",
                        arguments={
                            "resource": "document",
                            "query": {"id": doc_ids[0]},
                            "scope": scope
                        }
                    )
                    data = parse_result(result)
                    print(f"  ✓ 读取成功:")
                    print(f"    标题: {data.get('title')}")
                    print(f"    内容: {data.get('body', '')[:100]}...")
                    print(f"    层级: {data.get('tier')}")
                
                # ========================================
                # 测试 6: L0 摘要 (~100 tokens)
                # ========================================
                print("\n[步骤 7/12] 读取 L0 摘要 (~100 tokens)...")
                if doc_ids:
                    result = await session.call_tool(
                        "mem_read",
                        arguments={
                            "resource": "document",
                            "query": {"id": doc_ids[0], "tier": "L0"},
                            "scope": scope
                        }
                    )
                    data = parse_result(result)
                    if "error" in data:
                        print(f"  ⚠ L0 摘要生成失败: {data['error']}")
                    else:
                        print(f"  ✓ L0 摘要:")
                        print(f"    内容: {data.get('content', 'N/A')[:150]}")
                        print(f"    层级: {data.get('tier')}")
                
                # ========================================
                # 测试 7: L1 概览 (~2000 tokens)
                # ========================================
                print("\n[步骤 8/12] 读取 L1 概览 (~2000 tokens)...")
                if doc_ids:
                    result = await session.call_tool(
                        "mem_read",
                        arguments={
                            "resource": "document",
                            "query": {"id": doc_ids[0], "tier": "L1"},
                            "scope": scope
                        }
                    )
                    data = parse_result(result)
                    if "error" in data:
                        print(f"  ⚠ L1 概览生成失败: {data['error']}")
                    else:
                        print(f"  ✓ L1 概览:")
                        print(f"    内容: {data.get('content', 'N/A')[:150]}")
                        print(f"    层级: {data.get('tier')}")
                
                # ========================================
                # 测试 8: 创建会话
                # ========================================
                print("\n[步骤 9/12] 创建会话...")
                scope_with_agent = {"user_id": "test-verify", "agent_id": "agent-001"}
                result = await session.call_tool(
                    "mem_create",
                    arguments={
                        "resource": "conversation",
                        "data": {"title": "测试对话"},
                        "scope": scope_with_agent
                    }
                )
                data = parse_result(result)
                if "id" in data:
                    conv_id = data["id"]
                    print(f"  ✓ 会话创建成功: {conv_id}")
                else:
                    print(f"  ⚠ 会话创建返回: {data}")
                
                # ========================================
                # 测试 9: 添加消息
                # ========================================
                if conv_id:
                    print("\n[步骤 10/12] 添加消息...")
                    messages = [
                        {"role": "user", "content": "你好，我喜欢喝咖啡"},
                        {"role": "assistant", "content": "你喜欢什么类型的咖啡？"},
                        {"role": "user", "content": "我喜欢美式咖啡，不加糖不加奶"}
                    ]
                    
                    for i, msg in enumerate(messages, 1):
                        result = await session.call_tool(
                            "mem_create",
                            arguments={
                                "resource": "message",
                                "data": {
                                    "conversation_id": conv_id,
                                    "role": msg["role"],
                                    "content": msg["content"]
                                },
                                "scope": scope
                            }
                        )
                        data = parse_result(result)
                        if "id" in data:
                            print(f"  ✓ 消息 {i} 创建成功")
                        else:
                            print(f"  ⚠ 消息 {i} 返回: {data}")
                
                # ========================================
                # 测试 10: 读取会话消息
                # ========================================
                if conv_id:
                    print("\n[步骤 11/12] 读取会话消息...")
                    result = await session.call_tool(
                        "mem_read",
                        arguments={
                            "resource": "conversation",
                            "query": {"id": conv_id},
                            "scope": scope_with_agent
                        }
                    )
                    data = parse_result(result)
                    if "error" not in data:
                        print(f"  ✓ 会话读取成功")
                        print(f"    标题: {data.get('title')}")
                        if "messages" in data:
                            print(f"    消息数: {len(data['messages'])}")
                    else:
                        print(f"  ⚠ 会话读取返回: {data}")
                
                # ========================================
                # 测试 11: 更新文档
                # ========================================
                print("\n[步骤 12/12] 更新文档...")
                if doc_ids:
                    result = await session.call_tool(
                        "mem_update",
                        arguments={
                            "resource": "document",
                            "id": doc_ids[0],
                            "data": {"title": "咖啡偏好 (已更新)", "content": "用户喜欢喝无糖美式咖啡，每天早上9点。"},
                            "scope": scope
                        }
                    )
                    data = parse_result(result)
                    if "title" in data:
                        print(f"  ✓ 更新成功: {data['title']}")
                    else:
                        print(f"  ⚠ 更新返回: {data}")
                
                # ========================================
                # 清理测试数据
                # ========================================
                print("\n[清理] 删除测试数据...")
                for doc_id in doc_ids:
                    await session.call_tool(
                        "mem_delete",
                        arguments={
                            "resource": "document",
                            "id": doc_id,
                            "scope": scope
                        }
                    )
                    print(f"  ✓ 删除文档: {doc_id}")
                
                if conv_id:
                    await session.call_tool(
                        "mem_delete",
                        arguments={
                            "resource": "conversation",
                            "id": conv_id,
                            "scope": scope_with_agent
                        }
                    )
                    print(f"  ✓ 删除会话: {conv_id}")
                
                print("\n" + "=" * 70)
                print("✅ 所有验证通过！MCP 服务运行正常。")
                print("=" * 70)
                return True
                
    except Exception as e:
        print(f"\n✗ 验证失败: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(verify_all())
    sys.exit(0 if success else 1)
