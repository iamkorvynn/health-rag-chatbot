import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./lib/auth";
import SiteHeader from "./components/SiteHeader";
import MobileNav from "./components/MobileNav";
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

export const viewport: Viewport = { themeColor: "#070b08" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Disclaimer banner shown on every view */}
        <div className="bg-[#141b06] text-lime-200 border-b border-lime-400/20 text-center text-sm px-3 py-2">
          <span className="font-semibold">Decision-support only</span> — not a
          replacement for a doctor. Synthetic demo data, not real patient records.
        </div>
        <AuthProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          {/* ── Mobile bottom nav (app reference) ─────────────────── */}
          <MobileNav />
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
