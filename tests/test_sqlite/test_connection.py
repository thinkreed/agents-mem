"""Tests for DatabaseConnection."""

import pytest
from agents_mem.sqlite.connection import (
    DatabaseConnection,
    set_database_path,
    get_database_path,
)


class TestDatabaseConnection:
    """Test DatabaseConnection class."""

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self, tmp_path):
        """Set up and tear down database for each test."""
        # Reset singleton before each test
        DatabaseConnection.reset()

        # Set up temporary database path
        db_path = str(tmp_path / "test.db")
        set_database_path(db_path)

        yield

        # Clean up after test
        DatabaseConnection.reset()

    @pytest.mark.asyncio
    async def test_connect(self):
        """Test database connection."""
        db = DatabaseConnection()
        await db.connect()
        assert db.is_open()
        await db.close()

    @pytest.mark.asyncio
    async def test_close(self):
        """Test database close."""
        db = DatabaseConnection()
        await db.connect()
        await db.close()
        assert not db.is_open()

    @pytest.mark.asyncio
    async def test_exec(self):
        """Test exec method."""
        db = DatabaseConnection()
        await db.connect()
        await db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)")
        await db.close()

    @pytest.mark.asyncio
    async def test_run(self):
        """Test run method."""
        db = DatabaseConnection()
        await db.connect()
        await db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)")
        await db.run("INSERT INTO test (name) VALUES (?)", ["test_name"])
        await db.close()

    @pytest.mark.asyncio
    async def test_query(self):
        """Test query method."""
        db = DatabaseConnection()
        await db.connect()
        await db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)")
        await db.run("INSERT INTO test (name) VALUES (?)", ["test_name"])
        rows = await db.query("SELECT * FROM test")
        assert len(rows) == 1
        assert rows[0]["name"] == "test_name"
        await db.close()

    @pytest.mark.asyncio
    async def test_query_one(self):
        """Test query_one method."""
        db = DatabaseConnection()
        await db.connect()
        await db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)")
        await db.run("INSERT INTO test (name) VALUES (?)", ["test_name"])
        row = await db.query_one("SELECT * FROM test WHERE id = ?", [1])
        assert row is not None
        assert row["name"] == "test_name"
        await db.close()

    @pytest.mark.asyncio
    async def test_transaction(self):
        """Test transaction context manager."""
        db = DatabaseConnection()
        await db.connect()
        await db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)")

        async with await db.transaction():
            await db.run("INSERT INTO test (name) VALUES (?)", ["test1"])
            await db.run("INSERT INTO test (name) VALUES (?)", ["test2"])

        rows = await db.query("SELECT * FROM test")
        assert len(rows) == 2
        await db.close()

    @pytest.mark.asyncio
    async def test_singleton_pattern(self):
        """Test singleton pattern."""
        db1 = DatabaseConnection()
        db2 = DatabaseConnection()
        assert db1 is db2

    def test_set_and_get_database_path(self, tmp_path):
        """Test set_database_path and get_database_path."""
        db_path = str(tmp_path / "custom.db")
        set_database_path(db_path)
        assert get_database_path() == db_path

    @pytest.mark.asyncio
    async def test_runtime_error_when_closed(self):
        """Test RuntimeError when database is closed."""
        db = DatabaseConnection()
        # Don't connect, try to run operations
        with pytest.raises(RuntimeError, match="Database is closed"):
            await db.exec("CREATE TABLE test (id INTEGER)")

        with pytest.raises(RuntimeError, match="Database is closed"):
            await db.run("INSERT INTO test VALUES (1)")

        with pytest.raises(RuntimeError, match="Database is closed"):
            await db.query("SELECT * FROM test")

        with pytest.raises(RuntimeError, match="Database is closed"):
            await db.query_one("SELECT * FROM test")