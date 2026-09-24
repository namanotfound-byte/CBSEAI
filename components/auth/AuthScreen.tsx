"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { getBrowserAuth } from "@/lib/auth/supabase";

export function AuthScreen({ mode, onRecovered }: { mode: "login" | "signup" | "recovery"; onRecovered?: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);
  const [providers, setProviders] = useState({ google: false, github: false });
  const auth = getBrowserAuth();

  useEffect(() => {
    void fetch("/api/auth/providers")
      .then((res) => res.ok ? res.json() : null)
      .then((settings) => {
        if (settings) setProviders({
          google: Boolean(settings.google),
          github: Boolean(settings.github),
        });
      })
      .catch(() => undefined);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth) return setMessage("Sign-in is being configured. Please try again later.");
    setBusy(true);
    setMessage("");
    try {
      if (mode === "recovery") {
        const { error } = await auth.auth.updateUser({ password });
        if (error) throw error;
        onRecovered?.();
      } else if (reset) {
        const { error } = await auth.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        });
        if (error) throw error;
        setMessage("Check your email for the password reset link.");
      } else if (mode === "signup") {
        const { data, error } = await auth.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMessage(data.session
          ? "Your account is ready. Opening Padhle…"
          : "Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await auth.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const social = async (provider: "google" | "github") => {
    if (!auth) return setMessage("Sign-in is being configured. Please try again later.");
    setBusy(true);
    setMessage("");
    const { error } = await auth.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setMessage(error.message);
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f8f9fb] px-4 py-10">
      <div className="w-full max-w-[420px] rounded-2xl border border-[#e4e7ec] bg-white p-7 shadow-sm sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#171717] text-white">
            <GraduationCap size={22} />
          </span>
          <span className="text-xl font-semibold">Padhle</span>
        </div>
        <h1 className="text-2xl font-semibold">
          {mode === "recovery" ? "Choose a new password" : reset ? "Reset your password" : mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-[#667085]">
          {mode === "recovery" ? "Enter a new password for your account." : reset ? "We'll email you a reset link." : "Study Class 10 Maths and Science with CBSE sources."}
        </p>

        {!reset && mode !== "recovery" && (
          <div className="mt-7 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => void social("google")} disabled={busy || !providers.google}
              className="rounded-lg border border-[#d0d5dd] px-3 py-2.5 text-sm font-medium hover:bg-[#f9fafb] disabled:opacity-50">
              Google{providers.google ? "" : " · setup pending"}
            </button>
            <button type="button" onClick={() => void social("github")} disabled={busy || !providers.github}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#d0d5dd] px-3 py-2.5 text-sm font-medium hover:bg-[#f9fafb] disabled:opacity-50">
              GitHub{providers.github ? "" : " · setup pending"}
            </button>
          </div>
        )}

        {!reset && mode !== "recovery" && <div className="my-6 flex items-center gap-3 text-xs text-[#98a2b3]"><span className="h-px flex-1 bg-[#e4e7ec]" />or use email<span className="h-px flex-1 bg-[#e4e7ec]" /></div>}
        <form onSubmit={(event) => void submit(event)} className={reset || mode === "recovery" ? "mt-7 space-y-4" : "space-y-4"}>
          {mode !== "recovery" && <label className="block text-sm font-medium">Email
            <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-[#d0d5dd] px-3 py-2.5 outline-none focus:border-[#171717]" />
          </label>}
          {(!reset || mode === "recovery") && <label className="block text-sm font-medium">{mode === "recovery" ? "New password" : "Password"}
            <input type="password" minLength={6} autoComplete={mode === "signup" || mode === "recovery" ? "new-password" : "current-password"} required value={password} onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-[#d0d5dd] px-3 py-2.5 outline-none focus:border-[#171717]" />
          </label>}
          {message && <p role="status" className="text-sm text-[#344054]">{message}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Please wait…" : mode === "recovery" ? "Save new password" : reset ? "Send reset link" : mode === "signup" ? "Sign up" : "Sign in"}
          </button>
        </form>
        {mode !== "recovery" && <div className="mt-6 flex justify-between text-sm">
          <button type="button" onClick={() => { setReset(false); setMessage(""); router.push(mode === "signup" ? "/login" : "/signup"); }} className="underline">
            {mode === "signup" ? "Already have an account?" : "Create an account"}
          </button>
          <button type="button" onClick={() => { setReset(!reset); setMessage(""); }} className="underline">
            {reset ? "Back to sign in" : "Forgot password?"}
          </button>
        </div>}
      </div>
    </main>
  );
}
