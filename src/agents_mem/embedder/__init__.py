"""
Embedding 模块

提供文本嵌入向量生成功能，用于：
- 文档向量索引 (L1 Index Layer)
- 语义搜索
- 相似度计算

使用 Ollama 服务调用 bge-m3 模型生成嵌入向量。
"""

import os
from typing import Any

import httpx
import numpy as np


class EmbedderError(Exception):
    """Embedder 错误"""
    pass


class OllamaEmbedder:
    """
    Ollama 嵌入向量生成器
    
    使用 Ollama 服务的 bge-m3 模型生成文本嵌入向量。
    bge-m3 是 BAAI 开发的多语言嵌入模型，支持中文。
    
    Example:
        embedder = OllamaEmbedder()
        embedding = await embedder.embed("这是一段文本")
        # Returns: numpy array of shape (1024,)
    """
    
    def __init__(
        self,
        base_url: str | None = None,
        model: str = "bge-m3",
    ):
        """
        初始化 Ollama Embedder
        
        Args:
            base_url: Ollama 服务地址，默认从 OLLAMA_HOST 环境变量
            model: 嵌入模型名称，默认 bge-m3
        """
        self._base_url = base_url or os.getenv("OLLAMA_HOST", "http://localhost:11434")
        self._model = model
        self._client = httpx.AsyncClient(base_url=self._base_url, timeout=30.0)
        self._embedding_dim = 1024  # bge-m3 输出维度
    
    async def embed(self, text: str) -> np.ndarray:
        """
        生成单个文本的嵌入向量
        
        Args:
            text: 输入文本
            
        Returns:
            嵌入向量 (numpy array, shape: (1024,))
            
        Raises:
            EmbedderError: 调用失败时
        """
        if not text or not text.strip():
            # 空文本返回零向量
            return np.zeros(self._embedding_dim, dtype=np.float32)
        
        try:
            response = await self._client.post(
                "/api/embeddings",
                json={
                    "model": self._model,
                    "prompt": text,
                },
            )
            response.raise_for_status()
            data = response.json()
            
            embedding = data.get("embedding", [])
            if not embedding:
                raise EmbedderError("Empty embedding returned from Ollama")
            
            return np.array(embedding, dtype=np.float32)
            
        except httpx.HTTPError as e:
            raise EmbedderError(f"Ollama embedding API error: {e}") from e
        except Exception as e:
            raise EmbedderError(f"Failed to generate embedding: {e}") from e
    
    async def embed_batch(self, texts: list[str]) -> list[np.ndarray]:
        """
        批量生成嵌入向量
        
        Args:
            texts: 文本列表
            
        Returns:
            嵌入向量列表
        """
        embeddings = []
        for text in texts:
            embedding = await self.embed(text)
            embeddings.append(embedding)
        return embeddings
    
    async def embed_document(
        self,
        content: str,
        title: str | None = None,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
    ) -> dict[str, Any]:
        """
        为文档生成嵌入向量
        
        支持长文档分块，返回文档级和块级嵌入。
        
        Args:
            content: 文档内容
            title: 文档标题
            chunk_size: 分块大小 (字符数)
            chunk_overlap: 块间重叠大小
            
        Returns:
            {
                "document_embedding": np.ndarray,  # 文档整体嵌入
                "chunks": [
                    {
                        "text": str,
                        "embedding": np.ndarray,
                        "start": int,
                        "end": int,
                    }
                ],
                "chunk_count": int,
            }
        """
        # 生成文档整体嵌入 (标题 + 前 chunk_size 字符)
        doc_text = f"{title}\n{content}" if title else content
        doc_preview = doc_text[:chunk_size * 2]  # 取前 2 倍 chunk_size
        doc_embedding = await self.embed(doc_preview)
        
        # 分块处理
        chunks = self._chunk_text(content, chunk_size, chunk_overlap)
        chunk_embeddings = await self.embed_batch(chunks)
        
        return {
            "document_embedding": doc_embedding,
            "chunks": [
                {
                    "text": chunk,
                    "embedding": emb,
                    "start": i * (chunk_size - chunk_overlap),
                    "end": i * (chunk_size - chunk_overlap) + len(chunk),
                }
                for i, (chunk, emb) in enumerate(zip(chunks, chunk_embeddings))
            ],
            "chunk_count": len(chunks),
        }
    
    def _chunk_text(
        self,
        text: str,
        chunk_size: int,
        chunk_overlap: int,
    ) -> list[str]:
        """
        将文本分块
        
        Args:
            text: 原始文本
            chunk_size: 块大小
            chunk_overlap: 重叠大小
            
        Returns:
            文本块列表
        """
        if len(text) <= chunk_size:
            return [text]
        
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start += chunk_size - chunk_overlap
        
        return chunks
    
    def compute_similarity(
        self,
        embedding1: np.ndarray,
        embedding2: np.ndarray,
    ) -> float:
        """
        计算两个嵌入向量的余弦相似度
        
        Args:
            embedding1: 向量 1
            embedding2: 向量 2
            
        Returns:
            余弦相似度 (-1.0 到 1.0)
        """
        # 归一化
        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return float(np.dot(embedding1, embedding2) / (norm1 * norm2))
    
    async def close(self) -> None:
        """关闭 HTTP 客户端"""
        await self._client.aclose()
    
    async def __aenter__(self):
        """异步上下文管理器入口"""
        return self
    
    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: Any,
    ) -> None:
        """异步上下文管理器出口"""
        await self.close()


class MockEmbedder:
    """
    Mock Embedder
    
    用于测试环境的模拟实现，不依赖外部服务。
    生成确定性的随机向量。
    """
    
    def __init__(self, embedding_dim: int = 1024):
        self._embedding_dim = embedding_dim
    
    async def embed(self, text: str) -> np.ndarray:
        """生成模拟嵌入向量"""
        if not text:
            return np.zeros(self._embedding_dim, dtype=np.float32)
        
        # 使用文本哈希作为随机种子，确保相同文本产生相同向量
        import hashlib
        seed = int(hashlib.md5(text.encode()).hexdigest()[:8], 16)
        np.random.seed(seed)
        
        # 生成随机单位向量
        vector = np.random.randn(self._embedding_dim).astype(np.float32)
        vector = vector / np.linalg.norm(vector)
        
        return vector
    
    async def embed_batch(self, texts: list[str]) -> list[np.ndarray]:
        """批量生成模拟嵌入"""
        return [await self.embed(text) for text in texts]
    
    async def embed_document(
        self,
        content: str,
        title: str | None = None,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
    ) -> dict[str, Any]:
        """为文档生成模拟嵌入"""
        doc_text = f"{title}\n{content}" if title else content
        doc_embedding = await self.embed(doc_text[:chunk_size * 2])
        
        chunks = self._chunk_text(content, chunk_size, chunk_overlap)
        chunk_embeddings = await self.embed_batch(chunks)
        
        return {
            "document_embedding": doc_embedding,
            "chunks": [
                {
                    "text": chunk,
                    "embedding": emb,
                    "start": i * (chunk_size - chunk_overlap),
                    "end": i * (chunk_size - chunk_overlap) + len(chunk),
                }
                for i, (chunk, emb) in enumerate(zip(chunks, chunk_embeddings))
            ],
            "chunk_count": len(chunks),
        }
    
    def _chunk_text(
        self,
        text: str,
        chunk_size: int,
        chunk_overlap: int,
    ) -> list[str]:
        """将文本分块"""
        if len(text) <= chunk_size:
            return [text]
        
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start += chunk_size - chunk_overlap
        
        return chunks
    
    def compute_similarity(
        self,
        embedding1: np.ndarray,
        embedding2: np.ndarray,
    ) -> float:
        """计算余弦相似度"""
        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return float(np.dot(embedding1, embedding2) / (norm1 * norm2))
    
    async def close(self) -> None:
        """Mock 无需关闭"""
        pass
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: Any,
    ) -> None:
        pass


# 便捷函数
async def get_embedder() -> OllamaEmbedder:
    """
    获取默认 Embedder 实例
    
    从环境变量读取配置。
    """
    return OllamaEmbedder()


__all__ = [
    "OllamaEmbedder",
    "MockEmbedder",
    "EmbedderError",
    "get_embedder",
]
