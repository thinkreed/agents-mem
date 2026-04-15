"""
LLM 客户端协议定义

定义 LLM 服务接口，用于 TieredViewCapability 等模块调用。
"""

from typing import Any, Protocol


class LLMClientProtocol(Protocol):
    """
    LLM 客户端协议
    
    定义 LLM 服务的标准接口，用于：
    - TieredViewCapability 分层摘要生成
    - 事实提取 (L3 Knowledge)
    - 其他需要 LLM 的模块
    """
    
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
            temperature: 温度参数
            **kwargs: 其他参数
            
        Returns:
            生成的文本
        """
        ...
    
    async def generate_stream(
        self,
        prompt: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> Any:
        """
        流式生成文本
        
        Args:
            prompt: 输入提示
            max_tokens: 最大 token 数量
            temperature: 温度参数
            **kwargs: 其他参数
            
        Returns:
            流式生成器
        """
        ...
    
    def count_tokens(self, text: str) -> int:
        """
        计算 token 数量
        
        Args:
            text: 输入文本
            
        Returns:
            token 数量
        """
        ...


class MockLLMClient:
    """
    Mock LLM 客户端
    
    用于测试和开发环境的模拟实现。
    """
    
    async def generate(
        self,
        prompt: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> str:
        """模拟生成"""
        # 简单截取提示词的一部分作为"摘要"
        if max_tokens:
            # 模拟 token 限制
            # 假设 1 token ≈ 4 字符
            char_limit = max_tokens * 4
            return prompt[:char_limit] if len(prompt) > char_limit else prompt
        return f"[Mock Summary] {prompt[:100]}..."
    
    async def generate_stream(
        self,
        prompt: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> Any:
        """模拟流式生成"""
        result = await self.generate(prompt, max_tokens, temperature, **kwargs)
        # 返回简单迭代器
        for char in result:
            yield char
    
    def count_tokens(self, text: str) -> int:
        """简单估算 token 数量"""
        # 假设 1 token ≈ 4 字符 (中文需要调整)
        return len(text) // 4


__all__ = ["LLMClientProtocol", "MockLLMClient"]