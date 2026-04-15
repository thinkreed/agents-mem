"""
SQLite 数据库层模块

提供:
- schema.py: 13 张表的 SQL 定义 (蛇形命名, Unix 秒时间戳)
- connection.py: aiosqlite 连接管理 (WAL 模式, 外键检查)
- migrations.py: 迁移版本控制

架构层次:
- L0: Scope & Identity (users, agents, teams, team_members)
- L1: Index & Metadata (memory_index)
- L2: Documents & Assets (documents, assets)
- L3: Tiered Content (tiered_content)
- L4: Conversations (conversations, messages)
- L5: Facts & Entity Tree (facts, extraction_status, memory_access_log)
"""

from agents_mem.sqlite.schema import (
    SCHEMA_VERSION,
    TABLE_NAMES,
    SchemaTable,
    get_schema_sql,
    get_schema_statements,
    get_table_names,
    get_create_table_sql,
    get_indexes_sql,
)

from agents_mem.sqlite.connection import (
    DatabaseConnection,
    AsyncTransaction,
    get_connection,
    reset_connection,
    is_connection_open,
    get_database_path,
    set_database_path,
    execute_query,
    execute_run,
    execute_transaction,
    SQLITE_WAL_MODE,
    SQLITE_FOREIGN_KEYS,
)

from agents_mem.sqlite.migrations import (
    MigrationManager,
    MigrationStatus,
    MigrationRecord,
    run_migrations,
    get_migration_status,
    get_current_version,
    is_migration_needed,
    apply_migration,
    rollback_migration,
)

__all__ = [
    # Schema
    "SCHEMA_VERSION",
    "TABLE_NAMES",
    "SchemaTable",
    "get_schema_sql",
    "get_schema_statements",
    "get_table_names",
    "get_create_table_sql",
    "get_indexes_sql",
    # Connection
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
    # Migrations
    "MigrationManager",
    "MigrationStatus",
    "MigrationRecord",
    "run_migrations",
    "get_migration_status",
    "get_current_version",
    "is_migration_needed",
    "apply_migration",
    "rollback_migration",
]