"""
OpenViking Client Tests

测试 HTTP 客户端的基本功能。
使用 httpx mock 进行测试。
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from agents_mem.openviking.client import (
    AddResourceResult,
    ContentResult,
    FindResult,
    OpenVikingClient,
    OpenVikingConfig,
    SearchResult,
    VikingError,
    VikingErrorType,
)


class TestOpenVikingConfig:
    """测试配置类"""

    def test_default_config(self):
        """默认配置"""
        config = OpenVikingConfig()
        assert config.enabled == True
        assert config.base_url == "http://localhost:1933"
        assert config.timeout == 30000
        assert config.max_retries == 3
        assert config.retry_delay == 100

    def test_custom_config(self):
        """自定义配置"""
        config = OpenVikingConfig(
            base_url="http://custom:8080",
            api_key="test-key",
            timeout=10000,
        )
        assert config.base_url == "http://custom:8080"
        assert config.api_key == "test-key"
        assert config.timeout == 10000


class TestSearchResult:
    """测试搜索结果"""

    def test_default_values(self):
        """默认值"""
        result = SearchResult(uri="test://uri", score=0.5)
        assert result.uri == "test://uri"
        assert result.score == 0.5
        assert result.abstract == ""
        assert result.context_type == "resource"

    def test_full_values(self):
        """完整值"""
        result = SearchResult(
            uri="test://uri",
            score=0.9,
            abstract="摘要",
            context_type="memory",
            metadata={"key": "value"},
        )
        assert result.abstract == "摘要"
        assert result.context_type == "memory"
        assert result.metadata["key"] == "value"


class TestVikingError:
    """测试错误类"""

    def test_error_str(self):
        """错误字符串"""
        error = VikingError(
            type=VikingErrorType.CONNECTION,
            message="连接失败",
        )
        assert "connection" in str(error)
        assert "连接失败" in str(error)

    def test_error_with_status(self):
        """带状态码的错误"""
        error = VikingError(
            type=VikingErrorType.AUTH,
            message="认证失败",
            status_code=401,
        )
        assert "401" in str(error)


class TestOpenVikingClient:
    """测试客户端"""

    def test_client_init(self):
        """客户端初始化"""
        config = OpenVikingConfig()
        client = OpenVikingClient(config)
        assert client.config == config
        assert client._client is None

    def test_build_headers_no_key(self):
        """无 API Key 的请求头"""
        config = OpenVikingConfig()
        client = OpenVikingClient(config)
        headers = client._build_headers()
        assert "Content-Type" in headers
        assert "Authorization" not in headers

    def test_build_headers_with_key(self):
        """有 API Key 的请求头"""
        config = OpenVikingConfig(api_key="test-key")
        client = OpenVikingClient(config)
        headers = client._build_headers()
        assert headers["Authorization"] == "Bearer test-key"

    @pytest.mark.asyncio
    async def test_context_manager(self):
        """异步上下文管理器"""
        config = OpenVikingConfig()
        client = OpenVikingClient(config)

        async with client as c:
            assert c._client is not None

        assert client._client is None

    @pytest.mark.asyncio
    async def test_close(self):
        """关闭客户端"""
        config = OpenVikingConfig()
        client = OpenVikingClient(config)

        # 手动获取客户端
        _ = client._get_client()
        assert client._client is not None

        await client.close()
        assert client._client is None


class TestClientMethods:
    """测试客户端方法 (mock)"""

    @pytest.mark.asyncio
    async def test_search_mock(self):
        """搜索方法 (mock)"""
        config = OpenVikingConfig()
        client = OpenVikingClient(config)

        # Mock _request 方法
        client._request = AsyncMock(return_value={
            "resources": [
                {"uri": "viking://test/1", "score": 0.9, "abstract": "摘要"}
            ],
            "memories": [],
            "total": 1,
        })

        results = await client.search("query", "viking://target", limit=10)

        assert len(results) == 1
        assert results[0].uri == "viking://test/1"
        assert results[0].score == 0.9

    @pytest.mark.asyncio
    async def test_index_mock(self):
        """索引方法 (mock)"""
        config = OpenVikingConfig()
        client = OpenVikingClient(config)

        client._request = AsyncMock(return_value={
            "root_uri": "viking://test/1",
            "task_id": "task-123",
            "status": "pending",
        })

        result = await client.index(
            "viking://target",
            embedding=[0.1] * 1024,
            metadata={"title": "test"},
        )

        assert result.root_uri == "viking://test/1"
        assert result.task_id == "task-123"

    @pytest.mark.asyncio
    async def test_delete_mock(self):
        """删除方法 (mock)"""
        config = OpenVikingConfig()
        client = OpenVikingClient(config)

        client._request = AsyncMock(return_value={"success": True})

        result = await client.delete("viking://test/1")

        assert result == True

    @pytest.mark.asyncio
    async def test_get_abstract_mock(self):
        """获取摘要 (mock)"""
        config = OpenVikingConfig()
        client = OpenVikingClient(config)

        client._request = AsyncMock(return_value={"abstract": "L0摘要"})

        result = await client.get_abstract("viking://test/1")

        assert result == "L0摘要"

    @pytest.mark.asyncio
    async def test_get_overview_mock(self):
        """获取概要 (mock)"""
        config = OpenVikingConfig()
        client = OpenVikingClient(config)

        client._request = AsyncMock(return_value={"overview": "L1概要"})

        result = await client.get_overview("viking://test/1")

        assert result == "L1概要"

    @pytest.mark.asyncio
    async def test_read_mock(self):
        """读取内容 (mock)"""
        config = OpenVikingConfig()
        client = OpenVikingClient(config)

        client._request = AsyncMock(return_value={
            "content": "完整内容",
            "abstract": "L0",
            "overview": "L1",
            "metadata": {"size": 100},
        })

        result = await client.read("viking://test/1")

        assert result.content == "完整内容"
        assert result.abstract == "L0"
        assert result.overview == "L1"

    @pytest.mark.asyncio
    async def test_health_check_ok(self):
        """健康检查成功"""
        config = OpenVikingConfig()
        client = OpenVikingClient(config)

        client._request = AsyncMock(return_value={"status": "ok"})

        ok, msg = await client.health_check()

        assert ok == True
        assert msg == "OK"

    @pytest.mark.asyncio
    async def test_health_check_fail(self):
        """健康检查失败"""
        config = OpenVikingConfig()
        client = OpenVikingClient(config)

        client._request = AsyncMock(
            side_effect=VikingError(
                type=VikingErrorType.CONNECTION,
                message="连接失败",
            )
        )

        ok, msg = await client.health_check()

        assert ok == False
        assert "连接失败" in msg


class TestErrorHandling:
    """测试错误处理"""

    def test_create_error_auth(self):
        """创建认证错误"""
        client = OpenVikingClient()
        mock_response = MagicMock(status_code=401)

        error = client._create_error_from_response(mock_response)

        assert error.type == VikingErrorType.AUTH
        assert error.status_code == 401

    def test_create_error_not_found(self):
        """创建未找到错误"""
        client = OpenVikingClient()
        mock_response = MagicMock(status_code=404)

        error = client._create_error_from_response(mock_response)

        assert error.type == VikingErrorType.NOT_FOUND

    def test_create_error_server(self):
        """创建服务器错误"""
        client = OpenVikingClient()
        mock_response = MagicMock(status_code=503)

        error = client._create_error_from_response(mock_response)

        assert error.type == VikingErrorType.SERVER