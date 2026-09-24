import { createHash } from "node:crypto";
import { env } from "../config";
import type { MarkStep, Source } from "../types";
import { TUTOR_POLICY_VERSION } from "../ai/policy";

export interface CachedAnswer {
  text: string;
  sources: Source[];
  steps?: MarkStep[];
  marks?: number;
  notice?: string;
}

const memory = new Map<string, { expires: number; value: CachedAnswer }>();

export function answerCacheKey(input: {
  query: string;
  subject?: string;
  chapter?: number;
  mode: string;
  marks?: number;
}) {
  const normalized = input.query.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256")
    .update([
      env.syllabusVersion,
      TUTOR_POLICY_VERSION,
      input.subject ?? "all",
      input.chapter ?? "all",
      input.mode,
      input.marks ?? "auto",
      normalized,
    ].join("|"))
    .digest("hex");
}

export async function getCachedAnswer(key: string): Promise<CachedAnswer | null> {
  if (env.cacheProvider === "none") return null;
  if (env.cacheProvider === "redis" && env.redisRestUrl) {
    const res = await fetch(env.redisRestUrl.replace(/\/$/, ""), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.redisRestToken
          ? { Authorization: `Bearer ${env.redisRestToken}` }
          : {}),
      },
      body: JSON.stringify(["GET", key]),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.result ? JSON.parse(json.result) : null;
  }

  const hit = memory.get(key);
  if (!hit || hit.expires <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value;
}

export async function setCachedAnswer(key: string, value: CachedAnswer) {
  if (env.cacheProvider === "none") return;
  if (env.cacheProvider === "redis" && env.redisRestUrl) {
    await fetch(env.redisRestUrl.replace(/\/$/, ""), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.redisRestToken
          ? { Authorization: `Bearer ${env.redisRestToken}` }
          : {}),
      },
      body: JSON.stringify([
        "SET",
        key,
        JSON.stringify(value),
        "EX",
        env.cacheTtlSeconds,
      ]),
    });
    return;
  }
  memory.set(key, {
    expires: Date.now() + env.cacheTtlSeconds * 1000,
    value,
  });
}
