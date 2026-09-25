"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { getBrowserAuth } from "@/lib/auth/supabase";
import { PadhleMark } from "@/components/brand/PadhleMark";
import { SESSION_NOTICE_KEY } from "@/lib/auth/session-recovery";

type Mode = "login" | "signup" | "recovery";

function GoogleIcon() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.7-.06-1.38-.18-2.03H12v3.84h5.38a4.6 4.6 0 0 1-2 3.01v2.49h3.22c1.88-1.73 3-4.28 3-7.31Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.46l-3.22-2.49c-.9.6-2.04.96-3.41.96-2.61 0-4.83-1.76-5.62-4.12H3.06v2.56A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.38 13.89a6 6 0 0 1 0-3.78V7.55H3.06a10 10 0 0 0 0 8.9l3.32-2.56Z"/><path fill="#EA4335" d="M12 5.99c1.47 0 2.8.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.55l3.32 2.56C7.17 7.75 9.39 5.99 12 5.99Z"/></svg>;
}

function GitHubIcon() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.1c-3.09.67-3.74-1.31-3.74-1.31-.5-1.28-1.23-1.62-1.23-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 .1 1.53.84 3.25.6.1-.72.39-1.21.71-1.49-2.47-.28-5.06-1.24-5.06-5.49 0-1.21.43-2.2 1.14-2.98-.11-.28-.49-1.41.11-2.94 0 0 .93-.3 3.05 1.14a10.63 10.63 0 0 1 5.55 0c2.12-1.44 3.05-1.14 3.05-1.14.6 1.53.22 2.66.11 2.94.71.78 1.14 1.77 1.14 2.98 0 4.26-2.6 5.21-5.08 5.48.4.35.75 1.01.75 2.04v3.02c0 .3.2.65.76.54A11.1 11.1 0 0 0 12 .9Z"/></svg>;
}

export function AuthScreen({ mode, onRecovered }: { mode: Mode; onRecovered?: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [sessionNotice, setSessionNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [reset, setReset] = useState(false);
  const [providers, setProviders] = useState({ google: false, github: false });
  const auth = getBrowserAuth();

  useEffect(() => {
    try {
      const notice = window.sessionStorage.getItem(SESSION_NOTICE_KEY);
      if (notice) { setSessionNotice(notice); window.sessionStorage.removeItem(SESSION_NOTICE_KEY); }
    } catch { /* Private browsing may disable session storage. */ }
    void fetch("/api/auth/providers")
      .then((res) => res.ok ? res.json() : null)
      .then((settings) => {
        if (settings) setProviders({ google: Boolean(settings.google), github: Boolean(settings.github) });
      })
      .catch(() => undefined);
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error_description") ?? params.get("error");
    if (oauthError) setErrorMessage(oauthError.replaceAll("+", " "));
  }, []);

  const clearNotice = () => { setMessage(""); setErrorMessage(""); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth) return setErrorMessage("Sign-in is unavailable right now. Please try again shortly.");
    setBusy(true);
    clearNotice();
    try {
      if (mode === "recovery") {
        const { error } = await auth.auth.updateUser({ password });
        if (error) throw error;
        onRecovered?.();
      } else if (reset) {
        const { error } = await auth.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/login` });
        if (error) throw error;
        setMessage("Password reset link sent. Check your inbox and spam folder.");
      } else if (mode === "signup") {
        const { data, error } = await auth.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name.trim() } },
        });
        if (error) throw error;
        setMessage(data.session ? "Your account is ready. Opening Padhle…" : "Check your inbox for a confirmation link, then sign in.");
      } else {
        const { error } = await auth.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace("/");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const social = async (provider: "google" | "github") => {
    if (!auth) return setErrorMessage("Sign-in is unavailable right now. Please try again shortly.");
    setBusy(true);
    clearNotice();
    const { error } = await auth.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
    if (error) { setErrorMessage(error.message); setBusy(false); }
  };

  const title = mode === "recovery" ? "Choose a new password" : reset ? "Reset your password" : mode === "signup" ? "Create your account" : "Welcome back";
  const subtitle = mode === "recovery" ? "Enter a new password to secure your account." : reset ? "We’ll email you a link to reset your password." : mode === "signup" ? "Start learning with answers grounded in CBSE sources." : "Sign in to continue learning with Padhle.";
  const fieldClass = "mt-2 block h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-[15px] text-slate-950 placeholder:text-slate-400 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-200";

  return (
    <main className="min-h-dvh bg-[#f5f6f8] px-4 py-8 text-slate-950 sm:px-6 sm:py-12" style={{ colorScheme: "light" }}>
      <div className="mx-auto grid min-h-[min(720px,calc(100dvh-96px))] max-w-[1020px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_70px_-30px_rgba(15,23,42,0.28)] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden flex-col justify-between bg-[#111827] p-12 text-white lg:flex">
          <div className="flex items-center gap-3"><PadhleMark size={44} className="ring-1 ring-white/20" /><span className="text-2xl font-semibold tracking-tight">Padhle</span></div>
          <div>
            <span className="inline-flex rounded-full border border-white/20 px-3 py-1.5 text-sm font-medium text-indigo-200">CBSE Class 10 · Maths &amp; Science</span>
            <h2 className="mt-6 max-w-sm text-[40px] font-semibold leading-[1.15] tracking-tight">Learn the concept. Write the answer.</h2>
            <p className="mt-5 max-w-sm text-base leading-7 text-slate-300">Ask a question and get a clear explanation grounded in your CBSE and NCERT study material.</p>
          </div>
          <p className="text-sm text-slate-400">Built for the way you study.</p>
        </div>

        <div className="flex flex-col justify-center px-6 py-10 sm:px-12 sm:py-14 lg:px-16">
          <div className="mb-10 flex items-center gap-3 lg:hidden"><PadhleMark size={42} /><span className="text-2xl font-semibold tracking-tight">Padhle</span></div>
          <div className="mx-auto w-full max-w-[390px]">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.17em] text-indigo-700">Your study space</p>
            <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-slate-950 sm:text-[34px]">{title}</h1>
            <p className="mt-2 text-[15px] leading-6 text-slate-600">{subtitle}</p>
            {sessionNotice && <p role="status" className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">{sessionNotice}</p>}

            {!reset && mode !== "recovery" && <>
              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => void social("google")} disabled={busy || !providers.google} className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 transition hover:border-slate-500 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50"><GoogleIcon />Google</button>
                <button type="button" onClick={() => void social("github")} disabled={busy || !providers.github} className="flex h-12 items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 transition hover:border-slate-500 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50"><GitHubIcon />GitHub</button>
              </div>
              <div className="my-7 flex items-center gap-3 text-xs font-medium text-slate-500"><span className="h-px flex-1 bg-slate-200" />or continue with email<span className="h-px flex-1 bg-slate-200" /></div>
            </>}

            <form onSubmit={(event) => void submit(event)} className={reset || mode === "recovery" ? "mt-8 space-y-5" : "space-y-5"}>
              {mode === "signup" && <label className="block text-sm font-semibold text-slate-800">Your name<input type="text" autoComplete="name" placeholder="How should we call you?" maxLength={60} required value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} /></label>}
              {mode !== "recovery" && <label className="block text-sm font-semibold text-slate-800"><span className="flex items-center gap-2"><Mail size={16} aria-hidden="true" />Email address</span><input type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} /></label>}
              {(!reset || mode === "recovery") && <label className="block text-sm font-semibold text-slate-800"><span className="flex items-center gap-2"><LockKeyhole size={16} aria-hidden="true" />{mode === "recovery" ? "New password" : "Password"}</span><span className="relative mt-2 block"><input type={showPassword ? "text" : "password"} minLength={6} autoComplete={mode === "signup" || mode === "recovery" ? "new-password" : "current-password"} required value={password} onChange={(event) => setPassword(event.target.value)} className="block h-12 w-full rounded-xl border border-slate-300 bg-white px-4 pr-12 text-[15px] text-slate-950 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-200" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-lg text-slate-600 hover:text-slate-950" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></span>{mode === "signup" && <span className="mt-2 block text-xs font-normal text-slate-600">Use at least 6 characters.</span>}</label>}
              {errorMessage && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">{errorMessage}</p>}
              {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-900">{message}</p>}
              <button type="submit" disabled={busy} className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-[15px] font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-wait disabled:opacity-60">{busy ? "Please wait…" : mode === "recovery" ? "Save new password" : reset ? "Send reset link" : mode === "signup" ? "Create account" : "Sign in"}</button>
            </form>

            {mode !== "recovery" && <div className="mt-7 space-y-4 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
              <p>{mode === "signup" || reset ? "Already have an account?" : "New to Padhle?"} <button type="button" onClick={() => { setReset(false); clearNotice(); router.push(mode === "signup" || reset ? "/login" : "/signup"); }} className="font-semibold text-slate-950 underline decoration-slate-400 underline-offset-4 hover:decoration-slate-950">{mode === "signup" || reset ? "Sign in" : "Create an account"}</button></p>
              {mode === "login" && !reset && <button type="button" onClick={() => { setReset(true); clearNotice(); }} className="font-semibold text-slate-700 underline decoration-slate-400 underline-offset-4 hover:text-slate-950">Forgot password?</button>}
            </div>}
            <p className="mt-9 text-center text-xs leading-5 text-slate-600">Padhle uses your account to keep your learning space secure. <Link href="/about" className="font-medium text-slate-800 underline underline-offset-2">About</Link> · <Link href="/privacy" className="font-medium text-slate-800 underline underline-offset-2">Privacy</Link></p>
          </div>
        </div>
      </div>
    </main>
  );
}
