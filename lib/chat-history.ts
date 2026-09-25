import { getBrowserAuth } from "./auth/supabase";
import type { ChatContext, Message } from "./types";

export interface ChatSummary {
  id: string;
  title: string;
  updated_at: string;
}

export interface SavedChat extends ChatSummary {
  messages: Message[];
  context: ChatContext;
}

export const CHATS_CHANGED = "padhle:chats-changed";

export async function listChats(): Promise<ChatSummary[]> {
  const auth = getBrowserAuth();
  if (!auth) return [];
  const { data, error } = await auth.from("chat_threads")
    .select("id,title,updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as ChatSummary[];
}

export async function loadChat(id: string): Promise<SavedChat> {
  const auth = getBrowserAuth();
  if (!auth) throw new Error("Sign in to see your conversations.");
  const { data, error } = await auth.from("chat_threads")
    .select("id,title,updated_at,messages,context")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error("This conversation could not be loaded.");
  return data as SavedChat;
}

export async function saveChat(id: string, messages: Message[], context: ChatContext) {
  const auth = getBrowserAuth();
  if (!auth) throw new Error("Sign in to save conversations.");
  const { data: { session } } = await auth.auth.getSession();
  if (!session) throw new Error("Sign in again to save this conversation.");

  const firstQuestion = messages.find((message) => message.role === "user");
  const title = firstQuestion?.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ").replace(/\s+/g, " ").trim().slice(0, 72) || "Image question";
  const safe = messages.map((message) => ({
    ...message,
    streaming: false,
    content: message.content.map((part) => part.type === "image"
      ? { type: "text" as const, text: "[Image attached]" }
      : part),
    sources: message.sources?.slice(0, 5).map(({ content: _content, ...source }) => source),
  }));
  while (safe.length > 2 && JSON.stringify(safe).length > 200000) safe.shift();
  const { error } = await auth.from("chat_threads").upsert({
    id,
    user_id: session.user.id,
    title,
    messages: safe,
    context,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) throw error;
  window.dispatchEvent(new Event(CHATS_CHANGED));
}
