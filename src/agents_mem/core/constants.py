"""
常量定义模块
"""

# Token 预算常量
L0_TOKEN_BUDGET = 100
L1_TOKEN_BUDGET = 2000

# 搜索模式
SEARCH_MODE_FTS = "fts"
SEARCH_MODE_SEMANTIC = "semantic"
SEARCH_MODE_HYBRID = "hybrid"

# 资源类型
RESOURCE_DOCUMENT = "document"
RESOURCE_ASSET = "asset"
RESOURCE_CONVERSATION = "conversation"
RESOURCE_MESSAGE = "message"
RESOURCE_FACT = "fact"
RESOURCE_TEAM = "team"

# 视图层级
TIER_L0 = "L0"
TIER_L1 = "L1"
TIER_L2 = "L2"

# Embedding 配置
DEFAULT_EMBEDDING_DIM = 1024
DEFAULT_EMBEDDING_MODEL = "bge-m3"

# 服务配置
OLLAMA_DEFAULT_URL = "http://localhost:11434"
