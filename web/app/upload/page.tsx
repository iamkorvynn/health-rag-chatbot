"use client";
// /upload — upload clinic PDFs (admin only). Uploaded PDFs are indexed
// into the clinic records; scanned ones are OCR'd by the backend.
import { useState } from "react";
import LoginForm from "../components/LoginForm";
import { API_URL, apiGet, type Stats } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function UploadPage() {
  const { user, token, ready } = useAuth();
  const [uploadMsg, setUploadMsg] = useState("");
  const isAdmin = user?.role === "admin";

  async function upload(files: FileList | null) {
    if (!files || !files.length || !token) return;
    const form = new FormData();
    for (const f of files) form.append("files", f);
    setUploadMsg("Uploading…");
    try {
      const r = await fetch(`${API_URL}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const d = await r.json();
      setUploadMsg(
        r.ok
          ? `Uploaded: ${d.uploaded.join(", ")}${d.embedded ? "" : " — registered, not embedded yet (no API key on backend)."}`
          : `Upload failed: ${d.detail || r.status}`,
      );
      if (r.ok) {
        apiGet<Stats>("/stats").then(() => {
          /* counts refresh on next visit to the landing page */
        });
      }
    } catch {
      setUploadMsg("Could not reach the backend.");
    }
  }

  return (
    <div className="pb-20 md:pb-0">
      <section className="bg-gradient-to-b from-lavender via-[#0e1a10] to-lavender-deep">
        <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <p className="text-xs font-bold tracking-[0.18em] text-brand-deep uppercase">Sunrise Family Clinic • Records</p>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold text-ink">Upload clinic PDFs</h1>
          <p className="mt-4 text-muted leading-relaxed">
            Add new clinic documents and the assistant indexes them, so new records are searchable right away.
          </p>

          {!ready ? (
            <p className="mt-10 text-center text-muted text-sm">Loading…</p>
          ) : !user ? (
            <div className="mt-10">
              <h2 className="font-bold text-lg text-ink mb-3">Sign in to upload</h2>
              <LoginForm />
            </div>
          ) : !isAdmin ? (
            <p className="mt-10 text-sm text-muted bg-card rounded-[24px] shadow-card p-5">
              Uploads are available to admin accounts only — you are signed in as {user.role}.
            </p>
          ) : (
            <div className="mt-10">
              <label className="block bg-card rounded-[24px] shadow-card border-2 border-dashed border-lilac hover:border-grape transition-colors p-6 text-center cursor-pointer">
                <span className="mx-auto w-12 h-12 rounded-full bg-grape-soft flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-grape" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
                </span>
                <span className="block mt-3 font-semibold text-ink text-sm">Choose clinic PDFs to upload</span>
                <span className="block mt-1 text-xs text-muted">PDF files only — they are indexed into the clinic records.</span>
                <input type="file" accept=".pdf" multiple onChange={(e) => upload(e.target.files)} className="hidden" />
              </label>
              {uploadMsg && <p className="text-sm mt-3 bg-card rounded-[16px] shadow-soft px-4 py-3">{uploadMsg}</p>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
