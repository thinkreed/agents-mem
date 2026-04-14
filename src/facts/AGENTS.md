# src/facts

事实提取、验证和链接层。

## 文件职责

| 文件 | 功能 |
|------|------|
| extractor.ts | LLM 驱动的事实提取 |
| verifier.ts | 与源文档交叉验证，重新计算置信度 |
| linker.ts | 按 user_id + entity_name 去重链接 |

## 约定

- **验证**: 与源文档交叉验证，重新计算置信度
- **链接**: 按 user_id + entity_name 去重
- **来源类型**: documents, messages, conversations

## 注意

- 所有操作需要 userId scope
- 事实创建后不可修改 (不可变)
- 追踪功能通过 tiered_content 链接回原始文档
