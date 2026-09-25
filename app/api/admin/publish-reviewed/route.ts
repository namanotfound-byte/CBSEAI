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
    await store.upsert(REVIEWED_ADDENDUM);
    return Response.json({ published: REVIEWED_ADDENDUM.length, total: await store.count() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Publishing failed" }, { status: 500 });
  }
}
