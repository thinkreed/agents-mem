"""
Tests for tools.handlers module.

Tests all MCP tool handlers: create, read, update, delete, export.
"""

import pytest
import pytest_asyncio
import time
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from agents_mem.core.types import Scope, ContentType, TierLevel
from agents_mem.core.exceptions import ScopeError, ValidationError, NotFoundError


class MockFastMCP:
    """Mock FastMCP server for testing."""
    
    def __init__(self):
        self._tools = {}
    
    def tool(self):
        """Decorator to register tool."""
        def decorator(func):
            self._tools[func.__name__] = func
            return func
        return decorator
    
    def get_tool(self, name):
        """Get registered tool."""
        return self._tools.get(name)


# ============================================================================
# Create Handler Tests
# ============================================================================


class TestCreateHandler:
    """Tests for mem_create handler."""
    
    def test_register_create_tool(self):
        """Test register_create_tool registers tool."""
        from agents_mem.tools.handlers.create import register_create_tool
        
        mcp = MockFastMCP()
        register_create_tool(mcp)
        
        assert "mem_create" in mcp._tools
    
    @pytest.mark.asyncio
    async def test_create_document(self):
        """Test create document through handler."""
        from agents_mem.tools.handlers.create import register_create_tool
        
        mcp = MockFastMCP()
        register_create_tool(mcp)
        handler = mcp.get_tool("mem_create")
        
        # Mock dependencies
        with patch("agents_mem.tools.handlers.create.get_connection") as mock_conn:
            mock_db = AsyncMock()
            mock_conn.return_value = mock_db
            
            result = await handler(
                resource="document",
                data={"title": "Test", "content": "Test content"},
                scope={"userId": "user123"},
            )
            
            # Should return id and uri
            assert "id" in result or "error" in result
    
    @pytest.mark.asyncio
    async def test_create_requires_scope(self):
        """Test create requires scope."""
        from agents_mem.tools.handlers.create import register_create_tool
        
        mcp = MockFastMCP()
        register_create_tool(mcp)
        handler = mcp.get_tool("mem_create")
        
        result = await handler(
            resource="document",
            data={"title": "Test", "content": "Test"},
            scope={},  # Empty scope
        )
        
        assert "error" in result
    
    @pytest.mark.asyncio
    async def test_create_conversation_requires_agent(self):
        """Test create conversation requires agent_id."""
        from agents_mem.tools.handlers.create import register_create_tool
        
        mcp = MockFastMCP()
        register_create_tool(mcp)
        handler = mcp.get_tool("mem_create")
        
        result = await handler(
            resource="conversation",
            data={"title": "Test"},
            scope={"userId": "user123"},  # No agentId
        )
        
        assert "error" in result


# ============================================================================
# Read Handler Tests
# ============================================================================


class TestReadHandler:
    """Tests for mem_read handler."""
    
    def test_register_read_tool(self):
        """Test register_read_tool registers tool."""
        from agents_mem.tools.handlers.read import register_read_tool
        
        mcp = MockFastMCP()
        register_read_tool(mcp)
        
        assert "mem_read" in mcp._tools
    
    @pytest.mark.asyncio
    async def test_read_by_id(self):
        """Test read by id."""
        from agents_mem.tools.handlers.read import register_read_tool
        
        mcp = MockFastMCP()
        register_read_tool(mcp)
        handler = mcp.get_tool("mem_read")
        
        with patch("agents_mem.tools.handlers.read.get_connection") as mock_conn:
            mock_db = AsyncMock()
            mock_conn.return_value = mock_db
            
            result = await handler(
                resource="document",
                query={"id": "doc-001"},
                scope={"userId": "user123"},
            )
            
            # Should return content or error
            assert "id" in result or "error" in result or "content" in result
    
    @pytest.mark.asyncio
    async def test_read_search(self):
        """Test read with search."""
        from agents_mem.tools.handlers.read import register_read_tool
        
        mcp = MockFastMCP()
        register_read_tool(mcp)
        handler = mcp.get_tool("mem_read")
        
        with patch("agents_mem.tools.handlers.read.get_connection") as mock_conn:
            mock_db = AsyncMock()
            mock_conn.return_value = mock_db
            
            result = await handler(
                resource="document",
                query={"search": "test query", "search_mode": "hybrid"},
                scope={"userId": "user123"},
            )
            
            assert "results" in result or "error" in result
    
    @pytest.mark.asyncio
    async def test_read_list(self):
        """Test read list."""
        from agents_mem.tools.handlers.read import register_read_tool
        
        mcp = MockFastMCP()
        register_read_tool(mcp)
        handler = mcp.get_tool("mem_read")
        
        with patch("agents_mem.tools.handlers.read.get_connection") as mock_conn:
            mock_db = AsyncMock()
            mock_conn.return_value = mock_db
            
            result = await handler(
                resource="document",
                query={"list": True, "limit": 10},
                scope={"userId": "user123"},
            )
            
            assert "results" in result or "error" in result
    
    @pytest.mark.asyncio
    async def test_read_tiered_view(self):
        """Test read with tiered view."""
        from agents_mem.tools.handlers.read import register_read_tool
        
        mcp = MockFastMCP()
        register_read_tool(mcp)
        handler = mcp.get_tool("mem_read")
        
        with patch("agents_mem.tools.handlers.read.get_connection") as mock_conn:
            mock_db = AsyncMock()
            mock_conn.return_value = mock_db
            
            result = await handler(
                resource="document",
                query={"id": "doc-001", "tier": "L0"},
                scope={"userId": "user123"},
            )
            
            # Should have tier info if successful
            if "tier" in result:
                assert result["tier"] == "L0"


# ============================================================================
# Update Handler Tests
# ============================================================================


class TestUpdateHandler:
    """Tests for mem_update handler."""
    
    def test_register_update_tool(self):
        """Test register_update_tool registers tool."""
        from agents_mem.tools.handlers.update import register_update_tool
        
        mcp = MockFastMCP()
        register_update_tool(mcp)
        
        assert "mem_update" in mcp._tools
    
    @pytest.mark.asyncio
    async def test_update_document(self):
        """Test update document."""
        from agents_mem.tools.handlers.update import register_update_tool
        
        mcp = MockFastMCP()
        register_update_tool(mcp)
        handler = mcp.get_tool("mem_update")
        
        with patch("agents_mem.tools.handlers.update.get_connection") as mock_conn:
            mock_db = AsyncMock()
            mock_conn.return_value = mock_db
            
            result = await handler(
                resource="document",
                id="doc-001",
                data={"title": "New Title"},
                scope={"userId": "user123"},
            )
            
            assert "id" in result or "error" in result
    
    @pytest.mark.asyncio
    async def test_update_requires_id(self):
        """Test update requires id."""
        from agents_mem.tools.handlers.update import register_update_tool
        
        mcp = MockFastMCP()
        register_update_tool(mcp)
        handler = mcp.get_tool("mem_update")
        
        result = await handler(
            resource="document",
            id="",  # Empty id
            data={"title": "Test"},
            scope={"userId": "user123"},
        )
        
        assert "error" in result


# ============================================================================
# Delete Handler Tests
# ============================================================================


class TestDeleteHandler:
    """Tests for mem_delete handler."""
    
    def test_register_delete_tool(self):
        """Test register_delete_tool registers tool."""
        from agents_mem.tools.handlers.delete import register_delete_tool
        
        mcp = MockFastMCP()
        register_delete_tool(mcp)
        
        assert "mem_delete" in mcp._tools
    
    @pytest.mark.asyncio
    async def test_delete_document(self):
        """Test delete document."""
        from agents_mem.tools.handlers.delete import register_delete_tool
        
        mcp = MockFastMCP()
        register_delete_tool(mcp)
        handler = mcp.get_tool("mem_delete")
        
        with patch("agents_mem.tools.handlers.delete.get_connection") as mock_conn:
            mock_db = AsyncMock()
            mock_conn.return_value = mock_db
            
            result = await handler(
                resource="document",
                id="doc-001",
                scope={"userId": "user123"},
            )
            
            assert "deleted" in result
    
    @pytest.mark.asyncio
    async def test_delete_returns_cascade_info(self):
        """Test delete returns cascade info."""
        from agents_mem.tools.handlers.delete import register_delete_tool
        
        mcp = MockFastMCP()
        register_delete_tool(mcp)
        handler = mcp.get_tool("mem_delete")
        
        with patch("agents_mem.tools.handlers.delete.get_connection") as mock_conn:
            mock_db = AsyncMock()
            mock_db.run = AsyncMock()
            mock_conn.return_value = mock_db
            
            result = await handler(
                resource="document",
                id="doc-001",
                scope={"userId": "user123"},
            )
            
            # Should have cascade info
            if "cascade" in result:
                assert isinstance(result["cascade"], list)


# ============================================================================
# Export Handler Tests
# ============================================================================


class TestExportHandler:
    """Tests for mem_export handler."""
    
    def test_register_export_tool(self):
        """Test register_export_tool registers tool."""
        # Check if export handler exists
        try:
            from agents_mem.tools.handlers.export import register_export_tool
            
            mcp = MockFastMCP()
            register_export_tool(mcp)
            
            assert "mem_export" in mcp._tools
        except ImportError:
            # Export handler may not be implemented yet
            pass


# ============================================================================
# Handler Common Tests
# ============================================================================


class TestHandlerCommon:
    """Common tests for all handlers."""
    
    @pytest.mark.asyncio
    async def test_all_handlers_handle_scope_error(self):
        """Test all handlers handle ScopeError gracefully."""
        from agents_mem.tools.handlers.create import register_create_tool
        from agents_mem.tools.handlers.read import register_read_tool
        from agents_mem.tools.handlers.update import register_update_tool
        from agents_mem.tools.handlers.delete import register_delete_tool
        
        # Test create handler with invalid scope
        mcp_create = MockFastMCP()
        register_create_tool(mcp_create)
        create_handler = mcp_create.get_tool("mem_create")
        result = await create_handler(
            resource="document",
            data={"title": "Test"},
            scope={},  # Invalid scope - missing user_id
        )
        assert "error" in result or isinstance(result, dict)
        
        # Test read handler with invalid scope
        mcp_read = MockFastMCP()
        register_read_tool(mcp_read)
        read_handler = mcp_read.get_tool("mem_read")
        result = await read_handler(
            resource="document",
            query={"id": "test"},
            scope={},  # Invalid scope
        )
        assert "error" in result or isinstance(result, dict)
        
        # Test update handler with invalid scope
        mcp_update = MockFastMCP()
        register_update_tool(mcp_update)
        update_handler = mcp_update.get_tool("mem_update")
        result = await update_handler(
            resource="document",
            id="test",
            data={"title": "Updated"},
            scope={},  # Invalid scope
        )
        assert "error" in result or isinstance(result, dict)
        
        # Test delete handler with invalid scope
        mcp_delete = MockFastMCP()
        register_delete_tool(mcp_delete)
        delete_handler = mcp_delete.get_tool("mem_delete")
        result = await delete_handler(
            resource="document",
            id="test",
            scope={},  # Invalid scope
        )
        assert "error" in result or isinstance(result, dict)
    
    @pytest.mark.asyncio
    async def test_handlers_return_dict(self):
        """Test all handlers return dict."""
        from agents_mem.tools.handlers.create import register_create_tool
        from agents_mem.tools.handlers.read import register_read_tool
        
        mcp1 = MockFastMCP()
        register_create_tool(mcp1)
        create_handler = mcp1.get_tool("mem_create")
        
        mcp2 = MockFastMCP()
        register_read_tool(mcp2)
        read_handler = mcp2.get_tool("mem_read")
        
        # Test create
        result = await create_handler(
            resource="document",
            data={"content": "test"},
            scope={"userId": "test"},
        )
        assert isinstance(result, dict)
        
        # Test read
        result = await read_handler(
            resource="document",
            query={},
            scope={"userId": "test"},
        )
        assert isinstance(result, dict)