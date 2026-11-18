"use client";
// /signup — dedicated sign-up page. New accounts are always staff
// (the backend fixes the role server-side, so nobody can sign up as
// admin). On success the account is signed in immediately and sent to chat.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";

export default function SignupPage() {
  const { user, ready, signup } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace(user.role === "admin" ? "/dashboard" : "/chat");
  }, [ready, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const name = username.trim();
    if (name.length < 3 || !/^[A-Za-z0-9_.\-]+$/.test(name)) {
      setError("Username must be 3–30 characters: letters, numbers, _ . -");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    const r = await signup(name, password);
    if (!r.ok) setError(r.error || "Sign-up failed.");
    setBusy(false);
  }

  return (
    <div className="pb-20 md:pb-0">
      <section className="bg-gradient-to-b from-lavender via-[#0e1a10] to-lavender-deep">
        <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <p className="text-xs font-bold tracking-[0.18em] text-brand-deep uppercase">Sunrise Family Clinic • Sign up</p>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold text-ink">Create a staff account</h1>
          <p className="mt-4 text-muted leading-relaxed">
            New accounts are staff accounts — they can chat, see patients and take tokens.
            Admin accounts are provided by the clinic, not created here.
          </p>

          {!ready ? (
            <p className="mt-10 text-center text-muted text-sm">Loading…</p>
          ) : !user ? (
            <div className="mt-10">
              <form onSubmit={submit} className="bg-card rounded-[24px] shadow-card p-5 space-y-3">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  autoComplete="username"
                  className="w-full bg-card border border-line rounded-full px-4 py-3 text-sm shadow-soft outline-none focus:border-brand"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (at least 6 characters)"
                  autoComplete="new-password"
                  className="w-full bg-card border border-line rounded-full px-4 py-3 text-sm shadow-soft outline-none focus:border-brand"
                />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className="w-full bg-card border border-line rounded-full px-4 py-3 text-sm shadow-soft outline-none focus:border-brand"
                />
                {error && <p className="text-sm text-red-300 bg-red-950/60 rounded-xl px-4 py-2">{error}</p>}
                <button
                  disabled={busy}
                  className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-onlime font-semibold rounded-full px-6 py-3 text-sm shadow-soft"
                >
                  {busy ? "Creating account…" : "Create account →"}
                </button>
              </form>
              <p className="text-sm text-muted mt-4 text-center">
                Already have an account?{" "}
                <Link href="/login" className="text-brand-deep font-semibold hover:underline">
                  Sign in →
                </Link>
              </p>
              <p className="text-xs text-muted mt-3 text-center">
                Decision-support only — not a replacement for a doctor. Synthetic demo data.
              </p>
            </div>
          ) : (
            <p className="mt-10 text-center text-muted text-sm">Signing you in…</p>
          )}
        </div>
      </section>
    </div>
  );
}
