import { env } from "../config";
import type { Chunk } from "../types";

type RankedChunk = Chunk & { score: number };

export async function rerank(
  query: string,
  chunks: RankedChunk[],
  limit: number,
): Promise<RankedChunk[]> {
  if (!chunks.length) return [];
  if (env.rerankerProvider === "none") return chunks.slice(0, limit);

  try {
    if (env.rerankerProvider === "cloudflare") {
      if (!env.cloudflareAccountId || !env.cloudflareApiToken) {
        throw new Error("Cloudflare reranker credentials are missing");
      }
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.cloudflareAccountId)}/ai/run/@cf/baai/bge-reranker-base`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.cloudflareApiToken}`,
          },
          body: JSON.stringify({
            query,
            contexts: chunks.map((chunk) => ({ text: chunk.text })),
            top_k: Math.min(limit, chunks.length),
          }),
        },
      );
      if (!res.ok) throw new Error(`Cloudflare reranker returned ${res.status}`);
      const json = await res.json();
      const rows: unknown = json.result?.response;
      if (!Array.isArray(rows)) throw new Error("Cloudflare reranker returned no scores");
      const ranked = rows
        .map((row: { id: number | string; score: number }) => {
          const chunk = chunks[Number(row.id)];
          return chunk && Number.isFinite(row.score) ? { ...chunk, score: row.score } : null;
        })
        .filter((row): row is RankedChunk => row !== null)
        .slice(0, limit);
      if (!ranked.length) throw new Error("Cloudflare reranker returned no usable scores");
      return ranked;
    }
    if (env.rerankerProvider !== "remote" || !env.rerankerBaseUrl) {
      throw new Error("Remote reranker endpoint is not configured");
    }
    const res = await fetch(env.rerankerBaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.rerankerApiKey
          ? { Authorization: `Bearer ${env.rerankerApiKey}` }
          : {}),
      },
      body: JSON.stringify({
        model: env.rerankerModel,
        query,
        documents: chunks.map((chunk) => chunk.text),
        top_n: Math.min(limit, chunks.length),
        return_documents: false,
      }),
    });
    if (!res.ok) throw new Error(`reranker returned ${res.status}`);
    const json = await res.json();
    const rows = json.results ?? json.data ?? [];
    return rows
      .map((row: { index: number; relevance_score?: number; score?: number }) => {
        const chunk = chunks[row.index];
        return chunk
          ? { ...chunk, score: row.relevance_score ?? row.score ?? chunk.score }
          : null;
      })
      .filter(Boolean) as RankedChunk[];
  } catch (error) {
    console.warn("reranker unavailable; using retrieval order", error);
    return chunks.slice(0, limit);
  }
}
