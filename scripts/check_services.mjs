#!/usr/bin/env node
/** Check production API credentials without printing values or response bodies.
 * Cloudflare calls use two tiny Workers AI requests from the free allocation.
 * No collection, point, or deployment is modified.
 */

const required = [
  "MODEL_API_KEY",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "QDRANT_URL",
  "QDRANT_API_KEY",
];

const result = Object.fromEntries(required.map((name) => [name, Boolean(process.env[name])]));
const check = async (name, url, init = {}) => {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
    let body = null;
    try { body = await response.json(); } catch { /* Status is still useful. */ }
    result[name] = { ok: response.ok && body?.success !== false, http: response.status };
    return body;
  } catch (error) {
    result[name] = { ok: false, error: error?.name === "TimeoutError" ? "timeout" : "connection_failed" };
    return null;
  }
};

if (result.MODEL_API_KEY) {
  await check("openrouterKey", "https://openrouter.ai/api/v1/key", {
    headers: { Authorization: `Bearer ${process.env.MODEL_API_KEY}` },
  });
}

if (result.CLOUDFLARE_API_TOKEN) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID ?? "");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const verified = await check("cloudflareToken", "https://api.cloudflare.com/client/v4/user/tokens/verify", { headers });
  if (result.CLOUDFLARE_ACCOUNT_ID && verified?.success) {
    const embedding = await check(
      "cloudflareEmbedding",
      `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/baai/bge-m3`,
      { method: "POST", headers, body: JSON.stringify({ text: ["CBSE Maths and Science"] }) },
    );
    if (result.cloudflareEmbedding?.ok) {
      const vector = embedding?.result?.data?.[0];
      result.cloudflareEmbedding.shapeOk = Array.isArray(vector) && vector.length === 1024;
    }
    await check(
      "cloudflareReranker",
      `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/baai/bge-reranker-base`,
      { method: "POST", headers, body: JSON.stringify({ query: "What is current?", contexts: [{ text: "Electric current is the rate of flow of electric charge." }] }) },
    );
  }
}

if (result.QDRANT_URL && result.QDRANT_API_KEY) {
  const url = process.env.QDRANT_URL.replace(/\/$/, "");
  if (!url.startsWith("https://")) {
    result.qdrant = { ok: false, error: "url_must_be_https" };
  } else {
    const collections = await check("qdrant", `${url}/collections`, {
      headers: { "api-key": process.env.QDRANT_API_KEY },
    });
    if (result.qdrant?.ok) {
      result.qdrant.collections = collections?.result?.collections?.length ?? null;
      const aliases = await check("qdrantAliases", `${url}/aliases`, {
        headers: { "api-key": process.env.QDRANT_API_KEY },
      });
      result.qdrant.liveAliasPresent = (aliases?.result?.aliases ?? []).some(
        (alias) => alias.alias_name === "cbse_10_live",
      );
    }
  }
}

console.log(JSON.stringify(result, null, 2));
const checks = ["openrouterKey", "cloudflareToken", "cloudflareEmbedding", "cloudflareReranker", "qdrant", "qdrantAliases"];
if (required.some((name) => !result[name]) || checks.some((name) => !result[name]?.ok) ||
    result.cloudflareEmbedding?.shapeOk !== true) process.exitCode = 1;
