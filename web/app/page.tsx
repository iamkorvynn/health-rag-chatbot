"use client";
// Health RAG Chatbot — Next.js frontend for Sunrise Family Clinic.
// Talks to the FastAPI backend (NEXT_PUBLIC_API_URL, default http://localhost:8000).
// No RAG code here: it only sends questions/uploads and shows answers + sources.
import { useEffect, useState } from "react";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

type Source = { file: string; page: number };
type Msg = { q: string; a: string; sources: Source[] };
type Patient = { id: string; name: string; file: string };

export default function Home() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Msg[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [uploadMsg, setUploadMsg] = useState("");

  // Load the patient list + check the backend is reachable.
  useEffect(() => {
    fetch(`${API_URL}/patients`)
      .then((r) => r.json())
      .then((d) => { setPatients(d.patients || []); setBackendOk(true); })
      .catch(() => setBackendOk(false));
  }, []);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setQuestion("");
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await r.json();
      setHistory((h) => [...h, {
        q, a: r.ok ? data.answer : `Backend error (${r.status}): ${data.detail || ""}`,
        sources: r.ok ? data.sources || [] : [],
      }]);
    } catch {
      setHistory((h) => [...h, { q, a: `Could not reach the backend at ${API_URL}. Is it running?`, sources: [] }]);
    }
    setLoading(false);
  }

  async function upload(files: FileList | null) {
    if (!files || !files.length) return;
    const form = new FormData();
    for (const f of files) form.append("files", f);
    setUploadMsg("Uploading…");
    try {
      const r = await fetch(`${API_URL}/upload`, { method: "POST", body: form });
      const d = await r.json();
      setUploadMsg(r.ok ? `Uploaded: ${d.uploaded.join(", ")}${d.embedded ? "" : " — registered, not embedded yet (no API key on backend)."}` : `Upload failed: ${d.detail || r.status}`);
      if (r.ok) setPatients(d.patients || patients);
    } catch {
      setUploadMsg(`Could not reach the backend at ${API_URL}.`);
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold">🏥 Health RAG Chatbot</h1>
      <p className="text-gray-600">Sunrise Family Clinic — answers only from the clinic records.</p>

      {backendOk === false && (
        <div className="mt-4 p-3 bg-red-100 text-red-800 rounded">
          Backend not configured / not reachable at <code>{API_URL}</code>.
          Set <code>NEXT_PUBLIC_API_URL</code> to the backend URL (see README) —
          the chat will work once the backend is up and a Gemini key is set on it.
        </div>
      )}

      <section className="mt-6">
        <h2 className="font-semibold mb-2">Patients</h2>
        {patients.length === 0 ? <p className="text-gray-500">No patients loaded yet.</p> : (
          <ul className="list-disc pl-5">
            {patients.map((p) => <li key={p.id}><b>{p.id}</b> — {p.name}</li>)}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-semibold mb-2">Chat</h2>
        <div className="space-y-4">
          {history.map((m, i) => (
            <div key={i}>
              <p><b>You:</b> {m.q}</p>
              <p className="whitespace-pre-line"><b>Bot:</b> {m.a}</p>
              {m.sources.length > 0 && (
                <p className="text-sm text-gray-500">Sources: {m.sources.map((s) => `${s.file} (p.${s.page})`).join(", ")}</p>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={ask} className="mt-3 flex gap-2">
          <input value={question} onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about a patient, medicine, or the clinic…"
            className="flex-1 border rounded px-3 py-2" />
          <button disabled={loading} className="bg-cyan-700 text-white rounded px-4 py-2">
            {loading ? "…" : "Ask"}
          </button>
        </form>
        <p className="text-sm text-gray-500 mt-2">Try: “What is Rahul Mehta allergic to?” or “List all my patients”.</p>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold mb-2">Upload clinic PDFs</h2>
        <input type="file" accept=".pdf" multiple onChange={(e) => upload(e.target.files)} />
        {uploadMsg && <p className="text-sm mt-1">{uploadMsg}</p>}
      </section>

      <footer className="mt-8 text-sm text-gray-500">
        Decision-support only, not a replacement for a doctor. Synthetic demo data.
      </footer>
    </main>
  );
}
