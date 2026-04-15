"""
Tests for core.constants module.

Tests all constant values defined in the module.
"""

import pytest

from agents_mem.core.constants import (
    L0_TOKEN_BUDGET,
    L1_TOKEN_BUDGET,
    SEARCH_MODE_FTS,
    SEARCH_MODE_SEMANTIC,
    SEARCH_MODE_HYBRID,
    RESOURCE_DOCUMENT,
    RESOURCE_ASSET,
    RESOURCE_CONVERSATION,
    RESOURCE_MESSAGE,
    RESOURCE_FACT,
    RESOURCE_TEAM,
    TIER_L0,
    TIER_L1,
    TIER_L2,
    DEFAULT_EMBEDDING_DIM,
    DEFAULT_EMBEDDING_MODEL,
    OPENVIKING_DEFAULT_URL,
    OLLAMA_DEFAULT_URL,
)


class TestTokenBudgetConstants:
    """Token budget constant tests."""
    
    def test_l0_token_budget(self):
        """Test L0 token budget value."""
        assert L0_TOKEN_BUDGET == 100
        assert isinstance(L0_TOKEN_BUDGET, int)
    
    def test_l1_token_budget(self):
        """Test L1 token budget value."""
        assert L1_TOKEN_BUDGET == 2000
        assert isinstance(L1_TOKEN_BUDGET, int)
    
    def test_token_budget_order(self):
        """Test token budget ordering."""
        assert L0_TOKEN_BUDGET < L1_TOKEN_BUDGET


class TestSearchModeConstants:
    """Search mode constant tests."""
    
    def test_search_mode_fts(self):
        """Test FTS search mode."""
        assert SEARCH_MODE_FTS == "fts"
    
    def test_search_mode_semantic(self):
        """Test semantic search mode."""
        assert SEARCH_MODE_SEMANTIC == "semantic"
    
    def test_search_mode_hybrid(self):
        """Test hybrid search mode."""
        assert SEARCH_MODE_HYBRID == "hybrid"


class TestResourceTypeConstants:
    """Resource type constant tests."""
    
    def test_resource_document(self):
        """Test document resource constant."""
        assert RESOURCE_DOCUMENT == "document"
    
    def test_resource_asset(self):
        """Test asset resource constant."""
        assert RESOURCE_ASSET == "asset"
    
    def test_resource_conversation(self):
        """Test conversation resource constant."""
        assert RESOURCE_CONVERSATION == "conversation"
    
    def test_resource_message(self):
        """Test message resource constant."""
        assert RESOURCE_MESSAGE == "message"
    
    def test_resource_fact(self):
        """Test fact resource constant."""
        assert RESOURCE_FACT == "fact"
    
    def test_resource_team(self):
        """Test team resource constant."""
        assert RESOURCE_TEAM == "team"


class TestTierConstants:
    """Tier level constant tests."""
    
    def test_tier_l0(self):
        """Test L0 tier constant."""
        assert TIER_L0 == "L0"
    
    def test_tier_l1(self):
        """Test L1 tier constant."""
        assert TIER_L1 == "L1"
    
    def test_tier_l2(self):
        """Test L2 tier constant."""
        assert TIER_L2 == "L2"
    
    def test_tier_order(self):
        """Test tier ordering."""
        assert TIER_L0 < TIER_L1 < TIER_L2


class TestEmbeddingConstants:
    """Embedding constant tests."""
    
    def test_default_embedding_dim(self):
        """Test default embedding dimension."""
        assert DEFAULT_EMBEDDING_DIM == 1024
        assert isinstance(DEFAULT_EMBEDDING_DIM, int)
    
    def test_default_embedding_model(self):
        """Test default embedding model."""
        assert DEFAULT_EMBEDDING_MODEL == "bge-m3"
        assert isinstance(DEFAULT_EMBEDDING_MODEL, str)


class TestServiceConstants:
    """Service URL constant tests."""
    
    def test_openviking_url(self):
        """Test OpenViking default URL."""
        assert OPENVIKING_DEFAULT_URL == "http://localhost:1933"
        assert "localhost" in OPENVIKING_DEFAULT_URL
        assert "1933" in OPENVIKING_DEFAULT_URL
    
    def test_ollama_url(self):
        """Test Ollama default URL."""
        assert OLLAMA_DEFAULT_URL == "http://localhost:11434"
        assert "localhost" in OLLAMA_DEFAULT_URL
        assert "11434" in OLLAMA_DEFAULT_URL


class TestConstantsIntegration:
    """Integration tests for constants."""
    
    def test_all_resource_types_defined(self):
        """Test all expected resource types are defined."""
        expected_types = [
            "document",
            "asset",
            "conversation",
            "message",
            "fact",
            "team",
        ]
        
        actual_types = [
            RESOURCE_DOCUMENT,
            RESOURCE_ASSET,
            RESOURCE_CONVERSATION,
            RESOURCE_MESSAGE,
            RESOURCE_FACT,
            RESOURCE_TEAM,
        ]
        
        assert expected_types == actual_types
    
    def test_all_search_modes_defined(self):
        """Test all search modes are defined."""
        modes = [SEARCH_MODE_FTS, SEARCH_MODE_SEMANTIC, SEARCH_MODE_HYBRID]
        assert len(modes) == 3
        assert len(set(modes)) == 3  # All unique
    
    def test_all_tiers_defined(self):
        """Test all tiers are defined."""
        tiers = [TIER_L0, TIER_L1, TIER_L2]
        assert len(tiers) == 3
        assert len(set(tiers)) == 3  # All unique