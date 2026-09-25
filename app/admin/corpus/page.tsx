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
      const { data } = await auth!.auth.getSession();
      if (!data.session) throw new Error("Sign in again, then return to this page.");
      const response = await fetch("/api/admin/publish-reviewed", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Publishing failed");
      setMessage(`Published ${result.published} reviewed passages. Total live passages: ${result.total}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Publishing failed");
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto max-w-xl px-6 py-12 text-slate-900">
    <Link href="/" className="text-sm underline">← Padhle</Link>
    <h1 className="mt-8 text-3xl font-semibold">Reviewed sources</h1>
    <p className="mt-3 text-slate-600">Publish ten page-checked NCERT Maths and Science passages from the 2026–27 review. This can be run again safely.</p>
    {email.toLowerCase() === "naman070609@gmail.com" ? <button disabled={busy} onClick={() => void publish()} className="mt-6 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Publishing…" : "Publish reviewed passages"}</button> : <p className="mt-6 text-slate-600">Sign in with the project owner account to publish.</p>}
    {message && <p role="status" className="mt-5 rounded-xl bg-slate-100 p-4">{message}</p>}
  </main>;
}
