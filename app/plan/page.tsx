"use client";

import Link from "next/link";
import { MASTERY } from "@/lib/data/mastery";
import { SUBJECT_MAP, chapterName } from "@/lib/data/syllabus";
import { Icon } from "@/components/ui/Icon";
import type { SourceKind } from "@/lib/types";

/**
 * This week's plan.
 *
 * Ordering rule: marks at stake × how shaky you are. A chapter you're bad at
 * that's worth two marks loses to one you're mediocre at that's worth eight.
 * That's the whole ranking — keep it explainable, because students distrust
 * plans they can't reason about.
 *
 * The source ladder below is the sequence the toppers who built this actually
 * followed. It's fixed, not generated.
 */
const LADDER: { kind: SourceKind; label: string; when: string }[] = [
  { kind: "ncert", label: "NCERT, cover to cover", when: "Before anything else. Every line, including the boxes." },
  { kind: "exemplar", label: "Exemplar", when: "Once the chapter is read. This is where the twist questions come from." },
  { kind: "pyq", label: "Past papers", when: "Chapter-wise first, then full papers." },
  { kind: "sqp", label: "CBSE sample paper", when: "Timed, in one sitting. Then mark it yourself against the scheme." },
  { kind: "cfpq", label: "CFPQs", when: "Competency questions — the case studies that catch people out." },
  { kind: "model", label: "Model papers", when: "Last three weeks, one every other day." },
];

export default function PlanPage() {
  const queue = [...MASTERY]
    .map((m) => {
      const chapter = SUBJECT_MAP[m.subject].chapters.find(
        (c) => c.no === m.chapter,
      );
      return { ...m, marks: chapter?.marks ?? 4 };
    })
    .sort((a, b) => b.marks * (1 - b.mastery) - a.marks * (1 - a.mastery))
    .slice(0, 6);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header
        className="border-b px-4 py-4 md:px-6"
        style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
      >
        <h1
          className="text-[22px] leading-tight tracking-[-0.03em]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          Study plan
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-soft)" }}>
          Exam date not set. A countdown will appear after an official date is added.
        </p>
      </header>

      <div className="sheet scroll-quiet min-h-0 flex-1 overflow-y-auto">
        <div
          className="mx-auto w-full max-w-[46rem] px-3 py-5 md:px-5"
          style={{ paddingLeft: "calc(var(--rail) + 18px)" }}
        >
          {queue.length > 0 ? (
            <>
              <h2 className="text-[13px]" style={{ fontWeight: 650 }}>
                This week, in this order
              </h2>
              <p
                className="mb-4 mt-0.5 text-[12px]"
                style={{ color: "var(--text-faint)" }}
              >
                Sorted by marks at stake, not by how the book is arranged.
              </p>

              <ol className="flex flex-col">
                {queue.map((item, i) => (
                  <li
                    key={`${item.subject}-${item.topic}`}
                    className="relative border-t py-3 first:border-t-0"
                    style={{ borderColor: "var(--rule)" }}
                  >
                    <span
                      className="absolute -left-[calc(var(--rail)+18px)] top-3.5 text-right text-[12px] tabular-nums"
                      style={{ width: "var(--rail)", paddingRight: "10px", color: "var(--text-faint)" }}
                    >
                      {i + 1}
                    </span>

                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14.5px]" style={{ fontWeight: 600 }}>
                          {item.topic}
                        </p>
                        <p
                          className="mt-0.5 truncate text-[11.5px]"
                          style={{ color: "var(--text-faint)" }}
                        >
                          {SUBJECT_MAP[item.subject].name} · Ch {item.chapter} ·{" "}
                          {chapterName(item.subject, item.chapter)}
                        </p>
                      </div>
                      <span
                        className="shrink-0 whitespace-nowrap text-[11.5px] tabular-nums"
                        style={{ color: "var(--red)", fontWeight: 600 }}
                      >
                        ~{item.marks} marks at stake
                      </span>
                    </div>

                    <Link
                      href={`/?subject=${item.subject}&chapter=${item.chapter}`}
                      className="mt-2 inline-flex items-center gap-1 text-[12.5px]"
                      style={{ color: "var(--accent)", fontWeight: 600 }}
                    >
                      Start here
                      <Icon.Chevron size={12} />
                    </Link>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <section
              className="rounded-2xl border p-5"
              style={{ borderColor: "var(--rule)", background: "var(--input)" }}
            >
              <h2 className="text-[15px]" style={{ fontWeight: 650 }}>
                No personalised plan yet
              </h2>
              <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-soft)" }}>
                Answer a few questions first. Your plan will appear when there is enough evidence to rank what needs attention.
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[12.5px]"
                style={{ background: "var(--accent)", color: "var(--surface)", fontWeight: 650 }}
              >
                Start practising
                <Icon.Chevron size={13} />
              </Link>
            </section>
          )}

          <h2 className="mb-1 mt-9 text-[13px]" style={{ fontWeight: 650 }}>
            What to study from, in sequence
          </h2>
          <p
            className="mb-4 text-[12px]"
            style={{ color: "var(--text-faint)" }}
          >
            Skipping a rung is the most common way to run out of time in March.
          </p>

          <ol className="flex flex-col gap-3">
            {LADDER.map((rung, i) => (
              <li key={rung.kind} className="flex gap-3">
                <span
                  className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10.5px] tabular-nums"
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px]" style={{ fontWeight: 600 }}>
                    {rung.label}
                  </span>
                  <span
                    className="block text-[12.5px]"
                    style={{ color: "var(--text-soft)" }}
                  >
                    {rung.when}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
