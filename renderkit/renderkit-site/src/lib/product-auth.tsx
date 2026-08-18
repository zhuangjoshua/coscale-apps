import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { AUTH_LOGIN_URL, AUTH_LOGOUT_URL, siteConfig } from "./site-config";

interface ProductAuthContextValue {
  available: boolean;
  configured: boolean;
  busy: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signUpWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const ProductAuthContext = createContext<ProductAuthContextValue | null>(null);

/**
 * Auth lives entirely on the express server that fronts this SPA: sign-in and
 * sign-up both hand off to /api/auth/login, sign-out to /api/auth/logout. Both
 * are full page loads, so the server (not the router) owns what happens next.
 */
export function ProductAuthProvider({ children }: { children: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = useMemo<ProductAuthContextValue>(() => {
    const go = async (url: string) => {
      setError(null);
      setBusy(true);
      if (typeof window !== "undefined") window.location.href = url;
    };
    return {
      available: true,
      configured: siteConfig.auth.configured,
      busy,
      error,
      signInWithGoogle: () => go(AUTH_LOGIN_URL),
      signUpWithGoogle: () => go(AUTH_LOGIN_URL),
      logout: () => go(AUTH_LOGOUT_URL),
      clearError: () => setError(null),
    };
  }, [busy, error]);

  return <ProductAuthContext.Provider value={value}>{children}</ProductAuthContext.Provider>;
}

export function useProductAuth(): ProductAuthContextValue {
  const value = useContext(ProductAuthContext);
  if (!value) {
    throw new Error("useProductAuth must be used inside ProductAuthProvider");
  }
  return value;
}
