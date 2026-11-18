"use client";
// /chat — the assistant. Login required. A question left by another page
// (e.g. a patient card) arrives via sessionStorage and is asked on load.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Chat from "../components/Chat";
import { useAuth } from "../lib/auth";

const PENDING_KEY = "health-rag-pending-question";

export default function ChatPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [externalQuestion, setExternalQuestion] = useState<{ q: string; nonce: number } | undefined>(undefined);
  const questionNonce = useRef(0);

  // Login required — send unauthenticated visitors to the sign-in page.
  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  useEffect(() => {
    if (!user) return;
    try {
      const q = sessionStorage.getItem(PENDING_KEY);
      if (q) {
        sessionStorage.removeItem(PENDING_KEY);
        questionNonce.current += 1;
        setExternalQuestion({ q, nonce: questionNonce.current });
      }
    } catch {
      /* sessionStorage unavailable — ignore */
    }
  }, [user]);

  return (
    <div className="pb-20 md:pb-0">
      <section className="bg-gradient-to-b from-lavender via-[#0e1a10] to-lavender-deep">
        <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <p className="text-xs font-bold tracking-[0.18em] text-brand-deep uppercase">Sunrise Family Clinic • Assistant</p>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold text-ink">Chat</h1>
          <p className="mt-4 text-muted leading-relaxed">
            Ask about a patient, a medicine, or the clinic — answers come only from the clinic records, with sources.
          </p>

          {!ready || !user ? (
            <p className="mt-10 text-center text-muted text-sm">Loading…</p>
          ) : (
            <div className="mt-10">
              <Chat externalQuestion={externalQuestion} />
              <p className="text-xs text-muted mt-4">
                Not sure what to ask? Try a suggested question in the chat, or pick a patient on the{" "}
                <Link href="/patients" className="text-brand-deep font-semibold hover:underline">Patients</Link> page.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
