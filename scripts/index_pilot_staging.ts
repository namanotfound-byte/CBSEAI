/** Upload the tiny reviewed pilot batch into a versioned Qdrant collection.
 * Never creates or updates the live alias. Dry run unless --apply is supplied.
 */
import { readFile } from "node:fs/promises";
import { validateChunks } from "../lib/rag/ingest";
import type { Chunk } from "../lib/types";

const target = "cbse_10_pilot_20260924_v2";
async function main() {
  const apply = process.argv.includes("--apply");
  const rows = (await readFile("data/corpus/pilot-reviewed-batch.jsonl", "utf8"))
    .split("\n").filter(Boolean).map((line) => JSON.parse(line)) as Chunk[];
  const errors = validateChunks(rows);
  if (errors.length) throw new Error(`Pilot batch validation failed: ${errors.slice(0, 5).join("; ")}`);
  if (rows.length !== 47 || rows.filter((row) => row.meta.kind === "syllabus").length !== 27 ||
      rows.filter((row) => row.meta.kind === "ncert" && row.meta.subject === "science").length !== 12 ||
      rows.filter((row) => row.meta.kind === "ncert" && row.meta.subject === "maths").length !== 8 ||
      rows.some((row) => (row.meta as Chunk["meta"] & { reviewBatch?: string }).reviewBatch !== "pilot-20260924-v2")) {
    throw new Error("Unexpected pilot batch composition");
  }

  console.log(JSON.stringify({ status: apply ? "indexing" : "dry_run", target, rows: rows.length }));
  if (apply) {
    if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY ||
        !process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
      throw new Error("Protected Qdrant and Cloudflare credentials are required");
    }
    // Set the versioned collection before the app's configuration module loads.
    process.env.QDRANT_COLLECTION = target;
    process.env.QDRANT_AUTO_CREATE = "true";
    const { getVectorStore } = await import("../lib/rag/vectorstore");
    const store = getVectorStore();
    await store.initialize();
    for (let offset = 0; offset < rows.length; offset += 8) {
      await store.upsert(rows.slice(offset, offset + 8));
      console.log(JSON.stringify({ status: "batch_indexed", indexed: Math.min(offset + 8, rows.length) }));
    }
    const count = await store.count();
    if (count !== rows.length) throw new Error(`Staging index count mismatch: ${count}`);
    console.log(JSON.stringify({ status: "staging_ready", target, count }));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Pilot indexing failed");
  process.exitCode = 1;
});
