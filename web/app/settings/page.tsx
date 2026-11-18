"use client";
// /settings — admin settings. The Gemini API key field: paste a new key
// here when the free-tier quota runs out and the whole clinic starts using
// it immediately — no restart, no redeploy. The key is stored on the
// backend (admin only); the page only ever shows its last 4 characters.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete, apiGet, apiPost, type ApiKeyStatus } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function SettingsPage() {
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const [keyInput, setKeyInput] = useState("");
  const [keyStatus, setKeyStatus] = useState<ApiKeyStatus | null>(null);
  const [keyError, setKeyError] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const isAdmin = user?.role === "admin";

  // Login required — send unauthenticated visitors to the sign-in page.
  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  function refreshStatus() {
    if (!token) return;
    apiGet<ApiKeyStatus>("/admin/api-key/status", token).then((r) => {
      if (r.ok && r.data) {
        setKeyStatus(r.data);
        setKeyError("");
      } else {
        setKeyError(r.detail || `Could not load the key status (${r.status || "no connection"}).`);
      }
    });
  }

  useEffect(() => {
    if (!ready || !user || !token || !isAdmin) return;
    refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, token, isAdmin]);

  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyInput.trim() || saveBusy || !token) return;
    setSaveBusy(true);
    setSaveMsg("");
    setTestMsg("");
    const r = await apiPost<ApiKeyStatus>("/admin/api-key", { api_key: keyInput.trim() }, token);
    if (r.ok && r.data) {
      setKeyStatus(r.data);
      setKeyInput("");
      setSaveMsg("Saved — the clinic now answers with this key.");
    } else {
      setSaveMsg(r.detail || `Could not save the key (${r.status || "no connection"}).`);
    }
    setSaveBusy(false);
  }

  async function testKey() {
    if (testBusy || !token) return;
    setTestBusy(true);
    setTestMsg("");
    const r = await apiPost<{ ok: boolean; detail?: string }>("/admin/api-key/test", {}, token);
    if (r.ok && r.data) {
      setTestMsg(r.data.ok ? "Key works — Gemini answered the test call." : `Key check failed: ${r.data.detail || "unknown error"}`);
    } else {
      setTestMsg(r.detail || `Could not test the key (${r.status || "no connection"}).`);
    }
    setTestBusy(false);
  }

  async function removeKey() {
    if (removeBusy || !token) return;
    setRemoveBusy(true);
    setSaveMsg("");
    setTestMsg("");
    const r = await apiDelete<ApiKeyStatus>("/admin/api-key", token);
    if (r.ok && r.data) {
      setKeyStatus(r.data);
      setSaveMsg("Manual key removed — the clinic now uses the server's own key.");
    } else {
      setSaveMsg(r.detail || `Could not remove the key (${r.status || "no connection"}).`);
    }
    setRemoveBusy(false);
  }

  const sourceLabel =
    keyStatus?.source === "manual"
      ? "Manual key — entered here"
      : keyStatus?.source === "env"
        ? "Server key — from the backend environment"
        : "No key configured";

  return (
    <div className="pb-20 md:pb-0">
      <section className="bg-gradient-to-b from-lavender via-[#0e1a10] to-lavender-deep">
        <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <p className="text-xs font-bold tracking-[0.18em] text-brand-deep uppercase">Sunrise Family Clinic • Admin</p>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold text-ink">Settings</h1>
          <p className="mt-4 text-muted leading-relaxed">
            Clinic-wide settings for the assistant.
          </p>

          {!ready || !user ? (
            <p className="mt-10 text-center text-muted text-sm">Loading…</p>
          ) : !isAdmin ? (
            <p className="mt-10 text-sm text-muted bg-card rounded-[24px] shadow-card p-5">
              Settings are available to admin accounts only — you are signed in as {user.role}.
            </p>
          ) : (
            <div className="mt-10 bg-card rounded-[24px] shadow-card p-6">
              <h2 className="font-bold text-ink text-lg">Gemini API key</h2>
              <p className="text-sm text-muted mt-2 leading-relaxed">
                The assistant answers through Google&apos;s Gemini API. The free tier allows a
                limited number of answers a day — when it runs out, paste a new key from{" "}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-brand-deep font-semibold hover:underline">
                  Google AI Studio
                </a>{" "}
                here and the whole clinic starts using it immediately. No restart, no redeploy.
                Removing it falls back to the server&apos;s own key.
              </p>

              {keyError && <p className="text-sm text-red-300 bg-red-950/60 rounded-[16px] px-4 py-3 mt-4">{keyError}</p>}

              <div className="mt-5 bg-lavender rounded-[16px] px-4 py-3 text-sm">
                <p>
                  <span className="font-semibold text-ink">Current key: </span>
                  {keyStatus ? (
                    <>
                      <span className="text-muted">{sourceLabel}</span>
                      {keyStatus.masked && (
                        <span className="ml-2 font-mono text-ink">••••••••{keyStatus.masked}</span>
                      )}
                      {!keyStatus.configured && <span className="ml-2 text-red-300 font-semibold">Not set — answers are disabled.</span>}
                    </>
                  ) : (
                    <span className="text-muted">Loading…</span>
                  )}
                </p>
              </div>

              <form onSubmit={saveKey} className="mt-5 space-y-3">
                <label className="block">
                  <span className="text-sm font-semibold text-ink">New Gemini API key</span>
                  <input
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="Paste a Gemini API key"
                    autoComplete="off"
                    className="mt-1 w-full bg-card border border-line rounded-full px-4 py-3 text-sm shadow-soft outline-none focus:border-brand"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={saveBusy || !keyInput.trim()}
                    className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-onlime font-semibold rounded-full px-5 py-3 text-sm shadow-soft"
                  >
                    {saveBusy ? "Saving…" : "Save key"}
                  </button>
                  <button
                    type="button"
                    onClick={testKey}
                    disabled={testBusy || !keyStatus?.configured}
                    className="bg-card border border-line hover:border-grape disabled:opacity-50 font-semibold text-ink rounded-full px-5 py-3 text-sm shadow-soft"
                  >
                    {testBusy ? "Testing…" : "Test key"}
                  </button>
                  {keyStatus?.source === "manual" && (
                    <button
                      type="button"
                      onClick={removeKey}
                      disabled={removeBusy}
                      className="bg-card border border-red-900 hover:border-red-500 disabled:opacity-50 font-semibold text-red-300 rounded-full px-5 py-3 text-sm shadow-soft"
                    >
                      {removeBusy ? "Removing…" : "Remove manual key"}
                    </button>
                  )}
                </div>
              </form>

              {saveMsg && <p className="text-sm mt-4 bg-lavender rounded-[16px] px-4 py-3">{saveMsg}</p>}
              {testMsg && <p className="text-sm mt-3 bg-lavender rounded-[16px] px-4 py-3">{testMsg}</p>}
              <p className="text-xs text-muted mt-4">
                The full key is never shown on this page and never leaves the clinic server —
                only its last 4 characters are displayed.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
