"""
Tests for embedder module

Test OllamaEmbedder and MockEmbedder implementations.
"""

import pytest
import numpy as np

from agents_mem.embedder import (
    OllamaEmbedder,
    MockEmbedder,
    EmbedderError,
)


class TestMockEmbedder:
    """Mock Embedder tests"""
    
    @pytest.fixture
    def embedder(self):
        return MockEmbedder()
    
    @pytest.mark.asyncio
    async def test_embed_basic(self, embedder):
        """Test basic embedding generation"""
        text = "Hello, world!"
        embedding = await embedder.embed(text)
        
        assert isinstance(embedding, np.ndarray)
        assert embedding.dtype == np.float32
        assert embedding.shape == (1024,)
    
    @pytest.mark.asyncio
    async def test_embed_empty(self, embedder):
        """Test empty text returns zero vector"""
        embedding = await embedder.embed("")
        
        assert isinstance(embedding, np.ndarray)
        assert np.allclose(embedding, 0)
    
    @pytest.mark.asyncio
    async def test_embed_batch(self, embedder):
        """Test batch embedding"""
        texts = ["Text 1", "Text 2", "Text 3"]
        embeddings = await embedder.embed_batch(texts)
        
        assert len(embeddings) == 3
        for emb in embeddings:
            assert isinstance(emb, np.ndarray)
            assert emb.shape == (1024,)
    
    @pytest.mark.asyncio
    async def test_embed_document(self, embedder):
        """Test document embedding"""
        content = "This is a long document. " * 50
        result = await embedder.embed_document(content, title="Test Doc")
        
        assert "document_embedding" in result
        assert "chunks" in result
        assert result["chunk_count"] > 0
        
        # Document embedding should be 1024-dim
        assert result["document_embedding"].shape == (1024,)
    
    def test_compute_similarity_same(self, embedder):
        """Test similarity of identical texts"""
        # Same text should have similarity ~1.0
        text = "Test text"
        
        # Use async to get embeddings
        import asyncio
        emb1 = asyncio.run(embedder.embed(text))
        emb2 = asyncio.run(embedder.embed(text))
        
        similarity = embedder.compute_similarity(emb1, emb2)
        assert 0.99 < similarity <= 1.0
    
    def test_compute_similarity_different(self, embedder):
        """Test similarity of different texts"""
        import asyncio
        emb1 = asyncio.run(embedder.embed("Machine learning"))
        emb2 = asyncio.run(embedder.embed("Pizza and pasta"))
        
        similarity = embedder.compute_similarity(emb1, emb2)
        # Different topics should have lower similarity
        assert similarity < 0.9


class TestOllamaEmbedder:
    """Ollama Embedder tests"""
    
    @pytest.fixture
    def embedder(self):
        return OllamaEmbedder()
    
    def test_init(self, embedder):
        """Test embedder initialization"""
        assert embedder._base_url is not None
        assert embedder._model == "bge-m3"
        assert embedder._embedding_dim == 1024
    
    @pytest.mark.asyncio
    async def test_embed_empty(self, embedder):
        """Test empty text returns zero vector"""
        embedding = await embedder.embed("")
        
        assert isinstance(embedding, np.ndarray)
        assert np.allclose(embedding, 0)
    
    def test_compute_similarity(self, embedder):
        """Test similarity calculation"""
        # Create two unit vectors
        vec1 = np.array([1.0, 0.0, 0.0])
        vec2 = np.array([1.0, 0.0, 0.0])
        
        similarity = embedder.compute_similarity(vec1, vec2)
        assert similarity == 1.0
    
    def test_compute_similarity_zero(self, embedder):
        """Test similarity with zero vectors"""
        vec1 = np.array([1.0, 0.0])
        vec2 = np.array([0.0, 0.0])
        
        similarity = embedder.compute_similarity(vec1, vec2)
        assert similarity == 0.0


class TestEmbedderChunking:
    """Test text chunking"""
    
    @pytest.fixture
    def embedder(self):
        return MockEmbedder()
    
    def test_chunk_text_short(self, embedder):
        """Test short text (no chunking needed)"""
        text = "Short text"
        chunks = embedder._chunk_text(text, chunk_size=100, chunk_overlap=10)
        
        assert len(chunks) == 1
        assert chunks[0] == text
    
    def test_chunk_text_long(self, embedder):
        """Test long text chunking"""
        text = "A" * 300
        chunks = embedder._chunk_text(text, chunk_size=100, chunk_overlap=20)
        
        assert len(chunks) > 1
        # Check that chunks overlap
        if len(chunks) > 1:
            # End of first chunk should overlap with start of second
            assert len(chunks[0]) == 100


class TestEmbedderContextManager:
    """Test async context manager"""
    
    @pytest.mark.asyncio
    async def test_mock_context_manager(self):
        """Test MockEmbedder context manager"""
        async with MockEmbedder() as embedder:
            embedding = await embedder.embed("Test")
            assert isinstance(embedding, np.ndarray)
    
    @pytest.mark.asyncio
    async def test_ollama_context_manager(self):
        """Test OllamaEmbedder context manager"""
        async with OllamaEmbedder() as embedder:
            assert embedder._client is not None


class TestEmbedderConsistency:
    """Test embedding consistency"""
    
    @pytest.mark.asyncio
    async def test_same_text_same_embedding(self):
        """Test that same text produces same embedding (Mock)"""
        embedder = MockEmbedder()
        
        text = "Consistency test"
        emb1 = await embedder.embed(text)
        emb2 = await embedder.embed(text)
        
        assert np.allclose(emb1, emb2)
    
    @pytest.mark.asyncio
    async def test_different_text_different_embedding(self):
        """Test that different texts produce different embeddings"""
        embedder = MockEmbedder()
        
        text1 = "Machine learning"
        text2 = "Deep learning"
        
        emb1 = await embedder.embed(text1)
        emb2 = await embedder.embed(text2)
        
        assert not np.allclose(emb1, emb2)


class TestEmbedderDimensions:
    """Test embedding dimensions"""
    
    @pytest.mark.asyncio
    async def test_embedding_dimension(self):
        """Test embedding has correct dimensions"""
        embedder = MockEmbedder(embedding_dim=512)
        
        embedding = await embedder.embed("Test")
        assert embedding.shape == (512,)
    
    @pytest.mark.asyncio
    async def test_unit_vector(self):
        """Test MockEmbedder produces unit vectors"""
        embedder = MockEmbedder()
        
        embedding = await embedder.embed("Test")
        # Mock embedder normalizes vectors
        norm = np.linalg.norm(embedding)
        assert 0.99 < norm < 1.01  # Allow floating point error
