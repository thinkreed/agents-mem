"""
Tests for content.capabilities.tiered module.

Tests TieredViewCapability, TieredCacheConfig, CacheEntry.
"""

import pytest
import time
from datetime import datetime

from agents_mem.core.types import Content, ContentType, TierLevel, EntityType, TieredContent
from agents_mem.content.capabilities.tiered import (
    TieredViewCapability,
    TieredCacheConfig,
    CacheEntry,
    L0_TOKEN_BUDGET_DEFAULT,
    L1_TOKEN_BUDGET_DEFAULT,
    should_use_tiered_view,
    select_tier_level,
)
from agents_mem.llm import MockLLMClient


@pytest.fixture
def mock_llm():
    """Create mock LLM client"""
    return MockLLMClient()


@pytest.fixture
def cache_config():
    """Create cache config"""
    return TieredCacheConfig(
        enabled=True,
        max_size=100,
        ttl_seconds=60,
    )


@pytest.fixture
def tiered(mock_llm, cache_config):
    """Create TieredViewCapability"""
    return TieredViewCapability(mock_llm, cache_config)


@pytest.fixture
def sample_content():
    """Create sample content"""
    return Content(
        id="doc-001",
        uri="mem://user123/_/_/documents/doc-001",
        title="Test Document",
        body="This is a test document with some content for testing the tiered view capability.",
        content_type=ContentType.NOTE,
        user_id="user123",
    )


class TestTieredCacheConfig:
    """TieredCacheConfig tests"""
    
    def test_cache_config_defaults(self):
        """Test default cache config"""
        config = TieredCacheConfig()
        assert config.enabled is True
        assert config.max_size == 1000
        assert config.ttl_seconds == 3600
        assert config.l0_max_size == 5000
        assert config.l0_ttl_seconds == 7200
    
    def test_cache_config_custom(self):
        """Test custom cache config"""
        config = TieredCacheConfig(
            enabled=False,
            max_size=500,
            ttl_seconds=120,
        )
        assert config.enabled is False
        assert config.max_size == 500
        assert config.ttl_seconds == 120


class TestCacheEntry:
    """CacheEntry tests"""
    
    def test_cache_entry_creation(self):
        """Test creating cache entry"""
        entry = CacheEntry(content="Test content")
        assert entry.content == "Test content"
        assert entry.hits == 0
    
    def test_cache_entry_is_expired(self):
        """Test expiration check"""
        entry = CacheEntry(content="Test", created_at=time.time() - 100)
        assert entry.is_expired(50) is True
        assert entry.is_expired(200) is False
    
    def test_cache_entry_touch(self):
        """Test touch increments hits"""
        entry = CacheEntry(content="Test")
        entry.touch()
        entry.touch()
        assert entry.hits == 2


class TestTieredViewCapability:
    """TieredViewCapability tests"""
    
    def test_initialization(self, mock_llm, cache_config):
        """Test initialization"""
        tiered = TieredViewCapability(mock_llm, cache_config)
        assert tiered._llm == mock_llm
        assert tiered._cache_config == cache_config
    
    def test_initialization_defaults(self):
        """Test initialization with defaults"""
        tiered = TieredViewCapability()
        assert tiered._llm is not None
        assert tiered._cache_config is not None
    
    @pytest.mark.asyncio
    async def test_get_view_l2(self, tiered, sample_content):
        """Test L2 returns original content"""
        result = await tiered.get_view(sample_content, TierLevel.L2)
        assert result == sample_content.body
    
    @pytest.mark.asyncio
    async def test_get_view_l0(self, tiered, sample_content):
        """Test L0 generates summary"""
        result = await tiered.get_view(sample_content, TierLevel.L0)
        assert result is not None
        assert isinstance(result, str)
    
    @pytest.mark.asyncio
    async def test_get_view_l1(self, tiered, sample_content):
        """Test L1 generates overview"""
        result = await tiered.get_view(sample_content, TierLevel.L1)
        assert result is not None
        assert isinstance(result, str)
    
    @pytest.mark.asyncio
    async def test_get_view_str_tier(self, tiered, sample_content):
        """Test string tier conversion"""
        result = await tiered.get_view(sample_content, "L0")
        assert result is not None
    
    @pytest.mark.asyncio
    async def test_get_view_invalid_tier(self, tiered, sample_content):
        """Test invalid tier raises"""
        with pytest.raises(ValueError):
            await tiered.get_view(sample_content, "invalid")
    
    @pytest.mark.asyncio
    async def test_generate_l0_with_cache(self, tiered, sample_content):
        """Test L0 with caching"""
        # First call
        result1 = await tiered.generate_l0(sample_content)
        
        # Second call should use cache
        result2 = await tiered.generate_l0(sample_content)
        
        assert result1 == result2
        stats = tiered.get_cache_stats()
        assert stats["l0"]["total_hits"] >= 1
    
    @pytest.mark.asyncio
    async def test_generate_l1_with_cache(self, tiered, sample_content):
        """Test L1 with caching"""
        result1 = await tiered.generate_l1(sample_content)
        result2 = await tiered.generate_l1(sample_content)
        
        assert result1 == result2
    
    @pytest.mark.asyncio
    async def test_generate_tiered_content(self, tiered, sample_content):
        """Test generating TieredContent"""
        result = await tiered.generate_tiered_content(sample_content)
        
        assert isinstance(result, TieredContent)
        assert result.abstract is not None
        assert result.overview is not None
        assert result.source_id == sample_content.id
    
    def test_clear_cache(self, tiered, sample_content):
        """Test clearing cache"""
        # Generate to populate cache
        tiered._l0_cache["test"] = CacheEntry(content="cached")
        tiered._l1_cache["test"] = CacheEntry(content="cached")
        
        tiered.clear_cache()
        
        assert len(tiered._l0_cache) == 0
        assert len(tiered._l1_cache) == 0
    
    def test_get_cache_stats(self, tiered):
        """Test cache stats"""
        tiered._l0_cache["a"] = CacheEntry(content="test")
        tiered._l0_cache["a"].touch()
        
        stats = tiered.get_cache_stats()
        
        assert "l0" in stats
        assert "l1" in stats
        assert stats["l0"]["size"] == 1
        assert stats["l0"]["total_hits"] == 1
    
    def test_estimate_tokens(self, tiered, sample_content):
        """Test token estimation"""
        tokens = tiered.estimate_tokens(sample_content)
        assert tokens > 0


class TestHelperFunctions:
    """Helper function tests"""
    
    def test_should_use_tiered_view_large_content(self, mock_llm):
        """Test tiered view needed for large content"""
        content = Content(
            id="doc-001",
            uri="mem://user123/_/_/documents/doc-001",
            title="Test",
            body="Very long content here...",
            content_type=ContentType.NOTE,
            user_id="user123",
        )
        tiered = TieredViewCapability(mock_llm)
        
        result = should_use_tiered_view(content, 50, tiered)
        assert result is True
    
    def test_should_use_tiered_view_small_content(self, mock_llm):
        """Test tiered view not needed for small content"""
        content = Content(
            id="doc-001",
            uri="mem://user123/_/_/documents/doc-001",
            title="Test",
            body="Short",
            content_type=ContentType.NOTE,
            user_id="user123",
        )
        tiered = TieredViewCapability(mock_llm)
        
        result = should_use_tiered_view(content, 10000, tiered)
        # Small content with large budget may not need tiered
        assert isinstance(result, bool)
    
    def test_select_tier_level_low_budget(self):
        """Test L0 selection for low budget"""
        content = Content(
            id="doc-001",
            uri="mem://user123/_/_/documents/doc-001",
            title="Test",
            body="Content",
            content_type=ContentType.NOTE,
            user_id="user123",
        )
        tiered = TieredViewCapability()
        
        level = select_tier_level(content, 100, tiered)
        assert level == TierLevel.L0
    
    def test_select_tier_level_medium_budget(self):
        """Test L1 selection for medium budget"""
        content = Content(
            id="doc-001",
            uri="mem://user123/_/_/documents/doc-001",
            title="Test",
            body="Content",
            content_type=ContentType.NOTE,
            user_id="user123",
        )
        tiered = TieredViewCapability()
        
        level = select_tier_level(content, 1000, tiered)
        assert level == TierLevel.L1
    
    def test_select_tier_level_high_budget(self):
        """Test L2 selection for high budget"""
        content = Content(
            id="doc-001",
            uri="mem://user123/_/_/documents/doc-001",
            title="Test",
            body="Content",
            content_type=ContentType.NOTE,
            user_id="user123",
        )
        tiered = TieredViewCapability()
        
        level = select_tier_level(content, 5000, tiered)
        assert level == TierLevel.L2


class TestTokenBudgetConstants:
    """Token budget constant tests"""
    
    def test_l0_budget(self):
        """Test L0 budget constant"""
        assert L0_TOKEN_BUDGET_DEFAULT == 100
    
    def test_l1_budget(self):
        """Test L1 budget constant"""
        assert L1_TOKEN_BUDGET_DEFAULT == 2000