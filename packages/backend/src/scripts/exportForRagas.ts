import 'dotenv/config';
import fs from 'fs/promises';
import { getDb, messages } from '@chalk/shared';
import { eq, desc } from 'drizzle-orm';

/**
 * Helper script to export recent chat turns into a JSONL format
 * suitable for Python-based RAGAS evaluation.
 * 
 * RAGAS typically expects:
 * - question: The user's query
 * - answer: The LLM's response
 * - contexts: Array of retrieved chunks
 * - ground_truth: (Optional) Expert-provided ideal answer
 * 
 * Usage: npx tsx src/scripts/exportForRagas.ts [chatId] [limit]
 */
async function exportForRagas() {
  const chatId = process.argv[2];
  const limit = parseInt(process.argv[3] || '50', 10);

  if (!chatId) {
    console.error('Usage: npx tsx src/scripts/exportForRagas.ts <chatId> [limit]');
    process.exit(1);
  }

  console.log(`[Export] Fetching up to ${limit} turns for chat: ${chatId}`);

  try {
    const db = getDb();
    
    // Fetch messages for the chat
    const allMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(desc(messages.createdAt))
      .limit(limit * 2); // user + assistant pairs

    // Group into turns (user -> assistant)
    const turns = [];
    let currentUserMsg = null;

    // Traverse oldest to newest (by reversing the desc array)
    const sortedMessages = allMessages.reverse();

    for (const msg of sortedMessages) {
      if (msg.role === 'user') {
        currentUserMsg = msg;
      } else if (msg.role === 'assistant' && currentUserMsg) {
        turns.push({
          question: currentUserMsg.content,
          answer: msg.content,
          contexts: msg.retrievedChunkIds ? JSON.parse(msg.retrievedChunkIds) : [],
          // RAGAS ground_truth can be populated manually later by an SME
          ground_truth: "",
        });
        currentUserMsg = null;
      }
    }

    // Write to a JSONL file
    const outputPath = `./ragas_export_${chatId.substring(0, 8)}.jsonl`;
    const jsonlContent = turns.map(t => JSON.stringify(t)).join('\n');
    
    await fs.writeFile(outputPath, jsonlContent, 'utf-8');
    console.log(`[Export] Successfully wrote ${turns.length} turns to ${outputPath}`);
    
    process.exit(0);
  } catch (error) {
    console.error('[Export] Failed:', error);
    process.exit(1);
  }
}

exportForRagas();
