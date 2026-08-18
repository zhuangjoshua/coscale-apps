import { Link, NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { BackButton } from "../components/back-button";
import { Skeleton } from "../components/ui/skeleton";
import { brandLogoSrc, businessDisplayName } from "../lib/branding";
import { resolveViewerCta, useCheckoutReturnRefresh, useSubscribeIntent, useViewerAccess } from "../lib/hooks";
import { useSession } from "../lib/session";
import { useProductAuth } from "../lib/product-auth";

export function AppLayout() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const access = useViewerAccess();
  const auth = useProductAuth();
  // Local test identity, dev builds only — lets the gated shell be worked on before
  // Supabase auth is configured. `useDevSession` is inert in a production build.
  // Identity comes from the Pagewright service's own Google session, not the platform
  // rail — the deployment is standalone. Billing/entitlement is not gated here.
  const session = useSession();
  const authenticated = session.signedIn;
  const entitled = session.signedIn;
  const loadingAccess = session.loading;
  const productName = businessDisplayName();
  const cta = resolveViewerCta(access);
  const accountRoute = location.pathname.replace(/\/+$/, "") === "/app/profile";
  const subscribeIntent = searchParams.get("intent") === "subscribe";
  const checkoutError = searchParams.get("checkout") === "error";
  const autoCheckout =
    !loadingAccess && authenticated && !entitled && !accountRoute && !checkoutError;
  const checkoutStarting =
    authenticated && !entitled && (subscribeIntent || autoCheckout);
  useSubscribeIntent(access, searchParams.get("intent"), autoCheckout);
  useCheckoutReturnRefresh(access);

  return (
    <div className="min-h-screen bg-background" data-takyon-scaffold="app-layout">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 shadow-sm backdrop-blur">
        <div className="flex w-full flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link to="/app" className="flex items-center gap-3">
            <img src={brandLogoSrc()} alt={`${productName} logo`} className="h-8 w-auto rounded-[22%] bg-background p-[3px]" />
            <span className="font-heading text-lg font-medium tracking-[0.08em] text-foreground">{productName}</span>
          </Link>
          {loadingAccess ? (
            <Skeleton className="h-10 w-56" />
          ) : authenticated ? (
            <nav aria-label="Product navigation" className="flex flex-wrap items-center gap-2 text-sm">
              <NavLink
                to="/app"
                end
                className={({ isActive }) => `rounded px-3 py-2 font-medium ${isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
              >
                App
              </NavLink>
              <NavLink
                to="/app/profile"
                className={({ isActive }) => `rounded px-3 py-2 font-medium ${isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
              >
                Account
              </NavLink>
              <button
                type="button"
                onClick={() => void session.signOut()}
                disabled={auth.busy}
                className="rounded border border-border bg-background px-3 py-2 font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                Sign out
              </button>
            </nav>
          ) : null}
        </div>
      </header>

      {auth.error ? (
        <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-3 text-sm text-destructive" role="alert">
          {auth.error}
        </div>
      ) : null}

      <main className="w-full px-4 py-6 sm:px-6 lg:px-8">
        {location.pathname !== "/app" ? <BackButton fallback="/app" /> : null}
        {checkoutError ? (
          <div role="alert" className="mb-6 rounded border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            We couldn&apos;t start checkout. Try again in a moment or contact support.
          </div>
        ) : null}

        {loadingAccess || auth.busy || checkoutStarting ? (
          <div className="grid min-h-[70vh] place-items-center" aria-busy="true">
            <div className="w-full max-w-md space-y-4 text-center">
              <Skeleton className="mx-auto h-10 w-2/3" />
              <Skeleton className="h-24 w-full" />
              <p className="text-sm text-muted-foreground">
                {checkoutStarting ? "Opening secure checkout…" : "Loading your workspace…"}
              </p>
            </div>
          </div>
        ) : !authenticated ? (
          <section className="mx-auto grid min-h-[70vh] max-w-xl place-items-center text-center">
            <div className="space-y-6 rounded-2xl border border-border bg-card p-8 shadow-lg">
              <div className="space-y-2">
                <h1 className="font-heading text-3xl font-light tracking-tight text-foreground">Welcome to {productName}</h1>
                <p className="text-muted-foreground">Log in to continue, or create an account to start your subscription.</p>
              </div>
              <button
                type="button"
                onClick={() => session.signIn("/app")}
                disabled={!session.authConfigured}
                className="h-12 w-full rounded-full bg-primary px-5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Continue with Google
              </button>
              {!session.authConfigured ? (
                <p className="text-xs text-muted-foreground">
                  Sign-in is not configured on the server. Missing:{" "}
                  <code className="font-mono">{session.missingConfig.join(", ") || "configuration"}</code>
                </p>
              ) : null}
            </div>
          </section>
        ) : !entitled && !accountRoute ? (
          <section className="mx-auto grid min-h-[70vh] max-w-xl place-items-center text-center">
            <div className="space-y-6 rounded-2xl border border-border bg-card p-8 shadow-lg">
              <div className="space-y-2">
                <h1 className="font-heading text-3xl font-semibold text-foreground">Checkout didn&apos;t open</h1>
                <p className="text-muted-foreground">Try the secure checkout again to continue to {productName}.</p>
              </div>
              <Link
                to={cta.primaryHref}
                className="inline-flex h-12 items-center justify-center rounded bg-primary px-6 font-medium text-primary-foreground hover:opacity-90"
              >
                {cta.primaryLabel}
              </Link>
            </div>
          </section>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
