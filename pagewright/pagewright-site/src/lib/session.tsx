/**
 * Standalone session: Google sign-in handled entirely by the Pagewright service.
 *
 * The browser never holds a token — the service sets an httpOnly cookie after the
 * OAuth round trip, and requests carry it automatically. This module only asks the
 * service who the viewer is, and sends them to Google when they want to sign in.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { API_BASE } from "./pagewright";

export interface Account {
  id: string;
  email?: string;
}

export interface SessionValue {
  loading: boolean;
  signedIn: boolean;
  account: Account | null;
  /** False when the server has no Google credentials configured. */
  authConfigured: boolean;
  missingConfig: string[];
  signIn: (returnTo?: string) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

async function getJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const resp = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
    if (!resp.ok) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [authConfigured, setAuthConfigured] = useState(false);
  const [missingConfig, setMissingConfig] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const [me, config] = await Promise.all([
      getJson<{ signedIn: boolean; accountId: string | null; email: string | null }>("/api/auth/me"),
      getJson<{ configured: boolean; missing: string[] }>("/api/auth/config"),
    ]);
    setAuthConfigured(Boolean(config?.configured));
    setMissingConfig(config?.missing ?? []);
    setAccount(
      me?.signedIn && me.accountId ? { id: me.accountId, email: me.email ?? undefined } : null,
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<SessionValue>(
    () => ({
      loading,
      signedIn: Boolean(account),
      account,
      authConfigured,
      missingConfig,
      signIn: (returnTo = "/app") => {
        window.location.href = `${API_BASE}/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
      },
      signOut: async () => {
        await getJson("/api/auth/logout", { method: "POST" });
        setAccount(null);
        window.location.href = "/";
      },
      refresh,
    }),
    [loading, account, authConfigured, missingConfig, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
