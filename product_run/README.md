# product_run - 生产验证脚本

本目录包含用于验证 MCP 服务生产环境的功能脚本。

## 使用方法

```bash
# 验证 MCP 服务所有功能
python product_run/verify_mcp.py
```

## 验证内容

1. ✅ 创建文档
2. ✅ FTS 全文搜索
3. ✅ 混合搜索 (FTS + Vector)
4. ✅ L0 摘要生成 (~100 tokens)
5. ✅ L1 概览生成 (~2000 tokens)
6. ✅ L2 完整内容读取
7. ✅ 创建会话和消息
8. ✅ 更新文档
9. ✅ 删除文档（级联）

## 依赖

- mcp 库
- agents-mem 服务正常运行
