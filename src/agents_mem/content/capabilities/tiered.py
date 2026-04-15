"""
Tiered View Capability - 分层视图能力

L2 Content Layer 的内置能力，提供 L0/L1/L2 分层视图。
使用 LLM 生成摘要和概览。

Token 预算:
- L0: ~100 tokens (抽象摘要)
- L1: ~2000 tokens (概要)
- L2: 完整原始内容
"""

import hashlib
import time
from datetime import datetime
from dataclasses import dataclass, field
from typing import Any

from agents_mem.core.constants import L0_TOKEN_BUDGET, L1_TOKEN_BUDGET
from agents_mem.core.types import Content, TierLevel, TieredContent, EntityType
from agents_mem.llm import LLMClientProtocol, MockLLMClient


# ============================================================================
# Token 预算常量
# ============================================================================

L0_TOKEN_BUDGET_DEFAULT = 100  # L0 抽象摘要
L1_TOKEN_BUDGET_DEFAULT = 2000  # L1 概要


# ============================================================================
# 缓存配置
# ============================================================================

@dataclass
class TieredCacheConfig:
    """分层视图缓存配置"""
    
    enabled: bool = True
    max_size: int = 1000  # 最大缓存条目数
    ttl_seconds: int = 3600  # 缓存有效期 (1小时)
    
    # L0 缓存单独配置 (更小的摘要，可以缓存更多)
    l0_max_size: int = 5000
    l0_ttl_seconds: int = 7200  # 2小时
    
    # L1 缓存配置
    l1_max_size: int = 1000
    l1_ttl_seconds: int = 3600  # 1小时


@dataclass
class CacheEntry:
    """缓存条目"""
    
    content: str
    created_at: float = field(default_factory=time.time)
    hits: int = 0
    
    def is_expired(self, ttl_seconds: int) -> bool:
        """检查是否过期"""
        return time.time() - self.created_at > ttl_seconds
    
    def touch(self) -> None:
        """增加访问计数"""
        self.hits += 1


# ============================================================================
# TieredViewCapability 类
# ============================================================================

class TieredViewCapability:
    """
    分层视图能力
    
    提供 L0/L1/L2 分层视图生成和缓存功能。
    L2 是原始内容，不需要生成。
    
    核心方法:
    - get_view(content, tier) -> str: 获取指定层级视图
    - generate_l0(content) -> str: 生成 L0 摘要
    - generate_l1(content) -> str: 生成 L1 概览
    
    缓存机制:
    - L0/L1 摘要缓存，避免重复 LLM 调用
    - 基于 content hash 的缓存 key
    - TTL 过期和 LRU 淘汰
    """
    
    def __init__(
        self,
        llm_client: LLMClientProtocol | None = None,
        cache_config: TieredCacheConfig | None = None,
    ):
        """
        初始化分层视图能力
        
        Args:
            llm_client: LLM 客户端 (默认使用 MockLLMClient)
            cache_config: 缓存配置
        """
        self._llm = llm_client or MockLLMClient()
        self._cache_config = cache_config or TieredCacheConfig()
        
        # 缓存存储
        self._l0_cache: dict[str, CacheEntry] = {}
        self._l1_cache: dict[str, CacheEntry] = {}
        
        # Token 预算
        self._l0_budget = L0_TOKEN_BUDGET or L0_TOKEN_BUDGET_DEFAULT
        self._l1_budget = L1_TOKEN_BUDGET or L1_TOKEN_BUDGET_DEFAULT
    
    # =========================================================================
    # 公共方法
    # =========================================================================
    
    async def get_view(self, content: Content, tier: TierLevel | str) -> str:
        """
        获取指定层级的内容视图
        
        Args:
            content: 内容对象
            tier: 分层级别 (L0, L1, L2)
            
        Returns:
            对应层级的内容视图
            
        Raises:
            ValueError: 无效的层级
        """
        # 转换字符串到枚举
        tier_level: TierLevel
        if isinstance(tier, str):  # type: ignore[reportUnnecessaryIsInstance]
            tier_level = TierLevel(tier)
        else:
            tier_level = tier
        
        if tier_level == TierLevel.L2:
            # L2 是原始内容，直接返回
            return content.body
        
        if tier_level == TierLevel.L0:
            return await self.generate_l0(content)
        
        if tier_level == TierLevel.L1:
            return await self.generate_l1(content)
        
        raise ValueError(f"Invalid tier level: {tier}")
    
    async def generate_l0(self, content: Content) -> str:
        """
        生成 L0 抽象摘要 (~100 tokens)
        
        使用 LLM 生成简短摘要，适合快速浏览。
        结果会被缓存。
        
        Args:
            content: 内容对象
            
        Returns:
            L0 抽象摘要
        """
        # 检查缓存
        cache_key = self._get_cache_key(content)
        
        if self._cache_config.enabled:
            cached = self._l0_cache.get(cache_key)
            if cached and not cached.is_expired(self._cache_config.l0_ttl_seconds):
                cached.touch()
                return cached.content
        
        # 生成摘要
        prompt = self._build_l0_prompt(content)
        summary = await self._llm.generate(
            prompt,
            max_tokens=self._l0_budget,
            temperature=0.3,  # 低温度，更稳定的摘要
        )
        
        # 缓存结果
        if self._cache_config.enabled:
            self._cache_l0(cache_key, summary)
        
        return summary
    
    async def generate_l1(self, content: Content) -> str:
        """
        生成 L1 概览 (~2000 tokens)
        
        使用 LLM 生成详细概览，包含关键信息。
        结果会被缓存。
        
        Args:
            content: 内容对象
            
        Returns:
            L1 概览
        """
        # 检查缓存
        cache_key = self._get_cache_key(content)
        
        if self._cache_config.enabled:
            cached = self._l1_cache.get(cache_key)
            if cached and not cached.is_expired(self._cache_config.l1_ttl_seconds):
                cached.touch()
                return cached.content
        
        # 生成概览
        prompt = self._build_l1_prompt(content)
        overview = await self._llm.generate(
            prompt,
            max_tokens=self._l1_budget,
            temperature=0.5,
        )
        
        # 缓存结果
        if self._cache_config.enabled:
            self._cache_l1(cache_key, overview)
        
        return overview
    
    async def generate_tiered_content(
        self,
        content: Content,
        generation_mode: str = "realtime",
    ) -> TieredContent:
        """
        生成完整的 TieredContent 对象
        
        包含 L0 和 L1 两层摘要。
        
        Args:
            content: 原始内容
            generation_mode: 生成模式
            
        Returns:
            TieredContent 对象
        """
        l0_summary = await self.generate_l0(content)
        l1_overview = await self.generate_l1(content)
        
        now_dt = datetime.now()
        
        return TieredContent(
            id=f"tiered-{content.id}",
            source_type=EntityType.DOCUMENTS,  # 默认，实际应根据 content 类型调整
            source_id=content.id,
            original_uri=content.uri,
            user_id=content.user_id,
            agent_id=content.agent_id,
            team_id=content.team_id,
            abstract=l0_summary,
            overview=l1_overview,
            generation_mode=generation_mode,
            l0_generated_at=now_dt,
            l1_generated_at=now_dt,
        )
    
    # =========================================================================
    # 缓存管理
    # =========================================================================
    
    def clear_cache(self) -> None:
        """清空所有缓存"""
        self._l0_cache.clear()
        self._l1_cache.clear()
    
    def get_cache_stats(self) -> dict[str, Any]:
        """获取缓存统计信息"""
        return {
            "l0": {
                "size": len(self._l0_cache),
                "max_size": self._cache_config.l0_max_size,
                "total_hits": sum(e.hits for e in self._l0_cache.values()),
            },
            "l1": {
                "size": len(self._l1_cache),
                "max_size": self._cache_config.l1_max_size,
                "total_hits": sum(e.hits for e in self._l1_cache.values()),
            },
        }
    
    def _cache_l0(self, key: str, content: str) -> None:
        """缓存 L0 摘要"""
        # LRU 淘汰
        if len(self._l0_cache) >= self._cache_config.l0_max_size:
            self._evict_lru(self._l0_cache)
        
        self._l0_cache[key] = CacheEntry(content=content)
    
    def _cache_l1(self, key: str, content: str) -> None:
        """缓存 L1 概览"""
        # LRU 淘汰
        if len(self._l1_cache) >= self._cache_config.l1_max_size:
            self._evict_lru(self._l1_cache)
        
        self._l1_cache[key] = CacheEntry(content=content)
    
    def _evict_lru(self, cache: dict[str, CacheEntry]) -> None:
        """LRU 淘汰策略"""
        # 找到访问次数最少且最旧的条目
        if not cache:
            return
        
        # 按 hits 和 created_at 排序，淘汰最不活跃的
        sorted_entries = sorted(
            cache.items(),
            key=lambda x: (x[1].hits, x[1].created_at),
        )
        
        # 淘汰 10% 的条目
        evict_count = max(1, len(sorted_entries) // 10)
        for key, _ in sorted_entries[:evict_count]:
            del cache[key]
    
    # =========================================================================
    # 内部方法
    # =========================================================================
    
    def _get_cache_key(self, content: Content) -> str:
        """
        生成缓存 key
        
        基于 content id 和 body hash，确保内容变化时缓存失效。
        """
        body_hash = hashlib.sha256(content.body.encode()).hexdigest()[:16]
        return f"{content.id}:{body_hash}"
    
    def _build_l0_prompt(self, content: Content) -> str:
        """构建 L0 摘要生成提示词"""
        return f"""
请为以下内容生成一个简洁的摘要，控制在100个token以内。

标题: {content.title}

内容:
{content.body[:2000]}  # 限制输入长度

摘要要求:
1. 突出核心主题和关键信息
2. 使用简洁的语言
3. 保持客观中立的语气
4. 控制在100 tokens以内

请直接输出摘要，不要有任何额外说明:
"""
    
    def _build_l1_prompt(self, content: Content) -> str:
        """构建 L1 概览生成提示词"""
        return f"""
请为以下内容生成一个详细的概览，控制在2000个token以内。

标题: {content.title}
类型: {content.content_type.value}

内容:
{content.body[:5000]}  # 限制输入长度

概览要求:
1. 包含主要内容、关键观点和重要细节
2. 保持结构清晰，可使用段落或要点
3. 突出内容的逻辑脉络
4. 包含必要的背景信息
5. 控制在2000 tokens以内

请直接输出概览，不要有任何额外说明:
"""
    
    def estimate_tokens(self, content: Content) -> int:
        """
        估算内容的 token 数量
        
        用于决定是否需要分层视图。
        """
        return self._llm.count_tokens(content.body)


# ============================================================================
# 辅助函数
# ============================================================================

def should_use_tiered_view(
    content: Content,
    token_budget: int,
    tiered: TieredViewCapability,
) -> bool:
    """
    判断是否应该使用分层视图
    
    Args:
        content: 内容对象
        token_budget: 当前 token 预算
        tiered: TieredViewCapability 实例
        
    Returns:
        是否需要使用分层视图
    """
    estimated_tokens = tiered.estimate_tokens(content)
    
    # 如果内容 token 数超过预算，需要分层
    if estimated_tokens > token_budget:
        return True
    
    # 如果预算不足以加载完整内容，使用分层
    if token_budget < L1_TOKEN_BUDGET:
        return True
    
    return False


def select_tier_level(
    content: Content,
    token_budget: int,
    tiered: TieredViewCapability,
) -> TierLevel:
    """
    根据 token 预算选择合适的层级
    
    Args:
        content: 内容对象
        token_budget: 当前 token 预算
        tiered: TieredViewCapability 实例
        
    Returns:
        推荐的层级
    """
    # 预算 < 500: 使用 L0
    if token_budget < 500:
        return TierLevel.L0
    
    # 预算 < 3000: 使用 L0 + L1
    if token_budget < 3000:
        return TierLevel.L1
    
    # 预算 >= 3000: 使用 L2 (完整内容)
    return TierLevel.L2


__all__ = [
    "TieredViewCapability",
    "TieredCacheConfig",
    "CacheEntry",
    "L0_TOKEN_BUDGET_DEFAULT",
    "L1_TOKEN_BUDGET_DEFAULT",
    "should_use_tiered_view",
    "select_tier_level",
]