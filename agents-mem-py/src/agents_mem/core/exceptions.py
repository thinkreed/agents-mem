"""
自定义异常模块

定义 agents-mem 项目中使用的所有自定义异常类型。
"""

from typing import Any


class AgentMemError(Exception):
    """基类异常 - 所有 agents-mem 异常的父类"""

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)

    def __str__(self) -> str:
        if self.details:
            details_str = ", ".join(f"{k}={v!r}" for k, v in self.details.items())
            return f"{self.__class__.__name__}({self.message}, {details_str})"
        return f"{self.__class__.__name__}({self.message})"


class ScopeError(AgentMemError):
    """作用域验证错误 - userId/agentId/teamId 验证失败时抛出"""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
        required_fields: list[str] | None = None,
    ):
        if required_fields:
            details = details or {}
            details["required_fields"] = required_fields
        super().__init__(message, details)


class NotFoundError(AgentMemError):
    """资源未找到错误 - 请求的资源不存在时抛出"""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
    ):
        if resource_type or resource_id:
            details = details or {}
            if resource_type:
                details["resource_type"] = resource_type
            if resource_id:
                details["resource_id"] = resource_id
        super().__init__(message, details)


class ValidationError(AgentMemError):
    """数据验证错误 - 数据校验失败时抛出"""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
        field: str | None = None,
        value: Any = None,
    ):
        if field or value is not None:
            details = details or {}
            if field:
                details["field"] = field
            if value is not None:
                details["value"] = value
        super().__init__(message, details)


class URIError(AgentMemError):
    """URI 解析错误 - URI 格式解析或验证失败时抛出"""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
        uri: str | None = None,
        scheme: str | None = None,
    ):
        if uri or scheme:
            details = details or {}
            if uri:
                details["uri"] = uri
            if scheme:
                details["scheme"] = scheme
        super().__init__(message, details)


class SearchError(AgentMemError):
    """搜索错误 - 搜索操作失败时抛出"""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
        query: str | None = None,
        search_mode: str | None = None,
    ):
        if query or search_mode:
            details = details or {}
            if query:
                details["query"] = query
            if search_mode:
                details["search_mode"] = search_mode
        super().__init__(message, details)


class ExportError(AgentMemError):
    """导出错误 - 数据导出操作失败时抛出"""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
        export_format: str | None = None,
        resource_count: int | None = None,
    ):
        if export_format or resource_count is not None:
            details = details or {}
            if export_format:
                details["export_format"] = export_format
            if resource_count is not None:
                details["resource_count"] = resource_count
        super().__init__(message, details)
