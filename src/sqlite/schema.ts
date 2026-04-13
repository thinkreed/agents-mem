/**
 * @file src/sqlite/schema.ts
 * @description SQLite schema definitions for agents-mem
 */

/**
 * Schema version (increment when schema changes)
 */
export const SCHEMA_VERSION = 1;

/**
 * All table names
 */
export const TABLE_NAMES = [
  'users',
  'agents',
  'teams',
  'team_members',
  'memory_index',
  'documents',
  'assets',
  'tiered_content',
  'conversations',
  'messages',
  'facts',
  'entity_nodes',
  'extraction_status',
  'memory_access_log',
  'queue_jobs'
] as const;

/**
 * Schema table type
 */
export type SchemaTable = typeof TABLE_NAMES[number];

// ============================================================================
// Layer 0: SCOPE & IDENTITY
// ============================================================================

const CREATE_USERS = `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  preferences TEXT,
  created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at REAL NOT NULL DEFAULT (strftime('%s', 'now'))
)`;

const CREATE_AGENTS = `
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  capabilities TEXT,
  created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
)`;

const CREATE_TEAMS = `
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_user_id TEXT NOT NULL,
  visibility TEXT DEFAULT 'private',
  created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
)`;

const CREATE_TEAM_MEMBERS = `
CREATE TABLE team_members (
  team_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  permissions TEXT,
  joined_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  PRIMARY KEY (team_id, agent_id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
)`;

// ============================================================================
// Layer 1: INDEX & METADATA
// ============================================================================

const CREATE_MEMORY_INDEX = `
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
)`;

// ============================================================================
// Layer 2: DOCUMENTS & ASSETS
// ============================================================================

const CREATE_DOCUMENTS = `
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
)`;

const CREATE_ASSETS = `
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
)`;

// ============================================================================
// Layer 3: TIERED CONTENT
// ============================================================================

const CREATE_TIERED_CONTENT = `
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
)`;

// ============================================================================
// Layer 4: CONVERSATIONS
// ============================================================================

const CREATE_CONVERSATIONS = `
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
)`;

const CREATE_MESSAGES = `
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
)`;

// ============================================================================
// Layer 5: FACTS & ENTITY TREE
// ============================================================================

const CREATE_FACTS = `
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
)`;

const CREATE_ENTITY_NODES = `
CREATE TABLE entity_nodes (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  depth INTEGER NOT NULL DEFAULT 0,
  path TEXT,
  child_count INTEGER DEFAULT 0,
  user_id TEXT NOT NULL,
  agent_id TEXT,
  team_id TEXT,
  is_global BOOLEAN DEFAULT FALSE,
  entity_name TEXT NOT NULL,
  aggregated_content TEXT,
  threshold REAL,
  openviking_uri TEXT,
  linked_fact_ids TEXT,
  created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (parent_id) REFERENCES entity_nodes(id)
)`;

// ============================================================================
// AUDIT & LOGGING
// ============================================================================

const CREATE_EXTRACTION_STATUS = `
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
)`;

const CREATE_MEMORY_ACCESS_LOG = `
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
)`;

// ============================================================================
// QUEUE JOBS
// ============================================================================

const CREATE_QUEUE_JOBS = `
CREATE TABLE queue_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload TEXT NOT NULL,
  retries INTEGER NOT NULL DEFAULT 0,
  result_data TEXT,
  error TEXT,
  user_id TEXT NOT NULL,
  agent_id TEXT,
  team_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`;

// ============================================================================
// Indexes
// ============================================================================

const INDEXES_AGENTS = `CREATE INDEX idx_agents_user ON agents(user_id)`;

const INDEXES_TEAM_MEMBERS = `
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_agent ON team_members(agent_id)`;

const INDEXES_MEMORY_INDEX = `
CREATE INDEX idx_memory_uri ON memory_index(uri);
CREATE INDEX idx_memory_scope ON memory_index(user_id, agent_id, team_id);
CREATE INDEX idx_memory_target ON memory_index(target_type, target_id);
CREATE INDEX idx_memory_topic ON memory_index(topic) WHERE topic IS NOT NULL;
CREATE INDEX idx_memory_entity ON memory_index(entity) WHERE entity IS NOT NULL;
CREATE INDEX idx_memory_category ON memory_index(category) WHERE category IS NOT NULL`;

const INDEXES_DOCUMENTS = `
CREATE INDEX idx_documents_scope ON documents(user_id, agent_id, team_id);
CREATE INDEX idx_documents_type ON documents(doc_type)`;

const INDEXES_ASSETS = `
CREATE INDEX idx_assets_scope ON assets(user_id, agent_id, team_id);
CREATE INDEX idx_assets_type ON assets(file_type)`;

const INDEXES_TIERED_CONTENT = `
CREATE INDEX idx_tiered_scope ON tiered_content(user_id, agent_id, team_id);
CREATE INDEX idx_tiered_source ON tiered_content(source_type, source_id)`;

const INDEXES_CONVERSATIONS = `
CREATE INDEX idx_conversations_scope ON conversations(user_id, agent_id, team_id)`;

const INDEXES_MESSAGES = `
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_role ON messages(role)`;

const INDEXES_FACTS = `
CREATE INDEX idx_facts_scope ON facts(user_id, agent_id, team_id);
CREATE INDEX idx_facts_source ON facts(source_type, source_id);
CREATE INDEX idx_facts_type ON facts(fact_type)`;

const INDEXES_ENTITY_NODES = `
CREATE INDEX idx_entity_parent ON entity_nodes(parent_id);
CREATE INDEX idx_entity_depth ON entity_nodes(depth);
CREATE INDEX idx_entity_scope ON entity_nodes(user_id, agent_id, team_id)`;

const INDEXES_EXTRACTION_STATUS = `
CREATE INDEX idx_extraction_target ON extraction_status(target_type, target_id);
CREATE INDEX idx_extraction_status ON extraction_status(status)`;

const INDEXES_MEMORY_ACCESS_LOG = `
CREATE INDEX idx_access_log_user ON memory_access_log(user_id);
CREATE INDEX idx_access_log_memory ON memory_access_log(memory_type, memory_id);
CREATE INDEX idx_access_log_time ON memory_access_log(timestamp)`;

const INDEXES_QUEUE_JOBS = `
CREATE INDEX idx_queue_status ON queue_jobs(status);
CREATE INDEX idx_queue_type ON queue_jobs(type)`;

// ============================================================================
// Table SQL Map
// ============================================================================

const CREATE_TABLE_MAP: Record<SchemaTable, string> = {
  users: CREATE_USERS,
  agents: CREATE_AGENTS,
  teams: CREATE_TEAMS,
  team_members: CREATE_TEAM_MEMBERS,
  memory_index: CREATE_MEMORY_INDEX,
  documents: CREATE_DOCUMENTS,
  assets: CREATE_ASSETS,
  tiered_content: CREATE_TIERED_CONTENT,
  conversations: CREATE_CONVERSATIONS,
  messages: CREATE_MESSAGES,
  facts: CREATE_FACTS,
  entity_nodes: CREATE_ENTITY_NODES,
  extraction_status: CREATE_EXTRACTION_STATUS,
  memory_access_log: CREATE_MEMORY_ACCESS_LOG,
  queue_jobs: CREATE_QUEUE_JOBS
};

const INDEXES_MAP: Record<SchemaTable, string> = {
  users: '',
  agents: INDEXES_AGENTS,
  teams: '',
  team_members: INDEXES_TEAM_MEMBERS,
  memory_index: INDEXES_MEMORY_INDEX,
  documents: INDEXES_DOCUMENTS,
  assets: INDEXES_ASSETS,
  tiered_content: INDEXES_TIERED_CONTENT,
  conversations: INDEXES_CONVERSATIONS,
  messages: INDEXES_MESSAGES,
  facts: INDEXES_FACTS,
  entity_nodes: INDEXES_ENTITY_NODES,
  extraction_status: INDEXES_EXTRACTION_STATUS,
  memory_access_log: INDEXES_MEMORY_ACCESS_LOG,
  queue_jobs: INDEXES_QUEUE_JOBS
};

// ============================================================================
// Functions
// ============================================================================

/**
 * Get complete schema SQL (all tables and indexes)
 */
export function getSchemaSQL(): string {
  const parts: string[] = [];
  
  for (const table of TABLE_NAMES) {
    parts.push(CREATE_TABLE_MAP[table]);
    const indexes = INDEXES_MAP[table];
    if (indexes) {
      parts.push(indexes);
    }
  }
  
  return parts.join('\n');
}

/**
 * Get schema as array of individual statements
 */
export function getSchemaStatements(): string[] {
  const statements: string[] = [];
  
  for (const table of TABLE_NAMES) {
    // Add CREATE TABLE statement
    statements.push(CREATE_TABLE_MAP[table].trim());
    
    // Add index statements (split by semicolon for multiple indexes)
    const indexes = INDEXES_MAP[table];
    if (indexes) {
      const indexStmts = indexes.split(';').filter(s => s.trim().length > 0);
      for (const stmt of indexStmts) {
        statements.push(stmt.trim());
      }
    }
  }
  
  return statements;
}

/**
 * Get array of table names
 */
export function getTableNames(): readonly SchemaTable[] {
  return TABLE_NAMES;
}

/**
 * Get CREATE TABLE SQL for specific table
 */
export function getCreateTableSQL(table: SchemaTable): string {
  if (!CREATE_TABLE_MAP[table]) {
    throw new Error(`Unknown table: ${table}`);
  }
  return CREATE_TABLE_MAP[table];
}

/**
 * Get indexes SQL for specific table
 */
export function getIndexesSQL(table: SchemaTable): string {
  return INDEXES_MAP[table] ?? '';
}

/**
 * Validate schema exists in database
 * (Placeholder - actual validation requires DB connection)
 */
export function validateSchema(_db: unknown): boolean {
  // This would check if all tables exist
  // Implementation depends on the DB wrapper used
  return true;
}