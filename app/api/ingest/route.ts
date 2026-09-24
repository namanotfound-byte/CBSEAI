import { timingSafeEqual } from "node:crypto";
import { chunkText } from "@/lib/rag/retriever";
import { getVectorStore } from "@/lib/rag/vectorstore";
import { env } from "@/lib/config";
import type { Chunk } from "@/lib/types";
import { validateChunks } from "@/lib/rag/ingest";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Corpus ingestion.
 *
 * Send either raw text to be chunked here, or pre-chunked rows if your PDF
 * pipeline already handles segmentation (it probably should — page numbers are
 * easier to keep accurate upstream).
 *
 *   POST /api/ingest
 *   { "text": "...", "meta": { "kind": "ncert", "subject": "science",
 *                              "chapter": 5, "page": 95 } }
 *
 *   POST /api/ingest
 *   { "chunks": [ { "id": "...", "text": "...", "meta": { ... } } ] }
 *
 * Requests require the server-side ingest secret and approved metadata.
 */
export async function POST(req: Request) {
  if (!env.ingestApiKey) {
    return Response.json(
      { error: "INGEST_API_KEY is not configured." },
      { status: 503 },
    );
  }
  const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = Buffer.from(env.ingestApiKey);
  const candidate = Buffer.from(supplied);
  if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const store = getVectorStore();

  try {
    let chunks: Chunk[];

    if (Array.isArray(body.chunks)) {
      chunks = body.chunks;
    } else if (typeof body.text === "string" && body.meta) {
      chunks = chunkText(body.text, body.meta);
    } else {
      return Response.json(
        { error: "Send { text, meta } or { chunks }." },
        { status: 400 },
      );
    }

    const errors = validateChunks(chunks);
    if (errors.length) {
      return Response.json({ error: "Invalid chunks", errors }, { status: 400 });
    }

    await store.upsert(chunks);
    return Response.json({
      ingested: chunks.length,
      total: await store.count(),
      store: store.name,
      syllabusVersion: env.syllabusVersion,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Ingestion failed" },
      { status: 500 },
    );
  }
}
