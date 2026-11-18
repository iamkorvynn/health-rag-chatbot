import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./lib/auth";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Health RAG Chatbot — Sunrise Family Clinic",
  description:
    "Decision-support chatbot for doctors at Sunrise Family Clinic. Answers only from the clinic records (synthetic demo data).",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "Health RAG" },
};

export const viewport: Viewport = { themeColor: "#4caf4f" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Disclaimer banner shown on every view */}
        <div className="bg-amber-100 text-amber-900 text-center text-sm px-3 py-2">
          <span className="font-semibold">Decision-support only</span> — not a
          replacement for a doctor. Synthetic demo data, not real patient records.
        </div>
        <AuthProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          {/* ── Mobile bottom nav (app reference) ─────────────────── */}
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-line">
            <div className="grid grid-cols-3 text-center text-xs font-semibold">
              <Link href="/#chat" className="py-3 text-grape flex flex-col items-center gap-1">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M4 5h16v11H8l-4 4V5z" /></svg>
                Chat
              </Link>
              <Link href="/#patients" className="py-3 text-ink/70 flex flex-col items-center gap-1">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0v1H5v-1z" /></svg>
                Patients
              </Link>
              <Link href="/visit" className="py-3 text-ink/70 flex flex-col items-center gap-1">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                Visit
              </Link>
            </div>
          </nav>
        </AuthProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `if ("serviceWorker" in navigator) { window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(()=>{})); }`,
          }}
        />
      </body>
    </html>
  );
}
