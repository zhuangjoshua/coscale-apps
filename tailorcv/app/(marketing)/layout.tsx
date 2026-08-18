import type { Metadata } from "next";
import "./_site/landing.css";
import "./_site/pages.css";

/**
 * Marketing site (landing + product/pricing/faq/blog/privacy/terms).
 *
 * The markup is the Takyon-designed prototype (rev 145), rendered verbatim as
 * server-rendered HTML. Its two stylesheets set :root / html,body rules, so they
 * are scoped to this route group only — the product app (/login, /dashboard, …)
 * never loads them. Design source of truth is app/(marketing)/_site/.
 */
export const metadata: Metadata = {
  title: "TailorCV — one resume, tailored for every job",
  description:
    "Tell us what you've done once. We build your professional resume and tailor it for every job you apply to — without ever inventing a word.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
