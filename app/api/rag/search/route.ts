import { retrieve } from "@/lib/rag/retriever";
import { routeQuery } from "@/lib/rag/router";
import { authenticatedUser } from "@/lib/auth/supabase";
import type { SourceKind, SubjectId } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Retrieval on its own, so you can eyeball what the model is being fed
 * without generating an answer. Useful while tuning chunk size and priority.
 *
 *   GET /api/rag/search?q=ohm's+law&subject=science&chapter=11
 */
export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!(await authenticatedUser(token))) {
    return Response.json({ error: "Sign in to search sources." }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  if (!q) {
    return Response.json({ error: "Pass a query as ?q=" }, { status: 400 });
  }

  const kinds = url.searchParams.get("kinds");
  const route = routeQuery(q);

  try {
    const sources = await retrieve(q, {
      subject: (url.searchParams.get("subject") as SubjectId) ?? undefined,
      chapter: Number(url.searchParams.get("chapter")) || undefined,
      kinds: kinds ? (kinds.split(",") as SourceKind[]) : undefined,
      route,
      topK: Number(url.searchParams.get("topK")) || 8,
    });
    return Response.json({ query: q, route, count: sources.length, sources });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Retrieval failed" },
      { status: 500 },
    );
  }
}
