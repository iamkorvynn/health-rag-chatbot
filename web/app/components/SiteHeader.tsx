"use client";
// Shared top nav (Nexcent style) — on every page via layout.tsx.
// Real routes only: Chat, Patients, Upload, Visit, Dashboard, How it works,
// Tests, Settings. Items are shown per role; the active page is highlighted.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/auth";

type NavItem = { href: string; label: string; adminOnly?: boolean; authedOnly?: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: "/chat", label: "Chat", authedOnly: true },
  { href: "/patients", label: "Patients", authedOnly: true },
  { href: "/upload", label: "Upload", adminOnly: true },
  { href: "/visit", label: "Visit & tokens" },
  { href: "/dashboard", label: "Dashboard", adminOnly: true },
  { href: "/how", label: "How it works" },
  { href: "/tests", label: "Test questions" },
  { href: "/settings", label: "Settings", adminOnly: true },
];

export default function SiteHeader() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";
  const items = NAV_ITEMS.filter((i) => {
    if (i.adminOnly) return isAdmin;
    if (i.authedOnly) return !!user;
    return true;
  });
  return (
    <header className="sticky top-0 z-40 bg-[#070b08]/95 backdrop-blur border-b border-line">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center shadow-soft">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#0b120c" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </span>
          <span className="leading-tight">
            <span className="block font-bold text-ink text-[15px]">Sunrise Family Clinic</span>
            <span className="block text-xs text-muted">Health RAG Assistant</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-5 ml-auto text-sm font-medium">
          {items.map((i) => {
            const active = pathname === i.href;
            return (
              <Link
                key={i.href}
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={active ? "text-brand-deep font-bold border-b-2 border-brand pb-0.5" : "text-ink/80 hover:text-brand-deep"}
              >
                {i.label}
              </Link>
            );
          })}
        </nav>
        {user ? (
          <span className="ml-auto md:ml-0 flex items-center gap-2">
            <span className="hidden sm:inline bg-grape-soft text-grape-dark text-xs font-semibold rounded-full px-3 py-1.5">
              {user.username} · {user.role}
            </span>
            <button
              type="button"
              onClick={logout}
              className="border border-line hover:border-grape text-ink text-sm font-semibold rounded-lg px-3 py-2 bg-card"
            >
              Log out
            </button>
          </span>
        ) : (
          <Link href="/chat" className="ml-auto md:ml-0 bg-brand hover:bg-brand-dark text-onlime text-sm font-semibold rounded-lg px-4 py-2 shadow-soft">
            Sign in →
          </Link>
        )}
      </div>
    </header>
  );
}
