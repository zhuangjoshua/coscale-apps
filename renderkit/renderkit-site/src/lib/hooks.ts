/**
 * Viewer state for the public marketing site.
 *
 * The signed-in product lives behind the express server at /app, which owns the
 * session cookie and serves its own HTML. This SPA is the anonymous public
 * front, so the viewer is always treated as anonymous here and every signed-in
 * destination is a full page load to the server.
 */

export type ViewerAccessState = "anonymous" | "ready";

export interface ViewerAccessResult {
  state: ViewerAccessState;
  authenticated: boolean;
  loading: boolean;
}

export interface ViewerCta {
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
}

const ANONYMOUS_ACCESS: ViewerAccessResult = {
  state: "anonymous",
  authenticated: false,
  loading: false,
};

export function useViewerAccess(): ViewerAccessResult {
  return ANONYMOUS_ACCESS;
}

export function resolveViewerCta(
  access: Pick<ViewerAccessResult, "authenticated"> | null,
): ViewerCta {
  if (access && access.authenticated) {
    return {
      primaryHref: "/app",
      primaryLabel: "Open app",
      secondaryHref: "/app",
      secondaryLabel: "Account",
    };
  }
  return {
    primaryHref: "/app",
    primaryLabel: "Get started",
    secondaryHref: "/app",
    secondaryLabel: "Sign in",
  };
}
