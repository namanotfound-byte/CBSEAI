"use client";

import { useState } from "react";
import { getBrowserAuth } from "@/lib/auth/supabase";

type ArchiveResult = {
  subject: string;
  sourcePath: string;
  archiveMember: string | null;
  page: number;
  extractionStatus: string;
  pageType: string | null;
  excerpt: string;
};

export default function ArchiveSearchPage() {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [results, setResults] = useState<ArchiveResult[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const auth = getBrowserAuth();
    if (!auth) { setMessage("Sign-in is not configured."); return; }
    setBusy(true);
    setMessage("");
    try {
      const { data } = await auth.auth.getSession();
      const params = new URLSearchParams({ q: query });
      if (subject) params.set("subject", subject);
      const response = await fetch(`/api/archive-search?${params}`, {
        headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {},
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Search failed.");
      setResults(body.results ?? []);
      setMessage(body.results?.length ? `${body.count} archive matches` : "No matching extracted pages found.");
    } catch (error) {
      setResults([]);
      setMessage(error instanceof Error ? error.message : "Search failed.");
    } finally { setBusy(false); }
  }

  return (
    <section className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-5 py-8 md:px-8">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>Discovery only</p>
      <h1 className="mt-2 text-2xl font-semibold">Search the source archive</h1>
      <p className="mt-3 rounded-xl border p-4 text-sm" style={{ borderColor: "var(--rule)", background: "var(--hover)" }}>
        These are raw extraction leads. They have not been verified or approved, and are never used to generate tutor answers. Check each cited source page before relying on it.
      </p>
      <form onSubmit={search} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="archive-query">Search terms</label>
        <input id="archive-query" value={query} onChange={(event) => setQuery(event.target.value)} required maxLength={240} placeholder="Search words in Maths and Science pages" className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm" style={{ background: "var(--surface)", borderColor: "var(--rule)" }} />
        <label className="sr-only" htmlFor="archive-subject">Subject</label>
        <select id="archive-subject" value={subject} onChange={(event) => setSubject(event.target.value)} className="rounded-xl border px-3 py-3 text-sm" style={{ background: "var(--surface)", borderColor: "var(--rule)" }}>
          <option value="">All subjects</option><option value="science">Science</option><option value="maths">Maths</option>
        </select>
        <button disabled={busy} className="rounded-xl px-5 py-3 text-sm font-medium text-white disabled:opacity-50" style={{ background: "#8052a5" }}>{busy ? "Searching…" : "Search"}</button>
      </form>
      {message && <p role="status" className="mt-4 text-sm" style={{ color: "var(--text-faint)" }}>{message}</p>}
      <div className="mt-4 space-y-3">
        {results.map((result, index) => <article key={`${result.sourcePath}:${result.page}:${index}`} className="rounded-xl border p-4" style={{ borderColor: "var(--rule)" }}>
          <p className="text-xs font-medium uppercase" style={{ color: "var(--text-faint)" }}>{result.subject} · Page {result.page} · {result.extractionStatus}</p>
          <p className="mt-2 break-words text-sm font-medium">{result.sourcePath.includes("!/") || !result.archiveMember ? result.sourcePath : `${result.sourcePath}!/${result.archiveMember}`}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{result.excerpt}</p>
        </article>)}
      </div>
    </section>
  );
}
