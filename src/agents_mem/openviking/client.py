"""
OpenViking HTTP Client SDK

提供 OpenViking 向量搜索服务的 HTTP 客户端实现。
支持异步操作、错误处理和重试机制。

API 端点:
- /api/v1/search/find - 语义搜索
- /api/v1/resources - 添加资源
- /api/v1/fs - 删除资源
- /api/v1/content/* - 分层内容读取
"""

import asyncio
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import httpx

from agents_mem.core.constants import OPENVIKING_DEFAULT_URL


class VikingErrorType(str, Enum):
    """OpenViking 错误类型"""

    CONNECTION = "connection"
    AUTH = "auth"
    NOT_FOUND = "not_found"
    INVALID = "invalid"
    SERVER = "server"
    TIMEOUT = "timeout"


@dataclass
class VikingError(Exception):
    """OpenViking API 错误"""

    type: VikingErrorType
    message: str
    status_code: int | None = None
    original: Exception | None = None

    def __str__(self) -> str:
        if self.status_code:
            return f"VikingError({self.type.value}): {self.message} (status={self.status_code})"
        return f"VikingError({self.type.value}): {self.message}"


@dataclass
class OpenVikingConfig:
    """OpenViking 配置"""

    enabled: bool = True
    base_url: str = OPENVIKING_DEFAULT_URL
    api_key: str | None = None
    account: str | None = None
    timeout: int = 30000  # milliseconds
    max_retries: int = 3
    retry_delay: int = 100  # milliseconds
    embedding_dim: int = 1024


@dataclass
class SearchResult:
    """搜索结果"""

    uri: str
    score: float
    abstract: str = ""
    context_type: str = "resource"
    is_leaf: bool = True
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class FindResult:
    """搜索返回结果集"""

    memories: list[SearchResult] = field(default_factory=list)
    resources: list[SearchResult] = field(default_factory=list)
    skills: list[SearchResult] = field(default_factory=list)
    total: int = 0


@dataclass
class ContentResult:
    """内容读取结果"""

    content: str = ""
    abstract: str | None = None
    overview: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AddResourceResult:
    """添加资源结果"""

    root_uri: str = ""
    task_id: str | None = None
    status: str | None = None


class OpenVikingClient:
    """
    OpenViking HTTP Client

    提供向量搜索服务的 HTTP 客户端，支持:
    - 语义搜索 (find API)
    - 资源添加/删除
    - 分层内容读取 (L0/L1/L2)
    - 健康检查
    """

    def __init__(self, config: OpenVikingConfig | None = None):
        """
        初始化客户端

        Args:
            config: 配置对象，默认使用默认配置
        """
        self.config = config or OpenVikingConfig()
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "OpenVikingClient":
        """异步上下文管理器入口"""
        self._client = httpx.AsyncClient(
            base_url=self.config.base_url,
            timeout=self.config.timeout / 1000,  # convert to seconds
            headers=self._build_headers(),
        )
        return self

    async def __aexit__(self, *args: Any) -> None:
        """异步上下文管理器出口"""
        if self._client:
            await self._client.aclose()
            self._client = None

    def _build_headers(self) -> dict[str, str]:
        """构建请求头"""
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        return headers

    def _get_client(self) -> httpx.AsyncClient:
        """获取或创建 HTTP 客户端"""
        if not self._client:
            self._client = httpx.AsyncClient(
                base_url=self.config.base_url,
                timeout=self.config.timeout / 1000,
                headers=self._build_headers(),
            )
        return self._client

    async def close(self) -> None:
        """关闭客户端连接"""
        if self._client:
            await self._client.aclose()
            self._client = None

    # =========================================================================
    # 核心方法
    # =========================================================================

    async def search(
        self,
        query: str,
        target_uri: str,
        limit: int = 10,
        mode: str = "hybrid",
    ) -> list[SearchResult]:
        """
        语义搜索

        Args:
            query: 搜索查询文本
            target_uri: 目标 URI (viking:// 格式)
            limit: 最大返回数量
            mode: 搜索模式 (hybrid, vector, fts)

        Returns:
            搜索结果列表

        Raises:
            VikingError: 搜索失败
        """
        body = {
            "query": query,
            "target_uri": target_uri,
            "limit": limit,
            "mode": mode,
        }

        response = await self._request("POST", "/api/v1/search/find", body)
        return self._parse_find_response(response)

    async def index(
        self,
        uri: str,
        embedding: list[float],
        metadata: dict[str, Any] | None = None,
        content: str | None = None,
    ) -> AddResourceResult:
        """
        添加/索引资源

        Args:
            uri: 目标 URI (viking:// 格式)
            embedding: 嵌入向量 (1024 维)
            metadata: 资源元数据
            content: 文本内容 (可选，用于 L0/L1 生成)

        Returns:
            添加结果

        Raises:
            VikingError: 添加失败
        """
        body: dict[str, Any] = {
            "target": uri,
            "wait": False,
            "content_type": "text",
        }

        if content:
            body["content"] = content

        if metadata:
            body["metadata"] = metadata

        if embedding:
            body["embedding"] = embedding

        response = await self._request("POST", "/api/v1/resources", body)

        return AddResourceResult(
            root_uri=response.get("root_uri", ""),
            task_id=response.get("task_id"),
            status=response.get("status"),
        )

    async def delete(self, uri: str) -> bool:
        """
        删除资源

        Args:
            uri: 资源 URI (viking:// 格式)

        Returns:
            是否成功删除

        Raises:
            VikingError: 删除失败
        """
        encoded_uri = uri.replace("/", "%2F")
        response = await self._request(
            "DELETE", f"/api/v1/fs?uri={encoded_uri}"
        )
        return response.get("success", False)

    # =========================================================================
    # 分层内容方法
    # =========================================================================

    async def get_abstract(self, uri: str) -> str:
        """
        获取 L0 抽象摘要 (~100 tokens)

        Args:
            uri: 资源 URI

        Returns:
            L0 抽象摘要
        """
        encoded_uri = uri.replace("/", "%2F")
        response = await self._request(
            "GET", f"/api/v1/content/abstract?uri={encoded_uri}"
        )
        return response.get("abstract", "")

    async def get_overview(self, uri: str) -> str:
        """
        获取 L1 概要 (~2000 tokens)

        Args:
            uri: 资源 URI

        Returns:
            L1 概要
        """
        encoded_uri = uri.replace("/", "%2F")
        response = await self._request(
            "GET", f"/api/v1/content/overview?uri={encoded_uri}"
        )
        return response.get("overview", "")

    async def read(self, uri: str) -> ContentResult:
        """
        读取完整内容 (L2)

        Args:
            uri: 资源 URI

        Returns:
            完整内容结果
        """
        encoded_uri = uri.replace("/", "%2F")
        response = await self._request(
            "GET", f"/api/v1/content/read?uri={encoded_uri}"
        )

        return ContentResult(
            content=response.get("content", ""),
            abstract=response.get("abstract"),
            overview=response.get("overview"),
            metadata=response.get("metadata", {}),
        )

    # =========================================================================
    # 辅助方法
    # =========================================================================

    async def health_check(self) -> tuple[bool, str]:
        """
        健康检查

        Returns:
            (是否健康, 消息)
        """
        try:
            await self._request("GET", "/health")
            return True, "OK"
        except VikingError as e:
            return False, e.message

    async def find(
        self,
        query: str,
        target_uri: str,
        limit: int = 10,
        mode: str = "hybrid",
        tier: str | None = None,
    ) -> FindResult:
        """
        高级搜索 (返回完整结果集)

        Args:
            query: 搜索查询
            target_uri: 目标 URI
            limit: 最大返回数量
            mode: 搜索模式
            tier: 分层级别过滤 (L0, L1, L2)

        Returns:
            FindResult 结果集
        """
        body: dict[str, Any] = {
            "query": query,
            "target_uri": target_uri,
            "limit": limit,
            "mode": mode,
        }

        if tier:
            body["tier"] = tier

        response = await self._request("POST", "/api/v1/search/find", body)

        memories = self._parse_contexts(response.get("memories", []))
        resources = self._parse_contexts(response.get("resources", []))
        skills = self._parse_contexts(response.get("skills", []))

        return FindResult(
            memories=memories,
            resources=resources,
            skills=skills,
            total=response.get("total", len(memories) + len(resources)),
        )

    async def ls(self, uri: str) -> list[dict[str, Any]]:
        """
        列出目录内容

        Args:
            uri: 目录 URI

        Returns:
            目录项列表
        """
        encoded_uri = uri.replace("/", "%2F")
        response = await self._request(
            "GET", f"/api/v1/fs/ls?uri={encoded_uri}"
        )
        return response.get("items", [])

    # =========================================================================
    # 内部方法
    # =========================================================================

    async def _request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        发送 HTTP 请求 (带重试机制)

        Args:
            method: HTTP 方法
            path: API 路径
            body: 请求体

        Returns:
            响应数据

        Raises:
            VikingError: 请求失败
        """
        client = self._get_client()
        last_error: VikingError | None = None

        for attempt in range(self.config.max_retries):
            try:
                response = await client.request(
                    method,
                    path,
                    json=body if body else None,
                )

                if response.status_code >= 400:
                    raise self._create_error_from_response(response)

                return response.json()

            except httpx.TimeoutException:
                last_error = VikingError(
                    type=VikingErrorType.TIMEOUT,
                    message="Request timeout",
                )

            except httpx.ConnectError as e:
                last_error = VikingError(
                    type=VikingErrorType.CONNECTION,
                    message="Connection failed",
                    original=e,
                )

            except httpx.HTTPStatusError as e:
                last_error = self._create_error_from_response(e.response)

            except VikingError as e:
                last_error = e
                # 不重试认证和未找到错误
                if e.type in (VikingErrorType.AUTH, VikingErrorType.NOT_FOUND):
                    raise e

            # 等待重试 (指数退避)
            if attempt < self.config.max_retries - 1:
                delay = self.config.retry_delay * (2 ** attempt)
                await asyncio.sleep(delay / 1000)

        if last_error:
            raise last_error

        raise VikingError(
            type=VikingErrorType.SERVER,
            message="Max retries exceeded",
        )

    def _create_error_from_response(self, response: httpx.Response) -> VikingError:
        """从 HTTP 响应创建错误"""
        status_code = response.status_code

        if status_code in (401, 403):
            return VikingError(
                type=VikingErrorType.AUTH,
                message="Authentication failed",
                status_code=status_code,
            )

        if status_code == 404:
            return VikingError(
                type=VikingErrorType.NOT_FOUND,
                message="Resource not found",
                status_code=status_code,
            )

        if status_code == 400:
            return VikingError(
                type=VikingErrorType.INVALID,
                message="Invalid request",
                status_code=status_code,
            )

        if status_code == 503:
            return VikingError(
                type=VikingErrorType.SERVER,
                message="Service unavailable",
                status_code=status_code,
            )

        return VikingError(
            type=VikingErrorType.SERVER,
            message=f"Server error: {status_code}",
            status_code=status_code,
        )

    def _parse_find_response(self, response: dict[str, Any]) -> list[SearchResult]:
        """解析搜索响应为 SearchResult 列表"""
        results = []

        for context in response.get("resources", []):
            results.append(self._parse_context(context))

        for context in response.get("memories", []):
            results.append(self._parse_context(context))

        return results

    def _parse_context(self, context: dict[str, Any]) -> SearchResult:
        """解析单个匹配上下文"""
        return SearchResult(
            uri=context.get("uri", ""),
            score=context.get("score", 0.0),
            abstract=context.get("abstract", ""),
            context_type=context.get("context_type", "resource"),
            is_leaf=context.get("is_leaf", True),
            metadata=context.get("metadata", {}),
        )

    def _parse_contexts(self, contexts: list[dict[str, Any]]) -> list[SearchResult]:
        """解析上下文列表"""
        return [self._parse_context(c) for c in contexts]


# =============================================================================
# 单例管理 (兼容旧代码)
# =============================================================================

_client_instance: OpenVikingClient | None = None


def get_client(config: OpenVikingConfig | None = None) -> OpenVikingClient:
    """
    获取单例客户端

    Args:
        config: 配置 (可选)

    Returns:
        OpenVikingClient 实例
    """
    global _client_instance
    if not _client_instance:
        _client_instance = OpenVikingClient(config)
    return _client_instance


def reset_client() -> None:
    """重置单例客户端"""
    global _client_instance
    if _client_instance:
        _client_instance = None