import { createHash } from "node:crypto";
import { env } from "../config";
import type { Chunk, RetrievalFilters } from "../types";
import { cosine, getEmbedder, getSparseEmbedder } from "./embeddings";
import { SEED_CHUNKS } from "./seed";

export interface VectorStore {
  name: string;
  initialize(): Promise<void>;
  upsert(chunks: Chunk[]): Promise<void>;
  search(
    query: string,
    filters: RetrievalFilters,
  ): Promise<(Chunk & { score: number })[]>;
  findByJoinPrefixes(
    prefixes: string[],
    filters: RetrievalFilters,
  ): Promise<(Chunk & { score: number })[]>;
  findByIds(
    ids: string[],
    filters: RetrievalFilters,
  ): Promise<(Chunk & { score: number })[]>;
  count(): Promise<number>;
}

/* ────────────────────────── in-memory ──────────────────────────────────── */

/**
 * Holds the corpus in the Node process. Fine for the seed set and for local
 * work; it resets on every deploy, so move to Qdrant before the December
 * launch.
 */
function createMemoryStore(): VectorStore {
  const store: (Chunk & { embedding: number[] })[] = [];
  let warmed: Promise<void> | null = null;

  async function warm() {
    if (!warmed) {
      warmed = (async () => {
        const embedder = getEmbedder();
        const vectors = await embedder.embed(SEED_CHUNKS.map((c) => c.text));
        SEED_CHUNKS.forEach((c, i) =>
          store.push({ ...c, embedding: vectors[i] }),
        );
      })();
    }
    return warmed;
  }

  return {
    name: "memory",
    async initialize() {
      await warm();
    },
    async upsert(chunks) {
      await warm();
      const embedder = getEmbedder();
      const vectors = await embedder.embed(chunks.map((c) => c.text));
      chunks.forEach((c, i) => {
        const idx = store.findIndex((s) => s.id === c.id);
        const row = { ...c, embedding: vectors[i] };
        if (idx >= 0) store[idx] = row;
        else store.push(row);
      });
    },
    async search(query, filters) {
      await warm();
      const embedder = getEmbedder();
      const [qv] = await embedder.embed([query]);
      const queryTerms = terms(query);

      const syllabusVersion = filters.syllabusVersion ?? env.syllabusVersion;
      return store
        .filter((c) => c.meta.syllabusVersion === syllabusVersion)
        .filter((c) => c.meta.inActiveSyllabus === true)
        .filter((c) => assessmentAllowed(c.meta, filters))
        .filter((c) => !filters.syllabusTopicId || c.meta.syllabusTopicId === filters.syllabusTopicId)
        .filter((c) => !filters.subject || c.meta.subject === filters.subject)
        .filter((c) => !filters.chapter || c.meta.chapter === filters.chapter)
        .filter((c) => !filters.chapters?.length || filters.chapters.includes(c.meta.chapter))
        .filter((c) => !filters.itemIdentitySearch || c.meta.itemIdentitySearch === filters.itemIdentitySearch)
        .filter((c) => !filters.kinds?.length || filters.kinds.includes(c.meta.kind))
        .map((c) => {
          const lexical = overlap(
            queryTerms,
            terms([
              c.meta.kind,
              c.meta.chunkType ?? "",
              c.meta.heading ?? "",
              ...(c.meta.conceptTags ?? []),
              c.text,
            ].join(" ")),
          );
          const semantic = cosine(qv, c.embedding);
          return {
            ...c,
            score: lexical > 0 ? 0.35 + lexical * 0.55 + semantic * 0.1 : semantic * 0.1,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, filters.topK ?? 5);
    },
    async findByJoinPrefixes(prefixes, filters) {
      await warm();
      if (!prefixes.length) return [];

      const syllabusVersion = filters.syllabusVersion ?? env.syllabusVersion;
      return store
        .filter((c) => c.meta.syllabusVersion === syllabusVersion)
        .filter((c) => c.meta.inActiveSyllabus === true)
        .filter((c) => assessmentAllowed(c.meta, filters))
        .filter((c) => !filters.syllabusTopicId || c.meta.syllabusTopicId === filters.syllabusTopicId)
        .filter((c) => prefixes.includes(c.meta.joinPrefix ?? ""))
        .filter((c) => !filters.subject || c.meta.subject === filters.subject)
        .filter((c) => !filters.chapter || c.meta.chapter === filters.chapter)
        .filter((c) => !filters.chapters?.length || filters.chapters.includes(c.meta.chapter))
        .filter((c) => !filters.itemIdentitySearch || c.meta.itemIdentitySearch === filters.itemIdentitySearch)
        .filter((c) => !filters.kinds?.length || filters.kinds.includes(c.meta.kind))
        .slice(0, filters.topK ?? 24)
        .map((c) => ({ ...c, score: 1 }));
    },
    async findByIds(ids, filters) {
      await warm();
      if (!ids.length) return [];

      const syllabusVersion = filters.syllabusVersion ?? env.syllabusVersion;
      return store
        .filter((c) => ids.includes(c.id))
        .filter((c) => c.meta.syllabusVersion === syllabusVersion)
        .filter((c) => c.meta.inActiveSyllabus === true)
        .filter((c) => assessmentAllowed(c.meta, filters))
        .filter((c) => !filters.syllabusTopicId || c.meta.syllabusTopicId === filters.syllabusTopicId)
        .filter((c) => !filters.subject || c.meta.subject === filters.subject)
        .filter((c) => !filters.chapter || c.meta.chapter === filters.chapter)
        .filter((c) => !filters.chapters?.length || filters.chapters.includes(c.meta.chapter))
        .filter((c) => !filters.itemIdentitySearch || c.meta.itemIdentitySearch === filters.itemIdentitySearch)
        .map((c) => ({ ...c, score: 1 }));
    },
    async count() {
      await warm();
      return store.length;
    },
  };
}

function assessmentAllowed(meta: Chunk["meta"], filters: RetrievalFilters) {
  // Development seed fixtures predate assessmentStatus; deployable corpus rows
  // are required to declare it by validateChunks.
  if (meta.assessmentStatus === undefined || meta.assessmentStatus === "summative") return true;
  if (filters.route !== "competency" || meta.assessmentStatus !== "formative" || meta.kind !== "item_bank") return false;
  return (meta.chunkType === "item_bank_question" && meta.practiceModeEligible === true && meta.answerVisibility === "question_only") ||
    (meta.chunkType === "item_bank_marking_scheme" && meta.practiceModeEligible === false && Boolean(meta.pairedQuestionId) && meta.answerVisibility === "solution_only");
}

const STOP_WORDS = new Set([
  "a", "an", "and", "answer", "for", "in", "is", "it", "mark", "marks",
  "of", "on", "the", "to", "what", "which", "with", "write", "about",
  "chapter", "current", "deleted", "explain", "give", "out", "process",
  "syllabus", "topic", "using", "why",
]);

function terms(text: string) {
  return new Set(
    (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
  );
}

function overlap(query: Set<string>, document: Set<string>) {
  if (!query.size) return 0;
  let matched = 0;
  query.forEach((token) => {
    if (document.has(token)) matched += 1;
  });
  return matched / query.size;
}

/* ──────────────────────────── Qdrant ───────────────────────────────────── */

/**
 * Recommended production store. Create the collection with the embedder's
 * dimension and payload indexes on subject, chapter, kind and syllabus topic,
 * then fill
 * in the two fetches below — the interface above is all the app depends on.
 *
 *   PUT /collections/{c}   { vectors: { size, distance: "Cosine" } }
 *   PUT /collections/{c}/index   { field_name: "syllabusVersion", field_schema: "keyword" }
 */
export function createQdrantStore(
  settings: Pick<typeof env, "qdrantUrl" | "qdrantCollection" | "qdrantApiKey" | "qdrantAutoCreate" | "qdrantVectorSize" | "syllabusVersion" | "hybridSearch"> = env,
): VectorStore {
  const base = settings.qdrantUrl.replace(/\/$/, "");
  const collection = encodeURIComponent(settings.qdrantCollection);
  const headers = {
    "Content-Type": "application/json",
    ...(settings.qdrantApiKey ? { "api-key": settings.qdrantApiKey } : {}),
  };
  let ready: Promise<void> | null = null;

  async function qdrant(path: string, init?: RequestInit) {
    if (!base) throw new Error("RAG_PROVIDER=qdrant requires QDRANT_URL.");
    const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...init?.headers } });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Qdrant returned ${res.status}. ${detail.slice(0, 300)}`);
    }
    return res.json();
  }

  async function ensureCollection() {
    if (!ready) {
      ready = (async () => {
        if (!base) throw new Error("RAG_PROVIDER=qdrant requires QDRANT_URL.");
        const check = await fetch(`${base}/collections/${collection}`, { headers });
        if (check.status === 404) {
          if (!settings.qdrantAutoCreate) {
            throw new Error(`Qdrant collection ${settings.qdrantCollection} does not exist.`);
          }
          const created = await fetch(`${base}/collections/${collection}`, {
            method: "PUT",
            headers,
            body: JSON.stringify({
              vectors: {
                dense: { size: settings.qdrantVectorSize, distance: "Cosine" },
              },
              sparse_vectors: {
                sparse: { index: { on_disk: false } },
              },
            }),
          });
          if (!created.ok) throw new Error(`Qdrant collection creation returned ${created.status}`);
        } else if (!check.ok) {
          throw new Error(`Qdrant collection check returned ${check.status}`);
        }

        if (settings.qdrantAutoCreate) {
          const indexes: [string, string][] = [
            ["sourceId", "keyword"],
            ["meta.subject", "keyword"],
            ["meta.chapter", "integer"],
            ["meta.kind", "keyword"],
            ["meta.sourceYear", "keyword"],
            ["meta.syllabusVersion", "keyword"],
            ["meta.syllabusTopicId", "keyword"],
            ["meta.inActiveSyllabus", "bool"],
            ["meta.reviewStatus", "keyword"],
            ["meta.assessmentStatus", "keyword"],
            ["meta.joinPrefix", "keyword"],
          ];
          await Promise.all(indexes.map(async ([field_name, field_schema]) => {
            const response = await fetch(`${base}/collections/${collection}/index?wait=true`, {
              method: "PUT",
              headers,
              body: JSON.stringify({ field_name, field_schema }),
            });
            if (!response.ok && response.status !== 409) {
              throw new Error(`Qdrant index ${field_name} returned ${response.status}`);
            }
          }));
        }
      })();
    }
    return ready;
  }

  function must(filters: RetrievalFilters, prefixes?: string[]) {
    const clauses: Record<string, unknown>[] = [
      { key: "meta.syllabusVersion", match: { value: filters.syllabusVersion ?? settings.syllabusVersion } },
      { key: "meta.inActiveSyllabus", match: { value: true } },
      { key: "meta.reviewStatus", match: { value: "approved" } },
      { key: "meta.assessmentStatus", match: { any: filters.route === "competency" ? ["summative", "formative"] : ["summative"] } },
    ];
    if (filters.syllabusTopicId) {
      clauses.push({ key: "meta.syllabusTopicId", match: { value: filters.syllabusTopicId } });
    }
    if (filters.subject) clauses.push({ key: "meta.subject", match: { value: filters.subject } });
    if (filters.chapter) clauses.push({ key: "meta.chapter", match: { value: filters.chapter } });
    if (filters.chapters?.length) clauses.push({ key: "meta.chapter", match: { any: filters.chapters } });
    if (filters.kinds?.length) {
      clauses.push({ key: "meta.kind", match: { any: filters.kinds } });
    }
    if (filters.itemIdentitySearch) {
      const identityMatch = filters.itemIdentitySearch.match(/^maths10([a-z0-9]+)$/i);
      const prefixes = identityMatch
        ? [
            `2026|CBSE-CBE-ItemBank|Maths10|Maths10${identityMatch[1].toUpperCase()}`,
            `2026|CBSE-CBE-ItemBank|Maths10|Maths10${identityMatch[1].toUpperCase()}|Q1`,
          ]
        : [];
      clauses.push(prefixes.length
        ? { key: "meta.joinPrefix", match: { any: prefixes } }
        : { key: "meta.joinPrefix", match: { value: "__invalid_item_bank_identity__" } });
    }
    if (prefixes?.length) clauses.push({ key: "meta.joinPrefix", match: { any: prefixes } });
    return clauses;
  }

  function pointId(id: string) {
    const chars = createHash("sha256").update(id).digest("hex").slice(0, 32).split("");
    chars[12] = "5";
    chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
    const hex = chars.join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function fromQdrant(hit: {
    id: string | number;
    score?: number;
    payload?: { sourceId?: string; text?: string; meta?: Chunk["meta"] };
  }): (Chunk & { score: number }) | null {
    if (!hit.payload?.text || !hit.payload.meta) return null;
    return {
      id: hit.payload.sourceId ?? String(hit.id),
      text: hit.payload.text,
      meta: hit.payload.meta,
      score: hit.score ?? 1,
    };
  }

  function allowed(chunk: Chunk & { score: number }, filters: RetrievalFilters) {
    return (
      chunk.meta.syllabusVersion === (filters.syllabusVersion ?? settings.syllabusVersion) &&
      chunk.meta.inActiveSyllabus === true &&
      chunk.meta.reviewStatus === "approved" &&
      assessmentAllowed(chunk.meta, filters) &&
      (!filters.syllabusTopicId || chunk.meta.syllabusTopicId === filters.syllabusTopicId) &&
      (!filters.subject || chunk.meta.subject === filters.subject) &&
      (!filters.chapter || chunk.meta.chapter === filters.chapter)
      && (!filters.chapters?.length || filters.chapters.includes(chunk.meta.chapter)) &&
      (!filters.itemIdentitySearch || chunk.meta.itemIdentitySearch === filters.itemIdentitySearch) &&
      (!filters.kinds?.length || filters.kinds.includes(chunk.meta.kind))
    );
  }

  return {
    name: "qdrant",
    async initialize() {
      await ensureCollection();
    },
    async upsert(chunks) {
      await ensureCollection();
      const embedder = getEmbedder();
      const sparseEmbedder = getSparseEmbedder();
      const texts = chunks.map((c) => c.text);
      const [vectors, sparseVectors] = await Promise.all([
        embedder.embed(texts),
        sparseEmbedder.embed(texts),
      ]);
      await qdrant(`/collections/${collection}/points?wait=true`, {
        method: "PUT",
        body: JSON.stringify({
          points: chunks.map((chunk, i) => ({
            id: pointId(chunk.id),
            vector: { dense: vectors[i], sparse: sparseVectors[i] },
            payload: {
              sourceId: chunk.id,
              text: chunk.text,
              meta: chunk.meta,
            },
          })),
        }),
      });
    },
    async search(query, filters) {
      await ensureCollection();
      const embedder = getEmbedder();
      const sparseEmbedder = getSparseEmbedder();
      const [[vector], [sparseVector]] = await Promise.all([
        embedder.embed([query]),
        sparseEmbedder.embed([query]),
      ]);
      const filter = { must: must(filters) };
      const prefetch = [
        { query: vector, using: "dense", limit: Math.max(40, filters.topK ?? 8), filter },
        ...(settings.hybridSearch
          ? [{ query: sparseVector, using: "sparse", limit: Math.max(40, filters.topK ?? 8), filter }]
          : []),
      ];
      const json = await qdrant(`/collections/${collection}/points/query`, {
        method: "POST",
        body: JSON.stringify({
          prefetch,
          query: settings.hybridSearch ? { fusion: "rrf" } : vector,
          ...(settings.hybridSearch ? {} : { using: "dense" }),
          limit: filters.topK ?? 5,
          with_payload: true,
        }),
      });
      return ((json.result?.points ?? json.result ?? []).map(fromQdrant).filter(Boolean) as (Chunk & { score: number })[])
        .filter((chunk) => assessmentAllowed(chunk.meta, filters));
    },
    async findByJoinPrefixes(prefixes, filters) {
      if (!prefixes.length) return [];
      await ensureCollection();
      const json = await qdrant(`/collections/${collection}/points/scroll`, {
        method: "POST",
        body: JSON.stringify({
          limit: filters.topK ?? 24,
          with_payload: true,
          with_vector: false,
          filter: { must: must(filters, prefixes) },
        }),
      });
      return ((json.result?.points ?? []).map(fromQdrant).filter(Boolean) as (Chunk & { score: number })[])
        .filter((chunk) => assessmentAllowed(chunk.meta, filters));
    },
    async findByIds(ids, filters) {
      if (!ids.length) return [];
      await ensureCollection();
      const json = await qdrant(`/collections/${collection}/points`, {
        method: "POST",
        body: JSON.stringify({
          ids: ids.map(pointId),
          with_payload: true,
          with_vector: false,
        }),
      });
      return ((json.result ?? []).map(fromQdrant).filter(Boolean) as (Chunk & { score: number })[])
        .filter((chunk) => allowed(chunk, filters));
    },
    async count() {
      await ensureCollection();
      const json = await qdrant(`/collections/${collection}/points/count`, {
        method: "POST",
        body: JSON.stringify({ exact: true }),
      });
      return json.result?.count ?? 0;
    },
  };
}

/* ─────────────────────────── selection ─────────────────────────────────── */

let singleton: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (singleton) return singleton;
  switch (env.ragProvider) {
    case "qdrant": singleton = createQdrantStore(); break;
    case "memory": singleton = createMemoryStore(); break;
    default: throw new Error(`Unsupported RAG_PROVIDER: ${env.ragProvider}`);
  }
  return singleton;
}
