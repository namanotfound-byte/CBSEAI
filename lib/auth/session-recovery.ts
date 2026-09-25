export const INVALID_SESSION_EVENT = "padhle:session-invalid";
export const SESSION_NOTICE_KEY = "padhle:session-notice";
export const PENDING_DRAFT_KEY = "padhle:pending-draft";

export function rememberExpiredSession(parts?: { type: string; text?: string }[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_NOTICE_KEY, "Your session ended. Sign in again to continue.");
    if (parts?.length) {
      window.sessionStorage.setItem(PENDING_DRAFT_KEY, JSON.stringify({
        text: parts.filter((part) => part.type === "text").map((part) => part.text ?? "").join(" ").slice(0, 4000),
        hadImage: parts.some((part) => part.type === "image"),
      }));
    }
  } catch {
    // Storage may be unavailable in private browsing; sign-in still works.
  }
  window.dispatchEvent(new Event(INVALID_SESSION_EVENT));
}
