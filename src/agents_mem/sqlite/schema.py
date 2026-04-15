"""
SQLite schema definitions for agents-mem-py

Defines all table structures following the 6-layer progressive disclosure architecture:
- L0: Scope & Identity (users, agents, teams, team_members)
- L1: Index & Metadata (memory_index)
- L2: Documents & Assets (documents, assets)
- L3: Tiered Content (tiered_content)
- L4: Conversations (conversations, messages)
- L5: Facts & Entity Tree (facts, extraction_status, memory_access_log)

Uses snake_case column names (user_id, created_at) and Unix seconds timestamps.
"""

from typing import Literal

# ============================================================================
# Schema Version
# ============================================================================

SCHEMA_VERSION = 2

# ============================================================================
# Table Names
# ============================================================================

TABLE_NAMES = [
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

SchemaTable = Literal[
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


# ============================================================================
# L0: SCOPE & IDENTITY
# ============================================================================

CREATE_USERS = """
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    preferences TEXT,
    created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at REAL NOT NULL DEFAULT (strftime('%s', 'now'))
)
"""

CREATE_AGENTS = """
CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    capabilities TEXT,
    created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
)
"""

CREATE_TEAMS = """
CREATE TABLE teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_user_id TEXT NOT NULL,
    visibility TEXT DEFAULT 'private',
    created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
)
"""

CREATE_TEAM_MEMBERS = """
CREATE TABLE team_members (
    team_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    permissions TEXT,
    joined_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (team_id, agent_id),
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (agent_id) REFERENCES agents(id)
)
"""


# ============================================================================
# L1: INDEX & METADATA
# ============================================================================

CREATE_MEMORY_INDEX = """
CREATE TABLE memory_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uri TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    agent_id TEXT,
    team_id TEXT,
    is_global BOOLEAN DEFAULT FALSE,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    topic TEXT,
    entity TEXT,
    category TEXT,
    tags TEXT,
    importance REAL DEFAULT 0.5,
    path TEXT,
    created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at REAL NOT NULL DEFAULT (strftime('%s', 'now'))
)
"""


# ============================================================================
# L2: DOCUMENTS & ASSETS
# ============================================================================

CREATE_DOCUMENTS = """
CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_id TEXT,
    team_id TEXT,
    is_global BOOLEAN DEFAULT FALSE,
    doc_type TEXT NOT NULL,
    source_url TEXT,
    source_path TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT,
    openviking_uri TEXT,
    created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
    content_length INTEGER,
    token_count INTEGER
)
"""

CREATE_ASSETS = """
CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_id TEXT,
    team_id TEXT,
    is_global BOOLEAN DEFAULT FALSE,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    source_url TEXT,
    source_path TEXT,
    storage_path TEXT NOT NULL,
    extracted_text TEXT,
    title TEXT,
    description TEXT,
    metadata TEXT,
    openviking_uri TEXT,
    text_extracted BOOLEAN DEFAULT FALSE,
    created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at REAL NOT NULL DEFAULT (strftime('%s', 'now'))
)
"""


# ============================================================================
# L3: TIERED CONTENT
# ============================================================================

CREATE_TIERED_CONTENT = """
CREATE TABLE tiered_content (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_id TEXT,
    team_id TEXT,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    abstract TEXT NOT NULL,
    overview TEXT,
    original_uri TEXT,
    importance REAL DEFAULT 0.5,
    openviking_uri_l0 TEXT,
    openviking_uri_l1 TEXT,
    l0_generated_at REAL,
    l1_generated_at REAL,
    generation_mode TEXT,
    created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at REAL NOT NULL DEFAULT (strftime('%s', 'now'))
)
"""


# ============================================================================
# L4: CONVERSATIONS
# ============================================================================

CREATE_CONVERSATIONS = """
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    team_id TEXT,
    title TEXT,
    source TEXT DEFAULT 'mcp',
    message_count INTEGER DEFAULT 0,
    token_count_input INTEGER DEFAULT 0,
    token_count_output INTEGER DEFAULT 0,
    started_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
    ended_at REAL,
    last_message_at REAL
)
"""

CREATE_MESSAGES = """
CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT,
    tool_calls TEXT,
    tool_results TEXT,
    reasoning TEXT,
    openviking_uri TEXT,
    tiered_id TEXT,
    tokens_input INTEGER,
    tokens_output INTEGER,
    timestamp REAL NOT NULL DEFAULT (strftime('%s', 'now')),
    source_document_id TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (source_document_id) REFERENCES documents(id)
)
"""


# ============================================================================
# L5: FACTS & ENTITY TREE
# ============================================================================

CREATE_FACTS = """
CREATE TABLE facts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_id TEXT,
    team_id TEXT,
    is_global BOOLEAN DEFAULT FALSE,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_uri TEXT,
    content TEXT NOT NULL,
    fact_type TEXT NOT NULL,
    entities TEXT NOT NULL,
    importance REAL DEFAULT 0.5,
    confidence REAL DEFAULT 0.8,
    verified BOOLEAN DEFAULT FALSE,
    openviking_uri TEXT,
    extraction_mode TEXT,
    extracted_at REAL,
    created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at REAL NOT NULL DEFAULT (strftime('%s', 'now'))
)
"""


# ============================================================================
# AUDIT & LOGGING
# ============================================================================

CREATE_EXTRACTION_STATUS = """
CREATE TABLE extraction_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    extraction_mode TEXT,
    facts_count INTEGER DEFAULT 0,
    entities_count INTEGER DEFAULT 0,
    started_at REAL,
    completed_at REAL,
    error_message TEXT
)
"""

CREATE_MEMORY_ACCESS_LOG = """
CREATE TABLE memory_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    agent_id TEXT,
    memory_type TEXT NOT NULL,
    memory_id TEXT NOT NULL,
    action TEXT NOT NULL,
    scope TEXT,
    timestamp REAL NOT NULL DEFAULT (strftime('%s', 'now')),
    success BOOLEAN NOT NULL,
    reason TEXT
)
"""


# ============================================================================
# Indexes
# ============================================================================

INDEXES_AGENTS = "CREATE INDEX idx_agents_user ON agents(user_id)"

INDEXES_TEAM_MEMBERS = """
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_agent ON team_members(agent_id)
"""

INDEXES_MEMORY_INDEX = """
CREATE INDEX idx_memory_uri ON memory_index(uri);
CREATE INDEX idx_memory_scope ON memory_index(user_id, agent_id, team_id);
CREATE INDEX idx_memory_target ON memory_index(target_type, target_id);
CREATE INDEX idx_memory_topic ON memory_index(topic) WHERE topic IS NOT NULL;
CREATE INDEX idx_memory_entity ON memory_index(entity) WHERE entity IS NOT NULL;
CREATE INDEX idx_memory_category ON memory_index(category) WHERE category IS NOT NULL
"""

INDEXES_DOCUMENTS = """
CREATE INDEX idx_documents_scope ON documents(user_id, agent_id, team_id);
CREATE INDEX idx_documents_type ON documents(doc_type)
"""

INDEXES_ASSETS = """
CREATE INDEX idx_assets_scope ON assets(user_id, agent_id, team_id);
CREATE INDEX idx_assets_type ON assets(file_type)
"""

INDEXES_TIERED_CONTENT = """
CREATE INDEX idx_tiered_scope ON tiered_content(user_id, agent_id, team_id);
CREATE INDEX idx_tiered_source ON tiered_content(source_type, source_id)
"""

INDEXES_CONVERSATIONS = """
CREATE INDEX idx_conversations_scope ON conversations(user_id, agent_id, team_id)
"""

INDEXES_MESSAGES = """
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_role ON messages(role)
"""

INDEXES_FACTS = """
CREATE INDEX idx_facts_scope ON facts(user_id, agent_id, team_id);
CREATE INDEX idx_facts_source ON facts(source_type, source_id);
CREATE INDEX idx_facts_type ON facts(fact_type)
"""

INDEXES_EXTRACTION_STATUS = """
CREATE INDEX idx_extraction_target ON extraction_status(target_type, target_id);
CREATE INDEX idx_extraction_status ON extraction_status(status)
"""

INDEXES_MEMORY_ACCESS_LOG = """
CREATE INDEX idx_access_log_user ON memory_access_log(user_id);
CREATE INDEX idx_access_log_memory ON memory_access_log(memory_type, memory_id);
CREATE INDEX idx_access_log_time ON memory_access_log(timestamp)
"""


# ============================================================================
# Table SQL Map
# ============================================================================

CREATE_TABLE_MAP: dict[SchemaTable, str] = {
    "users": CREATE_USERS,
    "agents": CREATE_AGENTS,
    "teams": CREATE_TEAMS,
    "team_members": CREATE_TEAM_MEMBERS,
    "memory_index": CREATE_MEMORY_INDEX,
    "documents": CREATE_DOCUMENTS,
    "assets": CREATE_ASSETS,
    "tiered_content": CREATE_TIERED_CONTENT,
    "conversations": CREATE_CONVERSATIONS,
    "messages": CREATE_MESSAGES,
    "facts": CREATE_FACTS,
    "extraction_status": CREATE_EXTRACTION_STATUS,
    "memory_access_log": CREATE_MEMORY_ACCESS_LOG,
}

INDEXES_MAP: dict[SchemaTable, str] = {
    "users": "",
    "agents": INDEXES_AGENTS,
    "teams": "",
    "team_members": INDEXES_TEAM_MEMBERS,
    "memory_index": INDEXES_MEMORY_INDEX,
    "documents": INDEXES_DOCUMENTS,
    "assets": INDEXES_ASSETS,
    "tiered_content": INDEXES_TIERED_CONTENT,
    "conversations": INDEXES_CONVERSATIONS,
    "messages": INDEXES_MESSAGES,
    "facts": INDEXES_FACTS,
    "extraction_status": INDEXES_EXTRACTION_STATUS,
    "memory_access_log": INDEXES_MEMORY_ACCESS_LOG,
}


# ============================================================================
# Functions
# ============================================================================


def get_schema_sql() -> str:
    """Get complete schema SQL (all tables and indexes)"""
    parts: list[str] = []

    for table in TABLE_NAMES:
        parts.append(CREATE_TABLE_MAP[table])
        indexes = INDEXES_MAP[table]
        if indexes:
            parts.append(indexes)

    return "\n".join(parts)


def get_schema_statements() -> list[str]:
    """Get schema as array of individual statements"""
    statements: list[str] = []

    for table in TABLE_NAMES:
        # Add CREATE TABLE statement
        statements.append(CREATE_TABLE_MAP[table].strip())

        # Add index statements (split by semicolon for multiple indexes)
        indexes = INDEXES_MAP[table]
        if indexes:
            index_stmts = [s.strip() for s in indexes.split(";") if s.strip()]
            for stmt in index_stmts:
                statements.append(stmt)

    return statements


def get_table_names() -> list[SchemaTable]:
    """Get array of table names"""
    return TABLE_NAMES


def get_create_table_sql(table: SchemaTable) -> str:
    """Get CREATE TABLE SQL for specific table"""
    if table not in CREATE_TABLE_MAP:
        raise ValueError(f"Unknown table: {table}")
    return CREATE_TABLE_MAP[table]


def get_indexes_sql(table: SchemaTable) -> str:
    """Get indexes SQL for specific table"""
    return INDEXES_MAP.get(table, "")


__all__ = [
    "SCHEMA_VERSION",
    "TABLE_NAMES",
    "SchemaTable",
    "CREATE_TABLE_MAP",
    "INDEXES_MAP",
    "get_schema_sql",
    "get_schema_statements",
    "get_table_names",
    "get_create_table_sql",
    "get_indexes_sql",
    # Raw SQL constants
    "CREATE_USERS",
    "CREATE_AGENTS",
    "CREATE_TEAMS",
    "CREATE_TEAM_MEMBERS",
    "CREATE_MEMORY_INDEX",
    "CREATE_DOCUMENTS",
    "CREATE_ASSETS",
    "CREATE_TIERED_CONTENT",
    "CREATE_CONVERSATIONS",
    "CREATE_MESSAGES",
    "CREATE_FACTS",
    "CREATE_EXTRACTION_STATUS",
    "CREATE_MEMORY_ACCESS_LOG",
]