import { redirect } from "next/navigation";
import AppHeader from "@/app/AppHeader";
import SubmitButton from "./SubmitButton";
import { createApplication } from "@/app/actions";
import { getMasterResume } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { aiEnabled } from "@/lib/ai";

export const dynamic = "force-dynamic";

const inputClass =
  "field";

export default async function TailorPage(props: PageProps<"/tailor">) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!getMasterResume(user.id)) redirect("/onboard");

  const search = await props.searchParams;
  const error = search.error === "required";

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user.email} />

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Tailor your resume for a job
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell us where you&apos;re applying. We&apos;ll build a version of your resume
          aimed at this specific role.
        </p>

        {error ? (
          <p className="mt-4 rounded-brand border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Company and role are both required.
          </p>
        ) : null}

        <form
          action={createApplication}
          className="mt-6 space-y-5 card p-6"
        >
          <div>
            <label htmlFor="company" className="block text-sm font-medium">
              Company
            </label>
            <input
              id="company"
              name="company"
              required
              placeholder="Acme Corp"
              className={`mt-1 ${inputClass}`}
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium">
              Role
            </label>
            <input
              id="role"
              name="role"
              required
              placeholder="Senior Product Designer"
              className={`mt-1 ${inputClass}`}
            />
          </div>

          <div>
            <label htmlFor="jd_url" className="block text-sm font-medium">
              Job posting link (optional)
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste a link to the posting and we&apos;ll read it for you — works
              with Greenhouse, Lever, and most careers pages.
            </p>
            <input
              id="jd_url"
              name="jd_url"
              type="url"
              placeholder="https://boards.greenhouse.io/…"
              className={`mt-2 ${inputClass}`}
            />
          </div>

          <div>
            <label htmlFor="jd" className="block text-sm font-medium">
              Job description (optional)
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Or paste the posting text itself — pasted text wins over the
              link. Leave both blank and we&apos;ll research the role instead.
            </p>
            <textarea
              id="jd"
              name="jd"
              rows={12}
              placeholder="Paste the job posting here…"
              className={`mt-2 ${inputClass}`}
            />
          </div>

          {!aiEnabled() ? (
            <p className="text-xs text-muted-foreground">
              Note: running in mock mode without <code>ANTHROPIC_API_KEY</code> — research
              and tailoring return deterministic placeholder content.
            </p>
          ) : null}

          <SubmitButton />
        </form>

        <section className="mt-6 card p-6">
          <h2 className="text-sm font-semibold">What happens next</h2>
          <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">1. We research the role.</span>{" "}
              Using your pasted job description, or a live search of what this employer
              prioritizes for this position.
            </li>
            <li>
              <span className="font-medium text-foreground">
                2. We match it against your Experience Library.
              </span>{" "}
              Including the facts that didn&apos;t make your master resume.
            </li>
            <li>
              <span className="font-medium text-foreground">
                3. We rewrite emphasis — never invent.
              </span>{" "}
              Bullets get reordered, reworded, and trimmed, but no employer, metric,
              skill, or date is ever added that you didn&apos;t provide.
            </li>
          </ol>
        </section>
      </main>
    </div>
  );
}
