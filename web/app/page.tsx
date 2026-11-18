"use client";
// Health RAG Chatbot — landing page for Sunrise Family Clinic.
// Nexcent-style (white + green #4CAF4F): hero, sources, features, stats,
// how-it-works. The app itself lives on real routes: /chat, /patients,
// /upload, /dashboard, /settings. All counts come from the live GET /stats
// endpoint — no hardcoded numbers.
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, PIPELINE, type Stats } from "./lib/api";

// The documents in the clinic records (verified live: GET /stats = 8).
const DOCUMENTS = [
  "Patient_P1001_Rahul_Mehta.pdf",
  "Patient_P1002_Sneha_Kulkarni.pdf",
  "Patient_P1003_Arjun_Nair.pdf",
  "Patient_P1004_Meera_Joshi.pdf",
  "Patient_P1005_Kabir_Singh.pdf",
  "Patient_P1006_Ananya_Rao.pdf",
  "Clinic_Patient_Information_Guide.pdf",
  "Doctor_Treatment_Protocols.pdf",
];

// Patient chips in the hero (verified live via /patients).
const HERO_PATIENTS = [
  "P1001 — Rahul Mehta",
  "P1002 — Sneha Kulkarni",
  "P1003 — Arjun Nair",
  "P1004 — Meera Joshi",
  "P1005 — Kabir Singh",
  "P1006 — Ananya Rao",
];

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState(false);

  // Live counts for the landing — public GET /stats, computed by the backend.
  useEffect(() => {
    apiGet<Stats>("/stats").then((r) => {
      if (r.ok && r.data) setStats(r.data);
      else setStatsError(true);
    });
  }, []);

  return (
    <div className="pb-20 md:pb-0">
      {/* ── Hero (Nexcent style) ────────────────────────────────── */}
      <section>
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-xs font-semibold text-lime-200">
              <span className="w-2 h-2 rounded-full bg-lime-400" />
              Answers only from clinic records
            </span>
            <h1 className="mt-5 text-4xl md:text-[3.4rem] leading-[1.08] font-bold text-ink">
              Answers from your<br />
              <span className="text-brand">clinic records</span>,<br />
              in seconds.
            </h1>
            <p className="mt-5 text-muted text-lg leading-relaxed">
              Ask about a patient, a medicine, or the clinic — the assistant
              answers only from the clinic&apos;s own documents, and shows you
              exactly where each answer came from.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/signup" className="bg-brand hover:bg-brand-dark text-onlime font-semibold rounded-full px-6 py-3 shadow-soft">Get started →</Link>
              <Link href="/patients" className="border border-line hover:border-brand text-ink font-semibold rounded-full px-6 py-3 bg-card">See patients</Link>
            </div>
            <p className="mt-4 text-sm text-muted">Sign in or create a staff account to start. Synthetic demo data — not real patient records.</p>
          </div>

          {/* App preview — soft purple card, big circular stat (live count) */}
          <div className="rounded-[28px] bg-gradient-to-br from-lavender via-lavender-deep to-[#0d1f14] p-6 md:p-8 shadow-card-lg">
            <div className="flex flex-col items-center">
              <div className="w-44 h-44 md:w-52 md:h-52 rounded-full bg-gradient-to-b from-[#34d399] via-[#059669] to-[#064e3b] shadow-card-lg flex flex-col items-center justify-center text-white">
                <span className="text-6xl font-bold leading-none">{stats ? stats.documents : "—"}</span>
                <span className="text-sm mt-1 opacity-90">documents indexed</span>
              </div>
              <p className="mt-5 text-sm font-semibold text-ink">Every answer cites its source file</p>
            </div>
            <div className="mt-6 bg-card rounded-3xl shadow-card p-4">
              <p className="text-sm"><span className="font-semibold text-grape">You:</span> What is Rahul Mehta allergic to?</p>
              <p className="text-sm mt-2"><span className="font-semibold text-brand-deep">Assistant:</span> Rahul Mehta is allergic to Penicillin (rash, reported 2014).</p>
              <p className="text-xs text-muted mt-2">Source: Patient_P1001_Rahul_Mehta.pdf (p.1)</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {HERO_PATIENTS.map((t) => (
                <span key={t} className="bg-card rounded-full px-3 py-1 text-xs font-medium text-ink shadow-soft">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Sources strip ───────────────────────────────────────── */}
      <section className="border-t border-line">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h2 className="text-center text-xl font-bold text-ink">It answers only from these documents</h2>
          <p className="text-center text-sm text-muted mt-1">Nothing from outside knowledge — if it&apos;s not in the records, it says so.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {DOCUMENTS.map((f) => (
              <span key={f} className="flex items-center gap-2 bg-lavender border border-line rounded-full px-4 py-2 text-sm font-medium text-ink shadow-soft">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-grape shrink-0" fill="currentColor"><path d="M6 2h9l5 5v15H6V2zm8 1.5V8h4.5L14 3.5zM8 12h8v1.5H8V12zm0 4h8v1.5H8V16z" /></svg>
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features (Nexcent 3-card style) ─────────────────────── */}
      <section id="features" className="scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
          <h2 className="text-center text-2xl md:text-3xl font-bold text-ink">Built for a clinic, not a demo</h2>
          <p className="text-center text-muted mt-2">Answers you can trust, access you can control, and a record of everything asked.</p>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <path d="M12 3l7 3v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" />,
                title: "Answers only from records",
                body: "Every answer comes from the clinic's own documents — never from outside knowledge. If it isn't in the records, the assistant says so.",
              },
              {
                icon: <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0v1H5v-1z" />,
                title: "Role-based login",
                body: "Doctors, staff and admins sign in with their own accounts. Admins see the dashboard and uploads; everyone else sees chat and patients.",
              },
              {
                icon: <path d="M5 4h14v16H5zM9 9h6M9 13h6" />,
                title: "Audit log",
                body: "Every question is logged with who asked it and whether the assistant had to fall back — the admin dashboard shows the counts live.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-card border border-line rounded-[24px] shadow-card p-6 text-center hover:shadow-card-lg transition-shadow">
                <span className="mx-auto w-14 h-14 rounded-2xl bg-brand-soft flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 text-brand-deep" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">{f.icon}</svg>
                </span>
                <h3 className="mt-4 text-lg font-bold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats band (live GET /stats — no hardcoded numbers) ── */}
      <section className="bg-brand-pale">
        <div className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-6 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-ink">Small records,<br /><span className="text-brand">straight answers.</span></h2>
            <p className="text-muted mt-2 text-sm">Counts from the clinic records as indexed — no invented numbers.</p>
            {statsError && <p className="text-sm text-red-300 mt-2">Live counts are unavailable right now — the backend could not be reached.</p>}
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl md:text-4xl font-bold text-brand-deep">{stats ? stats.patients : "—"}</p>
              <p className="text-sm text-muted mt-1">Patients</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-brand-deep">{stats ? stats.documents : "—"}</p>
              <p className="text-sm text-muted mt-1">Documents</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-brand-deep">{PIPELINE.retrieverK}</p>
              <p className="text-sm text-muted mt-1">Sources checked per answer</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Phone mockup (reference: login screen on mobile) ────── */}
      <section>
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
          <div className="rounded-[32px] border border-line bg-gradient-to-br from-[#0d2818] via-[#0a140d] to-[#070b08] shadow-card-lg p-8 md:p-12 grid md:grid-cols-2 gap-10 items-center overflow-hidden">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-brand-deep uppercase">On your phone too</p>
              <h2 className="mt-4 text-3xl md:text-4xl font-bold text-ink leading-tight">More than just<br />a question box</h2>
              <p className="mt-4 text-muted leading-relaxed">
                The same assistant, installed from your browser — sign in once and
                ask from the ward, the desk, or on the go. It stays a decision-support
                tool: every answer still cites its source file.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/signup" className="bg-brand hover:bg-brand-dark text-onlime font-semibold rounded-full px-6 py-3 shadow-soft">Get started →</Link>
                <Link href="/how" className="border border-line hover:border-brand text-ink font-semibold rounded-full px-6 py-3">See how it works</Link>
              </div>
            </div>
            <div className="relative flex justify-center py-4">
              <div className="absolute w-72 h-72 rounded-full bg-emerald-500/20 blur-3xl" />
              <div className="relative w-60 rounded-[2.5rem] border border-lime-400/20 bg-[#0b120c] p-3 shadow-card-lg">
                <div className="rounded-[2rem] bg-gradient-to-b from-[#0d2818] to-[#070b08] px-5 py-8">
                  <span className="mx-auto w-11 h-11 rounded-2xl bg-brand flex items-center justify-center shadow-soft">
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#0b120c" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </span>
                  <p className="mt-4 font-bold text-ink text-center">Ask the assistant</p>
                  <p className="text-xs text-muted mt-1 text-center">Answers only from clinic records</p>
                  <div className="mt-5 space-y-2">
                    <div className="rounded-2xl bg-card px-4 py-2.5 text-xs text-ink shadow-soft">What is Rahul Mehta allergic to?</div>
                    <div className="rounded-2xl bg-lavender px-4 py-2.5 text-xs text-ink shadow-soft">Penicillin (rash, reported 2014).</div>
                    <p className="text-[11px] text-muted">Source: Patient_P1001_Rahul_Mehta.pdf (p.1)</p>
                  </div>
                  <div className="mt-4 rounded-full bg-brand py-2.5 text-sm font-bold text-onlime text-center">Ask a question →</div>
                </div>
              </div>
              <span className="absolute left-2 top-10 bg-card border border-line rounded-full px-3 py-1.5 text-xs font-semibold text-ink shadow-soft">P1001 — Rahul Mehta</span>
              <span className="absolute right-0 bottom-12 bg-card border border-line rounded-full px-3 py-1.5 text-xs font-semibold text-ink shadow-soft">Penicillin allergy</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works (blog-style cards) ─────────────────────── */}
      <section id="how" className="scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
          <h2 className="text-center text-2xl md:text-3xl font-bold text-ink">How it works</h2>
          <p className="text-center text-muted mt-2">Three steps, no setup beyond the clinic&apos;s own PDFs.</p>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[
              { n: "1", title: "Upload the clinic PDFs", body: "Patient files, the information guide, and treatment protocols go into the records — the assistant reads and indexes them." },
              { n: "2", title: "Ask in plain words", body: "Type a question the way you would ask a colleague. No keywords, no codes — just the question." },
              { n: "3", title: "Check the sources", body: "Every answer lists the file and page it came from, so you can verify it against the record before acting on it." },
            ].map((s) => (
              <article key={s.n} className="rounded-[24px] overflow-hidden border border-line shadow-card bg-card">
                <div className="h-28 bg-gradient-to-br from-lavender via-lavender-deep to-[#0d1f14] flex items-center justify-center">
                  <span className="w-14 h-14 rounded-full bg-card shadow-card flex items-center justify-center text-2xl font-bold text-grape">{s.n}</span>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-ink">{s.title}</h3>
                  <p className="text-sm text-muted mt-2 leading-relaxed">{s.body}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="text-center mt-8">
            <Link href="/how" className="text-brand-deep font-semibold text-sm hover:underline">See the full pipeline — chunks, embeddings, retrieval →</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
