"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getBrowserAuth } from "@/lib/auth/supabase";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const auth = getBrowserAuth();
    void auth?.auth.getUser().then(({ data }) => {
      const metadata = data.user?.user_metadata;
      setName(typeof metadata?.full_name === "string" ? metadata.full_name : "");
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const auth = getBrowserAuth();
    const { error } = await auth!.auth.updateUser({ data: { full_name: name.trim() } });
    setNotice(error ? error.message : "Name saved.");
    setBusy(false);
  }

  return <main className="mx-auto w-full max-w-2xl px-5 py-10">
    <h1 className="text-3xl font-semibold">Settings</h1>
    <p className="mt-2 text-sm" style={{ color: "var(--text-soft)" }}>Choose the name shown in your account menu.</p>
    <form onSubmit={(event) => void save(event)} className="mt-8 space-y-4">
      <label className="block text-sm font-medium">Display name
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required className="mt-2 block w-full rounded-xl border px-4 py-3 outline-none focus:ring-2" style={{ background: "var(--surface)", borderColor: "var(--rule)" }} />
      </label>
      <button disabled={busy} type="submit" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save name"}</button>
      {notice && <p role="status" className="text-sm">{notice}</p>}
    </form>
  </main>;
}
