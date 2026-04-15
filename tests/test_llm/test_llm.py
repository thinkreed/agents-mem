"""
Tests for LLM module

Test OllamaLLMClient and MockLLMClient implementations.
"""

import pytest
import numpy as np

from agents_mem.llm import (
    OllamaLLMClient,
    MockLLMClient,
    LLMClientError,
)


class TestMockLLMClient:
    """Mock LLM Client tests"""
    
    @pytest.fixture
    def client(self):
        return MockLLMClient()
    
    @pytest.mark.asyncio
    async def test_generate_basic(self, client):
        """Test basic text generation"""
        result = await client.generate("Hello, world!")
        assert isinstance(result, str)
        assert "Hello, world!" in result
    
    @pytest.mark.asyncio
    async def test_generate_with_max_tokens(self, client):
        """Test generation with token limit"""
        long_text = "A" * 1000
        result = await client.generate(long_text, max_tokens=10)
        # 10 tokens * 4 chars = 40 chars max
        assert len(result) <= 50  # Allow some margin
    
    @pytest.mark.asyncio
    async def test_generate_stream(self, client):
        """Test streaming generation"""
        chunks = []
        async for chunk in client.generate_stream("Test"):
            chunks.append(chunk)
        full_text = "".join(chunks)
        assert "Test" in full_text
    
    def test_count_tokens(self, client):
        """Test token counting"""
        text = "Hello world"
        tokens = client.count_tokens(text)
        # Mock uses len(text) // 4
        expected = len(text) // 4
        assert tokens == expected


class TestOllamaLLMClient:
    """Ollama LLM Client tests"""
    
    @pytest.fixture
    def client(self):
        return OllamaLLMClient()
    
    def test_init(self, client):
        """Test client initialization"""
        assert client._base_url is not None
        assert client._model is not None
    
    def test_count_tokens_chinese(self, client):
        """Test Chinese token counting"""
        # Chinese text should have higher token count
        chinese = "这是一段中文文本"
        english = "This is English"
        
        chinese_tokens = client.count_tokens(chinese)
        english_tokens = client.count_tokens(english)
        
        # Chinese chars count as ~1.5 tokens each
        assert chinese_tokens > len(chinese) * 1
    
    def test_count_tokens_english(self, client):
        """Test English token counting"""
        text = "Hello world this is a test"
        tokens = client.count_tokens(text)
        
        # English words count as ~1.3 tokens each
        word_count = len(text.split())
        assert tokens > word_count


class TestLLMClientProtocols:
    """Test protocol compliance"""
    
    @pytest.mark.asyncio
    async def test_mock_client_is_async(self):
        """Verify MockLLMClient methods are async"""
        client = MockLLMClient()
        
        # generate should be async
        import inspect
        assert inspect.iscoroutinefunction(client.generate)
        assert inspect.iscoroutinefunction(client.generate_stream)
    
    @pytest.mark.asyncio
    async def test_ollama_client_is_async(self):
        """Verify OllamaLLMClient methods are async"""
        client = OllamaLLMClient()
        
        import inspect
        assert inspect.iscoroutinefunction(client.generate)
        assert inspect.iscoroutinefunction(client.generate_stream)


class TestLLMContextManager:
    """Test async context manager"""
    
    @pytest.mark.asyncio
    async def test_mock_context_manager(self):
        """Test MockLLMClient context manager"""
        async with MockLLMClient() as client:
            result = await client.generate("Test")
            assert isinstance(result, str)
    
    @pytest.mark.asyncio
    async def test_ollama_context_manager(self):
        """Test OllamaLLMClient context manager"""
        async with OllamaLLMClient() as client:
            assert client._client is not None


class TestLLMErrorHandling:
    """Test error handling"""
    
    @pytest.mark.asyncio
    async def test_ollama_error(self):
        """Test Ollama client handles errors"""
        # Create client with invalid URL to trigger error
        client = OllamaLLMClient(base_url="http://invalid:99999")
        
        with pytest.raises(LLMClientError):
            await client.generate("Test")
        
        await client.close()
