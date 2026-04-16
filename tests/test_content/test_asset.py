"""
Tests for content.resources.asset module.

Tests AssetRepository, Asset, AssetCreateInput, AssetUpdateInput.
"""

import pytest
import pytest_asyncio
from typing import Any, Protocol

from agents_mem.core.types import Scope
from agents_mem.content.resources.asset import (
    Asset,
    AssetCreateInput,
    AssetUpdateInput,
    AssetRepository,
)
from agents_mem.content.capabilities.tiered import TieredViewCapability
from agents_mem.llm import MockLLMClient


class MockDBConnection:
    """Mock database"""
    
    def __init__(self):
        self._assets: dict[str, dict] = {}
    
    async def run(self, sql: str, params: list | None = None):
        if "INSERT INTO assets" in sql:
            asset_id = params[0] if params else ""
            self._assets[asset_id] = {
                "id": asset_id,
                "user_id": params[1] if len(params) > 1 else "",
                "filename": params[4] if len(params) > 4 else "",
                "file_type": params[5] if len(params) > 5 else "",
            }
        return None
    
    async def query(self, sql: str, params: list | None = None):
        return list(self._assets.values())
    
    async def query_one(self, sql: str, params: list | None = None):
        if "assets" in sql and ("WHERE id =" in sql or "WHERE id=" in sql):
            asset_id = params[0] if params else ""
            return self._assets.get(asset_id)
        return None


@pytest.fixture
def mock_db():
    return MockDBConnection()


@pytest.fixture
def tiered():
    return TieredViewCapability(MockLLMClient())


@pytest.fixture
def asset_repo(mock_db, tiered):
    return AssetRepository(mock_db, tiered)


@pytest.fixture
def sample_scope():
    return Scope(user_id="user123")


class TestAsset:
    """Asset model tests"""
    
    def test_asset_creation(self):
        """Test creating asset"""
        asset = Asset(
            id="asset-001",
            user_id="user123",
            filename="test.pdf",
            file_type="pdf",
        )
        assert asset.id == "asset-001"
        assert asset.filename == "test.pdf"
        assert asset.file_type == "pdf"
    
    def test_asset_uri(self):
        """Test URI generation"""
        asset = Asset(
            id="asset-001",
            user_id="user123",
            filename="test.pdf",
            file_type="pdf",
        )
        uri = asset.uri
        assert uri.startswith("mem://")
        assert "assets" in uri
    
    def test_asset_defaults(self):
        """Test default values"""
        asset = Asset(
            id="asset-001",
            user_id="user123",
            filename="test.pdf",
            file_type="pdf",
        )
        assert asset.is_global is False
        assert asset.text_extracted is False
        assert asset.metadata == {}
    
    def test_asset_with_content(self):
        """Test asset with extracted text"""
        asset = Asset(
            id="asset-001",
            user_id="user123",
            filename="test.pdf",
            file_type="pdf",
            extracted_text="Extracted content",
            text_extracted=True,
        )
        assert asset.extracted_text == "Extracted content"
        assert asset.text_extracted is True


class TestAssetCreateInput:
    """AssetCreateInput tests"""
    
    def test_create_input_required(self):
        """Test required fields"""
        input = AssetCreateInput(
            filename="test.pdf",
            file_type="pdf",
        )
        assert input.filename == "test.pdf"
        assert input.file_type == "pdf"
    
    def test_create_input_defaults(self):
        """Test default values"""
        input = AssetCreateInput(
            filename="test.pdf",
            file_type="pdf",
        )
        assert input.file_size is None
        assert input.source_url is None
    
    def test_create_input_custom(self):
        """Test custom values"""
        input = AssetCreateInput(
            filename="test.pdf",
            file_type="pdf",
            file_size=1024,
            title="Test Asset",
            description="Description",
        )
        assert input.file_size == 1024
        assert input.title == "Test Asset"


class TestAssetUpdateInput:
    """AssetUpdateInput tests"""
    
    def test_update_input_defaults(self):
        """Test all fields optional"""
        input = AssetUpdateInput()
        assert input.title is None
        assert input.description is None
    
    def test_update_input_custom(self):
        """Test custom values"""
        input = AssetUpdateInput(
            title="New Title",
            extracted_text="New text",
        )
        assert input.title == "New Title"
        assert input.extracted_text == "New text"


class TestAssetRepository:
    """AssetRepository tests"""
    
    def test_initialization(self, mock_db, tiered):
        """Test initialization"""
        repo = AssetRepository(mock_db, tiered)
        assert repo._db == mock_db
        assert repo._tiered == tiered
    
    @pytest.mark.asyncio
    async def test_create(self, asset_repo, sample_scope):
        """Test creating asset"""
        input = AssetCreateInput(
            filename="test.pdf",
            file_type="pdf",
            title="Test Asset",
        )
        asset = await asset_repo.create(sample_scope, input)
        
        assert asset.filename == "test.pdf"
        assert asset.user_id == "user123"
    
    @pytest.mark.asyncio
    async def test_get(self, asset_repo, sample_scope, mock_db):
        """Test getting asset"""
        input = AssetCreateInput(filename="test.pdf", file_type="pdf")
        asset = await asset_repo.create(sample_scope, input)
        
        result = await asset_repo.get(sample_scope, asset.id)
        assert result is not None
    
    @pytest.mark.asyncio
    async def test_get_nonexistent(self, asset_repo, sample_scope):
        """Test getting nonexistent"""
        result = await asset_repo.get(sample_scope, "nonexistent")
        assert result is None
    
    @pytest.mark.asyncio
    async def test_update(self, asset_repo, sample_scope, mock_db):
        """Test updating asset"""
        input = AssetCreateInput(filename="test.pdf", file_type="pdf", title="Original")
        asset = await asset_repo.create(sample_scope, input)
        
        update_input = AssetUpdateInput(title="Updated")
        updated = await asset_repo.update(sample_scope, asset.id, update_input)
        assert updated.title == "Updated"
    
    @pytest.mark.asyncio
    async def test_delete(self, asset_repo, sample_scope, mock_db):
        """Test deleting asset"""
        input = AssetCreateInput(filename="test.pdf", file_type="pdf")
        asset = await asset_repo.create(sample_scope, input)
        
        deleted = await asset_repo.delete(sample_scope, asset.id)
        assert deleted is True
    
    @pytest.mark.asyncio
    async def test_list(self, asset_repo, sample_scope):
        """Test listing assets"""
        input = AssetCreateInput(filename="test.pdf", file_type="pdf")
        await asset_repo.create(sample_scope, input)
        
        assets = await asset_repo.list(sample_scope)
        assert len(assets) >= 1
    
    @pytest.mark.asyncio
    async def test_search(self, asset_repo, sample_scope):
        """Test searching assets"""
        input = AssetCreateInput(
            filename="python_guide.pdf",
            file_type="pdf",
            title="Python Guide",
        )
        await asset_repo.create(sample_scope, input)
        
        results = await asset_repo.search(sample_scope, "Python", "fts", 10)
        assert isinstance(results, list)