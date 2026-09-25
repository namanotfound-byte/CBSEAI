"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  Menu,
  LogOut,
  MessageSquare,
  Network,
  SquarePen,
  Settings,
  X,
} from "lucide-react";
import { APP } from "@/lib/config";
import { PadhleMark } from "@/components/brand/PadhleMark";
import { CHATS_CHANGED, listChats, type ChatSummary } from "@/lib/chat-history";

const NAV = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/subjects", label: "Chapters", icon: BookOpen },
  { href: "/graph", label: "Weak spots", icon: Network },
  { href: "/plan", label: "Study plan", icon: CalendarDays },
];

export function AppShell({ children, displayName, userId, onSignOut }: {
  children: React.ReactNode;
  displayName: string;
  userId: string;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatsError, setChatsError] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = () => { void listChats()
      .then((rows) => { if (active) { setChats(rows); setChatsError(false); } })
      .catch(() => { if (active) setChatsError(true); }); };
    refresh();
    window.addEventListener(CHATS_CHANGED, refresh);
    return () => { active = false; window.removeEventListener(CHATS_CHANGED, refresh); };
  }, [userId]);

  const newChat = () => window.location.assign(`/?new=${crypto.randomUUID()}`);
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "S";
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const sidebar = (
    <div className="flex h-full flex-col p-2.5">
      <div className="flex items-center justify-between px-1 pb-2">
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-[14px]"
          style={{ fontWeight: 600 }}
        >
          <PadhleMark size={28} className="shrink-0" />
          <span className="truncate">{APP.name}</span>
        </Link>
        <button
          type="button"
          onClick={newChat}
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          aria-label="New chat"
          title="New chat"
        >
          <SquarePen size={19} />
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors"
              style={{
                background: active ? "var(--hover)" : "transparent",
                color: "var(--text)",
                fontWeight: active ? 550 : 400,
              }}
            >
              <item.icon size={18} strokeWidth={1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-7 min-h-0 flex-1 overflow-y-auto px-1">
        <p className="px-2 pb-2 text-xs font-semibold" style={{ color: "var(--text-faint)" }}>Recent chats</p>
        {chatsError && <p className="px-2 py-2 text-xs" style={{ color: "var(--text-faint)" }}>Couldn’t load chats. Refresh to retry.</p>}
        {!chatsError && chats.length === 0 && <p className="px-2 py-2 text-xs" style={{ color: "var(--text-faint)" }}>Your saved chats will appear here.</p>}
        {chats.map((chat) => <Link key={chat.id} href={`/?chat=${chat.id}`} onClick={() => setMobileOpen(false)} title={chat.title} className="block truncate rounded-lg px-2 py-2 text-[13px] hover:bg-black/5">{chat.title}</Link>)}
      </div>

      <div className="relative mt-auto border-t px-1 pt-2" style={{ borderColor: "var(--rule)" }}>
        {profileOpen && <div className="absolute bottom-full left-1 right-1 mb-2 rounded-xl border p-1 shadow-lg" style={{ background: "var(--surface)", borderColor: "var(--rule)" }}>
          <Link href="/settings" onClick={() => { setProfileOpen(false); setMobileOpen(false); }} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-black/5"><Settings size={16} />Settings</Link>
          <button type="button" onClick={onSignOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-black/5"><LogOut size={16} />Sign out</button>
        </div>}
        <button type="button" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen} aria-label="Account menu" className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-black/5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] text-white"
            style={{ background: "#8052a5", fontWeight: 600 }}
          >
            {initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px]" style={{ fontWeight: 550 }}>
              {displayName}
            </span>
            <span className="block text-[11px]" style={{ color: "var(--text-faint)" }}>
              Class 10
            </span>
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden" style={{ background: "var(--surface)" }}>
      <aside
        className="hidden h-full w-[260px] shrink-0 md:block"
        style={{ background: "var(--sidebar)" }}
      >
        {sidebar}
      </aside>

      <header
        className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between px-3 md:hidden"
        style={{ background: "var(--surface)" }}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          aria-label="Open menu"
        >
          <Menu size={21} />
        </button>
        <Link href="/" className="text-[15px]" style={{ fontWeight: 600 }}>
          {APP.name}
        </Link>
        <button
          type="button"
          onClick={newChat}
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          aria-label="New chat"
        >
          <SquarePen size={20} />
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <aside
            className="relative h-full w-[min(86vw,320px)]"
            style={{ background: "var(--sidebar)" }}
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="flex h-dvh min-h-0 min-w-0 flex-1 flex-col overflow-hidden pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
