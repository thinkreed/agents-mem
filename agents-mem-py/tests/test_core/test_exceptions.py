"""
Tests for core.exceptions module.

Tests all custom exception classes:
- AgentMemError (base)
- ScopeError
- NotFoundError
- ValidationError
- URIError
- SearchError
- ExportError
"""

import pytest

from agents_mem.core.exceptions import (
    AgentMemError,
    ScopeError,
    NotFoundError,
    ValidationError,
    URIError,
    SearchError,
    ExportError,
)


class TestAgentMemError:
    """Base exception tests."""

    def test_basic_creation(self):
        """Test basic error creation."""
        error = AgentMemError("Something went wrong")
        assert error.message == "Something went wrong"
        assert str(error) == "AgentMemError(Something went wrong)"

    def test_error_with_details(self):
        """Test error with details."""
        error = AgentMemError(
            "Validation failed",
            details={"field": "title", "value": ""},
        )
        assert error.message == "Validation failed"
        assert error.details["field"] == "title"
        # Using !r format, so strings are quoted
        assert "field='title'" in str(error)

    def test_error_details_default(self):
        """Test error details default to empty dict."""
        error = AgentMemError("Error")
        assert error.details == {}

    def test_error_inheritance(self):
        """Test error inherits from Exception."""
        error = AgentMemError("Test")
        assert isinstance(error, Exception)

    def test_error_can_be_raised(self):
        """Test error can be raised."""
        with pytest.raises(AgentMemError) as exc_info:
            raise AgentMemError("Raised error")
        assert exc_info.value.message == "Raised error"


class TestScopeError:
    """ScopeError tests."""

    def test_basic_creation(self):
        """Test basic ScopeError creation."""
        error = ScopeError("Invalid scope")
        assert error.message == "Invalid scope"
        assert isinstance(error, AgentMemError)

    def test_with_required_fields(self):
        """Test ScopeError with required fields."""
        error = ScopeError(
            "Missing required fields",
            required_fields=["user_id", "agent_id"],
        )
        assert error.details["required_fields"] == ["user_id", "agent_id"]

    def test_with_details_and_required_fields(self):
        """Test ScopeError with both details and required_fields."""
        error = ScopeError(
            "Validation failed",
            details={"extra": "info"},
            required_fields=["user_id"],
        )
        assert error.details["required_fields"] == ["user_id"]
        assert error.details["extra"] == "info"

    def test_required_fields_merged_into_details(self):
        """Test required_fields are merged into details."""
        error = ScopeError("Error", required_fields=["user_id"])
        assert "required_fields" in error.details


class TestNotFoundError:
    """NotFoundError tests."""

    def test_basic_creation(self):
        """Test basic NotFoundError creation."""
        error = NotFoundError("Resource not found")
        assert error.message == "Resource not found"
        assert isinstance(error, AgentMemError)

    def test_with_resource_type(self):
        """Test NotFoundError with resource type."""
        error = NotFoundError(
            "Document not found",
            resource_type="document",
        )
        assert error.details["resource_type"] == "document"

    def test_with_resource_id(self):
        """Test NotFoundError with resource id."""
        error = NotFoundError(
            "Not found",
            resource_id="doc-001",
        )
        assert error.details["resource_id"] == "doc-001"

    def test_with_both_resource_info(self):
        """Test NotFoundError with both resource type and id."""
        error = NotFoundError(
            "Document not found",
            resource_type="document",
            resource_id="doc-001",
        )
        assert error.details["resource_type"] == "document"
        assert error.details["resource_id"] == "doc-001"


class TestValidationError:
    """ValidationError tests."""

    def test_basic_creation(self):
        """Test basic ValidationError creation."""
        error = ValidationError("Invalid input")
        assert error.message == "Invalid input"
        assert isinstance(error, AgentMemError)

    def test_with_field(self):
        """Test ValidationError with field."""
        error = ValidationError(
            "Field is required",
            field="title",
        )
        assert error.details["field"] == "title"

    def test_with_value(self):
        """Test ValidationError with value."""
        error = ValidationError(
            "Invalid value",
            field="count",
            value=-1,
        )
        assert error.details["field"] == "count"
        assert error.details["value"] == -1

    def test_with_details(self):
        """Test ValidationError with details."""
        error = ValidationError(
            "Invalid",
            details={"constraint": "must be positive"},
            field="count",
            value=-1,
        )
        assert error.details["constraint"] == "must be positive"
        assert error.details["field"] == "count"


class TestURIError:
    """URIError tests."""

    def test_basic_creation(self):
        """Test basic URIError creation."""
        error = URIError("Invalid URI format")
        assert error.message == "Invalid URI format"
        assert isinstance(error, AgentMemError)

    def test_with_uri(self):
        """Test URIError with uri."""
        error = URIError(
            "Cannot parse URI",
            uri="invalid://uri",
        )
        assert error.details["uri"] == "invalid://uri"

    def test_with_scheme(self):
        """Test URIError with scheme."""
        error = URIError(
            "Unsupported scheme",
            scheme="http",
        )
        assert error.details["scheme"] == "http"

    def test_with_both_uri_and_scheme(self):
        """Test URIError with both uri and scheme."""
        error = URIError(
            "Error",
            uri="http://example.com",
            scheme="http",
        )
        assert error.details["uri"] == "http://example.com"
        assert error.details["scheme"] == "http"


class TestSearchError:
    """SearchError tests."""

    def test_basic_creation(self):
        """Test basic SearchError creation."""
        error = SearchError("Search failed")
        assert error.message == "Search failed"
        assert isinstance(error, AgentMemError)

    def test_with_query(self):
        """Test SearchError with query."""
        error = SearchError(
            "Query too long",
            query="a very long query...",
        )
        assert error.details["query"] == "a very long query..."

    def test_with_search_mode(self):
        """Test SearchError with search mode."""
        error = SearchError(
            "Unsupported mode",
            search_mode="invalid_mode",
        )
        assert error.details["search_mode"] == "invalid_mode"

    def test_with_both_query_and_mode(self):
        """Test SearchError with both query and mode."""
        error = SearchError(
            "Search error",
            query="test",
            search_mode="fts",
        )
        assert error.details["query"] == "test"
        assert error.details["search_mode"] == "fts"


class TestExportError:
    """ExportError tests."""

    def test_basic_creation(self):
        """Test basic ExportError creation."""
        error = ExportError("Export failed")
        assert error.message == "Export failed"
        assert isinstance(error, AgentMemError)

    def test_with_export_format(self):
        """Test ExportError with export format."""
        error = ExportError(
            "Unsupported format",
            export_format="pdf",
        )
        assert error.details["export_format"] == "pdf"

    def test_with_resource_count(self):
        """Test ExportError with resource count."""
        error = ExportError(
            "Too many resources",
            resource_count=10000,
        )
        assert error.details["resource_count"] == 10000

    def test_with_both_format_and_count(self):
        """Test ExportError with both format and count."""
        error = ExportError(
            "Error",
            export_format="markdown",
            resource_count=50,
        )
        assert error.details["export_format"] == "markdown"
        assert error.details["resource_count"] == 50


class TestExceptionHierarchy:
    """Test exception inheritance hierarchy."""

    def test_all_inherit_from_base(self):
        """Test all exceptions inherit from AgentMemError."""
        exceptions = [
            ScopeError("test"),
            NotFoundError("test"),
            ValidationError("test"),
            URIError("test"),
            SearchError("test"),
            ExportError("test"),
        ]
        for exc in exceptions:
            assert isinstance(exc, AgentMemError)
            assert isinstance(exc, Exception)

    def test_can_catch_with_base_class(self):
        """Test can catch all with base class."""
        errors_to_raise = [
            ScopeError("scope"),
            NotFoundError("not found"),
            ValidationError("validation"),
        ]
        
        for error in errors_to_raise:
            with pytest.raises(AgentMemError):
                raise error


class TestExceptionStrFormat:
    """Test exception string formatting."""

    def test_format_without_details(self):
        """Test format without details."""
        error = AgentMemError("Simple error")
        assert str(error) == "AgentMemError(Simple error)"

    def test_format_with_details(self):
        """Test format with details."""
        error = AgentMemError(
            "Error with details",
            details={"key1": "value1", "key2": 123},
        )
        # Format: ErrorName(message, key1='value1', key2=123)
        assert "Error with details" in str(error)
        assert "key1='value1'" in str(error)
        assert "key2=123" in str(error)

    def test_subclass_format(self):
        """Test subclass format includes class name."""
        error = ScopeError("Invalid scope", required_fields=["user_id"])
        assert "ScopeError" in str(error)
        assert "Invalid scope" in str(error)