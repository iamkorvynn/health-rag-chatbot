"use client";
// /patients — patient directory. Login required. Tapping a patient card
// asks about them on /chat (the question travels via sessionStorage).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, type Patient } from "../lib/api";
import { useAuth } from "../lib/auth";

const PENDING_KEY = "health-rag-pending-question";

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function PatientsPage() {
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsError, setPatientsError] = useState("");

  // Login required — send unauthenticated visitors to the sign-in page.
  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  useEffect(() => {
    if (!ready || !user || !token) return;
    apiGet<{ patients: Patient[] }>("/patients", token).then((r) => {
      if (r.ok && r.data) setPatients(r.data.patients || []);
      else setPatientsError(r.detail || `Could not load patients (${r.status || "no connection"}).`);
    });
  }, [ready, user, token]);

  function askAboutPatient(p: Patient) {
    try {
      sessionStorage.setItem(PENDING_KEY, `Tell me about ${p.name} (${p.id})`);
    } catch {
      /* sessionStorage unavailable — chat still opens */
    }
    router.push("/chat");
  }

  return (
    <div className="pb-20 md:pb-0">
      <section className="bg-gradient-to-b from-lavender via-[#0e1a10] to-lavender-deep">
        <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <p className="text-xs font-bold tracking-[0.18em] text-brand-deep uppercase">Sunrise Family Clinic • Records</p>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold text-ink">Patients</h1>
          <p className="mt-4 text-muted leading-relaxed">
            Every patient in the clinic records. Tap a card to ask about them.
          </p>

          {!ready || !user ? (
            <p className="mt-10 text-center text-muted text-sm">Loading…</p>
          ) : (
            <div className="mt-10">
              {patientsError && <p className="text-sm text-red-300 bg-card rounded-[16px] shadow-soft px-4 py-3 mb-3">{patientsError}</p>}
              {patients.length === 0 && !patientsError ? (
                <p className="text-muted bg-card rounded-[24px] shadow-card p-5">No patients loaded yet.</p>
              ) : (
                <div className="grid sm:grid-cols-3 gap-4">
                  {patients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => askAboutPatient(p)}
                      className="text-left bg-card rounded-[24px] shadow-card hover:shadow-card-lg transition-shadow p-5"
                      title={`Ask about ${p.name}`}
                    >
                      <span className="w-12 h-12 rounded-full bg-gradient-to-br from-[#34d399] to-[#059669] text-white flex items-center justify-center font-bold">{initials(p.name)}</span>
                      <span className="block mt-3 font-bold text-ink">{p.name}</span>
                      <span className="inline-block mt-1 bg-grape-soft text-grape-dark text-xs font-semibold rounded-full px-2.5 py-1">{p.id}</span>
                      <span className="block mt-2 text-xs text-muted break-all">{p.file}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted mt-3">Tap a patient card to ask about them in chat.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
