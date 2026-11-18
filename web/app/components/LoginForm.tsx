"use client";
// Sign-in form — real login against POST /auth/login (JWT).
// Seeded demo accounts: admin / doctor / staff (passwords <role>123).
import { useState } from "react";
import { useAuth } from "../lib/auth";

export default function LoginForm({ compact = false }: { compact?: boolean }) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password || busy) return;
    setBusy(true);
    setError("");
    const r = await login(username.trim(), password);
    if (!r.ok) setError(r.error || "Login failed.");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="bg-card rounded-[24px] shadow-card p-5 space-y-3">
      {!compact && (
        <p className="text-sm text-muted">
          Sign in to use the assistant. Staff accounts are provided by the clinic — try the demo
          accounts <code className="text-ink">admin / admin123</code>, <code className="text-ink">doctor / doctor123</code> or{" "}
          <code className="text-ink">staff / staff123</code>.
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoComplete="username"
          className="flex-1 bg-card border border-line rounded-full px-4 py-3 text-sm shadow-soft outline-none focus:border-brand"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="flex-1 bg-card border border-line rounded-full px-4 py-3 text-sm shadow-soft outline-none focus:border-brand"
        />
        <button
          disabled={busy}
          className="bg-grape hover:bg-grape-dark disabled:opacity-50 text-onlime font-semibold rounded-full px-6 py-3 text-sm shadow-soft shrink-0"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
      {error && <p className="text-sm text-red-300 bg-red-950/60 rounded-xl px-4 py-2">{error}</p>}
    </form>
  );
}
