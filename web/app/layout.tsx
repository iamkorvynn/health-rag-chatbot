import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Health RAG Chatbot — Sunrise Family Clinic",
  description:
    "Decision-support chatbot for doctors at Sunrise Family Clinic. Answers only from the clinic records (synthetic demo data).",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "Health RAG" },
};

export const viewport: Viewport = { themeColor: "#0e7490" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Disclaimer banner shown on every view */}
        <div className="bg-amber-100 text-amber-900 text-center text-sm px-3 py-2">
          Decision-support only, not a replacement for a doctor. Synthetic demo
          data — not real patient records.
        </div>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ("serviceWorker" in navigator) { window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(()=>{})); }`,
          }}
        />
      </body>
    </html>
  );
}
