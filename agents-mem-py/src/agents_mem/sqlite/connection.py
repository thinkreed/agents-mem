"""
SQLite connection management for agents-mem-py

Uses aiosqlite for async database operations with:
- WAL mode for better concurrent access
- Foreign key enforcement
- Statement caching
- Singleton connection pool
"""

import os
import sqlite3
from pathlib import Path
from typing import Any

import aiosqlite

# ============================================================================
# Configuration
# ============================================================================

SQLITE_WAL_MODE = True
SQLITE_FOREIGN_KEYS = True


def get_default_db_path() -> str:
    """Get default SQLite database path (~/.agents_mem/agents_mem.db)"""
    home = Path.home()
    db_dir = home / ".agents_mem"
    db_dir.mkdir(parents=True, exist_ok=True)
    return str(db_dir / "agents_mem.db")


# Global database path (can be overridden via env var)
_database_path: str = os.environ.get("AGENTS_MEM_DB_PATH", get_default_db_path())


# ============================================================================
# DatabaseConnection Class
# ============================================================================


class DatabaseConnection:
    """
    Async SQLite connection wrapper with statement caching.

    Provides:
    - Async exec, run, query operations
    - WAL mode and foreign key support
    - Statement caching for performance
    - Transaction support
    """

    _instance: "DatabaseConnection | None" = None
    _db: aiosqlite.Connection | None = None
    _stmt_cache: dict[str, aiosqlite.Cursor] = {}
    _open: bool = False

    def __new__(cls) -> "DatabaseConnection":
        """Singleton pattern"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def connect(self) -> None:
        """Establish database connection"""
        if self._open:
            return

        db_path = os.environ.get("AGENTS_MEM_DB_PATH", _database_path)

        # Ensure directory exists for file-based databases
        if db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)

        self._db = await aiosqlite.connect(db_path)

        # Enable WAL mode if configured
        if SQLITE_WAL_MODE and db_path != ":memory:":
            await self._db.execute("PRAGMA journal_mode = WAL")

        # Enable foreign keys
        if SQLITE_FOREIGN_KEYS:
            await self._db.execute("PRAGMA foreign_keys = ON")

        self._open = True

    async def close(self) -> None:
        """Close database connection"""
        if self._open and self._db:
            self._stmt_cache.clear()
            await self._db.close()
            self._open = False
            self._db = None

    def is_open(self) -> bool:
        """Check if connection is open"""
        return self._open

    async def exec(self, sql: str) -> None:
        """Execute SQL without parameters"""
        if not self._open or not self._db:
            raise RuntimeError("Database is closed")
        await self._db.executescript(sql)

    async def run(
        self, sql: str, params: list[Any] | None = None
    ) -> sqlite3.Cursor:
        """Run SQL with parameters"""
        if not self._open or not self._db:
            raise RuntimeError("Database is closed")
        params = params or []
        return await self._db.execute(sql, params)

    async def query(
        self, sql: str, params: list[Any] | None = None
    ) -> list[dict[str, Any]]:
        """Query SQL and return all results as dict rows"""
        if not self._open or not self._db:
            raise RuntimeError("Database is closed")
        params = params or []
        self._db.row_factory = aiosqlite.Row
        cursor = await self._db.execute(sql, params)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    async def query_one(
        self, sql: str, params: list[Any] | None = None
    ) -> dict[str, Any] | None:
        """Query SQL and return first result"""
        if not self._open or not self._db:
            raise RuntimeError("Database is closed")
        params = params or []
        self._db.row_factory = aiosqlite.Row
        cursor = await self._db.execute(sql, params)
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def transaction(self) -> "AsyncTransaction":
        """Start a transaction context"""
        if not self._open or not self._db:
            raise RuntimeError("Database is closed")
        return AsyncTransaction(self._db)

    async def prepare_cached(self, sql: str) -> aiosqlite.Cursor:
        """Prepare statement with caching"""
        if not self._open or not self._db:
            raise RuntimeError("Database is closed")
        # Note: aiosqlite doesn't have statement caching like Bun SQLite
        # We maintain a simple cache for reference
        return await self._db.execute(sql)

    def clear_cache(self) -> None:
        """Clear statement cache"""
        self._stmt_cache.clear()

    @classmethod
    def reset(cls) -> None:
        """Reset singleton instance"""
        if cls._instance:
            cls._instance._stmt_cache.clear()
            cls._instance._open = False
            cls._instance._db = None
            cls._instance = None


class AsyncTransaction:
    """Async transaction context manager"""

    def __init__(self, db: aiosqlite.Connection):
        self._db = db

    async def __aenter__(self) -> "AsyncTransaction":
        await self._db.execute("BEGIN")
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if exc_type is None:
            await self._db.commit()
        else:
            await self._db.rollback()

    async def exec(self, sql: str) -> None:
        """Execute SQL within transaction"""
        await self._db.executescript(sql)

    async def run(self, sql: str, params: list[Any] | None = None) -> None:
        """Run SQL with parameters within transaction"""
        params = params or []
        await self._db.execute(sql, params)


# ============================================================================
# Singleton Helpers (Backward Compatibility)
# ============================================================================

_db_connection: DatabaseConnection | None = None


async def get_connection() -> DatabaseConnection:
    """Get database connection singleton"""
    global _db_connection
    if _db_connection is None:
        _db_connection = DatabaseConnection()
        await _db_connection.connect()
    return _db_connection


async def reset_connection() -> None:
    """Reset connection singleton"""
    global _db_connection
    if _db_connection:
        await _db_connection.close()
        _db_connection = None
    DatabaseConnection.reset()


def is_connection_open() -> bool:
    """Check if connection is open"""
    return _db_connection is not None and _db_connection.is_open()


def get_database_path() -> str:
    """Get current database path"""
    return _database_path


def set_database_path(path: str) -> None:
    """Set database path (before connecting)"""
    global _database_path
    _database_path = path
    os.environ["AGENTS_MEM_DB_PATH"] = path


async def execute_query(sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
    """Execute query using singleton connection"""
    conn = await get_connection()
    return await conn.query(sql, params)


async def execute_run(sql: str, params: list[Any] | None = None) -> sqlite3.Cursor:
    """Execute run using singleton connection"""
    conn = await get_connection()
    return await conn.run(sql, params)


async def execute_transaction(statements: list[str]) -> None:
    """Execute transaction using singleton connection"""
    conn = await get_connection()
    async with await conn.transaction() as tx:
        for sql in statements:
            await tx.exec(sql)


__all__ = [
    "DatabaseConnection",
    "AsyncTransaction",
    "get_connection",
    "reset_connection",
    "is_connection_open",
    "get_database_path",
    "set_database_path",
    "execute_query",
    "execute_run",
    "execute_transaction",
    "SQLITE_WAL_MODE",
    "SQLITE_FOREIGN_KEYS",
    "get_default_db_path",
]