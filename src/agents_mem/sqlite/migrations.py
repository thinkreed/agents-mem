"""
SQLite migration management for agents-mem-py

Provides:
- Version control for schema changes
- Upgrade/downgrade migrations
- Migration history tracking
- Schema validation
"""

import time
from dataclasses import dataclass
from typing import Any

from agents_mem.sqlite.connection import DatabaseConnection, get_connection
from agents_mem.sqlite.schema import SCHEMA_VERSION, get_schema_statements, get_table_names


# ============================================================================
# Constants
# ============================================================================

MIGRATION_HISTORY_TABLE = "migration_history"

CREATE_MIGRATION_HISTORY = """
CREATE TABLE IF NOT EXISTS migration_history (
    version INTEGER PRIMARY KEY,
    applied_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
    description TEXT
)
"""


# ============================================================================
# Data Classes
# ============================================================================


@dataclass
class MigrationStatus:
    """Migration status info"""

    current_version: int
    target_version: int
    needed: bool
    applied_migrations: list[int]


@dataclass
class MigrationRecord:
    """Migration history record"""

    version: int
    applied_at: float
    description: str | None = None


# ============================================================================
# MigrationManager Class
# ============================================================================


class MigrationManager:
    """
    Manages database schema migrations.

    Features:
    - Version tracking
    - Automatic schema creation
    - Migration history
    - Schema validation
    """

    def __init__(self, db: DatabaseConnection):
        self._db = db

    async def init(self) -> None:
        """Initialize migration history table"""
        await self._db.exec(CREATE_MIGRATION_HISTORY)

    async def get_current_version(self) -> int:
        """Get current schema version"""
        await self.init()

        result = await self._db.query_one(
            "SELECT MAX(version) as version FROM migration_history"
        )

        if result and result.get("version") is not None:
            return result["version"]
        return 0

    async def is_migration_needed(self) -> bool:
        """Check if migration is needed"""
        current = await self.get_current_version()
        return current < SCHEMA_VERSION

    async def get_status(self) -> MigrationStatus:
        """Get migration status"""
        await self.init()

        current_version = await self.get_current_version()
        history = await self.get_history()

        return MigrationStatus(
            current_version=current_version,
            target_version=SCHEMA_VERSION,
            needed=current_version < SCHEMA_VERSION,
            applied_migrations=[h.version for h in history],
        )

    async def get_history(self) -> list[MigrationRecord]:
        """Get migration history"""
        await self.init()

        rows = await self._db.query(
            "SELECT version, applied_at, description FROM migration_history ORDER BY version"
        )

        return [
            MigrationRecord(
                version=row["version"],
                applied_at=row["applied_at"],
                description=row.get("description"),
            )
            for row in rows
        ]

    async def run_migrations(self) -> None:
        """Run all pending migrations"""
        await self.init()

        current_version = await self.get_current_version()

        if current_version >= SCHEMA_VERSION:
            return  # Already at target version

        # Apply migrations from current+1 to target
        for version in range(current_version + 1, SCHEMA_VERSION + 1):
            await self._apply_version_migration(version)

    async def _apply_version_migration(self, version: int) -> None:
        """Apply specific version migration"""
        if version == 1:
            # Version 1: Initial schema
            async with await self._db.transaction() as tx:
                # Apply schema statements one by one
                statements = get_schema_statements()
                for stmt in statements:
                    if stmt.strip():
                        await tx.exec(stmt)

                # Record migration
                await tx.run(
                    "INSERT INTO migration_history (version, description) VALUES (?, ?)",
                    [version, "Initial schema creation"],
                )

        elif version == 2:
            # Version 2: Drop deprecated queue_jobs and entity_nodes tables
            async with await self._db.transaction() as tx:
                await tx.exec("DROP TABLE IF EXISTS queue_jobs")
                await tx.exec("DROP TABLE IF EXISTS entity_nodes")

                # Record migration
                await tx.run(
                    "INSERT INTO migration_history (version, description) VALUES (?, ?)",
                    [version, "Drop deprecated queue_jobs and entity_nodes tables"],
                )

        else:
            # Future migrations would go here
            raise NotImplementedError(f"Migration version {version} not implemented")

    async def apply_migration(self, version: int) -> None:
        """Apply single migration"""
        await self.init()

        current_version = await self.get_current_version()

        if version <= current_version:
            raise ValueError(f"Version {version} already applied")

        if version > current_version + 1:
            raise ValueError(
                f"Cannot skip migrations. Current: {current_version}, Target: {version}"
            )

        await self._apply_version_migration(version)

    async def rollback_migration(self) -> None:
        """Rollback last migration (if supported)"""
        await self.init()

        current_version = await self.get_current_version()

        if current_version == 0:
            raise ValueError("No migrations to rollback")

        # For now, we don't support rollback
        # In a production system, you'd have DOWN migrations
        raise NotImplementedError(
            "Rollback not supported. Drop tables manually if needed."
        )

    async def validate_schema(self) -> bool:
        """Validate all tables exist"""
        rows = await self._db.query(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )

        existing_names = {row["name"] for row in rows}

        for table in get_table_names():
            if table not in existing_names:
                return False

        return True


# ============================================================================
# Singleton Helpers
# ============================================================================

_manager_instance: MigrationManager | None = None


async def get_manager() -> MigrationManager:
    """Get migration manager singleton"""
    global _manager_instance
    if _manager_instance is None:
        conn = await get_connection()
        _manager_instance = MigrationManager(conn)
    return _manager_instance


def reset_manager() -> None:
    """Reset migration manager singleton"""
    global _manager_instance
    _manager_instance = None


async def run_migrations() -> None:
    """Run migrations using singleton"""
    manager = await get_manager()
    await manager.run_migrations()


async def get_migration_status() -> MigrationStatus:
    """Get migration status using singleton"""
    manager = await get_manager()
    return await manager.get_status()


async def get_current_version() -> int:
    """Get current version using singleton"""
    manager = await get_manager()
    return await manager.get_current_version()


async def is_migration_needed() -> bool:
    """Check if migration needed using singleton"""
    manager = await get_manager()
    return await manager.is_migration_needed()


async def apply_migration(version: int) -> None:
    """Apply single migration using singleton"""
    manager = await get_manager()
    await manager.apply_migration(version)


async def rollback_migration() -> None:
    """Rollback migration using singleton"""
    manager = await get_manager()
    await manager.rollback_migration()


__all__ = [
    "MigrationManager",
    "MigrationStatus",
    "MigrationRecord",
    "MIGRATION_HISTORY_TABLE",
    "CREATE_MIGRATION_HISTORY",
    "get_manager",
    "reset_manager",
    "run_migrations",
    "get_migration_status",
    "get_current_version",
    "is_migration_needed",
    "apply_migration",
    "rollback_migration",
]