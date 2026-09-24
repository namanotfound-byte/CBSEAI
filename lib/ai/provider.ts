import { env } from "../config";
import type { ContentPart, Message } from "../types";

/** Hosted model access. The default routes use free OpenRouter endpoints only. */

export interface ChatProvider {
  name: string;
  /** Yields raw text deltas. Throwing is fine — /api/chat turns it into an error event. */
  stream(args: {
    system: string;
    messages: Pick<Message, "role" | "content">[];
    signal?: AbortSignal;
    /** Set when the turn contains an image; routes to the VL checkpoint. */
    hasImages?: boolean;
  }): AsyncGenerator<string, void, unknown>;
}

/* ───────────────────────── OpenAI-compatible ───────────────────────────── */

/** Send text and image parts in the OpenAI-compatible chat shape. */
function toOpenAIContent(parts: ContentPart[]) {
  // Text-only turns go as a plain string; some servers are stricter about this.
  if (parts.every((p) => p.type === "text")) {
    return parts.map((p) => (p as { text: string }).text).join("\n");
  }
  return parts.map((p) =>
    p.type === "text"
      ? { type: "text", text: p.text }
      : { type: "image_url", image_url: { url: p.url } },
  );
}

const openAICompatible: ChatProvider = {
  name: "openai-compatible",
  async *stream({ system, messages, signal, hasImages }) {
    const model =
      hasImages && env.visionModelName ? env.visionModelName : env.modelName;
    const openRouter = env.modelBaseUrl.startsWith("https://openrouter.ai/api/v1");
    const openRouterModels = [
      ...new Set((openRouter ? [model, env.fallbackModelName] : [model]).filter(Boolean)),
    ];
    if (openRouter && openRouterModels.some((candidate) => !candidate.endsWith(":free"))) {
      throw new Error("Only free OpenRouter model routes are enabled.");
    }
    const candidates = [
      ...(openRouter && env.groqApiKey ? [{
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: env.groqApiKey,
        model: "qwen/qwen3.8-27b",
      }] : []),
      ...openRouterModels.filter(() => !openRouter || Boolean(env.modelApiKey)).map((candidate) => ({
        baseUrl: env.modelBaseUrl,
        apiKey: env.modelApiKey,
        model: candidate,
      })),
    ];
    let res: Response | undefined;
    for (const candidate of candidates) {
      res = await fetch(`${candidate.baseUrl}/chat/completions`, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          ...(candidate.apiKey
            ? { Authorization: `Bearer ${candidate.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: candidate.model,
          stream: true,
          temperature: 0.2,
          top_p: 0.9,
          max_tokens: 1200,
          messages: [
            { role: "system", content: system },
            ...messages.map((m) => ({
              role: m.role,
              content: toOpenAIContent(m.content),
            })),
          ],
        }),
      });
      if (res.ok && res.body) break;
      if (candidate !== candidates.at(-1) && [404, 429, 502, 503].includes(res.status)) {
        continue;
      }
      if (openRouter && res.status === 429) {
        throw new Error("The free answer models are busy right now. Please try again shortly.");
      }
      if (openRouter && res.status === 404) {
        throw new Error("The selected free answer model is unavailable right now.");
      }
      throw new Error(`The answer model is unavailable (HTTP ${res.status}).`);
    }

    if (!res?.body) throw new Error("No free model response was available.");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) yield delta;
        } catch {
          // Partial frame. It'll arrive complete on the next read.
        }
      }
    }
  },
};

/* ──────────────────────────── Mock ─────────────────────────────────────── */

/**
 * Canned answers used only when development tests explicitly select mock mode.
 */
const mock: ChatProvider = {
  name: "mock",
  async *stream({ messages }) {
    const last = messages.at(-1);
    const asked =
      last?.content.find((p) => p.type === "text")?.type === "text"
        ? (last.content.find((p) => p.type === "text") as { text: string }).text
        : "";

    const reply = mockAnswer(asked);
    // Chunk on word boundaries so the typing rhythm looks like a real stream.
    for (const token of reply.match(/\S+\s*/g) ?? []) {
      await new Promise((r) => setTimeout(r, 18 + Math.random() * 30));
      yield token;
    }
  },
};

function mockAnswer(q: string) {
  const lower = q.toLowerCase();

  if (lower.includes("photosynthesis") || lower.includes("life process")) {
    return [
      "Photosynthesis is the process by which green plants use light energy to convert carbon dioxide and water into **carbohydrates**, releasing oxygen. [S1]",
      "",
      "Steps, in the order NCERT gives them:",
      "1. **Chlorophyll** in the chloroplast absorbs light energy.",
      "2. That energy splits water into hydrogen and oxygen — oxygen is released through the stomata. [S1]",
      "3. Light energy is converted to chemical energy and carbon dioxide is reduced to carbohydrate.",
      "",
      "Equation — write it balanced, the balance itself carries a mark:",
      "6CO₂ + 6H₂O →(sunlight, chlorophyll) C₆H₁₂O₆ + 6O₂",
      "",
      "Where students drop marks: writing the arrow without **sunlight and chlorophyll** above it, and forgetting that the three steps need not happen immediately one after the other. [S2]",
      "",
      "MARKS: 3 | 1 — definition with reactants and products | 1 — three steps in order | 1 — balanced equation with conditions",
    ].join("\n");
  }

  if (lower.includes("electric") || lower.includes("resistance") || lower.includes("ohm")) {
    return [
      "Ohm's law: at **constant temperature**, the current through a conductor is **directly proportional** to the potential difference across its ends. [S1]",
      "",
      "V = IR, where R is the resistance in ohms.",
      "",
      "For the numerical, set it out in four lines — each line is a mark:",
      "Formula → R = V/I",
      "Substitution → R = 12 V ÷ 0.5 A",
      "Answer → R = 24",
      "Unit → Ω",
      "",
      "The **unit** on its own is worth a mark, and it is the most common single reason students lose one in this chapter.",
      "",
      "MARKS: 3 | 1 — statement of the law | 1 — correct substitution | 1 — answer with unit",
    ].join("\n");
  }

  return [
    "Here's how I'd write this one on the answer sheet.",
    "",
    "Point one, in **NCERT's own words**, because that's what the examiner is checking against. [S1]",
    "Point two, with the reason — the reason is a separate mark from the statement.",
    "Point three, the conclusion, stated plainly.",
    "",
    "This sample answer is for development tests only.",
    "",
    "MARKS: 3 | 1 — statement | 1 — reason | 1 — conclusion",
  ].join("\n");
}

/* ─────────────────────────── selection ─────────────────────────────────── */

export function getChatProvider(): ChatProvider {
  switch (env.modelProvider) {
    case "openai":
      if (!env.modelBaseUrl || (!env.modelApiKey &&
          !(env.modelBaseUrl.startsWith("https://openrouter.ai/api/v1") && env.groqApiKey))) {
        throw new Error(
          "The hosted tutor model is not configured. Add a free provider API key in protected server settings.",
        );
      }
      return openAICompatible;
    case "mock":
      return mock;
    default:
      throw new Error(`Unsupported MODEL_PROVIDER: ${env.modelProvider}`);
  }
}
