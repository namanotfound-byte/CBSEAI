"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChatContext,
  ChatEvent,
  ContentPart,
  Message,
} from "./types";
import { getBrowserAuth } from "./auth/supabase";
import { rememberExpiredSession } from "./auth/session-recovery";
import { loadChat, saveChat } from "./chat-history";

const uid = () => Math.random().toString(36).slice(2, 10);

class SessionExpiredError extends Error {}

/**
 * Owns the transcript and the SSE connection.
 *
 * Messages are appended optimistically and the assistant turn is mutated in
 * place as frames arrive, so the sheet fills top-down the way a person writes.
 */
export function useChat(initialContext: ChatContext, savedId?: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [context, setContext] = useState<ChatContext>(initialContext);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(savedId));
  const [historyError, setHistoryError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const threadId = useRef(savedId ?? null);

  useEffect(() => {
    if (!savedId) return;
    let active = true;
    void loadChat(savedId).then((saved) => {
      if (!active) return;
      setMessages(saved.messages);
      setContext(saved.context);
    }).catch((error: unknown) => {
      if (active) setHistoryError(error instanceof Error ? error.message : "Conversation could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [savedId]);

  const patch = useCallback((id: string, updater: (m: Message) => Message) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
  }, []);

  const send = useCallback(
    async (parts: ContentPart[], overrides?: Partial<ChatContext>) => {
      if (busy || loading) return;
      setHistoryError("");
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
      let replyState = replyMsg;

      const history = [...messages, userMsg];
      setMessages([...history, replyMsg]);
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let sessionExpired = false;

      try {
        const auth = getBrowserAuth();
        if (!auth) throw new Error("Sign-in is unavailable right now.");
        const requestBody = JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          context: ctx,
        });
        const request = async (refresh: boolean) => {
          const { data, error } = refresh
            ? await auth.auth.refreshSession()
            : await auth.auth.getSession();
          if (error || !data.session) throw new SessionExpiredError("Your session ended.");
          return fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.session.access_token}`,
            },
            signal: controller.signal,
            body: requestBody,
          });
        };
        let res = await request(false);
        if (res.status === 401) res = await request(true);

        if (!res.ok || !res.body) {
          const detail = await res.json().catch(() => null) as { error?: string } | null;
          if (res.status === 401) throw new SessionExpiredError("Your session ended.");
          throw new Error(detail?.error ?? "Padhle couldn't answer right now. Please try again.");
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
            replyState = applyEvent(replyState, event);
            patch(replyId, () => replyState);
          }
        }
      } catch (err) {
        if (err instanceof SessionExpiredError) {
          sessionExpired = true;
          rememberExpiredSession(parts);
        } else if ((err as Error).name !== "AbortError") {
          replyState = {
            ...replyState,
            streaming: false,
            error:
              err instanceof Error
                ? err.message
                : "Couldn't reach the model.",
          };
          patch(replyId, () => replyState);
        }
      } finally {
        if (!sessionExpired) {
          replyState = { ...replyState, streaming: false };
          patch(replyId, () => replyState);
        }
        setBusy(false);
        abortRef.current = null;
        if (sessionExpired) return;
        const id = threadId.current ?? crypto.randomUUID();
        try {
          await saveChat(id, [...history, replyState], ctx);
          threadId.current = id;
          if (!savedId) window.history.replaceState(null, "", `/?chat=${id}`);
        } catch (error) {
          setHistoryError(error instanceof Error ? `Conversation was not saved: ${error.message}` : "Conversation was not saved.");
        }
      }
    },
    [busy, context, loading, messages, patch, savedId],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    window.location.assign(`/?new=${crypto.randomUUID()}`);
  }, []);

  return { messages, context, setContext, send, stop, reset, busy, loading, historyError };
}

function applyEvent(message: Message, event: ChatEvent): Message {
  switch (event.type) {
    case "sources":
      return { ...message, sources: event.sources };
    case "token":
      const [first, ...rest] = message.content;
      return { ...message, content: [{ type: "text", text: (first?.type === "text" ? first.text : "") + event.text }, ...rest] };
    case "steps":
      return { ...message, steps: event.steps, marks: event.marks };
    case "notice":
      return { ...message, notice: event.message };
    case "error":
      return { ...message, error: event.message, streaming: false };
    case "done":
      return { ...message, streaming: false };
  }
}
