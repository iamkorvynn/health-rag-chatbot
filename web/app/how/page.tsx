import type { Metadata } from "next";
import Link from "next/link";
import { PIPELINE } from "../lib/api";

export const metadata: Metadata = {
  title: "How it works — Health RAG Chatbot",
  description: "The retrieval pipeline behind the Sunrise Family Clinic assistant: PDFs, chunks, embeddings, ChromaDB, Gemini.",
};

// Real pipeline diagram — values are the backend's actual config
// (chunk size / overlap, embedding model, collection, retriever k, LLM).
const STAGES = [
  {
    step: "1",
    title: "Clinic PDFs",
    body: "Patient files, the information guide and treatment protocols — the only knowledge the assistant has.",
    detail: "5 seed documents in the clinic records",
  },
  {
    step: "2",
    title: "Chunks",
    body: "Each PDF is split into overlapping text chunks so a single fact stays searchable on its own.",
    detail: `Chunk ${PIPELINE.chunkSize} chars · overlap ${PIPELINE.chunkOverlap}`,
  },
  {
    step: "3",
    title: "Embeddings",
    body: "Every chunk is turned into a vector by the embedding model, so meaning — not just keywords — can be matched.",
    detail: PIPELINE.embeddingModel,
  },
  {
    step: "4",
    title: "Vector store",
    body: "Vectors live in ChromaDB. A question is embedded the same way and the closest chunks are retrieved.",
    detail: `${PIPELINE.vectorStore} · collection "${PIPELINE.collection}" · top k=${PIPELINE.retrieverK}`,
  },
  {
    step: "5",
    title: "Gemini answers",
    body: "The retrieved chunks — and only those chunks — are handed to the language model, which writes the answer from them.",
    detail: `${PIPELINE.llm} · temperature ${PIPELINE.temperature}`,
  },
  {
    step: "6",
    title: "Answer + sources",
    body: "You get the answer with the file and page it came from, so you can verify it against the record. If nothing in the records answers the question, it says so instead of guessing.",
    detail: "Fallback: polite 'not in the records' reply",
  },
];

export default function HowPage() {
  return (
    <div className="pb-20 md:pb-0">
      <section>
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
          <p className="text-xs font-bold tracking-[0.18em] text-brand-deep uppercase">Sunrise Family Clinic • How it works</p>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold text-ink">
            From clinic PDFs to a <span className="text-brand">sourced answer</span>
          </h1>
          <p className="mt-4 text-muted text-lg leading-relaxed max-w-2xl">
            Retrieval-augmented generation: the assistant never answers from general knowledge.
            It retrieves the relevant passages from the clinic&apos;s own documents first, then
            writes the answer from those passages alone.
          </p>

          {/* Pipeline diagram */}
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {STAGES.map((s, i) => (
              <article key={s.step} className="relative rounded-[24px] overflow-hidden border border-line shadow-card bg-card">
                <div className="h-24 bg-gradient-to-br from-lavender via-lavender-deep to-[#0d1f14] flex items-center justify-between px-5">
                  <span className="w-12 h-12 rounded-full bg-card shadow-card flex items-center justify-center text-xl font-bold text-grape">{s.step}</span>
                  {i < STAGES.length - 1 && (
                    <span className="hidden md:block text-grape text-2xl font-bold" aria-hidden>→</span>
                  )}
                </div>
                <div className="p-5">
                  <h2 className="font-bold text-ink text-lg">{s.title}</h2>
                  <p className="text-sm text-muted mt-2 leading-relaxed">{s.body}</p>
                  <p className="mt-3 inline-block bg-grape-soft text-grape-dark text-xs font-semibold rounded-full px-3 py-1">{s.detail}</p>
                </div>
              </article>
            ))}
          </div>

          {/* Config table */}
          <div className="mt-12 bg-lavender rounded-[24px] shadow-card p-6">
            <h2 className="font-bold text-ink text-lg">Live configuration</h2>
            <p className="text-sm text-muted mt-1">The exact settings the backend runs with — shown here, not buried in code.</p>
            <dl className="mt-4 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-line pb-2"><dt className="text-muted">Chunk size</dt><dd className="font-semibold text-ink">{PIPELINE.chunkSize} characters</dd></div>
              <div className="flex justify-between gap-4 border-b border-line pb-2"><dt className="text-muted">Chunk overlap</dt><dd className="font-semibold text-ink">{PIPELINE.chunkOverlap} characters</dd></div>
              <div className="flex justify-between gap-4 border-b border-line pb-2"><dt className="text-muted">Embedding model</dt><dd className="font-semibold text-ink">{PIPELINE.embeddingModel}</dd></div>
              <div className="flex justify-between gap-4 border-b border-line pb-2"><dt className="text-muted">Vector store</dt><dd className="font-semibold text-ink">{PIPELINE.vectorStore} — &ldquo;{PIPELINE.collection}&rdquo;</dd></div>
              <div className="flex justify-between gap-4 border-b border-line pb-2"><dt className="text-muted">Retrieved per question</dt><dd className="font-semibold text-ink">Top {PIPELINE.retrieverK} chunks</dd></div>
              <div className="flex justify-between gap-4 border-b border-line pb-2"><dt className="text-muted">Answer model</dt><dd className="font-semibold text-ink">{PIPELINE.llm}, temperature {PIPELINE.temperature}</dd></div>
            </dl>
          </div>

          <p className="mt-8 text-center">
            <Link href="/chat" className="bg-brand hover:bg-brand-dark text-onlime font-semibold rounded-lg px-6 py-3 shadow-soft inline-block">Try it — ask the assistant →</Link>
            <Link href="/tests" className="ml-3 border border-line hover:border-brand text-ink font-semibold rounded-lg px-6 py-3 bg-card inline-block">See the live test questions</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
