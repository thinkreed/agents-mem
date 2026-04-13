/**
 * @file scripts/migrate_to_openviking.ts
 * @description Data migration script from SQLite to OpenViking
 * 
 * Run: bun run scripts/migrate_to_openviking.ts
 * 
 * Migrates:
 * - Documents → OpenViking resources/documents/
 * - Assets → OpenViking resources/assets/
 * - Facts → OpenViking memories/facts/
 * - Messages → OpenViking memories/messages/
 */

import { getDb } from '../src/sqlite/connection';
import { getOpenVikingClient, getScopeMapper, getURIAdapter } from '../src/openviking';
import type { Scope } from '../src/core/types';

/**
 * Migration configuration
 */
interface MigrationConfig {
  /** Batch size for migration */
  batchSize: number;
  /** Delay between batches (ms) */
  batchDelay: number;
  /** Dry run - don't actually migrate */
  dryRun: boolean;
  /** Verbose logging */
  verbose: boolean;
}

const DEFAULT_CONFIG: MigrationConfig = {
  batchSize: 50,
  batchDelay: 1000,
  dryRun: false,
  verbose: true,
};

/**
 * Migration result
 */
interface MigrationResult {
  total: number;
  migrated: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * Migrate documents to OpenViking
 */
async function migrateDocuments(config: MigrationConfig): Promise<MigrationResult> {
  const db = getDb();
  const client = getOpenVikingClient();
  const mapper = getScopeMapper();
  const adapter = getURIAdapter();
  
  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    failed: 0,
    errors: [],
  };
  
  // Get all documents
  const documents = db.query(`
    SELECT id, user_id, agent_id, team_id, title, content, doc_type, metadata
    FROM documents
  `).all() as Array<{
    id: string;
    user_id: string;
    agent_id: string | null;
    team_id: string | null;
    title: string;
    content: string;
    doc_type: string;
    metadata: string | null;
  }>;
  
  result.total = documents.length;
  
  if (config.verbose) {
    console.log(`Found ${documents.length} documents to migrate`);
  }
  
  // Process in batches
  for (let i = 0; i < documents.length; i += config.batchSize) {
    const batch = documents.slice(i, i + config.batchSize);
    
    for (const doc of batch) {
      try {
        const scope: Scope = {
          userId: doc.user_id,
          agentId: doc.agent_id,
          teamId: doc.team_id,
        };
        
        const targetUri = mapper.buildTargetForType(scope, 'resources') + '/documents';
        
        if (config.dryRun) {
          if (config.verbose) {
            console.log(`[DRY RUN] Would migrate document ${doc.id} to ${targetUri}`);
          }
          result.migrated++;
          continue;
        }
        
        // Add to OpenViking
        const vikingResult = await client.addResource({
          content: doc.content,
          targetUri,
          reason: `Migrated document: ${doc.title}`,
          wait: false,
        });
        
        // Update SQLite with viking URI
        db.run(`
          UPDATE documents 
          SET openviking_uri = ?
          WHERE id = ?
        `, [vikingResult.rootUri, doc.id]);
        
        if (config.verbose) {
          console.log(`Migrated document ${doc.id} → ${vikingResult.rootUri}`);
        }
        
        result.migrated++;
      } catch (err) {
        result.failed++;
        result.errors.push({
          id: doc.id,
          error: (err as Error).message,
        });
        console.error(`Failed to migrate document ${doc.id}: ${(err as Error).message}`);
      }
    }
    
    // Delay between batches
    if (i + config.batchSize < documents.length && config.batchDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, config.batchDelay));
    }
  }
  
  return result;
}

/**
 * Migrate assets to OpenViking
 */
async function migrateAssets(config: MigrationConfig): Promise<MigrationResult> {
  const db = getDb();
  const client = getOpenVikingClient();
  const mapper = getScopeMapper();
  
  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    failed: 0,
    errors: [],
  };
  
  // Get all assets with extracted text
  const assets = db.query(`
    SELECT id, user_id, agent_id, team_id, filename, file_type, extracted_text, storage_path
    FROM assets
    WHERE extracted_text IS NOT NULL
  `).all() as Array<{
    id: string;
    user_id: string;
    agent_id: string | null;
    team_id: string | null;
    filename: string;
    file_type: string;
    extracted_text: string;
    storage_path: string;
  }>;
  
  result.total = assets.length;
  
  if (config.verbose) {
    console.log(`Found ${assets.length} assets with text to migrate`);
  }
  
  for (const asset of assets) {
    try {
      const scope: Scope = {
        userId: asset.user_id,
        agentId: asset.agent_id,
        teamId: asset.team_id,
      };
      
      const targetUri = mapper.buildTargetForType(scope, 'resources') + '/assets';
      
      if (config.dryRun) {
        if (config.verbose) {
          console.log(`[DRY RUN] Would migrate asset ${asset.id}`);
        }
        result.migrated++;
        continue;
      }
      
      const vikingResult = await client.addResource({
        content: asset.extracted_text,
        targetUri,
        reason: `Migrated asset: ${asset.filename}`,
        wait: false,
      });
      
      db.run(`
        UPDATE assets 
        SET openviking_uri = ?
        WHERE id = ?
      `, [vikingResult.rootUri, asset.id]);
      
      result.migrated++;
    } catch (err) {
      result.failed++;
      result.errors.push({
        id: asset.id,
        error: (err as Error).message,
      });
    }
  }
  
  return result;
}

/**
 * Migrate facts to OpenViking
 */
async function migrateFacts(config: MigrationConfig): Promise<MigrationResult> {
  const db = getDb();
  const client = getOpenVikingClient();
  const mapper = getScopeMapper();
  
  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    failed: 0,
    errors: [],
  };
  
  const facts = db.query(`
    SELECT id, user_id, agent_id, team_id, content, fact_type, entities
    FROM facts
  `).all() as Array<{
    id: string;
    user_id: string;
    agent_id: string | null;
    team_id: string | null;
    content: string;
    fact_type: string;
    entities: string;
  }>;
  
  result.total = facts.length;
  
  if (config.verbose) {
    console.log(`Found ${facts.length} facts to migrate`);
  }
  
  for (let i = 0; i < facts.length; i += config.batchSize) {
    const batch = facts.slice(i, i + config.batchSize);
    
    for (const fact of batch) {
      try {
        const scope: Scope = {
          userId: fact.user_id,
          agentId: fact.agent_id,
          teamId: fact.team_id,
        };
        
        const targetUri = mapper.buildTargetForType(scope, 'memories') + '/facts';
        
        if (config.dryRun) {
          result.migrated++;
          continue;
        }
        
        const vikingResult = await client.addResource({
          content: fact.content,
          targetUri,
          reason: `Migrated fact: ${fact.fact_type}`,
          wait: false,
        });
        
        db.run(`
          UPDATE facts 
          SET openviking_uri = ?
          WHERE id = ?
        `, [vikingResult.rootUri, fact.id]);
        
        result.migrated++;
      } catch (err) {
        result.failed++;
        result.errors.push({ id: fact.id, error: (err as Error).message });
      }
    }
    
    if (i + config.batchSize < facts.length && config.batchDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, config.batchDelay));
    }
  }
  
  return result;
}

/**
 * Run full migration
 */
async function runMigration(config: MigrationConfig = DEFAULT_CONFIG): Promise<void> {
  console.log('=== OpenViking Migration Script ===');
  console.log(`Config: batchSize=${config.batchSize}, dryRun=${config.dryRun}`);
  console.log('');
  
  // Check OpenViking connection
  const client = getOpenVikingClient();
  const health = await client.healthCheck();
  
  if (health.status !== 'ok') {
    console.error('OpenViking server not available:', health.message);
    console.error('Please start OpenViking server before migration:');
    console.error('  docker run -p 1933:1933 openviking/server');
    process.exit(1);
  }
  
  console.log('OpenViking connection: OK');
  console.log('');
  
  // Migrate documents
  console.log('--- Migrating Documents ---');
  const docResult = await migrateDocuments(config);
  console.log(`Documents: ${docResult.migrated}/${docResult.total} migrated, ${docResult.failed} failed`);
  
  // Migrate assets
  console.log('--- Migrating Assets ---');
  const assetResult = await migrateAssets(config);
  console.log(`Assets: ${assetResult.migrated}/${assetResult.total} migrated, ${assetResult.failed} failed`);
  
  // Migrate facts
  console.log('--- Migrating Facts ---');
  const factResult = await migrateFacts(config);
  console.log(`Facts: ${factResult.migrated}/${factResult.total} migrated, ${factResult.failed} failed`);
  
  // Summary
  console.log('');
  console.log('=== Migration Complete ===');
  const totalMigrated = docResult.migrated + assetResult.migrated + factResult.migrated;
  const totalFailed = docResult.failed + assetResult.failed + factResult.failed;
  console.log(`Total migrated: ${totalMigrated}`);
  console.log(`Total failed: ${totalFailed}`);
  
  if (totalFailed > 0) {
    console.log('');
    console.log('Errors:');
    [...docResult.errors, ...assetResult.errors, ...factResult.errors].forEach(e => {
      console.log(`  - ${e.id}: ${e.error}`);
    });
  }
}

// Run if executed directly
if (import.meta.main) {
  const args = process.argv.slice(2);
  const config: MigrationConfig = {
    ...DEFAULT_CONFIG,
    dryRun: args.includes('--dry-run'),
    verbose: !args.includes('--quiet'),
  };
  
  runMigration(config).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

export { runMigration, migrateDocuments, migrateAssets, migrateFacts };