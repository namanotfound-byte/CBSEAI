import { env } from "../config";

export interface Embedder {
  name: string;
  dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export interface SparseVector {
  indices: number[];
  values: number[];
}

export interface SparseEmbedder {
  name: string;
  embed(texts: string[]): Promise<SparseVector[]>;
}

/** Any OpenAI-compatible /v1/embeddings endpoint. BGE-M3 is a good default
 *  for this corpus — it handles Devanagari and English in one model, which
 *  matters once Hindi and SST are ingested. */
const remote: Embedder = {
  name: "remote",
  dimensions: 1024,
  async embed(texts) {
    const res = await fetch(`${env.embeddingsBaseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.embeddingsApiKey
          ? { Authorization: `Bearer ${env.embeddingsApiKey}` }
          : {}),
      },
      body: JSON.stringify({ model: env.embeddingsModel, input: texts }),
    });
    if (!res.ok) {
      throw new Error(`Embeddings endpoint returned ${res.status}`);
    }
    const json = await res.json();
    return json.data.map((d: { embedding: number[] }) => d.embedding);
  },
};

/** BGE-M3 through Cloudflare's free Workers AI allowance. No local model. */
const cloudflare: Embedder = {
  name: "cloudflare-bge-m3",
  dimensions: 1024,
  async embed(texts) {
    if (!env.cloudflareAccountId || !env.cloudflareApiToken) {
      throw new Error("BGE-M3 embeddings need CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.");
    }
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.cloudflareAccountId)}/ai/run/@cf/baai/bge-m3`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.cloudflareApiToken}`,
        },
        body: JSON.stringify({ text: texts }),
      },
    );
    if (!res.ok) throw new Error(`Cloudflare BGE-M3 returned ${res.status}`);
    const json = await res.json();
    const vectors: unknown = json.result?.data;
    if (!Array.isArray(vectors) || vectors.length !== texts.length ||
        !vectors.every((vector) => Array.isArray(vector) && vector.length === 1024)) {
      throw new Error("Cloudflare BGE-M3 returned an unexpected embedding shape.");
    }
    return vectors as number[][];
  },
};

/** Deterministic hashing embedder. Good enough to exercise the plumbing and
 *  to keep tests offline; useless for real semantic search. */
const mock: Embedder = {
  name: "mock",
  dimensions: 256,
  async embed(texts) {
    return texts.map((text) => {
      const v = new Array(256).fill(0);
      for (const token of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
        let h = 2166136261;
        for (let i = 0; i < token.length; i++) {
          h ^= token.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        v[Math.abs(h) % 256] += 1;
      }
      const norm = Math.hypot(...v) || 1;
      return v.map((x) => x / norm);
    });
  },
};

export function getEmbedder(): Embedder {
  switch (env.embeddingsProvider) {
    case "cloudflare": return cloudflare;
    case "remote": return remote;
    case "mock": return mock;
    default: throw new Error(`Unsupported EMBEDDINGS_PROVIDER: ${env.embeddingsProvider}`);
  }
}

const sparseRemote: SparseEmbedder = {
  name: "remote-bge-m3-sparse",
  async embed(texts) {
    const res = await fetch(`${env.sparseEmbeddingsBaseUrl}/sparse/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.sparseEmbeddingsApiKey
          ? { Authorization: `Bearer ${env.sparseEmbeddingsApiKey}` }
          : {}),
      },
      body: JSON.stringify({ model: env.sparseEmbeddingsModel, input: texts }),
    });
    if (!res.ok) throw new Error(`Sparse embeddings endpoint returned ${res.status}`);
    const json = await res.json();
    return (json.data ?? json.embeddings ?? []).map(
      (row: { embedding?: SparseVector; indices?: number[]; values?: number[]; lexical_weights?: Record<string, number> }) => {
        if (row.embedding?.indices && row.embedding.values) return row.embedding;
        if (row.indices && row.values) return { indices: row.indices, values: row.values };
        const entries = Object.entries(row.lexical_weights ?? {});
        return {
          indices: entries.map(([key]) => Number(key)),
          values: entries.map(([, value]) => Number(value)),
        };
      },
    );
  },
};

const sparseLocal: SparseEmbedder = {
  name: "local-lexical",
  async embed(texts) {
    return texts.map((text) => {
      const weights = new Map<number, number>();
      const tokens = text.toLowerCase().match(/[\p{L}\p{N}/.-]+/gu) ?? [];
      tokens.forEach((token) => {
        let hash = 2166136261;
        for (let i = 0; i < token.length; i++) {
          hash ^= token.charCodeAt(i);
          hash = Math.imul(hash, 16777619);
        }
        const index = hash >>> 0;
        weights.set(index, (weights.get(index) ?? 0) + 1);
      });
      const sorted = [...weights.entries()].sort((a, b) => a[0] - b[0]);
      const norm = Math.hypot(...sorted.map(([, value]) => value)) || 1;
      return {
        indices: sorted.map(([index]) => index),
        values: sorted.map(([, value]) => value / norm),
      };
    });
  },
};

export function getSparseEmbedder(): SparseEmbedder {
  return env.sparseEmbeddingsBaseUrl ? sparseRemote : sparseLocal;
}

export function cosine(a: number[], b: number[]) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are pre-normalised
}
