"use client";
// Chat: asks POST /ask with the logged-in token + chosen language,
// persists history in localStorage, exports a REAL PDF of the actual
// history (jspdf), voice input via the Web Speech API, and source
// highlighting — the matching excerpt with the question's key words
// highlighted, plus the file (p.N) chips and the retrieval score.
import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import {
  API_URL,
  LANGUAGES,
  apiPost,
  loadChatHistory,
  questionKeywords,
  saveChatHistory,
  type ChatMsg,
  type Language,
  type Source,
} from "../lib/api";
import { useAuth } from "../lib/auth";

const SUGGESTIONS = [
  "What is Rahul Mehta allergic to?",
  "List all my patients",
  "What are the clinic timings on Saturday?",
  "What medicine is Sneha Kulkarni taking?",
  "What are Arjun Nair's conditions?",
];

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: { transcript: string }[][] }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition as (new () => SpeechRecognitionLike) | undefined) ||
    (w.webkitSpeechRecognition as (new () => SpeechRecognitionLike) | undefined) ||
    null;
}

/** Render text with the question's key words highlighted. */
function HighlightedText({ text, keywords }: { text: string; keywords: string[] }) {
  if (!keywords.length) return <>{text}</>;
  const pattern = new RegExp(`(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        keywords.some((k) => k.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="bg-yellow-200 text-ink rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function exportChatPdf(history: ChatMsg[]) {
  const doc = new jsPDF();
  const margin = 14;
  const width = 210 - margin * 2;
  let y = 18;
  doc.setFontSize(16);
  doc.text("Sunrise Family Clinic — Chat history", margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(107, 103, 128);
  doc.text(`Exported ${new Date().toLocaleString()} — decision-support only, synthetic demo data.`, margin, y);
  y += 10;
  doc.setTextColor(35, 32, 58);
  for (const m of history) {
    const stamp = new Date(m.ts).toLocaleString();
    const qLines = doc.splitTextToSize(`You (${stamp}): ${m.q}`, width);
    const aLines = doc.splitTextToSize(`Assistant: ${m.a}`, width);
    const srcLines = m.sources.length
      ? doc.splitTextToSize(`Sources: ${m.sources.map((s) => `${s.file} (p.${s.page})`).join("; ")}`, width)
      : [];
    const needed = (qLines.length + aLines.length + srcLines.length) * 5 + 8;
    if (y + needed > 280) {
      doc.addPage();
      y = 18;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(qLines, margin, y);
    y += qLines.length * 5 + 2;
    doc.setFont("helvetica", "normal");
    doc.text(aLines, margin, y);
    y += aLines.length * 5 + 2;
    if (srcLines.length) {
      doc.setFontSize(9);
      doc.setTextColor(107, 103, 128);
      doc.text(srcLines, margin, y);
      y += srcLines.length * 5;
      doc.setTextColor(35, 32, 58);
      doc.setFontSize(11);
    }
    y += 6;
  }
  doc.save("sunrise-clinic-chat.pdf");
}

export default function Chat({ externalQuestion }: { externalQuestion?: { q: string; nonce: number } }) {
  const { token, user } = useAuth();
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [language, setLanguage] = useState<Language>("en");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);
  const historyRef = useRef(history);
  historyRef.current = history;

  useEffect(() => {
    // Intentional post-hydration sync: chat history lives in localStorage,
    // which does not exist during the static prerender.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(loadChatHistory());
    setVoiceSupported(getSpeechRecognition() !== null);
  }, []);

  useEffect(() => {
    saveChatHistory(history);
  }, [history]);

  useEffect(() => () => recogRef.current?.stop(), []);

  // A patient card tap (or any other section) can ask a question in this chat.
  const askedNonce = useRef(0);
  useEffect(() => {
    if (externalQuestion && externalQuestion.nonce !== askedNonce.current) {
      askedNonce.current = externalQuestion.nonce;
      askQuestion(externalQuestion.q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuestion]);

  async function askQuestion(q: string) {
    const query = q.trim();
    if (!query || loading || !token) return;
    setLoading(true);
    try {
      const r = await apiPost<{ answer: string; sources: Source[]; fallback?: boolean; language?: string }>(
        "/ask",
        { question: query, language },
        token,
      );
      const msg: ChatMsg = {
        q: query,
        a: r.ok && r.data
          ? r.data.answer
          : `Backend error (${r.status || "no connection"}): ${r.detail || ""}`,
        sources: r.ok && r.data ? r.data.sources || [] : [],
        language,
        ts: Date.now(),
      };
      setHistory((h) => [...h, msg]);
    } catch {
      setHistory((h) => [
        ...h,
        { q: query, a: `Could not reach the backend at ${API_URL}. Is it running?`, sources: [], language, ts: Date.now() },
      ]);
    }
    setLoading(false);
  }

  function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    setQuestion("");
    askQuestion(q);
  }

  function toggleVoice() {
    if (listening) {
      recogRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setVoiceError("Voice input is not supported in this browser — try Chrome.");
      return;
    }
    setVoiceError("");
    const recog = new Ctor();
    recogRef.current = recog;
    recog.lang = LANGUAGES.find((l) => l.code === language)?.speechLang || "en-IN";
    recog.interimResults = false;
    recog.continuous = false;
    recog.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript;
      if (transcript) setQuestion((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recog.onerror = (e) => {
      setListening(false);
      setVoiceError(e.error === "not-allowed" ? "Microphone access was denied." : `Voice input error: ${e.error}.`);
    };
    recog.onend = () => setListening(false);
    try {
      recog.start();
      setListening(true);
    } catch {
      setVoiceError("Could not start voice input.");
    }
  }

  function clearHistory() {
    setHistory([]);
    saveChatHistory([]);
  }

  return (
    <div className="bg-white/70 rounded-[28px] shadow-card p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-sm text-muted">
          Signed in as <strong className="text-ink">{user?.username}</strong> ({user?.role})
        </span>
        <span className="ml-auto flex items-center gap-2">
          <label htmlFor="chat-lang" className="text-xs text-muted font-semibold">Answer in</label>
          <select
            id="chat-lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="bg-white border border-line rounded-full px-3 py-1.5 text-sm shadow-soft outline-none focus:border-brand"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          {history.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => exportChatPdf(history)}
                className="bg-white border border-line hover:border-grape text-xs font-semibold text-ink rounded-full px-3 py-1.5 shadow-soft"
              >
                Export PDF
              </button>
              <button
                type="button"
                onClick={clearHistory}
                className="bg-white border border-line hover:border-red-400 text-xs font-semibold text-ink rounded-full px-3 py-1.5 shadow-soft"
              >
                Clear history
              </button>
            </>
          )}
        </span>
      </div>

      <div className="space-y-4 min-h-[120px]">
        {history.length === 0 && (
          <p className="text-muted text-sm bg-white rounded-[20px] shadow-soft p-4">
            Ask the assistant anything about the clinic records — for example, a patient&apos;s allergy or the Saturday timings.
            Your chat history is saved on this device.
          </p>
        )}
        {history.map((m, i) => {
          const keywords = questionKeywords(m.q);
          return (
            <div key={i} className="space-y-2">
              <div className="flex justify-end">
                <p className="bg-brand-soft text-ink rounded-[20px] rounded-br-md px-4 py-2.5 text-sm max-w-[85%] shadow-soft">{m.q}</p>
              </div>
              <div className="flex justify-start">
                <div className="bg-white rounded-[20px] rounded-bl-md px-4 py-3 text-sm max-w-[92%] shadow-card">
                  <p className="whitespace-pre-line text-ink">{m.a}</p>
                  {m.sources.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-muted flex flex-wrap gap-1.5">
                        {m.sources.map((s, j) => (
                          <span key={j} className="bg-lavender border border-line rounded-full px-2 py-0.5">
                            {s.file} (p.{s.page}){typeof s.score === "number" ? ` · ${(s.score * 100).toFixed(0)}% match` : ""}
                          </span>
                        ))}
                      </p>
                      {m.sources.filter((s) => s.text).map((s, j) => (
                        <blockquote key={j} className="border-l-4 border-lilac bg-lavender rounded-r-xl px-3 py-2 text-[13px] leading-relaxed text-ink/90">
                          <HighlightedText text={s.text as string} keywords={keywords} />
                          <span className="block text-xs text-muted mt-1">— {s.file} (p.{s.page})</span>
                        </blockquote>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex justify-start">
            <p className="bg-white rounded-[20px] rounded-bl-md px-4 py-3 text-sm shadow-card text-muted">Thinking…</p>
          </div>
        )}
      </div>

      <form onSubmit={ask} className="mt-4 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about a patient, medicine, or the clinic…"
          className="flex-1 bg-white border border-line rounded-full px-4 py-3 text-sm shadow-soft outline-none focus:border-brand"
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            title={listening ? "Stop listening" : "Speak your question"}
            className={`rounded-full px-4 py-3 text-sm shadow-soft shrink-0 font-semibold ${
              listening ? "bg-red-500 text-white" : "bg-white border border-line hover:border-grape text-ink"
            }`}
          >
            {listening ? "● Listening…" : "🎙 Mic"}
          </button>
        )}
        <button disabled={loading} className="bg-grape hover:bg-grape-dark disabled:opacity-50 text-white font-semibold rounded-full px-5 py-3 text-sm shadow-soft shrink-0">
          {loading ? "…" : "Ask"}
        </button>
      </form>
      {voiceError && <p className="text-xs text-red-700 mt-2">{voiceError}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => askQuestion(s)} className="bg-white border border-line hover:border-grape text-xs text-ink rounded-full px-3 py-1.5 shadow-soft">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
