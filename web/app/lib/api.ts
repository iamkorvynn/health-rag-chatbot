// Shared API client for the Health RAG Chatbot frontend.
// Talks to the FastAPI backend (NEXT_PUBLIC_API_URL). No RAG code here.
// Response shapes follow the backend API contract (repo/backend/API.md):
// auth, ask (with language), patients, upload, stats, admin, visit-info,
// tokens, test-questions. Nothing is faked: every number/list/answer comes
// from a live backend response or from real client-side computation.

// Runtime backend URL resolution — the localhost.run tunnel URL rotates on
// reconnect, so the baked NEXT_PUBLIC_API_URL goes stale until the next
// redeploy. Resolve at runtime instead, in this order:
//   (a) public gist (published ~2s after a tunnel rotation),
//   (b) same-origin /api-url.json (always matches the deployed site),
//   (c) value cached from a previous session,
//   (d) the baked build-time URL (last resort).
// A failed fetch never surfaces an error here — resolution just moves to
// the next source. Every API call awaits getApiUrl() first, so resolution
// always happens before the first API call.
const GIST_URL =
  "https://gist.githubusercontent.com/iamkorvynn/2c01b4fcaa4f8649a477d9c46f483560/raw/health-rag-backend-url.json";
const API_URL_CACHE_KEY = "health-rag-api-url";
const RESOLVE_TIMEOUT_MS = 8000;

export const BAKED_API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
/** Baked build-time backend URL (last-resort fallback). Prefer getApiUrl(). */
export const API_URL = BAKED_API_URL;

let resolvedApiUrl: string | null = null;
let resolvingApiUrl: Promise<string> | null = null;

async function fetchJsonWithTimeout(url: string, ms: number): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as unknown;
  } finally {
    clearTimeout(t);
  }
}

function pickUrl(data: unknown): string | null {
  if (data && typeof data === "object" && typeof (data as { url?: unknown }).url === "string") {
    const u = ((data as { url: string }).url || "").trim().replace(/\/$/, "");
    return /^https?:\/\//.test(u) ? u : null;
  }
  return null;
}

function readCachedApiUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const u = (localStorage.getItem(API_URL_CACHE_KEY) || "").trim().replace(/\/$/, "");
    return /^https?:\/\//.test(u) ? u : null;
  } catch {
    return null;
  }
}

async function resolveApiUrl(): Promise<string> {
  // (a) gist — updated seconds after a tunnel rotation. One retry.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const u = pickUrl(await fetchJsonWithTimeout(`${GIST_URL}?t=${Date.now()}`, RESOLVE_TIMEOUT_MS));
      if (u) return u;
    } catch {
      /* fall through to the next source */
    }
  }
  // (b) same-origin /api-url.json — always matches the deployed site.
  try {
    const u = pickUrl(await fetchJsonWithTimeout("/api-url.json", RESOLVE_TIMEOUT_MS));
    if (u) return u;
  } catch {
    /* fall through */
  }
  // (c) value cached from a previous session, then (d) the baked URL.
  return readCachedApiUrl() ?? BAKED_API_URL;
}

/** Resolve (once per page load) and cache the live backend URL. */
export function getApiUrl(): Promise<string> {
  if (resolvedApiUrl) return Promise.resolve(resolvedApiUrl);
  if (typeof window === "undefined") return Promise.resolve(BAKED_API_URL);
  if (!resolvingApiUrl) {
    resolvingApiUrl = resolveApiUrl().then((u) => {
      resolvedApiUrl = u;
      try {
        localStorage.setItem(API_URL_CACHE_KEY, u);
      } catch {
        /* storage unavailable — memory cache still applies */
      }
      return u;
    });
  }
  return resolvingApiUrl;
}

/** Sync best-known backend URL (for error messages). Never triggers a fetch. */
export function getResolvedApiUrl(): string {
  return resolvedApiUrl ?? readCachedApiUrl() ?? BAKED_API_URL;
}

// Real pipeline config, as implemented in the backend (see backend/main.py
// and the API contract). Shown on /how — these are config values, not live
// counts, so they live in one place instead of being scattered as literals.
export const PIPELINE = {
  chunkSize: 800,
  chunkOverlap: 150,
  embeddingModel: "gemini-embedding-001",
  vectorStore: "ChromaDB",
  collection: "clinic",
  retrieverK: 5,
  llm: "gemini-2.5-flash",
  temperature: 0,
} as const;

export type Role = "admin" | "doctor" | "staff";
export type Language = "en" | "hi" | "mr";

export const LANGUAGES: { code: Language; label: string; speechLang: string }[] = [
  { code: "en", label: "English", speechLang: "en-IN" },
  { code: "hi", label: "Hindi", speechLang: "hi-IN" },
  { code: "mr", label: "Marathi", speechLang: "mr-IN" },
];

export type AuthUser = { username: string; role: Role };

export type Source = {
  file: string;
  page: number;
  text?: string;
  score?: number;
};

export type ChatMsg = {
  q: string;
  a: string;
  sources: Source[];
  language: Language;
  ts: number;
};

export type Patient = { id: string; name: string; file: string };

export type Stats = { patients: number; documents: number };

export type AdminStats = {
  documents_indexed: number;
  questions_asked: number;
  fallback_rate: number;
  recent_queries: unknown[];
};

export type AdminQuery = {
  id: number | string;
  timestamp: string;
  username: string;
  question: string;
  answer: string;
  sources: Source[];
  fallback: boolean;
  language: string;
};

export type VisitInfo = {
  timings: string;
  fees: string;
  emergency: string;
  source_file: string;
};

export type TokenStatus = {
  current: { number: number; name: string } | null;
  waiting: { number: number; name: string; created_at?: string }[];
  served_count: number;
};

export type ApiKeyStatus = {
  configured: boolean;
  source: "manual" | "env" | "none";
  masked: string | null;
};

export type TestQuestion = { id: number | string; question: string; expected: string };

const TOKEN_KEY = "health-rag-token";
const USER_KEY = "health-rag-user";
const CHAT_KEY = "health-rag-chat";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function storeAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function loadChatHistory(): ChatMsg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    return raw ? (JSON.parse(raw) as ChatMsg[]) : [];
  } catch {
    return [];
  }
}

export function saveChatHistory(history: ChatMsg[]) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(history));
}

export function authHeaders(token?: string | null): Record<string, string> {
  const t = token ?? getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function apiGet<T>(path: string, token?: string | null): Promise<{ ok: boolean; status: number; data: T | null; detail?: string }> {
  const base = await getApiUrl();
  try {
    const r = await fetch(`${base}${path}`, { headers: authHeaders(token) });
    const data = (await r.json().catch(() => null)) as T | null;
    return { ok: r.ok, status: r.status, data, detail: (data as { detail?: string } | null)?.detail };
  } catch {
    return { ok: false, status: 0, data: null, detail: `Could not reach the backend at ${base}.` };
  }
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  token?: string | null,
): Promise<{ ok: boolean; status: number; data: T | null; detail?: string }> {
  const base = await getApiUrl();
  try {
    const r = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    });
    const data = (await r.json().catch(() => null)) as T | null;
    return { ok: r.ok, status: r.status, data, detail: (data as { detail?: string } | null)?.detail };
  } catch {
    return { ok: false, status: 0, data: null, detail: `Could not reach the backend at ${base}.` };
  }
}

export async function apiDelete<T>(
  path: string,
  token?: string | null,
): Promise<{ ok: boolean; status: number; data: T | null; detail?: string }> {
  const base = await getApiUrl();
  try {
    const r = await fetch(`${base}${path}`, { method: "DELETE", headers: authHeaders(token) });
    const data = (await r.json().catch(() => null)) as T | null;
    return { ok: r.ok, status: r.status, data, detail: (data as { detail?: string } | null)?.detail };
  } catch {
    return { ok: false, status: 0, data: null, detail: `Could not reach the backend at ${base}.` };
  }
}

/** Multipart upload (clinic PDFs) against the resolved backend URL. */
export async function apiUpload<T>(
  form: FormData,
  token?: string | null,
): Promise<{ ok: boolean; status: number; data: T | null; detail?: string }> {
  const base = await getApiUrl();
  try {
    const r = await fetch(`${base}/upload`, {
      method: "POST",
      headers: authHeaders(token),
      body: form,
    });
    const data = (await r.json().catch(() => null)) as T | null;
    return { ok: r.ok, status: r.status, data, detail: (data as { detail?: string } | null)?.detail };
  } catch {
    return { ok: false, status: 0, data: null, detail: `Could not reach the backend at ${base}.` };
  }
}

/** Words from the question worth highlighting inside a source excerpt. */
const STOPWORDS = new Set([
  "what", "when", "where", "which", "who", "whom", "whose", "how", "why",
  "list", "tell", "show", "give", "about", "clinic", "patient", "patients",
  "doctor", "please", "does", "have", "with", "from", "that", "this", "there",
  "their", "your", "name", "file",
]);

export function questionKeywords(question: string): string[] {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return [...new Set(words)];
}
