"use client";
// /tests — live test-question page.
// Fetches GET /test-questions, runs each question LIVE against POST /ask
// with the logged-in token, and computes pass/fail at runtime by checking
// whether the answer contains the expected phrase. Results are never
// hardcoded — re-run any time and they are recomputed from live answers.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, type TestQuestion } from "../lib/api";
import { useAuth } from "../lib/auth";

type Result = {
  status: "pending" | "running" | "pass" | "fail" | "error";
  answer?: string;
  detail?: string;
};

export default function TestsPage() {
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [loadError, setLoadError] = useState("");
  const [results, setResults] = useState<Record<string, Result>>({});
  const [runningAll, setRunningAll] = useState(false);

  // Login required — send unauthenticated visitors to the sign-in page.
  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  useEffect(() => {
    apiGet<{ questions: TestQuestion[] }>("/test-questions").then((r) => {
      if (r.ok && r.data) setQuestions(r.data.questions || []);
      else setLoadError(r.detail || `Could not load test questions (${r.status || "no connection"}).`);
    });
  }, []);

  async function runOne(q: TestQuestion) {
    if (!token) return;
    setResults((prev) => ({ ...prev, [String(q.id)]: { status: "running" } }));
    const r = await apiPost<{ answer: string }>("/ask", { question: q.question, language: "en" }, token);
    if (!r.ok || !r.data) {
      setResults((prev) => ({ ...prev, [String(q.id)]: { status: "error", detail: r.detail || `Backend error (${r.status}).` } }));
      return;
    }
    const answer = r.data.answer || "";
    const pass = answer.toLowerCase().includes(q.expected.toLowerCase());
    setResults((prev) => ({ ...prev, [String(q.id)]: { status: pass ? "pass" : "fail", answer } }));
  }

  async function runAll() {
    if (!token || runningAll) return;
    setRunningAll(true);
    for (const q of questions) {
      // Sequential — one live call at a time, same as a person asking.
      await runOne(q);
    }
    setRunningAll(false);
  }

  const done = Object.values(results).filter((r) => r.status === "pass" || r.status === "fail").length;
  const passed = Object.values(results).filter((r) => r.status === "pass").length;

  return (
    <div className="pb-20 md:pb-0">
      <section>
        <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <p className="text-xs font-bold tracking-[0.18em] text-brand-deep uppercase">Sunrise Family Clinic • Live tests</p>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold text-ink">Test questions</h1>
          <p className="mt-4 text-muted leading-relaxed">
            A fixed set of questions the assistant should answer from the clinic records.
            Each one is run <strong className="text-ink">live</strong> against the backend and marked
            pass or fail by checking whether the live answer contains the expected phrase —
            nothing here is pre-recorded.
          </p>

          {loadError && (
            <p className="mt-6 text-sm text-red-300 bg-red-950/60 rounded-[16px] px-4 py-3">{loadError}</p>
          )}

          {!ready || !user ? (
            <p className="mt-6 text-muted text-sm">Loading…</p>
          ) : (
            <>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  onClick={runAll}
                  disabled={runningAll || questions.length === 0}
                  className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-onlime font-semibold rounded-lg px-6 py-3 shadow-soft"
                >
                  {runningAll ? "Running…" : "Run all live"}
                </button>
                {done > 0 && (
                  <span className="text-sm font-semibold text-ink bg-brand-soft rounded-full px-4 py-2">
                    {passed} / {done} passed
                  </span>
                )}
                <span className="text-sm text-muted">Signed in as {user.username} ({user.role})</span>
              </div>

              <div className="mt-6 space-y-4">
                {questions.map((q) => {
                  const res = results[String(q.id)] || { status: "pending" as const };
                  return (
                    <article key={String(q.id)} className="bg-card border border-line rounded-[24px] shadow-card p-5">
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-ink">{q.question}</p>
                          <p className="text-sm text-muted mt-1">
                            Expected phrase: <code className="bg-lavender rounded px-1.5 py-0.5 text-ink">{q.expected}</code>
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-xs font-bold rounded-full px-3 py-1.5 ${
                            res.status === "pass"
                              ? "bg-green-100 text-green-800"
                              : res.status === "fail"
                                ? "bg-red-100 text-red-800"
                                : res.status === "running"
                                  ? "bg-amber-400/15 text-amber-200"
                                  : res.status === "error"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-lavender text-muted"
                          }`}
                        >
                          {res.status === "pending" ? "Not run" : res.status === "running" ? "Running…" : res.status === "pass" ? "✓ Pass" : res.status === "fail" ? "✗ Fail" : "Error"}
                        </span>
                        <button
                          onClick={() => runOne(q)}
                          disabled={res.status === "running" || runningAll}
                          className="shrink-0 bg-grape hover:bg-grape-dark disabled:opacity-50 text-onlime text-sm font-semibold rounded-full px-4 py-2 shadow-soft"
                        >
                          Run
                        </button>
                      </div>
                      {res.answer && (
                        <p className="mt-3 text-sm text-ink bg-lavender rounded-xl px-4 py-3 whitespace-pre-line">{res.answer}</p>
                      )}
                      {res.status === "fail" && (
                        <p className="mt-2 text-sm text-red-300">The live answer did not contain the expected phrase “{q.expected}”.</p>
                      )}
                      {res.status === "error" && <p className="mt-2 text-sm text-red-300">{res.detail}</p>}
                    </article>
                  );
                })}
                {questions.length === 0 && !loadError && (
                  <p className="text-muted bg-card rounded-[24px] shadow-card p-5 text-sm">No test questions returned by the backend yet.</p>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
