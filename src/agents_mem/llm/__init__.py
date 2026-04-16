"""
LLM 客户端实现

提供与 Ollama 服务的集成，用于：
- TieredViewCapability 分层摘要生成
- 事实提取 (L3 Knowledge)
- 其他需要 LLM 的模块
"""

import os
from typing import Any, AsyncGenerator

import httpx


class LLMClientError(Exception):
    """LLM 客户端错误"""
    pass


class OllamaLLMClient:
    """
    Ollama LLM 客户端
    
    连接到 Ollama 服务进行文本生成。
    默认使用环境变量 OLLAMA_HOST 和 OLLAMA_MODEL。
    
    Example:
        client = OllamaLLMClient()
        result = await client.generate("Summarize this text", max_tokens=100)
    """
    
    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
    ):
        """
        初始化 Ollama 客户端
        
        Args:
            base_url: Ollama 服务地址，默认从 OLLAMA_HOST 环境变量读取
            model: 模型名称，默认从 OLLAMA_MODEL 环境变量读取
        """
        self._base_url = base_url or os.getenv("OLLAMA_HOST", "http://localhost:11434")
        self._model = model or os.getenv("OLLAMA_MODEL", "bge-m3")
        self._client = httpx.AsyncClient(base_url=self._base_url, timeout=60.0)
    
    async def generate(
        self,
        prompt: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> str:
        """
        生成文本
        
        Args:
            prompt: 输入提示
            max_tokens: 最大 token 数量
            temperature: 温度参数 (0.0-1.0)
            **kwargs: 其他参数传递给 Ollama
            
        Returns:
            生成的文本
            
        Raises:
            LLMClientError: 调用失败时
        """
        try:
            response = await self._client.post(
                "/api/generate",
                json={
                    "model": self._model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                        **kwargs,
                    },
                },
            )
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")
        except httpx.HTTPError as e:
            raise LLMClientError(f"Ollama API error: {e}") from e
        except Exception as e:
            raise LLMClientError(f"Failed to generate text: {e}") from e
    
    async def generate_stream(
        self,
        prompt: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """
        流式生成文本
        
        Args:
            prompt: 输入提示
            max_tokens: 最大 token 数量
            temperature: 温度参数
            **kwargs: 其他参数
            
        Yields:
            生成的文本片段
        """
        try:
            async with self._client.stream(
                "POST",
                "/api/generate",
                json={
                    "model": self._model,
                    "prompt": prompt,
                    "stream": True,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                        **kwargs,
                    },
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.strip():
                        import json
                        try:
                            data = json.loads(line)
                            if "response" in data:
                                yield data["response"]
                        except json.JSONDecodeError:
                            continue
        except httpx.HTTPError as e:
            raise LLMClientError(f"Ollama streaming error: {e}") from e
    
    def count_tokens(self, text: str) -> int:
        """
        估算 token 数量
        
        使用简单启发式：中文约 1.5 token/字，英文约 0.25 token/字符
        
        Args:
            text: 输入文本
            
        Returns:
            估算的 token 数量
        """
        import re
        
        # 统计中文字符
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
        # 统计英文单词 (粗略估计)
        english_words = len(re.findall(r'[a-zA-Z]+', text))
        # 其他字符
        other_chars = len(text) - chinese_chars - english_words
        
        # 估算：中文字符 × 1.5 + 英文单词 × 1.3 + 其他 × 0.5
        return int(chinese_chars * 1.5 + english_words * 1.3 + other_chars * 0.5)
    
    async def close(self) -> None:
        """关闭 HTTP 客户端"""
        await self._client.aclose()
    
    async def __aenter__(self):
        """异步上下文管理器入口"""
        return self
    
    async def __aexit__(self, exc_type: type[BaseException] | None, exc_val: BaseException | None, exc_tb: Any) -> None:
        """异步上下文管理器出口"""
        await self.close()


class MockLLMClient:
    """
    Mock LLM 客户端
    
    用于测试和开发环境的模拟实现。
    不依赖外部服务，生成确定性输出。
    """
    
    async def generate(
        self,
        prompt: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> str:
        """模拟生成"""
        if max_tokens:
            # 模拟 token 限制：假设 1 token ≈ 4 字符
            char_limit = max_tokens * 4
            return prompt[:char_limit] if len(prompt) > char_limit else prompt
        return f"[Mock Summary] {prompt[:100]}..."
    
    async def generate_stream(
        self,
        prompt: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """模拟流式生成"""
        result = await self.generate(prompt, max_tokens, temperature, **kwargs)
        for char in result:
            yield char
    
    def count_tokens(self, text: str) -> int:
        """简单估算 token 数量"""
        return len(text) // 4
    
    async def close(self) -> None:
        """Mock 客户端无需关闭"""
        pass


# 保持向后兼容的协议定义
from typing import Any, AsyncGenerator, Protocol


class LLMClientProtocol(Protocol):
    """
    LLM 客户端协议 (用于类型检查)
    
    实现类：
    - OllamaLLMClient: 生产环境，调用 Ollama 服务
    - MockLLMClient: 测试环境，本地模拟
    
    Note: generate_stream 返回 AsyncGenerator，Protocol 使用 Coroutine 包装
    以兼容 pyright 类型检查。
    """
    
    async def generate(
        self,
        prompt: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> str:
        ...
    
    # pyright 要求 Protocol 的 async 方法返回 Coroutine
    # 但实际实现返回 AsyncGenerator，使用类型包装解决
    def generate_stream(
        self,
        prompt: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        ...
    
    def count_tokens(self, text: str) -> int:
        ...
    
    async def close(self) -> None:
        ...


__all__ = [
    "LLMClientProtocol",
    "OllamaLLMClient", 
    "MockLLMClient",
    "LLMClientError",
]
