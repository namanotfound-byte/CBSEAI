"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { getBrowserAuth } from "@/lib/auth/supabase";
import { AppShell } from "@/components/shell/AppShell";
import { AuthScreen } from "./AuthScreen";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>();
  const [recovering, setRecovering] = useState(false);
  const auth = getBrowserAuth();


  useEffect(() => {
    if (!auth) {
      setSession(null);
      return;
    }
    let active = true;
    const { data } = auth.auth.onAuthStateChange((event, next) => {
      if (event === "INITIAL_SESSION") return;
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    void auth.auth.getSession().then(async ({ data: stored }) => {
      if (!stored.session) {
        if (active) setSession(null);
        return;
      }
      const { error } = await auth.auth.getUser(stored.session.access_token);
      if (error && (error.status === 401 || error.status === 403 || error.code === "session_not_found")) {
        await auth.auth.signOut({ scope: "local" });
        if (active) setSession(null);
        return;
      }
      if (active) setSession(stored.session);
    }).catch(() => { if (active) setSession(null); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [auth]);

  useEffect(() => {
    if (session && (pathname === "/login" || pathname === "/signup")) {
      router.replace("/");
    }
  }, [pathname, router, session]);

  if (pathname === "/privacy" || pathname === "/about") return children;
  if (session === undefined) {
    return <div className="flex min-h-dvh items-center justify-center text-sm">Opening Padhle…</div>;
  }
  if (recovering && session) return <AuthScreen mode="recovery" onRecovered={() => { setRecovering(false); router.replace("/"); }} />;
  if (!session) return <AuthScreen mode={pathname === "/signup" ? "signup" : "login"} />;
  const metadata = session.user.user_metadata;
  const givenName = [metadata?.full_name, metadata?.name, metadata?.user_name, metadata?.preferred_username]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  const displayName = givenName?.trim() ?? (session.user.email?.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Student");
  return (
    <AppShell
      displayName={displayName}
      userId={session.user.id}
      onSignOut={() => { void auth?.auth.signOut(); }}
    >
      {children}
    </AppShell>
  );
}
