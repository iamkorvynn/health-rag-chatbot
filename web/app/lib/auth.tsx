"use client";
// Auth state for the Health RAG frontend: real JWT login against
// POST /auth/login, token in localStorage, sent as Bearer on every
// authenticated call. Validated on load via GET /auth/me.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiGet, apiPost, clearAuth, getStoredUser, getToken, storeAuth, type AuthUser } from "./api";

type AuthCtx = {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  token: null,
  ready: false,
  login: async () => ({ ok: false }),
  signup: async () => ({ ok: false }),
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // On load: if a token is stored, validate it against /auth/me.
  useEffect(() => {
    const t = getToken();
    const stored = getStoredUser();
    if (!t) {
      // Intentional post-hydration sync: the token lives in localStorage,
      // which does not exist during the static prerender.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReady(true);
      return;
    }
    apiGet<{ username: string; role: AuthUser["role"] }>("/auth/me", t).then((r) => {
      if (r.ok && r.data) {
        setToken(t);
        setUser({ username: r.data.username, role: r.data.role });
      } else if (r.status === 404) {
        // Backend predates /auth/me — keep the stored session; the next
        // authenticated call will surface a real 401 if the token is bad.
        setToken(t);
        if (stored) setUser(stored);
      } else {
        clearAuth();
      }
      setReady(true);
    });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const r = await apiPost<{ access_token: string; username: string; role: AuthUser["role"] }>(
      "/auth/login",
      { username, password },
    );
    if (!r.ok || !r.data?.access_token) {
      return { ok: false, error: r.detail || `Login failed (${r.status || "no connection"}).` };
    }
    const u = { username: r.data.username, role: r.data.role };
    storeAuth(r.data.access_token, u);
    setToken(r.data.access_token);
    setUser(u);
    return { ok: true };
  }, []);

  // Create a staff account (POST /auth/register) and sign in with it —
  // the backend fixes the role to "staff", so nobody can sign up as admin.
  const signup = useCallback(async (username: string, password: string) => {
    const r = await apiPost<{ access_token: string; username: string; role: AuthUser["role"] }>(
      "/auth/register",
      { username, password },
    );
    if (!r.ok || !r.data?.access_token) {
      return { ok: false, error: r.detail || `Sign-up failed (${r.status || "no connection"}).` };
    }
    const u = { username: r.data.username, role: r.data.role };
    storeAuth(r.data.access_token, u);
    setToken(r.data.access_token);
    setUser(u);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, token, ready, login, signup, logout }), [user, token, ready, login, signup, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
