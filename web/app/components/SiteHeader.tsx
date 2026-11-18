"use client";
// Shared top nav (Nexcent style) — on every page via layout.tsx.
import { useAuth } from "../lib/auth";
import Link from "next/link";

export default function SiteHeader() {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center shadow-soft">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </span>
          <span className="leading-tight">
            <span className="block font-bold text-ink text-[15px]">Sunrise Family Clinic</span>
            <span className="block text-xs text-muted">Health RAG Assistant</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-5 ml-auto text-sm font-medium text-ink/80">
          <Link href="/#features" className="hover:text-brand-deep">Features</Link>
          <Link href="/how" className="hover:text-brand-deep">How it works</Link>
          <Link href="/tests" className="hover:text-brand-deep">Test questions</Link>
          <Link href="/visit" className="hover:text-brand-deep">Visit &amp; tokens</Link>
          <Link href="/#patients" className="hover:text-brand-deep">Patients</Link>
        </nav>
        {user ? (
          <span className="ml-auto md:ml-0 flex items-center gap-2">
            <span className="hidden sm:inline bg-grape-soft text-grape-dark text-xs font-semibold rounded-full px-3 py-1.5">
              {user.username} · {user.role}
            </span>
            <button
              type="button"
              onClick={logout}
              className="border border-line hover:border-grape text-ink text-sm font-semibold rounded-lg px-3 py-2 bg-white"
            >
              Log out
            </button>
          </span>
        ) : (
          <Link href="/#login" className="ml-auto md:ml-0 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-lg px-4 py-2 shadow-soft">
            Sign in →
          </Link>
        )}
      </div>
    </header>
  );
}
