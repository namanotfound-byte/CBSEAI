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
    void auth.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null));
    const { data } = auth.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (session && (pathname === "/login" || pathname === "/signup")) {
      router.replace("/");
    }
  }, [pathname, router, session]);

  if (pathname === "/privacy") return children;
  if (session === undefined) {
    return <div className="flex min-h-dvh items-center justify-center text-sm">Opening Padhle…</div>;
  }
  if (recovering && session) return <AuthScreen mode="recovery" onRecovered={() => { setRecovering(false); router.replace("/"); }} />;
  if (!session) return <AuthScreen mode={pathname === "/signup" ? "signup" : "login"} />;
  return (
    <AppShell
      email={session.user.email ?? "Student"}
      onSignOut={() => { void auth?.auth.signOut(); }}
    >
      {children}
    </AppShell>
  );
}
