import Link from "next/link";
import { redirect } from "next/navigation";
import { requestLogin } from "@/app/actions";
import { getSessionUser } from "@/lib/session";
import { siteUrl } from "@/lib/email";
import { googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  google: "Google login didn't complete. Please try again.",
  google_unconfigured: "Google login isn't configured on this server yet.",
  email: "That doesn't look like a valid email address.",
  ratelimit: "Too many login links requested. Check your inbox for an earlier one, or try again in an hour.",
  expired: "That link has expired or was already used. Request a new one.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const params = await props.searchParams;
  const sent = typeof params.sent === "string" ? params.sent : "";
  const error = typeof params.error === "string" ? params.error : "";
  // "Generate your resume" on the landing page arrives with ?intent=start;
  // plain "Log in" doesn't. Same Google flow, different framing.
  const starting = params.intent === "start";
  const google = googleConfigured();
  // Google is the only login method. The email link exists solely so the app
  // runs locally before Google credentials are added; never in production.
  const devFallback = !google && process.env.NODE_ENV !== "production";

  return (
    <main className="flex flex-1 items-center justify-center bg-paper px-4 py-20">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <a
            href={siteUrl()}
            className="inline-flex items-center gap-2 text-[0.95rem] font-medium tracking-[0.08em]"
          >
            <img src="/brand-logo.png" alt="" className="h-9 w-auto" />
            TailorCV
          </a>
        </div>

        {sent ? (
          <div className="mt-8 card p-7">
            <h1 className="text-2xl">Check your email</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              We sent a login link to{" "}
              <span className="font-medium text-foreground">{sent}</span>. It
              works once and expires in 20 minutes.
            </p>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Running locally without <code>RESEND_API_KEY</code>? The link is
              printed to your terminal instead of being emailed.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-block text-sm text-primary hover:underline"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <div className="mt-8 card p-7">
            <h1 className="text-2xl">{starting ? "Let’s build your resume" : "Log in"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {starting
                ? "Continue with Google to get started — no password, no account setup. You’ll describe your background next."
                : "Continue with the Google account you use for TailorCV."}
            </p>

            {error && (
              <p className="mt-4 rounded-brand border border-warn/40 bg-paper p-3 text-sm text-warn">
                {ERRORS[error] ?? "Something went wrong. Try again."}
              </p>
            )}

            <a
              href={`/api/auth/google${starting ? "?intent=start" : ""}`}
              aria-disabled={!google || undefined}
              className={`btn btn-outline mt-5 w-full gap-3 px-4 py-2.5 text-sm ${
                google ? "" : "pointer-events-none opacity-50"
              }`}
            >
              <GoogleMark />
              {starting ? "Get started with Google" : "Continue with Google"}
            </a>

            {!google && !devFallback && (
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Google login isn&apos;t configured on this server yet.
              </p>
            )}

            {devFallback && (
              <details className="mt-6 border-t pt-4">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Local development: Google isn&apos;t configured (set{" "}
                  <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code>).
                  Use an email link instead.
                </summary>
                <form action={requestLogin} className="mt-3 space-y-3">
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="field"
                  />
                  <button type="submit" className="btn btn-outline w-full px-4 py-2 text-sm">
                    Send me a dev login link
                  </button>
                </form>
              </details>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
      <path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
