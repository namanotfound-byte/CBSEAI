import { env } from "@/lib/config";
import { getVectorStore } from "@/lib/rag/vectorstore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = getVectorStore();
  let count: number | null = null;
  let storeConnected = false;

  const credentials = {
    model: Boolean(env.modelApiKey || env.groqApiKey),
    cloudflare: Boolean(env.cloudflareAccountId && env.cloudflareApiToken),
    qdrant: Boolean(env.qdrantUrl && env.qdrantApiKey),
  };

  try {
    await store.initialize();
    count = await store.count();
    storeConnected = true;
  } catch {
    // Keep provider error bodies and connection details out of this public route.
  }

  const configured = credentials.model && credentials.cloudflare && credentials.qdrant;
  const ready = configured && storeConnected && (count ?? 0) > 0;

  return Response.json({
    ragProvider: env.ragProvider,
    store: store.name,
    chunks: count,
    syllabusVersion: env.syllabusVersion,
    embeddingsProvider: env.embeddingsProvider,
    embeddingsModel:
      env.embeddingsProvider === "cloudflare"
        ? "@cf/baai/bge-m3"
        : env.embeddingsModel || null,
    hybridSearch: env.ragProvider === "qdrant" ? env.hybridSearch : false,
    sparseEmbeddings: env.sparseEmbeddingsBaseUrl ? "remote" : "local-lexical",
    reranker:
      env.rerankerProvider === "cloudflare"
        ? "@cf/baai/bge-reranker-base"
        : env.rerankerProvider === "remote" && env.rerankerBaseUrl
          ? env.rerankerModel
          : "retrieval-order fallback",
    cache: env.cacheProvider,
    nli: env.nliBaseUrl ? env.nliModel : "structural-only",
    diagrams: env.diagramSigningSecret ? "signed" : "not-configured",
    ingestAuth: Boolean(env.ingestApiKey),
    qdrantCollection:
      env.ragProvider === "qdrant" ? env.qdrantCollection : null,
    credentials,
    storeConnected,
    ready,
    status: !configured
      ? "credentials_missing"
      : !storeConnected
        ? "collection_unavailable"
        : !count
          ? "corpus_empty"
          : "ready",
  });
}
