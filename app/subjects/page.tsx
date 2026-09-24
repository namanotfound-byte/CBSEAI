"use client";

import { useState } from "react";
import Link from "next/link";
import { ACTIVE_SUBJECTS } from "@/lib/data/syllabus";
import { MASTERY } from "@/lib/data/mastery";
import { Icon } from "@/components/ui/Icon";
import type { SubjectId } from "@/lib/types";

/**
 * Chapter picker. Two signals per row and no more: how much the chapter is
 * worth in the paper, and whether you're currently shaky on it. Everything
 * else would be noise at this size.
 */
export default function SubjectsPage() {
  const [active, setActive] = useState<SubjectId>("science");
  const subject = ACTIVE_SUBJECTS.find((s) => s.id === active)!;
  const maxMarks = Math.max(...subject.chapters.map((c) => c.marks));

  const weakByChapter = new Map<number, number>();
  for (const m of MASTERY) {
    if (m.subject !== active) continue;
    const cur = weakByChapter.get(m.chapter);
    if (cur == null || m.mastery < cur) weakByChapter.set(m.chapter, m.mastery);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header
        className="border-b px-4 pb-2.5 pt-4 md:px-6"
        style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
      >
        <h1
          className="text-[22px] leading-tight tracking-[-0.03em]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          Chapters
        </h1>
        <div
          className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 md:-mx-6 md:px-6"
          role="tablist"
          aria-label="Subjects"
        >
          {ACTIVE_SUBJECTS.map((s) => {
            const on = s.id === active;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(s.id)}
                role="tab"
                aria-selected={on}
                className="shrink-0 rounded-lg border px-3.5 py-1.5 text-[13px] transition-colors"
                style={{
                  borderColor: "var(--rule)",
                  background: on ? "var(--accent-soft)" : "transparent",
                  color: on ? "var(--text)" : "var(--text-soft)",
                  fontWeight: on ? 600 : 450,
                  boxShadow: on ? "inset 0 -2px 0 var(--accent)" : "none",
                }}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      </header>

      <div className="sheet scroll-quiet min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[46rem] px-3 py-4 md:px-5">
          <ul className="flex flex-col">
            {subject.chapters.map((c) => {
              const weak = weakByChapter.get(c.no);
              return (
                <li key={c.no}>
                  <Link
                    href={`/?subject=${subject.id}&chapter=${c.no}`}
                    className="group relative flex items-center gap-3 py-2.5"
                    style={{ paddingLeft: "calc(var(--rail) + 18px)" }}
                  >
                    <span
                      className="absolute left-0 top-3 pr-2.5 text-right text-[12px] tabular-nums"
                      style={{ width: "var(--rail)", color: "var(--text-faint)" }}
                    >
                      {c.no}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px]">
                        {c.name}
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <span
                          className="block h-[3px] rounded-full"
                          style={{
                            width: `${(c.marks / maxMarks) * 84}px`,
                            background: "var(--accent)",
                            opacity: 0.45,
                          }}
                        />
                        <span
                          className="text-[11px] tabular-nums"
                          style={{ color: "var(--text-faint)" }}
                        >
                          ~{c.marks} marks
                        </span>
                        {weak != null && weak < 0.45 && (
                          <span
                            className="text-[11px]"
                            style={{ color: "var(--red)", fontWeight: 600 }}
                          >
                            shaky
                          </span>
                        )}
                      </span>
                    </span>

                    <Icon.Chevron
                      size={16}
                      style={{ color: "var(--text-faint)" }}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
