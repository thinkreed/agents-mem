"""Tests for database schema."""

import pytest
from agents_mem.sqlite.schema import (
    get_schema_statements,
    get_schema_sql,
    get_table_names,
    get_create_table_sql,
    get_indexes_sql,
    TABLE_NAMES,
    SCHEMA_VERSION,
    SchemaTable,
)


class TestSchema:
    """Test database schema definitions."""

    def test_get_schema_statements(self):
        """Test that schema statements are returned."""
        statements = get_schema_statements()
        assert isinstance(statements, list)
        assert len(statements) > 0

    def test_schema_includes_users_table(self):
        """Test that users table is defined."""
        statements = get_schema_statements()
        users_found = any("CREATE TABLE users" in s for s in statements)
        assert users_found, "Users table not found in schema"

    def test_schema_includes_documents_table(self):
        """Test that documents table is defined."""
        statements = get_schema_statements()
        docs_found = any("CREATE TABLE documents" in s for s in statements)
        assert docs_found, "Documents table not found in schema"

    def test_schema_includes_assets_table(self):
        """Test that assets table is defined."""
        statements = get_schema_statements()
        assets_found = any("CREATE TABLE assets" in s for s in statements)
        assert assets_found, "Assets table not found in schema"

    def test_schema_includes_facts_table(self):
        """Test that facts table is defined."""
        statements = get_schema_statements()
        facts_found = any("CREATE TABLE facts" in s for s in statements)
        assert facts_found, "Facts table not found in schema"

    def test_get_schema_sql(self):
        """Test that get_schema_sql returns a string."""
        sql = get_schema_sql()
        assert isinstance(sql, str)
        assert len(sql) > 0
        # Should contain all tables
        for table in TABLE_NAMES:
            assert f"CREATE TABLE {table}" in sql

    def test_get_table_names(self):
        """Test that get_table_names returns all expected tables."""
        tables = get_table_names()
        assert isinstance(tables, list)
        assert len(tables) == 13  # 13 tables as per design
        expected_tables = [
            "users",
            "agents",
            "teams",
            "team_members",
            "memory_index",
            "documents",
            "assets",
            "tiered_content",
            "conversations",
            "messages",
            "facts",
            "extraction_status",
            "memory_access_log",
        ]
        assert tables == expected_tables

    def test_get_create_table_sql(self):
        """Test get_create_table_sql for specific tables."""
        users_sql = get_create_table_sql("users")
        assert "CREATE TABLE users" in users_sql
        assert "id TEXT PRIMARY KEY" in users_sql

        documents_sql = get_create_table_sql("documents")
        assert "CREATE TABLE documents" in documents_sql
        assert "content TEXT NOT NULL" in documents_sql

    def test_get_create_table_sql_unknown_table_raises(self):
        """Test that get_create_table_sql raises for unknown table."""
        with pytest.raises(ValueError, match="Unknown table"):
            get_create_table_sql("unknown_table")

    def test_get_indexes_sql(self):
        """Test get_indexes_sql returns indexes for tables with indexes."""
        # agents has indexes
        agents_indexes = get_indexes_sql("agents")
        assert "CREATE INDEX" in agents_indexes

        # users has no indexes
        users_indexes = get_indexes_sql("users")
        assert users_indexes == ""

    def test_schema_version(self):
        """Test that SCHEMA_VERSION is defined."""
        assert isinstance(SCHEMA_VERSION, int)
        assert SCHEMA_VERSION >= 1

    def test_table_names_constant(self):
        """Test that TABLE_NAMES is properly defined."""
        assert isinstance(TABLE_NAMES, list)
        assert all(isinstance(t, str) for t in TABLE_NAMES)

    def test_schema_table_literal(self):
        """Test SchemaTable literal type coverage."""
        # All table names should be valid SchemaTable values
        for table in TABLE_NAMES:
            # This is a type check - the literal should cover all table names
            assert table in [
                "users",
                "agents",
                "teams",
                "team_members",
                "memory_index",
                "documents",
                "assets",
                "tiered_content",
                "conversations",
                "messages",
                "facts",
                "extraction_status",
                "memory_access_log",
            ]

    def test_schema_statements_are_valid_sql(self):
        """Test that schema statements are valid SQL syntax."""
        statements = get_schema_statements()
        for stmt in statements:
            # Basic SQL syntax checks
            if stmt.startswith("CREATE TABLE"):
                # Should have opening parenthesis
                assert "(" in stmt
                # Should have closing parenthesis (for complete CREATE TABLE)
                assert ")" in stmt
            elif stmt.startswith("CREATE INDEX"):
                # Should specify table
                assert " ON " in stmt