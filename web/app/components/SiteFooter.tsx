// Shared footer (Nexcent dark) — on every page via layout.tsx.
import Link from "next/link";
export default function SiteFooter() {
  return (
    <footer className="bg-[#05080a] text-white">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row md:items-start gap-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#0b120c" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </span>
              <span className="font-bold">Sunrise Family Clinic</span>
            </div>
            <p className="text-sm text-white/70 mt-3 max-w-xs">
              Decision-support only, not a replacement for a doctor.
              Synthetic demo data — not real patient records.
            </p>
          </div>
          <nav className="md:ml-auto flex gap-10 text-sm">
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-white/90">Product</span>
              <Link href="/#features" className="text-white/70 hover:text-white">Features</Link>
              <Link href="/how" className="text-white/70 hover:text-white">How it works</Link>
              <Link href="/tests" className="text-white/70 hover:text-white">Test questions</Link>
              <Link href="/visit" className="text-white/70 hover:text-white">Visit &amp; tokens</Link>
              <Link href="/chat" className="text-white/70 hover:text-white">Chat</Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-white/90">Records</span>
              <Link href="/patients" className="text-white/70 hover:text-white">Patients</Link>
              <Link href="/upload" className="text-white/70 hover:text-white">Upload PDFs</Link>
            </div>
          </nav>
        </div>
        <p className="text-xs text-white/50 mt-8 pt-6 border-t border-white/10">
          Health RAG Chatbot — college project, SJCEM (B.Tech AI &amp; ML). Answers only from the clinic records.
        </p>
      </div>
    </footer>
  );
}
