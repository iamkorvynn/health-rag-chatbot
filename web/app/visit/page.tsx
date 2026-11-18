"use client";
// /visit — visit info (GET /visit-info, public) + token queue
// (GET /tokens public; POST /tokens/take public; POST /tokens/next for
// staff/admin). All numbers come from the live backend.
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost, type TokenStatus, type VisitInfo } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function VisitPage() {
  const { user, token } = useAuth();
  const [info, setInfo] = useState<VisitInfo | null>(null);
  const [infoError, setInfoError] = useState("");
  const [tokens, setTokens] = useState<TokenStatus | null>(null);
  const [tokensError, setTokensError] = useState("");
  const [name, setName] = useState("");
  const [taken, setTaken] = useState<{ number: number; position: number } | null>(null);
  const [takeError, setTakeError] = useState("");
  const [takeBusy, setTakeBusy] = useState(false);
  const [nextMsg, setNextMsg] = useState("");

  function refreshTokens() {
    apiGet<TokenStatus>("/tokens").then((r) => {
      if (r.ok && r.data) {
        setTokens(r.data);
        setTokensError("");
      } else {
        setTokensError(r.detail || `Token queue unavailable (${r.status || "no connection"}).`);
      }
    });
  }

  useEffect(() => {
    apiGet<VisitInfo>("/visit-info").then((r) => {
      if (r.ok && r.data) setInfo(r.data);
      else setInfoError(r.detail || `Visit info unavailable (${r.status || "no connection"}).`);
    });
    refreshTokens();
    const id = setInterval(refreshTokens, 20000);
    return () => clearInterval(id);
  }, []);

  async function takeToken(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || takeBusy) return;
    setTakeBusy(true);
    setTakeError("");
    setTaken(null);
    const r = await apiPost<{ number: number; position: number }>("/tokens/take", { name: name.trim() });
    if (r.ok && r.data) {
      setTaken({ number: r.data.number, position: r.data.position });
      setName("");
      refreshTokens();
    } else {
      setTakeError(r.detail || `Could not take a token (${r.status || "no connection"}).`);
    }
    setTakeBusy(false);
  }

  async function nextToken() {
    if (!token) return;
    setNextMsg("");
    const r = await apiPost<{ called: { number: number; name: string } | null }>("/tokens/next", undefined, token);
    if (r.ok && r.data) {
      setNextMsg(
        r.data.called != null
          ? `Now serving token #${r.data.called.number} — ${r.data.called.name}.`
          : "No one is waiting.",
      );
      refreshTokens();
    } else {
      setNextMsg(r.detail || `Could not call the next token (${r.status}).`);
    }
  }

  const canCallNext = user && (user.role === "staff" || user.role === "admin");

  return (
    <div className="pb-20 md:pb-0">
      <section>
        <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <p className="text-xs font-bold tracking-[0.18em] text-brand-deep uppercase">Sunrise Family Clinic • Visit</p>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold text-ink">Visit the clinic</h1>
          <p className="mt-4 text-muted leading-relaxed">
            Timings, fees and the token queue — straight from the clinic records.
          </p>

          {infoError && <p className="mt-6 text-sm text-red-300 bg-red-950/60 rounded-[16px] px-4 py-3">{infoError}</p>}

          {info && (
            <div className="mt-8 grid sm:grid-cols-3 gap-4">
              <div className="bg-lavender rounded-[24px] shadow-card p-5">
                <h2 className="font-bold text-ink">Timings</h2>
                <p className="text-sm text-muted mt-2 whitespace-pre-line">{info.timings}</p>
              </div>
              <div className="bg-lavender rounded-[24px] shadow-card p-5">
                <h2 className="font-bold text-ink">Fees</h2>
                <p className="text-sm text-muted mt-2 whitespace-pre-line">{info.fees}</p>
              </div>
              <div className="bg-lavender rounded-[24px] shadow-card p-5">
                <h2 className="font-bold text-ink">Emergency</h2>
                <p className="text-sm text-muted mt-2 whitespace-pre-line">{info.emergency}</p>
              </div>
            </div>
          )}
          {info?.source_file && (
            <p className="text-xs text-muted mt-3">Source: {info.source_file}</p>
          )}

          {/* Token queue */}
          <div className="mt-10 bg-gradient-to-b from-lavender via-[#0e1a10] to-lavender-deep rounded-[28px] shadow-card p-6">
            <h2 className="font-bold text-ink text-xl">Token queue</h2>
            {tokensError && <p className="text-sm text-red-300 mt-2">{tokensError}</p>}
            {tokens && (
              <>
                <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                  <div className="bg-card rounded-[24px] shadow-card p-4">
                    <p className="text-3xl font-bold text-brand-deep">
                      {tokens.current ? `#${tokens.current.number}` : "—"}
                    </p>
                    <p className="text-xs text-muted mt-1">Now serving{tokens.current ? ` — ${tokens.current.name}` : ""}</p>
                  </div>
                  <div className="bg-card rounded-[24px] shadow-card p-4">
                    <p className="text-3xl font-bold text-brand-deep">{tokens.waiting.length}</p>
                    <p className="text-xs text-muted mt-1">Waiting</p>
                  </div>
                  <div className="bg-card rounded-[24px] shadow-card p-4">
                    <p className="text-3xl font-bold text-brand-deep">{tokens.served_count}</p>
                    <p className="text-xs text-muted mt-1">Served today</p>
                  </div>
                </div>
                {tokens.waiting.length > 0 && (
                  <div className="mt-3 bg-card rounded-[24px] shadow-card p-4">
                    <p className="text-xs font-bold text-muted uppercase tracking-wide">Waiting queue</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {tokens.waiting.map((t) => (
                        <li key={t.number} className="flex justify-between gap-2">
                          <span className="font-semibold text-ink">#{t.number} — {t.name}</span>
                          <span className="text-muted text-xs">{t.created_at ? new Date(t.created_at).toLocaleTimeString() : ""}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            <form onSubmit={takeToken} className="mt-5 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="flex-1 bg-card border border-line rounded-full px-4 py-3 text-sm shadow-soft outline-none focus:border-brand"
              />
              <button
                disabled={takeBusy || !name.trim()}
                className="bg-grape hover:bg-grape-dark disabled:opacity-50 text-onlime font-semibold rounded-full px-5 py-3 text-sm shadow-soft shrink-0"
              >
                {takeBusy ? "…" : "Take a token"}
              </button>
            </form>
            {taken && (
              <p className="mt-3 text-sm bg-card rounded-[16px] shadow-soft px-4 py-3">
                Your token is <strong className="text-ink">#{taken.number}</strong> — position {taken.position} in the queue.
              </p>
            )}
            {takeError && <p className="mt-3 text-sm text-red-300">{takeError}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={refreshTokens}
                className="bg-card border border-line hover:border-grape text-sm font-semibold text-ink rounded-full px-4 py-2 shadow-soft"
              >
                Refresh queue
              </button>
              {canCallNext && (
                <button
                  onClick={nextToken}
                  className="bg-brand hover:bg-brand-dark text-onlime text-sm font-semibold rounded-full px-4 py-2 shadow-soft"
                >
                  Call next token
                </button>
              )}
              {user && !canCallNext && (
                <span className="text-xs text-muted">Calling the next token is for staff and admin accounts.</span>
              )}
              {!user && (
                <span className="text-xs text-muted">
                  Staff? <Link href="/chat" className="text-brand-deep font-semibold hover:underline">Sign in</Link> to call the next token.
                </span>
              )}
            </div>
            {nextMsg && <p className="mt-3 text-sm bg-card rounded-[16px] shadow-soft px-4 py-3">{nextMsg}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
