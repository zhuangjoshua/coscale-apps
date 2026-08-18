import { useCallback, useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useSession } from "../lib/session";
import { useViewerAccess } from "../lib/hooks";
import { prototypeLandingHtml } from "../prototype-landing-html";
import "../prototype-landing.css";

/**
 * The landing page is designed as static markup, so its links are wired here by
 * delegation rather than by rewriting the design into components:
 *
 *  - `.nav-login` starts the real sign-in flow (it shipped as `href="#"`).
 *  - Same-origin links route client-side instead of triggering a full reload.
 *
 * When auth is not configured — local development, before the product is published —
 * sign-in falls back to /app, which presents the sign-in options rather than failing
 * silently on a disabled OAuth call.
 */
export function LandingScreen() {
  const access = useViewerAccess();
  const session = useSession();
  const navigate = useNavigate();
  const host = useRef<HTMLDivElement>(null);

  const onClick = useCallback(
    (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      // Let the browser handle new-tab/modified clicks and external links.
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
      if (anchor.target && anchor.target !== "_self") return;

      if (anchor.classList.contains("nav-login")) {
        event.preventDefault();
        session.signIn("/app");
        return;
      }

      const href = anchor.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || /^[a-z]+:/i.test(href)) return;
      if (href.startsWith("/")) {
        event.preventDefault();
        navigate(href);
      }
    },
    [session, navigate],
  );

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    node.addEventListener("click", onClick);
    return () => node.removeEventListener("click", onClick);
  }, [onClick]);

  // Keep "signed in" consistent with the app shell, which also honours the dev session.
  if (access.authenticated || session.signedIn) return <Navigate to="/app" replace />;

  return (
    <main className="min-h-screen" aria-busy={access.loading || undefined}>
      <div ref={host} dangerouslySetInnerHTML={{ __html: prototypeLandingHtml }} />
    </main>
  );
}
