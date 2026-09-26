"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";
import type { Message, Source } from "@/lib/types";
import { AnswerText } from "./AnswerText";
import { Sources } from "./Sources";

export function AnswerSheet({ message }: { message: Message }) {
  const [openSource, setOpenSource] = useState<Source | null>(null);
  const text =
    message.content.find((p) => p.type === "text")?.type === "text"
      ? (message.content.find((p) => p.type === "text") as { text: string }).text
      : "";
  const sources = message.sources?.some((source) => source.kind !== "syllabus")
    ? message.sources
    : [];
  const displayedText = sources.length === 0 && text === "This topic is in the active syllabus, but I don't have enough approved source material to answer it yet."
    ? "I couldn't find an approved explanation for this question yet. That does not mean the topic is outside the syllabus."
    : text;

  const empty = !displayedText.trim();

  return (
    <article className="flex gap-3 py-5 md:gap-4">
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--assistant-avatar)", color: "var(--surface)" }}
        aria-hidden="true"
      >
        <GraduationCap size={15} strokeWidth={1.9} />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        {empty && message.streaming && <Thinking />}

        {!empty && (
          <div style={{ fontSize: "15px" }}>
            <AnswerText
              text={displayedText}
              sources={sources}
              onCite={setOpenSource}
            />
            {message.streaming && <span className="caret" />}
          </div>
        )}

        {message.error && (
          <p
            className="rounded-lg px-3 py-2 text-[13.5px]"
            style={{ background: "var(--red-soft)", color: "var(--red)" }}
          >
            {message.error}
          </p>
        )}

        {message.notice && (
          <p
            className="mt-3 rounded-lg border px-3 py-2 text-[12.5px]"
            style={{
              borderColor: "var(--rule)",
              background: "color-mix(in srgb, var(--accent-soft) 52%, transparent)",
              color: "var(--text-soft)",
            }}
          >
            {message.notice}
          </p>
        )}

        {message.steps?.length ? (
          <div
            className="mt-4 rounded-lg border px-3 py-2.5 text-[12.5px]"
            style={{ borderColor: "var(--rule)", color: "var(--text-soft)" }}
          >
            {message.marks != null && (
              <span className="mr-3" style={{ color: "var(--red)", fontWeight: 650 }}>
                {message.marks} marks
              </span>
            )}
            {message.steps.map((step, i) => (
              <span key={i} className="mr-3 inline-block">
                <span style={{ color: "var(--red)", fontWeight: 600 }}>
                  {step.marks}
                </span>{" "}
                {step.for}
              </span>
            ))}
          </div>
        ) : null}

        {sources.length ? (
          <Sources
            sources={sources}
            open={openSource}
            onOpen={setOpenSource}
          />
        ) : null}
      </div>
    </article>
  );
}

/** Shown between "sources found" and "first token". Three dots, no copy —
 *  the sources chips above already say what's happening. */
function Thinking() {
  return (
    <div className="flex items-center gap-1.5 py-1" aria-label="Writing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-1.5 w-1.5 rounded-full"
          style={{
            background: "var(--text-faint)",
            animation: "caret 1.1s ease-in-out infinite",
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </div>
  );
}
