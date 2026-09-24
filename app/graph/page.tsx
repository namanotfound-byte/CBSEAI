"use client";

import Link from "next/link";
import { MASTERY } from "@/lib/data/mastery";
import { SUBJECT_MAP, chapterName } from "@/lib/data/syllabus";
import { Icon } from "@/components/ui/Icon";

/**
 * Weak spots.
 *
 * Deliberately not a node-and-edge graph — a force-directed blob looks
 * impressive and tells a student nothing. What they need is an ordered list of
 * what to fix and a one-tap way to fix it, so the ranking is the graph.
 *
 * Reads MASTERY from the student's graded answer history.
 */
export default function GraphPage() {
  const ranked = [...MASTERY].sort((a, b) => a.mastery - b.mastery);
  const weak = ranked.filter((m) => m.mastery < 0.45);
  const solid = ranked.filter((m) => m.mastery >= 0.7);

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
          Weak spots
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-soft)" }}>
          Built from what you've answered, not from what you've read.
        </p>
      </header>

      <div className="sheet scroll-quiet min-h-0 flex-1 overflow-y-auto">
        <div
          className="mx-auto w-full max-w-[46rem] px-3 py-5 md:px-5"
          style={{ paddingLeft: "calc(var(--rail) + 18px)" }}
        >
          {ranked.length === 0 ? (
            <section
              className="rounded-2xl border p-5"
              style={{ borderColor: "var(--rule)", background: "var(--input)" }}
            >
              <h2 className="text-[15px]" style={{ fontWeight: 650 }}>
                Nothing to diagnose yet
              </h2>
              <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-soft)" }}>
                Once you answer a few questions, your weaker topics and recurring mistakes will appear here.
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[12.5px]"
                style={{ background: "var(--accent)", color: "var(--surface)", fontWeight: 650 }}
              >
                Answer a question
                <Icon.Chevron size={13} />
              </Link>
            </section>
          ) : (
            <>
              <Band ranked={ranked} />

              <h2
                className="mb-3 mt-8 text-[13px]"
                style={{ color: "var(--red)", fontWeight: 650 }}
              >
                Fix these first
              </h2>

              <ul className="flex flex-col gap-2.5">
            {weak.map((m) => (
              <li
                key={`${m.subject}-${m.chapter}-${m.topic}`}
                className="rounded-2xl border p-3.5"
                style={{
                  borderColor: "color-mix(in srgb, var(--red) 30%, transparent)",
                  background: "var(--surface)",
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px]" style={{ fontWeight: 600 }}>
                      {m.topic}
                    </p>
                    <p
                      className="mt-0.5 truncate text-[11.5px]"
                      style={{ color: "var(--text-faint)" }}
                    >
                      {SUBJECT_MAP[m.subject].name} · Ch {m.chapter}
                      {chapterName(m.subject, m.chapter)
                        ? ` · ${chapterName(m.subject, m.chapter)}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className="shrink-0 tabular-nums text-[19px] leading-none"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      color: "var(--red)",
                    }}
                  >
                    {Math.round(m.mastery * 100)}
                    <span className="text-[11px]">%</span>
                  </span>
                </div>

                {m.slips?.length ? (
                  <ul className="mt-2.5 flex flex-col gap-1">
                    {m.slips.map((s) => (
                      <li
                        key={s}
                        className="flex gap-1.5 text-[12.5px]"
                        style={{ color: "var(--text-soft)" }}
                      >
                        <span style={{ color: "var(--red)" }}>×</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <Link
                  href={`/?subject=${m.subject}&chapter=${m.chapter}&mode=drill`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px]"
                  style={{ background: "var(--accent)", color: "#fff", fontWeight: 600 }}
                >
                  Ask me three on this
                  <Icon.Chevron size={13} />
                </Link>
              </li>
            ))}
              </ul>

              <h2
                className="mb-2.5 mt-8 text-[13px]"
                style={{ color: "var(--text-soft)", fontWeight: 650 }}
              >
                Holding steady
              </h2>
              <ul className="flex flex-wrap gap-1.5">
            {solid.map((m) => (
              <li
                key={m.topic}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px]"
                style={{ borderColor: "var(--rule)", color: "var(--text-soft)" }}
              >
                <Icon.Check size={12} style={{ color: "#00A676" }} />
                {m.topic}
              </li>
            ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Every tracked topic as one tick on a single line, ordered weakest to
 * strongest. It reads at a glance and it doesn't pretend to more precision
 * than a dozen attempts can support.
 */
function Band({ ranked }: { ranked: typeof MASTERY }) {
  return (
    <div>
      <div className="flex h-11 items-end gap-[3px]">
        {ranked.map((m) => (
          <span
            key={`${m.subject}-${m.topic}`}
            title={`${m.topic} · ${Math.round(m.mastery * 100)}%`}
            className="flex-1 rounded-t-[3px]"
            style={{
              height: `${Math.max(8, m.mastery * 100)}%`,
              background: m.mastery < 0.45 ? "var(--red)" : "var(--accent)",
              opacity: m.mastery < 0.45 ? 0.9 : 0.35,
            }}
          />
        ))}
      </div>
      <p className="mt-2 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
        {ranked.filter((m) => m.mastery < 0.45).length} topics below the line,
        out of {ranked.length} tracked.
      </p>
    </div>
  );
}
