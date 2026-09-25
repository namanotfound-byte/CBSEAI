"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, RotateCcw } from "lucide-react";
import { PadhleMark } from "@/components/brand/PadhleMark";
import { APP } from "@/lib/config";
import { SUBJECT_MAP, chapterName } from "@/lib/data/syllabus";
import { useChat } from "@/lib/useChat";
import type { ChatContext, SubjectId } from "@/lib/types";
import { AnswerSheet } from "./AnswerSheet";
import { UserBubble } from "./UserBubble";
import { Composer } from "./Composer";

const OPENERS = [
  ["Explain photosynthesis", "Write a 3-mark board answer"],
  ["Solve an electricity numerical", "Show every scoring step"],
  ["Balance a chemical equation", "Use the NCERT method"],
  ["Help me make a study plan", "Start with my time and difficult chapters"],
] as const;

export function ChatView() {
  const params = useSearchParams();
  const initial: ChatContext = {
    grade: APP.grade,
    subject: (params.get("subject") as SubjectId) ?? undefined,
    chapter: Number(params.get("chapter")) || undefined,
    mode: (params.get("mode") as ChatContext["mode"]) ?? "answer",
  };

  const { messages, context, setContext, send, stop, reset, busy } = useChat(initial);
  const bottom = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

  useEffect(() => {
    if (pinned) bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, pinned]);

  const subject = context.subject ? SUBJECT_MAP[context.subject] : undefined;
  const chapter = chapterName(context.subject, context.chapter);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Header
        subject={subject?.name}
        chapter={chapter}
        chapterNo={context.chapter}
        onClearScope={() => setContext({ ...context, subject: undefined, chapter: undefined })}
        onReset={reset}
        hasMessages={messages.length > 0}
      />

      <div
        className="scroll-quiet min-h-0 flex-1 overflow-y-auto"
        onScroll={(event) => {
          const el = event.currentTarget;
          setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 90);
        }}
      >
        <div className="mx-auto flex min-h-full w-full max-w-[48rem] flex-col px-4 pb-8 md:px-6">
          {messages.length === 0 ? (
            <Empty onPick={(question) => send([{ type: "text", text: question }])} />
          ) : (
            <div className="pt-5 md:pt-8">
              {messages.map((message) =>
                message.role === "user" ? (
                  <UserBubble key={message.id} message={message} />
                ) : (
                  <AnswerSheet key={message.id} message={message} />
                ),
              )}
            </div>
          )}
          <div ref={bottom} />
        </div>
      </div>

      <Composer
        context={context}
        busy={busy}
        onSend={send}
        onStop={stop}
        onContextChange={(next) => setContext({ ...context, ...next })}
      />
    </div>
  );
}

function Header({
  subject,
  chapter,
  chapterNo,
  onClearScope,
  onReset,
  hasMessages,
}: {
  subject?: string;
  chapter?: string;
  chapterNo?: number;
  onClearScope: () => void;
  onReset: () => void;
  hasMessages: boolean;
}) {
  return (
    <header className="hidden h-14 shrink-0 items-center px-4 md:flex">
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[16px]"
        style={{ fontWeight: 600 }}
        title="Current tutor"
      >
        {APP.name}
        <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>Class 10</span>
        <ChevronDown size={16} />
      </button>

      <div className="ml-auto flex items-center gap-2">
        {(subject || chapter) && (
          <button
            type="button"
            onClick={onClearScope}
            className="rounded-lg px-3 py-1.5 text-[12px]"
            style={{ background: "var(--input)", color: "var(--text-soft)" }}
          >
            {chapter ? `${subject} · Ch ${chapterNo}` : subject}
          </button>
        )}
        {hasMessages && (
          <button
            type="button"
            onClick={onReset}
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            aria-label="Start a new chat"
            title="Start a new chat"
          >
            <RotateCcw size={17} />
          </button>
        )}
      </div>
    </header>
  );
}

function Empty({ onPick }: { onPick: (question: string) => void }) {
  return (
    <div className="flex flex-1 flex-col justify-end pb-6 pt-10 md:justify-center md:pb-2">
      <div className="mx-auto w-full max-w-[42rem]">
        <div className="mb-7 flex flex-col items-center text-center">
          <PadhleMark size={48} className="mb-5" />
          <h1 className="text-[28px] leading-tight md:text-[32px]" style={{ fontWeight: 600 }}>
            What can I help you study?
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {OPENERS.map(([title, subtitle]) => (
            <button
              key={title}
              type="button"
              onClick={() => onPick(`${title}. ${subtitle}.`)}
              className="min-h-[74px] rounded-xl border px-4 py-3 text-left transition-colors"
              style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
            >
              <span className="block text-[14px]" style={{ fontWeight: 550 }}>
                {title}
              </span>
              <span className="mt-0.5 block text-[12.5px]" style={{ color: "var(--text-faint)" }}>
                {subtitle}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
