"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserAuth } from "@/lib/auth/supabase";

export default function CorpusAdmin() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const auth = getBrowserAuth();
    void auth?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function publish() {
    setBusy(true);
    setMessage("");
    try {
      const auth = getBrowserAuth();
      let offset = 0;
      let published = 0;
      while (true) {
        const { data } = await auth!.auth.getSession();
        if (!data.session) throw new Error("Sign in again, then return to this page.");
        const response = await fetch("/api/admin/publish-reviewed", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ offset }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Publishing failed");
        published += result.published;
        setMessage(`Checked ${result.processed} of ${result.corpusCount} reviewed passages; published ${published} new. Total live: ${result.total}.`);
        if (result.nextOffset === null) break;
        offset = result.nextOffset;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Publishing failed");
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto max-w-xl px-6 py-12 text-slate-900">
    <Link href="/" className="text-sm underline">← Padhle</Link>
    <h1 className="mt-8 text-3xl font-semibold">Reviewed sources</h1>
    <p className="mt-3 text-slate-600">Publish page-checked NCERT and CBSE Maths and Science passages and exact sample-paper marking answers. Previously published passages are skipped to conserve the free embedding allowance.</p>
    {email.toLowerCase() === "naman070609@gmail.com" ? <button disabled={busy} onClick={() => void publish()} className="mt-6 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Publishing…" : "Publish reviewed passages"}</button> : <p className="mt-6 text-slate-600">Sign in with the project owner account to publish.</p>}
    {message && <p role="status" className="mt-5 rounded-xl bg-slate-100 p-4">{message}</p>}
  </main>;
}
