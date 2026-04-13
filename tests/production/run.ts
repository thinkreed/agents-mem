/**
 * @file tests/production/run.ts
 * @description Interactive production test runner
 */

import { handleMemCreate, handleMemRead, handleMemUpdate, handleMemDelete } from '../../src/tools/crud_handlers';
import { runMigrations } from '../../src/sqlite/migrations';
import * as fs from 'fs';
import * as path from 'path';

const ARTICLES_DIR = 'E:/projects/think_wiki/raw/articles';

async function runProductionTest() {
  console.log('========================================');
  console.log('MCP CRUD Production Test');
  console.log('========================================\n');

  // Initialize database schema
  console.log('🔧 Initializing database...');
  runMigrations();
  console.log('✅ Database initialized\n');

  const userId = 'production-test-user';
  const createdDocs: string[] = [];

  try {
    // Step 1: CREATE - Store all articles
    console.log('📁 Step 1: CREATE - Storing articles...\n');

    const articles = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.md'));

    for (const article of articles) {
      const filePath = path.join(ARTICLES_DIR, article);
      const content = fs.readFileSync(filePath, 'utf-8');
      const title = article.replace('.md', '');

      console.log(`  Creating: ${title}`);

      const result = await handleMemCreate({
        resource: 'document',
        data: {
          docType: 'article',
          title,
          content
        },
        scope: { userId }
      });

      const parsed = JSON.parse(result.content[0].text);
      if (parsed.error) {
        console.log(`  ❌ Error: ${parsed.error}`);
      } else {
        console.log(`  ✅ Created: ${parsed.id}`);
        console.log(`     URI: ${parsed.uri}`);
        createdDocs.push(parsed.id);
      }
      console.log('');
    }

    // Step 2: READ - Search
    console.log('🔍 Step 2: READ - Searching...\n');

    const searchTerms = ['大模型', 'AI Agent', 'OpenAI', 'Video'];

    for (const term of searchTerms) {
      console.log(`  Searching: "${term}"`);

      const result = await handleMemRead({
        resource: 'document',
        query: { search: term, searchMode: 'hybrid', limit: 3 },
        scope: { userId }
      });

      const parsed = JSON.parse(result.content[0].text);
      if (parsed.error) {
        console.log(`  ❌ Error: ${parsed.error}`);
      } else {
        const results = Array.isArray(parsed) ? parsed : parsed.results || [];
        console.log(`  ✅ Found: ${results.length} results`);
        for (const r of results) {
          console.log(`     - ${r.id || r.uri}: ${r.title || r.abstract?.substring(0, 50)}`);
        }
      }
      console.log('');
    }

    // Step 3: READ - Tiered content
    console.log('📖 Step 3: READ - Tiered content...\n');

    if (createdDocs.length > 0) {
      const docId = createdDocs[0];

      console.log(`  Reading L0 (abstract):`);
      const l0Result = await handleMemRead({
        resource: 'document',
        query: { id: docId, tier: 'L0' },
        scope: { userId }
      });
      const l0Parsed = JSON.parse(l0Result.content[0].text);
      console.log(`  ${l0Parsed.abstract?.substring(0, 100) || 'N/A'}...`);
      console.log('');

      console.log(`  Reading L1 (overview):`);
      const l1Result = await handleMemRead({
        resource: 'document',
        query: { id: docId, tier: 'L1' },
        scope: { userId }
      });
      const l1Parsed = JSON.parse(l1Result.content[0].text);
      console.log(`  Length: ${l1Parsed.overview?.length || 0} characters`);
      console.log('');
    }

    // Step 4: UPDATE
    console.log('✏️ Step 4: UPDATE...\n');

    if (createdDocs.length > 0) {
      const docId = createdDocs[0];
      console.log(`  Updating: ${docId}`);

      const result = await handleMemUpdate({
        resource: 'document',
        id: docId,
        data: { title: 'UPDATED - Production Test' },
        scope: { userId }
      });

      const parsed = JSON.parse(result.content[0].text);
      console.log(`  ✅ Title updated to: ${parsed.title}`);
      console.log('');
    }

    // Step 5: DELETE (cleanup one)
    console.log('🗑️ Step 5: DELETE...\n');

    if (createdDocs.length > 1) {
      const docIdToDelete = createdDocs[createdDocs.length - 1];
      console.log(`  Deleting: ${docIdToDelete}`);

      const result = await handleMemDelete({
        resource: 'document',
        id: docIdToDelete,
        scope: { userId }
      });

      const parsed = JSON.parse(result.content[0].text);
      console.log(`  ✅ Deleted: ${parsed.success}`);
      createdDocs.pop();
      console.log('');
    }

    // Summary
    console.log('========================================');
    console.log('Test Complete');
    console.log(`Created: ${createdDocs.length} documents`);
    console.log(`Remaining: ${createdDocs.length} documents`);
    console.log('========================================\n');

    console.log('To cleanup all documents, run:');
    console.log('  bun run tests/production/cleanup.ts');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run if executed directly
runProductionTest();

export { runProductionTest };