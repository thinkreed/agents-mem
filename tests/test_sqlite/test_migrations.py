"""
Tests for sqlite.migrations module.

Tests MigrationManager, MigrationStatus, MigrationRecord.
"""

import pytest
import pytest_asyncio

from agents_mem.sqlite.migrations import (
    MigrationManager,
    MigrationStatus,
    MigrationRecord,
    MIGRATION_HISTORY_TABLE,
    CREATE_MIGRATION_HISTORY,
    get_manager,
    reset_manager,
    run_migrations,
    get_migration_status,
    get_current_version,
    is_migration_needed,
)
from agents_mem.sqlite.connection import DatabaseConnection
from agents_mem.sqlite.schema import SCHEMA_VERSION


@pytest_asyncio.fixture
async def db_connection():
    """Create in-memory database connection"""
    db = DatabaseConnection(db_path=":memory:")
    await db.connect()
    yield db
    await db.close()


@pytest_asyncio.fixture
async def migration_manager(db_connection):
    """Create migration manager"""
    return MigrationManager(db_connection)


class TestMigrationStatus:
    """MigrationStatus tests"""
    
    def test_migration_status_creation(self):
        """Test creating migration status"""
        status = MigrationStatus(
            current_version=1,
            target_version=2,
            needed=True,
            applied_migrations=[1],
        )
        assert status.current_version == 1
        assert status.target_version == 2
        assert status.needed is True
        assert status.applied_migrations == [1]
    
    def test_migration_status_no_migration_needed(self):
        """Test status when no migration needed"""
        status = MigrationStatus(
            current_version=2,
            target_version=2,
            needed=False,
            applied_migrations=[1, 2],
        )
        assert status.needed is False


class TestMigrationRecord:
    """MigrationRecord tests"""
    
    def test_migration_record_creation(self):
        """Test creating migration record"""
        record = MigrationRecord(
            version=1,
            applied_at=1700000000.0,
            description="Initial schema",
        )
        assert record.version == 1
        assert record.applied_at == 1700000000.0
        assert record.description == "Initial schema"
    
    def test_migration_record_no_description(self):
        """Test record without description"""
        record = MigrationRecord(
            version=1,
            applied_at=1700000000.0,
        )
        assert record.description is None


class TestMigrationManager:
    """MigrationManager tests"""
    
    @pytest.mark.asyncio
    async def test_init(self, migration_manager):
        """Test initialization"""
        await migration_manager.init()
        # Should create migration_history table
    
    @pytest.mark.asyncio
    async def test_get_current_version_empty(self, migration_manager):
        """Test getting version when no migrations"""
        version = await migration_manager.get_current_version()
        assert version == 0
    
    @pytest.mark.asyncio
    async def test_get_current_version_after_migration(self, migration_manager):
        """Test getting version after migration"""
        await migration_manager.init()
        await migration_manager.run_migrations()
        
        version = await migration_manager.get_current_version()
        assert version == SCHEMA_VERSION
    
    @pytest.mark.asyncio
    async def test_is_migration_needed_initial(self, migration_manager):
        """Test migration needed initially"""
        needed = await migration_manager.is_migration_needed()
        assert needed is True
    
    @pytest.mark.asyncio
    async def test_is_migration_needed_after_run(self, migration_manager):
        """Test migration not needed after run"""
        await migration_manager.run_migrations()
        needed = await migration_manager.is_migration_needed()
        assert needed is False
    
    @pytest.mark.asyncio
    async def test_get_status(self, migration_manager):
        """Test getting migration status"""
        status = await migration_manager.get_status()
        
        assert isinstance(status, MigrationStatus)
        assert status.target_version == SCHEMA_VERSION
    
    @pytest.mark.asyncio
    async def test_get_history_empty(self, migration_manager):
        """Test getting empty history"""
        await migration_manager.init()
        history = await migration_manager.get_history()
        
        assert history == []
    
    @pytest.mark.asyncio
    async def test_get_history_after_migration(self, migration_manager):
        """Test getting history after migration"""
        await migration_manager.run_migrations()
        history = await migration_manager.get_history()
        
        assert len(history) > 0
        assert history[0].version == 1
    
    @pytest.mark.asyncio
    async def test_run_migrations(self, migration_manager):
        """Test running migrations"""
        await migration_manager.run_migrations()
        
        version = await migration_manager.get_current_version()
        assert version == SCHEMA_VERSION
    
    @pytest.mark.asyncio
    async def test_run_migrations_already_applied(self, migration_manager):
        """Test running migrations when already applied"""
        await migration_manager.run_migrations()
        # Second run should do nothing
        await migration_manager.run_migrations()
        
        version = await migration_manager.get_current_version()
        assert version == SCHEMA_VERSION
    
    @pytest.mark.asyncio
    async def test_apply_migration_single(self, migration_manager):
        """Test applying single migration"""
        await migration_manager.init()
        await migration_manager.apply_migration(1)
        
        version = await migration_manager.get_current_version()
        assert version == 1
    
    @pytest.mark.asyncio
    async def test_apply_migration_already_applied(self, migration_manager):
        """Test error when applying already applied"""
        await migration_manager.apply_migration(1)
        
        with pytest.raises(ValueError):
            await migration_manager.apply_migration(1)
    
    @pytest.mark.asyncio
    async def test_apply_migration_skip(self, migration_manager):
        """Test error when skipping migrations"""
        with pytest.raises(ValueError):
            await migration_manager.apply_migration(2)
    
    @pytest.mark.asyncio
    async def test_rollback_migration(self, migration_manager):
        """Test rollback raises NotImplementedError"""
        await migration_manager.run_migrations()
        
        with pytest.raises(NotImplementedError):
            await migration_manager.rollback_migration()
    
    @pytest.mark.asyncio
    async def test_rollback_no_migrations(self, migration_manager):
        """Test rollback with no migrations"""
        await migration_manager.init()
        
        with pytest.raises(ValueError):
            await migration_manager.rollback_migration()
    
    @pytest.mark.asyncio
    async def test_validate_schema(self, migration_manager):
        """Test schema validation"""
        await migration_manager.run_migrations()
        
        valid = await migration_manager.validate_schema()
        assert valid is True


class TestSingletonHelpers:
    """Singleton helper function tests"""
    
    @pytest.mark.asyncio
    async def test_get_manager(self, db_connection):
        """Test getting manager singleton"""
        reset_manager()
        
        # Override connection for test
        from agents_mem.sqlite.migrations import _manager_instance
        global _manager_instance
        _manager_instance = MigrationManager(db_connection)
        
        manager = await get_manager()
        assert isinstance(manager, MigrationManager)
        
        reset_manager()
    
    @pytest.mark.asyncio
    async def test_reset_manager(self, db_connection):
        """Test resetting manager"""
        from agents_mem.sqlite.migrations import _manager_instance
        _manager_instance = MigrationManager(db_connection)
        
        reset_manager()
        
        from agents_mem.sqlite.migrations import _manager_instance as new_instance
        assert new_instance is None
    
    @pytest.mark.asyncio
    async def test_run_migrations_helper(self, db_connection):
        """Test run_migrations helper"""
        reset_manager()
        from agents_mem.sqlite.migrations import _manager_instance
        global _manager_instance
        _manager_instance = MigrationManager(db_connection)
        
        await run_migrations()
        
        version = await get_current_version()
        assert version == SCHEMA_VERSION
        
        reset_manager()
    
    @pytest.mark.asyncio
    async def test_get_migration_status_helper(self, db_connection):
        """Test get_migration_status helper"""
        reset_manager()
        from agents_mem.sqlite.migrations import _manager_instance
        global _manager_instance
        _manager_instance = MigrationManager(db_connection)
        
        status = await get_migration_status()
        assert isinstance(status, MigrationStatus)
        
        reset_manager()
    
    @pytest.mark.asyncio
    async def test_is_migration_needed_helper(self, db_connection):
        """Test is_migration_needed helper"""
        reset_manager()
        from agents_mem.sqlite.migrations import _manager_instance
        global _manager_instance
        _manager_instance = MigrationManager(db_connection)
        
        needed = await is_migration_needed()
        assert needed is True
        
        reset_manager()


class TestConstants:
    """Constant tests"""
    
    def test_migration_history_table_name(self):
        """Test table name constant"""
        assert MIGRATION_HISTORY_TABLE == "migration_history"
    
    def test_create_migration_history_sql(self):
        """Test migration history SQL"""
        assert "CREATE TABLE" in CREATE_MIGRATION_HISTORY
        assert "migration_history" in CREATE_MIGRATION_HISTORY