# agents-mem-py

面向 Agents 的4层渐进式记忆系统 (Python 实现)

## 特性

- **4层架构**: L0 Identity → L1 Index → L2 Content → L3 Knowledge
- **分层加载**: L0摘要(~100 tokens) → L1概览(~2000 tokens) → L2完整内容
- **Token节省**: 80-91% 成本降低
- **MCP协议**: 通过 FastMCP 提供标准工具接口
- **向量搜索**: OpenViking 集成，支持混合搜索

## 快速开始

```bash
# 安装
pip install -e ".[dev]"

# 配置
cp .env.example .env
# 编辑 .env

# 测试
pytest --cov=agents_mem --cov-report=html

# 运行
python -m agents_mem
```

## 架构

```
L3 Knowledge: 事实提取、实体树、追溯链
L2 Content ⭐: 文档存储、Tiered分层视图
L1 Index: URI系统、元数据索引、向量搜索
L0 Identity: Scope验证、权限控制
```

## MCP工具

- `mem_create`: 创建资源
- `mem_read`: 读取/搜索/分层
- `mem_update`: 更新
- `mem_delete`: 删除
- `mem_export`: Markdown导出

## 文档

- [AGENTS.md](AGENTS.md) - 开发者指南
- [docs/agents-mem-py-DESIGN-v2.md](docs/agents-mem-py-DESIGN-v2.md) - 架构设计
- [docs/agents-mem-py-QUICKSTART-v2.md](docs/agents-mem-py-QUICKSTART-v2.md) - 快速开始

## 许可

MIT
