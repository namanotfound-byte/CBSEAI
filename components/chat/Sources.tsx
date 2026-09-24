"use client";

import type { Source, SourceKind } from "@/lib/types";
import { X } from "lucide-react";

/**
 * Citations. Every chip is numbered to match the [1] marks in the answer, and
 * tapping one opens the snippet underneath — students check the book, so the
 * book has to be one tap away, not a link out.
 */
const KIND_STYLE: Record<SourceKind, { label: string; dot: string }> = {
  syllabus: { label: "Current syllabus", dot: "var(--accent)" },
  ncert: { label: "NCERT", dot: "var(--accent)" },
  ms: { label: "Marking scheme", dot: "var(--red)" },
  diagram: { label: "Diagram", dot: "#00A676" },
  exemplar: { label: "Exemplar", dot: "#00A676" },
  pyq: { label: "Past paper", dot: "#B45CFF" },
  sqp: { label: "Sample paper", dot: "#FF9500" },
  cfpq: { label: "CFPQ", dot: "#FF9500" },
  model: { label: "Model paper", dot: "var(--text-faint)" },
  notes: { label: "Notes", dot: "var(--text-faint)" },
};

export function Sources({
  sources,
  open,
  onOpen,
}: {
  sources: Source[];
  open: Source | null;
  onOpen: (s: Source | null) => void;
}) {
  return (
    <div className="mt-3.5">
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s, i) => {
          const active = open?.id === s.id;
          const style = KIND_STYLE[s.kind];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onOpen(active ? null : s)}
              className="inline-flex items-center gap-1.5 rounded-lg border py-1 pl-2 pr-2.5 text-[12px] transition-colors"
              style={{
                borderColor: active ? "var(--accent)" : "var(--rule)",
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-soft)",
              }}
            >
              <span
                className="inline-flex h-[15px] w-[15px] items-center justify-center rounded-full text-[9.5px] leading-none"
                style={{ background: style.dot, color: "#fff", fontWeight: 700 }}
              >
                {i + 1}
              </span>
              {s.label}
            </button>
          );
        })}
      </div>

      {open && (
        <figure
          className="relative mt-2.5 rounded-xl border px-3.5 py-3"
          style={{
            borderColor: "var(--rule)",
            background: "color-mix(in srgb, var(--bg) 55%, transparent)",
          }}
        >
          <button
            type="button"
            onClick={() => onOpen(null)}
            className="absolute right-2 top-2 rounded-md p-1"
            style={{ color: "var(--text-faint)" }}
            aria-label="Close snippet"
          >
            <X size={15} />
          </button>
          <blockquote
            className="pr-6 text-[13.5px] leading-relaxed"
            style={{ color: "var(--text)" }}
          >
            {open.snippet}
          </blockquote>
          {open.kind === "diagram" && open.diagramUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={open.diagramUrl}
              alt={open.label}
              className="mt-3 max-h-[22rem] w-full rounded-lg object-contain"
            />
          ) : null}
          <figcaption
            className="mt-2 text-[11.5px]"
            style={{ color: "var(--text-faint)" }}
          >
            {open.label}
            {open.sourceYear ? ` · source ${open.sourceYear}` : ""}
            {open.syllabusVersion ? ` · mapped to ${open.syllabusVersion} syllabus` : ""}
            {open.officialUrl ? (
              <>
                {" · "}
                <a
                  href={open.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dotted underline-offset-2"
                >
                  official source
                </a>
              </>
            ) : null}
          </figcaption>
        </figure>
      )}
    </div>
  );
}
