"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { getBrowserAuth } from "@/lib/auth/supabase";

// OAuth client IDs identify a browser app; the client secret stays in Supabase.
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
  "305269086456-paojllp81gubrdo1tb8k7d5ejrjn3aok.apps.googleusercontent.com";

type GoogleIdentity = {
  accounts: { id: {
    initialize(options: {
      client_id: string;
      callback: (response: { credential: string }) => void;
      nonce: string;
      ux_mode: "popup";
    }): void;
    renderButton(parent: HTMLElement, options: {
      type: "standard";
      theme: "outline";
      size: "large";
      shape: "rectangular";
      text: "signin_with" | "signup_with";
      width: number;
    }): void;
  } };
};

async function noncePair() {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce));
  const hashed = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { nonce, hashed };
}

export function GoogleSignIn({
  signup,
  onError,
  onBusy,
  onReady,
}: {
  signup: boolean;
  onError: (message: string) => void;
  onBusy: (busy: boolean) => void;
  onReady: (ready: boolean) => void;
}) {
  const router = useRouter();
  const button = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    const google = (window as typeof window & { google?: GoogleIdentity }).google;
    if (!scriptReady || !google || !button.current) return;
    let active = true;
    void noncePair().then(({ nonce, hashed }) => {
      if (!active || !button.current) return;
      button.current.replaceChildren();
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        ux_mode: "popup",
        nonce: hashed,
        callback: ({ credential }) => {
          const auth = getBrowserAuth();
          if (!auth) return onError("Google sign-in is unavailable right now.");
          onBusy(true);
          void auth.auth.signInWithIdToken({ provider: "google", token: credential, nonce })
            .then(({ error }) => {
              if (error) throw error;
              router.replace("/");
            })
            .catch((error: unknown) => onError(error instanceof Error ? error.message : "Google sign-in failed. Please try again."))
            .finally(() => onBusy(false));
        },
      });
      google.accounts.id.renderButton(button.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "rectangular",
        text: signup ? "signup_with" : "signin_with",
        width: 184,
      });
      onReady(true);
    }).catch(() => onError("Google sign-in could not start. Please try again."));
    return () => { active = false; };
  }, [scriptReady, signup, router, onError, onBusy, onReady]);

  return <>
    <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setScriptReady(true)} onError={() => onError("Google sign-in could not load. Please try again.")} />
    <div ref={button} className="flex h-12 items-center justify-center" aria-label="Sign in with Google" />
  </>;
}
