import { authenticatedUser } from "@/lib/auth/supabase";
import { validateChunks } from "@/lib/rag/ingest";
import { REVIEWED_ADDENDUM } from "@/lib/rag/reviewed-addendum";
import { getVectorStore } from "@/lib/rag/vectorstore";

export const runtime = "nodejs";
export const maxDuration = 300;

// This endpoint accepts no source text from the caller. It publishes only the
// reviewed, versioned passages that were included in this deployment.
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = await authenticatedUser(token);
  if (user?.email?.toLowerCase() !== "naman070609@gmail.com") {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const errors = validateChunks(REVIEWED_ADDENDUM);
  if (errors.length) {
    return Response.json({ error: "Review validation failed", errors }, { status: 500 });
  }

  try {
    const store = getVectorStore();
    if (store.name !== "qdrant") {
      return Response.json({ error: "The live Qdrant store is required" }, { status: 503 });
    }
    const existing = await store.findByIds(REVIEWED_ADDENDUM.map((chunk) => chunk.id), {});
    const byId = new Map(existing.map((chunk) => [chunk.id, chunk]));
    const pending = REVIEWED_ADDENDUM.filter((chunk) => {
      const current = byId.get(chunk.id);
      return !current || current.text !== chunk.text ||
        canonical(current.meta) !== canonical(chunk.meta);
    });
    // Small embedding batches fit the free Workers AI request limits. Earlier
    // reviewed rows are skipped, so repeat publishing does not burn quota.
    for (let i = 0; i < pending.length; i += 12) {
      await store.upsert(pending.slice(i, i + 12));
    }
    return Response.json({ published: pending.length, total: await store.count() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Publishing failed" }, { status: 500 });
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
