import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/app/AppHeader";
import { deleteApplication, regenerateApplication } from "@/app/actions";
import ResumeView from "@/components/ResumeView";
import db, { Application, ResumeRow, parseResume } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ApplicationPage(
  props: PageProps<"/application/[id]">
) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await props.params;

  const app = db
    .prepare("SELECT * FROM applications WHERE id = ? AND user_id = ?")
    .get(Number(id), user.id) as Application | undefined;
  if (!app) redirect("/dashboard");

  const created = new Date(app.created_at * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const resumeRow =
    app.status === "ready"
      ? (db
          .prepare("SELECT * FROM resumes WHERE application_id = ?")
          .get(app.id) as ResumeRow | undefined)
      : undefined;

  const changes: string[] = safeList(app.changes);

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user.email} active="dashboard" />

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* ------------------------------------------------------ header */}
        <div className="no-print mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← All applications
            </Link>
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              {app.company} — {app.role}
            </h1>
            <p className="text-sm text-muted-foreground">Created {created}</p>
          </div>
          <form action={deleteApplication}>
            <input type="hidden" name="application_id" value={app.id} />
            <button className="text-sm text-muted-foreground hover:text-foreground">
              Delete
            </button>
          </form>
        </div>

        {/* --------------------------------------------------- generating */}
        {app.status === "generating" && (
          <div className="card p-10 text-center shadow-sm">
            <p className="font-medium">Tailoring in progress…</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Refresh in a moment.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <a
                href={`/application/${app.id}`}
                className="btn btn-primary px-3 py-2 text-sm"
              >
                Refresh
              </a>
              <form action={regenerateApplication}>
                <input type="hidden" name="application_id" value={app.id} />
                <button className="btn btn-outline px-3 py-2 text-sm">
                  Restart
                </button>
              </form>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------- error */}
        {app.status === "error" && (
          <div className="rounded-brand border border-red-300 bg-red-50 p-6">
            <p className="font-medium text-red-800">Tailoring failed</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-red-700">
              {app.error || "Something went wrong."}
            </p>
            <form action={regenerateApplication} className="mt-4">
              <input type="hidden" name="application_id" value={app.id} />
              <button className="btn btn-primary px-3 py-2 text-sm">
                Try again
              </button>
            </form>
          </div>
        )}

        {/* -------------------------------------------------------- ready */}
        {app.status === "ready" && !resumeRow && (
          <div className="card p-6 text-sm text-muted-foreground">
            The tailored resume for this application is missing.
            <form action={regenerateApplication} className="mt-4">
              <input type="hidden" name="application_id" value={app.id} />
              <button className="btn btn-primary px-3 py-2 text-sm">
                Regenerate
              </button>
            </form>
          </div>
        )}

        {app.status === "ready" && resumeRow && (
          <>
            <div className="no-print mb-5 flex flex-wrap items-center gap-2">
              <a
                href={`/api/pdf/${resumeRow.id}`}
                className="btn btn-primary px-3 py-2 text-sm"
              >
                Download PDF
              </a>
              <form action={regenerateApplication}>
                <input type="hidden" name="application_id" value={app.id} />
                <button className="btn btn-outline px-3 py-2 text-sm">
                  Regenerate
                </button>
              </form>
            </div>

            <div className="overflow-x-auto"><div className="mx-auto w-fit border shadow-lg [zoom:1.25]">
              <ResumeView resume={parseResume(resumeRow)} />
            </div></div>

            <div className="no-print mt-6 space-y-3">
              <details
                open
                className="card px-4 py-3"
              >
                <summary className="cursor-pointer text-sm font-semibold">
                  What changed for this application
                </summary>
                {changes.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {changes.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No change summary was recorded.
                  </p>
                )}
              </details>

              {app.research && (
                <details className="card px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Research notes
                  </summary>
                  <p className="mt-2 text-sm font-medium">
                    What {app.company} appears to prioritize
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {app.research}
                  </p>
                </details>
              )}

              {!app.research && app.jd_text && (
                <details className="card px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Job description{app.jd_url ? " (read from your link)" : " you provided"}
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {app.jd_text}
                  </p>
                </details>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function safeList(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
