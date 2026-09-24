"use client";

import { useCallback, useRef, useState } from "react";
import type {
  ChatContext,
  ChatEvent,
  ContentPart,
  Message,
} from "./types";
import { getBrowserAuth } from "./auth/supabase";

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Owns the transcript and the SSE connection.
 *
 * Messages are appended optimistically and the assistant turn is mutated in
 * place as frames arrive, so the sheet fills top-down the way a person writes.
 */
export function useChat(initialContext: ChatContext) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [context, setContext] = useState<ChatContext>(initialContext);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const patch = useCallback((id: string, updater: (m: Message) => Message) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
  }, []);

  const send = useCallback(
    async (parts: ContentPart[], overrides?: Partial<ChatContext>) => {
      if (busy) return;
      const ctx = { ...context, ...overrides };
      if (overrides) setContext(ctx);

      const userMsg: Message = {
        id: uid(),
        role: "user",
        content: parts,
        createdAt: Date.now(),
      };
      const replyId = uid();
      const replyMsg: Message = {
        id: replyId,
        role: "assistant",
        content: [{ type: "text", text: "" }],
        createdAt: Date.now(),
        streaming: true,
        mode: ctx.mode,
      };

      const history = [...messages, userMsg];
      setMessages([...history, replyMsg]);
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const { data: { session } } = await getBrowserAuth()!.auth.getSession();
        if (!session) throw new Error("Please sign in to ask a question.");
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            messages: history.map(({ role, content }) => ({ role, content })),
            context: ctx,
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`Chat route returned ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const line = frame.trim();
            if (!line.startsWith("data:")) continue;
            let event: ChatEvent;
            try {
              event = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            applyEvent(replyId, event, patch);
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          patch(replyId, (m) => ({
            ...m,
            streaming: false,
            error:
              err instanceof Error
                ? err.message
                : "Couldn't reach the model.",
          }));
        }
      } finally {
        patch(replyId, (m) => ({ ...m, streaming: false }));
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, context, messages, patch],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  return { messages, context, setContext, send, stop, reset, busy };
}

function applyEvent(
  id: string,
  event: ChatEvent,
  patch: (id: string, updater: (m: Message) => Message) => void,
) {
  switch (event.type) {
    case "sources":
      patch(id, (m) => ({ ...m, sources: event.sources }));
      break;
    case "token":
      patch(id, (m) => {
        const [first, ...rest] = m.content;
        const text =
          (first?.type === "text" ? first.text : "") + event.text;
        return { ...m, content: [{ type: "text", text }, ...rest] };
      });
      break;
    case "steps":
      patch(id, (m) => ({ ...m, steps: event.steps, marks: event.marks }));
      break;
    case "notice":
      patch(id, (m) => ({ ...m, notice: event.message }));
      break;
    case "error":
      patch(id, (m) => ({ ...m, error: event.message, streaming: false }));
      break;
    case "done":
      patch(id, (m) => ({ ...m, streaming: false }));
      break;
  }
}
