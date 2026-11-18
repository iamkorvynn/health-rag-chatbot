"use client";
// Health RAG Chatbot — Next.js frontend for Sunrise Family Clinic.
// Talks to the FastAPI backend (NEXT_PUBLIC_API_URL).
// No RAG code here: it only sends questions/uploads and shows answers + sources.
//
// UI: Nexcent-style web landing (white + green #4CAF4F) on top, soft
// purple/lavender app screens (chat / patients / upload) below — one product.
//
// Access: the landing (hero, features, stats, how-it-works) is public.
// The app sections (chat, patients, upload, dashboard) are gated behind a
// real login (POST /auth/login, JWT). Admin sees the dashboard + upload;
// doctor/staff see chat + patients only. All counts come from the live
// GET /stats endpoint — no hardcoded numbers.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Chat from "./components/Chat";
import LoginForm from "./components/LoginForm";
import { API_URL, apiGet, PIPELINE, type AdminQuery, type AdminStats, type Patient, type Stats } from "./lib/api";
import { useAuth } from "./lib/auth";

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

// Shown in the hero until the live patient list loads after sign-in
// (GET /patients needs a token). Names verified live via /patients.
const HERO_PATIENTS_FALLBACK = [
  "P1001 — Rahul Mehta",
  "P1002 — Sneha Kulkarni",
  "P1003 — Arjun Nair",
  "P1004 — Meera Joshi",
  "P1005 — Kabir Singh",
  "P1006 — Ananya Rao",
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function Home() {
  const { user, token, ready } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsError, setPatientsError] = useState("");
  const [uploadMsg, setUploadMsg] = useState("");
  const [externalQuestion, setExternalQuestion] = useState<{ q: string; nonce: number } | undefined>(undefined);
  const questionNonce = useRef(0);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [adminQueries, setAdminQueries] = useState<AdminQuery[]>([]);
  const [adminError, setAdminError] = useState("");

  // Live counts for the landing — public GET /stats, computed by the backend.
  useEffect(() => {
    apiGet<Stats>("/stats").then((r) => {
      if (r.ok && r.data) setStats(r.data);
      else setStatsError(true);
    });
  }, []);

  // Patient list — authenticated, loaded once signed in.
  useEffect(() => {
    if (!ready || !user || !token) return;
    apiGet<{ patients: Patient[] }>("/patients", token).then((r) => {
      if (r.ok && r.data) setPatients(r.data.patients || []);
      else setPatientsError(r.detail || `Could not load patients (${r.status || "no connection"}).`);
    });
  }, [ready, user, token]);

  // Admin dashboard — admin only.
  useEffect(() => {
    if (!ready || !user || !token || user.role !== "admin") return;
    apiGet<AdminStats>("/admin/stats", token).then((r) => {
      if (r.ok && r.data) setAdminStats(r.data);
      else setAdminError(r.detail || `Admin stats unavailable (${r.status || "no connection"}).`);
    });
    apiGet<{ queries: AdminQuery[] }>("/admin/queries", token).then((r) => {
      if (r.ok && r.data) setAdminQueries(r.data.queries || []);
    });
  }, [ready, user, token]);

  function askAboutPatient(p: Patient) {
    questionNonce.current += 1;
    setExternalQuestion({ q: `Tell me about ${p.name} (${p.id})`, nonce: questionNonce.current });
    document.getElementById("chat")?.scrollIntoView({ behavior: "smooth" });
  }

  async function upload(files: FileList | null) {
    if (!files || !files.length || !token) return;
    const form = new FormData();
    for (const f of files) form.append("files", f);
    setUploadMsg("Uploading…");
    try {
      const r = await fetch(`${API_URL}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const d = await r.json();
      setUploadMsg(
        r.ok
          ? `Uploaded: ${d.uploaded.join(", ")}${d.embedded ? "" : " — registered, not embedded yet (no API key on backend)."}`
          : `Upload failed: ${d.detail || r.status}`,
      );
      if (r.ok) {
        setPatients(d.patients || patients);
        apiGet<Stats>("/stats").then((s) => {
          if (s.ok && s.data) setStats(s.data);
        });
      }
    } catch {
      setUploadMsg("Could not reach the backend.");
    }
  }

  const isAdmin = user?.role === "admin";

  return (
    <div className="pb-20 md:pb-0">
      {/* ── Hero (Nexcent style) ────────────────────────────────── */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-brand-deep uppercase">Sunrise Family Clinic • Decision support</p>
            <h1 className="mt-4 text-4xl md:text-[3.4rem] leading-[1.08] font-bold text-ink">
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
              <a href="#chat" className="bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg px-6 py-3 shadow-soft">Start asking →</a>
              <a href="#patients" className="border border-line hover:border-brand text-ink font-semibold rounded-lg px-6 py-3 bg-white">See patients</a>
              <Link href="/visit" className="border border-line hover:border-brand text-ink font-semibold rounded-lg px-6 py-3 bg-white">Visit &amp; tokens</Link>
            </div>
            <p className="mt-4 text-sm text-muted">No sign-up. Synthetic demo data — not real patient records.</p>
          </div>

          {/* App preview — soft purple card, big circular stat (live count) */}
          <div className="rounded-[28px] bg-gradient-to-br from-lavender via-lavender-deep to-[#dcd3f5] p-6 md:p-8 shadow-card-lg">
            <div className="flex flex-col items-center">
              <div className="w-44 h-44 md:w-52 md:h-52 rounded-full bg-gradient-to-b from-[#8b7fd4] via-[#5b7fd7] to-[#3d3480] shadow-card-lg flex flex-col items-center justify-center text-white">
                <span className="text-6xl font-bold leading-none">{stats ? stats.documents : "—"}</span>
                <span className="text-sm mt-1 opacity-90">documents indexed</span>
              </div>
              <p className="mt-5 text-sm font-semibold text-ink">Every answer cites its source file</p>
            </div>
            <div className="mt-6 bg-white rounded-3xl shadow-card p-4">
              <p className="text-sm"><span className="font-semibold text-grape">You:</span> What is Rahul Mehta allergic to?</p>
              <p className="text-sm mt-2"><span className="font-semibold text-brand-deep">Assistant:</span> Rahul Mehta is allergic to Penicillin (rash, reported 2014).</p>
              <p className="text-xs text-muted mt-2">Source: Patient_P1001_Rahul_Mehta.pdf (p.1)</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {patients.length === 0
                ? HERO_PATIENTS_FALLBACK.map((t) => (
                    <span key={t} className="bg-white rounded-full px-3 py-1 text-xs font-medium text-ink shadow-soft">{t}</span>
                  ))
                : patients.map((p) => (
                    <span key={p.id} className="bg-white rounded-full px-3 py-1 text-xs font-medium text-ink shadow-soft">{p.id} — {p.name}</span>
                  ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Sources strip ───────────────────────────────────────── */}
      <section className="bg-white border-t border-line">
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
      <section id="features" className="bg-white scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
          <h2 className="text-center text-2xl md:text-3xl font-bold text-ink">Everything the clinic needs,<br />in a single assistant</h2>
          <p className="text-center text-muted mt-2">Built for doctors and clinic staff — decision support, not diagnosis.</p>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <path d="M4 5h16v11H8l-4 4V5z" />,
                title: "Ask from the records",
                body: "Ask any question about a patient, a medicine, or clinic timings. Answers come only from the uploaded documents — never from outside knowledge.",
              },
              {
                icon: <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0v1H5v-1z" />,
                title: "Patient directory",
                body: "Every patient in the records, one tap away. Pick a patient and ask about their conditions, medicines, or allergies.",
              },
              {
                icon: <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />,
                title: "Upload clinic PDFs",
                body: "Add new clinic documents and the assistant indexes them, so new records are searchable right away.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-white border border-line rounded-[24px] shadow-card p-6 text-center hover:shadow-card-lg transition-shadow">
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
            {statsError && <p className="text-sm text-red-700 mt-2">Live counts are unavailable right now — the backend could not be reached.</p>}
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

      {/* ── How it works (blog-style cards) ─────────────────────── */}
      <section id="how" className="bg-white scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
          <h2 className="text-center text-2xl md:text-3xl font-bold text-ink">How it works</h2>
          <p className="text-center text-muted mt-2">Three steps, no setup beyond the clinic&apos;s own PDFs.</p>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[
              { n: "1", title: "Upload the clinic PDFs", body: "Patient files, the information guide, and treatment protocols go into the records — the assistant reads and indexes them." },
              { n: "2", title: "Ask in plain words", body: "Type a question the way you would ask a colleague. No keywords, no codes — just the question." },
              { n: "3", title: "Check the sources", body: "Every answer lists the file and page it came from, so you can verify it against the record before acting on it." },
            ].map((s) => (
              <article key={s.n} className="rounded-[24px] overflow-hidden border border-line shadow-card bg-white">
                <div className="h-28 bg-gradient-to-br from-lavender via-lavender-deep to-[#d5cbf3] flex items-center justify-center">
                  <span className="w-14 h-14 rounded-full bg-white shadow-card flex items-center justify-center text-2xl font-bold text-grape">{s.n}</span>
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

      {/* ── The app (soft purple surfaces) ─────────────────────── */}
      <section className="bg-gradient-to-b from-lavender via-[#efeafc] to-lavender-deep">
        <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <h2 className="text-center text-2xl md:text-3xl font-bold text-ink">The assistant</h2>
          <p className="text-center text-muted mt-2">Ask, browse patients, or add documents — it all runs on the clinic records.</p>

          {/* Login gate */}
          {!ready ? (
            <p className="mt-10 text-center text-muted text-sm">Loading…</p>
          ) : !user ? (
            <div id="login" className="scroll-mt-24 mt-10">
              <h3 className="font-bold text-lg text-ink mb-3">Sign in to use the assistant</h3>
              <LoginForm />
              <p className="text-xs text-muted mt-3">
                The landing, visit info and token queue stay public — sign in for chat, patients and uploads.
                See <Link href="/visit" className="text-brand-deep font-semibold hover:underline">Visit &amp; tokens</Link> without signing in.
              </p>
            </div>
          ) : (
            <>
              {/* Patients */}
              <div id="patients" className="scroll-mt-24 mt-10">
                <h3 className="font-bold text-lg text-ink mb-3">Patients</h3>
                {patientsError && <p className="text-sm text-red-700 bg-white rounded-[16px] shadow-soft px-4 py-3 mb-3">{patientsError}</p>}
                {patients.length === 0 && !patientsError ? (
                  <p className="text-muted bg-white rounded-[24px] shadow-card p-5">No patients loaded yet.</p>
                ) : (
                  <div className="grid sm:grid-cols-3 gap-4">
                    {patients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => askAboutPatient(p)}
                        className="text-left bg-white rounded-[24px] shadow-card hover:shadow-card-lg transition-shadow p-5"
                        title={`Ask about ${p.name}`}
                      >
                        <span className="w-12 h-12 rounded-full bg-gradient-to-br from-[#8b7fd4] to-[#5b7fd7] text-white flex items-center justify-center font-bold">{initials(p.name)}</span>
                        <span className="block mt-3 font-bold text-ink">{p.name}</span>
                        <span className="inline-block mt-1 bg-grape-soft text-grape-dark text-xs font-semibold rounded-full px-2.5 py-1">{p.id}</span>
                        <span className="block mt-2 text-xs text-muted break-all">{p.file}</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted mt-3">Tap a patient card to ask about them.</p>
              </div>

              {/* Chat */}
              <div id="chat" className="scroll-mt-24 mt-10">
                <h3 className="font-bold text-lg text-ink mb-3">Chat</h3>
                <Chat externalQuestion={externalQuestion} />
              </div>

              {/* Upload — admin only */}
              {isAdmin && (
                <div id="upload" className="scroll-mt-24 mt-10">
                  <h3 className="font-bold text-lg text-ink mb-3">Upload clinic PDFs</h3>
                  <label className="block bg-white rounded-[24px] shadow-card border-2 border-dashed border-lilac hover:border-grape transition-colors p-6 text-center cursor-pointer">
                    <span className="mx-auto w-12 h-12 rounded-full bg-grape-soft flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-6 h-6 text-grape" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
                    </span>
                    <span className="block mt-3 font-semibold text-ink text-sm">Choose clinic PDFs to upload</span>
                    <span className="block mt-1 text-xs text-muted">PDF files only — they are indexed into the clinic records.</span>
                    <input type="file" accept=".pdf" multiple onChange={(e) => upload(e.target.files)} className="hidden" />
                  </label>
                  {uploadMsg && <p className="text-sm mt-3 bg-white rounded-[16px] shadow-soft px-4 py-3">{uploadMsg}</p>}
                </div>
              )}
              {user && !isAdmin && (
                <p className="text-xs text-muted mt-10 bg-white rounded-[16px] shadow-soft px-4 py-3">
                  Uploads and the admin dashboard are available to admin accounts only — you are signed in as {user.role}.
                </p>
              )}

              {/* Admin dashboard — admin only */}
              {isAdmin && (
                <div id="dashboard" className="scroll-mt-24 mt-10">
                  <h3 className="font-bold text-lg text-ink mb-3">Admin dashboard</h3>
                  {adminError && <p className="text-sm text-red-700 bg-white rounded-[16px] shadow-soft px-4 py-3 mb-3">{adminError}</p>}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-white rounded-[24px] shadow-card p-4">
                      <p className="text-2xl md:text-3xl font-bold text-brand-deep">{adminStats ? adminStats.documents_indexed : "—"}</p>
                      <p className="text-xs text-muted mt-1">Documents indexed</p>
                    </div>
                    <div className="bg-white rounded-[24px] shadow-card p-4">
                      <p className="text-2xl md:text-3xl font-bold text-brand-deep">{adminStats ? adminStats.questions_asked : "—"}</p>
                      <p className="text-xs text-muted mt-1">Questions asked</p>
                    </div>
                    <div className="bg-white rounded-[24px] shadow-card p-4">
                      <p className="text-2xl md:text-3xl font-bold text-brand-deep">
                        {adminStats ? `${(adminStats.fallback_rate * 100).toFixed(0)}%` : "—"}
                      </p>
                      <p className="text-xs text-muted mt-1">Fallback rate</p>
                    </div>
                  </div>
                  <h4 className="font-bold text-ink mt-6 mb-2">Recent queries</h4>
                  {adminQueries.length === 0 ? (
                    <p className="text-muted bg-white rounded-[24px] shadow-card p-5 text-sm">No queries logged yet.</p>
                  ) : (
                    <div className="bg-white rounded-[24px] shadow-card overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-muted border-b border-line">
                            <th className="px-4 py-3 font-semibold">When</th>
                            <th className="px-4 py-3 font-semibold">User</th>
                            <th className="px-4 py-3 font-semibold">Question</th>
                            <th className="px-4 py-3 font-semibold">Fallback</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminQueries.map((q) => (
                            <tr key={String(q.id)} className="border-b border-line last:border-0 align-top">
                              <td className="px-4 py-3 whitespace-nowrap text-muted">{q.timestamp ? new Date(q.timestamp).toLocaleString() : "—"}</td>
                              <td className="px-4 py-3">{q.username}</td>
                              <td className="px-4 py-3">{q.question}</td>
                              <td className="px-4 py-3">{q.fallback ? "Yes" : "No"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
