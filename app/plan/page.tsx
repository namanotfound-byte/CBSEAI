"use client";

import Link from "next/link";
import { STUDY_STEPS } from "@/lib/ai/study-advice";

export default function PlanPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b px-4 py-4 md:px-6" style={{ borderColor: "var(--rule)", background: "var(--surface)" }}>
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.03em]">Study plan</h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-soft)" }}>Make a plan that fits your time and the chapters you find difficult.</p>
      </header>
      <div className="sheet scroll-quiet min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[46rem] px-4 py-7 md:px-6">
          <section className="rounded-2xl border p-5 md:p-7" style={{ borderColor: "var(--rule)", background: "var(--surface)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-soft)" }}>Start here</p>
            <h2 className="mt-2 text-xl font-semibold">Build your next study session</h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-soft)" }}>Tell Padhle your exam date, how much time you have each day, and which Maths or Science chapters feel difficult. It can help turn those details into a timetable. It won’t invent your exam date or claim to know your weak areas.</p>
            <Link href="/" className="mt-5 inline-flex rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--surface)" }}>Ask for a study plan</Link>
          </section>
          <section className="mt-8">
            <h2 className="text-base font-semibold">A simple starting routine</h2>
            <ol className="mt-4 space-y-3">
              {STUDY_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3 rounded-xl border p-3.5 text-sm" style={{ borderColor: "var(--rule)" }}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold" style={{ background: "var(--accent-soft)" }}>{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs leading-5" style={{ color: "var(--text-faint)" }}>Personalised weak spots will appear after Padhle can assess your actual practice answers. No scores are guessed.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
