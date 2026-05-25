// SPDX-License-Identifier: AGPL-3.0-or-later

import { chunkText } from "./chunker.js";
import {
  deleteChunksByDocumentId,
  insertChunksAndFinalize,
  updateDocumentStatus,
} from "./store.js";
import { generateEmbeddings } from "../memory/embedder.js";

/**
 * Process a document: chunk the text, generate embeddings, store chunks.
 * Designed to be called asynchronously after document creation.
 *
 * Chunk insertion + status update are wrapped in a DB transaction:
 * if insertion fails, the document is set to "error" (never "ready" with incomplete data).
 */
export async function processDocument(
  docId: string,
  instanceId: string,
  textContent: string,
  openaiApiKey?: string,
): Promise<{ chunkCount: number }> {
  try {
    await updateDocumentStatus(docId, "processing");

    // Reindex-safe: drop any existing chunks before regenerating.
    // No-op on first ingestion.
    await deleteChunksByDocumentId(docId);

    const chunks = chunkText(textContent);

    if (chunks.length === 0) {
      await updateDocumentStatus(docId, "ready", { chunkCount: 0 });
      return { chunkCount: 0 };
    }

    // Generate embeddings in batches
    const BATCH_SIZE = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await generateEmbeddings(
        batch.map((c) => c.content),
        openaiApiKey,
      );
      allEmbeddings.push(...embeddings);
    }

    // Build chunk records with absolute cumulative chunkIndex (array index, not per-batch)
    const chunkRecords = chunks.map((chunk, i) => ({
      documentId: docId,
      instanceId,
      content: chunk.content,
      embedding: allEmbeddings[i],
      chunkIndex: i,
    }));

    // Insert chunks + mark document as "ready" atomically in a transaction
    const inserted = await insertChunksAndFinalize(docId, chunkRecords);

    console.log(`[Knowledge] Processed doc ${docId}: ${inserted} chunks embedded`);
    return { chunkCount: inserted };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Knowledge] Failed to process doc ${docId}: ${message}`);
    await updateDocumentStatus(docId, "error", { errorMessage: message });
    throw err;
  }
}
