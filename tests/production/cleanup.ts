/**
 * @file tests/production/cleanup.ts
 * @description Cleanup all test documents
 */

import { handleMemRead, handleMemDelete } from '../../src/tools/crud_handlers';

async function cleanupAllDocuments(userId: string) {
  console.log(`🗑️ Cleaning up documents for user: ${userId}\n`);

  // List all documents
  const listResult = await handleMemRead({
    resource: 'document',
    query: { list: true },
    scope: { userId }
  });

  const documents = JSON.parse(listResult.content[0].text);
  console.log(`Found ${documents.length} documents\n`);

  // Delete each one
  for (const doc of documents) {
    console.log(`Deleting: ${doc.id}`);
    await handleMemDelete({
      resource: 'document',
      id: doc.id,
      scope: { userId }
    });
  }

  console.log(`\n✅ Cleanup complete. Deleted ${documents.length} documents.`);
}

// Run cleanup
cleanupAllDocuments('production-test-user');
cleanupAllDocuments('test-user-production');

export { cleanupAllDocuments };