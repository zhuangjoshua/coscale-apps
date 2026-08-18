/**
 * Local test identity, for working on the product before Supabase auth is configured.
 *
 * Mints an unsigned JWT the document service accepts *only* in its own dev mode (no
 * PAGEWRIGHT_JWT_SECRET / PAGEWRIGHT_JWKS_URL). Set either of those and these tokens
 * are rejected with 401, so this cannot become a production back door.
 *
 * Every export is behind `import.meta.env.DEV`, which is statically false in a
 * production build — the bundler drops this module's callers entirely.
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pagewright.devSession";

/** Inlined by Vite as a literal, so production builds fold every guard to `false`
 *  and the bundler drops the dev sign-in UI entirely. */
export const DEV_SESSION_AVAILABLE = import.meta.env.DEV;

interface DevSession {
  email: string;
  token: string;
}

const b64url = (value: string): string =>
  btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Unsigned JWT — the signature slot is a placeholder, never a real MAC. */
function mintToken(email: string): string {
  const header = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      sub: `dev-${email.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      email,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    }),
  );
  return `${header}.${payload}.unsigned`;
}

export function readDevSession(): DevSession | null {
  if (!DEV_SESSION_AVAILABLE) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DevSession;
    return parsed.token ? parsed : null;
  } catch {
    return null;
  }
}

export function devSessionToken(): string {
  if (!DEV_SESSION_AVAILABLE) return "";
  return readDevSession()?.token ?? "";
}

export function startDevSession(email: string): DevSession {
  const session = { email, token: mintToken(email) };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function endDevSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export interface UseDevSession {
  available: boolean;
  active: boolean;
  email: string;
  start: (email: string) => void;
  end: () => void;
}

export function useDevSession(): UseDevSession {
  const [session, setSession] = useState<DevSession | null>(() => readDevSession());

  useEffect(() => {
    const sync = () => setSession(readDevSession());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const start = useCallback((email: string) => setSession(startDevSession(email)), []);
  const end = useCallback(() => {
    endDevSession();
    setSession(null);
  }, []);

  return {
    available: DEV_SESSION_AVAILABLE,
    active: Boolean(session),
    email: session?.email ?? "",
    start,
    end,
  };
}
