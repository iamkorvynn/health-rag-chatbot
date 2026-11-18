"use client";
// /dashboard — admin dashboard: live counts from GET /admin/stats and the
// query log from GET /admin/queries. Every number comes from the backend.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, type AdminQuery, type AdminStats } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function DashboardPage() {
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [adminQueries, setAdminQueries] = useState<AdminQuery[]>([]);
  const [adminError, setAdminError] = useState("");
  const isAdmin = user?.role === "admin";

  // Login required — send unauthenticated visitors to the sign-in page.
  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  useEffect(() => {
    if (!ready || !user || !token || !isAdmin) return;
    apiGet<AdminStats>("/admin/stats", token).then((r) => {
      if (r.ok && r.data) setAdminStats(r.data);
      else setAdminError(r.detail || `Admin stats unavailable (${r.status || "no connection"}).`);
    });
    apiGet<{ queries: AdminQuery[] }>("/admin/queries", token).then((r) => {
      if (r.ok && r.data) setAdminQueries(r.data.queries || []);
    });
  }, [ready, user, token, isAdmin]);

  return (
    <div className="pb-20 md:pb-0">
      <section className="bg-gradient-to-b from-lavender via-[#0e1a10] to-lavender-deep">
        <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <p className="text-xs font-bold tracking-[0.18em] text-brand-deep uppercase">Sunrise Family Clinic • Admin</p>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold text-ink">Admin dashboard</h1>
          <p className="mt-4 text-muted leading-relaxed">
            What the clinic has asked, and how often the assistant had to say it could not find the answer.
          </p>

          {!ready || !user ? (
            <p className="mt-10 text-center text-muted text-sm">Loading…</p>
          ) : !isAdmin ? (
            <p className="mt-10 text-sm text-muted bg-card rounded-[24px] shadow-card p-5">
              The admin dashboard is available to admin accounts only — you are signed in as {user.role}.
            </p>
          ) : (
            <div className="mt-10">
              {adminError && <p className="text-sm text-red-300 bg-card rounded-[16px] shadow-soft px-4 py-3 mb-3">{adminError}</p>}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-card rounded-[24px] shadow-card p-4">
                  <p className="text-2xl md:text-3xl font-bold text-brand-deep">{adminStats ? adminStats.documents_indexed : "—"}</p>
                  <p className="text-xs text-muted mt-1">Documents indexed</p>
                </div>
                <div className="bg-card rounded-[24px] shadow-card p-4">
                  <p className="text-2xl md:text-3xl font-bold text-brand-deep">{adminStats ? adminStats.questions_asked : "—"}</p>
                  <p className="text-xs text-muted mt-1">Questions asked</p>
                </div>
                <div className="bg-card rounded-[24px] shadow-card p-4">
                  <p className="text-2xl md:text-3xl font-bold text-brand-deep">
                    {adminStats ? `${(adminStats.fallback_rate * 100).toFixed(0)}%` : "—"}
                  </p>
                  <p className="text-xs text-muted mt-1">Fallback rate</p>
                </div>
              </div>
              <h2 className="font-bold text-ink mt-6 mb-2">Recent queries</h2>
              {adminQueries.length === 0 ? (
                <p className="text-muted bg-card rounded-[24px] shadow-card p-5 text-sm">No queries logged yet.</p>
              ) : (
                <div className="bg-card rounded-[24px] shadow-card overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted border-b border-line">
                        <th className="px-4 py-3 font-semibold">When</th>
                        <th className="px-4 py-3 font-semibold">User</th>
                        <th className="px-4 py-3 font-semibold">Question</th>
                        <th className="px-4 py-3 font-semibold">Fallback</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminQueries.map((q) => (
                        <tr key={String(q.id)} className="border-b border-line last:border-0 align-top">
                          <td className="px-4 py-3 whitespace-nowrap text-muted">{q.timestamp ? new Date(q.timestamp).toLocaleString() : "—"}</td>
                          <td className="px-4 py-3">{q.username}</td>
                          <td className="px-4 py-3">{q.question}</td>
                          <td className="px-4 py-3">{q.fallback ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
