import type { VectorStore } from "./vectorstore";

/**
 * Find rows already in the index before publishing reviewed corpus batches.
 * Competency scope admits approved formative item-bank pairs so publishing
 * them again does not embed them a second time. This is a lookup filter only;
 * normal theory retrieval still excludes formative content.
 */
export function findAlreadyPublishedReviewedChunks(store: VectorStore, ids: string[]) {
  return store.findByIds(ids, { route: "competency" });
}
