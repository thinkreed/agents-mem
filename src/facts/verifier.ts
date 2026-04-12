/**
 * @file src/facts/verifier.ts
 * @description Fact verification with source cross-check
 */

import { getFactById, updateFact } from '../sqlite/facts';
import { getDocumentById } from '../sqlite/documents';
import { getMessageById } from '../sqlite/messages';
import { getConversationById } from '../sqlite/conversations';

/** Confidence levels for verification outcomes */
const CONFIDENCE_MATCH = 0.9;     // Fact content found in source
const CONFIDENCE_NO_MATCH = 0.4;  // Fact content NOT found in source
const CONFIDENCE_MISSING = 0.3;   // Source document/message/conversation not found

/**
 * Verify fact by cross-checking with source content
 * 
 * Process:
 * 1. Get fact from database
 * 2. Get source document/message/conversation based on source_type
 * 3. Check if fact content is contained in source (simple containment check)
 * 4. Calculate confidence and verification status:
 *    - Match: confidence = 0.9, verified = true
 *    - No match: confidence = 0.4, verified = false
 *    - Missing source: confidence = 0.3, verified = false
 * 5. Update fact with verified status and confidence
 */
export async function verifyFact(factId: string): Promise<boolean> {
  const fact = getFactById(factId);
  if (!fact) return false;
  
  // Get source content based on source_type
  let sourceContent: string | null = null;
  
  switch (fact.source_type) {
    case 'documents':
      const doc = getDocumentById(fact.source_id);
      sourceContent = doc?.content ?? null;
      break;
    
    case 'messages':
      const msg = getMessageById(fact.source_id);
      sourceContent = msg?.content ?? null;
      break;
    
    case 'conversations':
      const conv = getConversationById(fact.source_id);
      // For conversations, use title as the source content
      sourceContent = conv?.title ?? null;
      break;
    
    default:
      // Unknown source type - treat as missing
      sourceContent = null;
  }
  
  // Determine verification status and confidence
  let verified: boolean;
  let confidence: number;
  
  if (sourceContent === null) {
    // Source not found
    verified = false;
    confidence = CONFIDENCE_MISSING;
  } else {
    // Simple containment check - normalize both for comparison
    const normalizedFact = fact.content.toLowerCase().trim();
    const normalizedSource = sourceContent.toLowerCase();
    
    if (normalizedSource.includes(normalizedFact)) {
      verified = true;
      confidence = CONFIDENCE_MATCH;
    } else {
      verified = false;
      confidence = CONFIDENCE_NO_MATCH;
    }
  }
  
  // Update fact with verification results
  updateFact(factId, { verified, confidence });
  
  return verified;
}

/**
 * Verify multiple facts
 */
export async function verifyFacts(factIds: string[]): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  
  for (const id of factIds) {
    results[id] = await verifyFact(id);
  }
  
  return results;
}