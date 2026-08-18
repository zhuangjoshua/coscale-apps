import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/app/AppHeader";
import db, { Application, getLibrary, getMasterResume, parseResume } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusPill({ status }: { status: Application["status"] }) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  if (status === "generating")
    return <span className={`${base} bg-warn/10 text-warn`}>Generating…</span>;
  if (status === "error")
    return <span className={`${base} bg-red-50 text-red-700`}>Failed</span>;
  return <span className={`${base} bg-ok/10 text-ok`}>Tailored resume ready</span>;
}

export default async function Dashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const masterRow = getMasterResume(user.id);
  if (!masterRow) redirect("/onboard");

  const master = parseResume(masterRow);
  const library = getLibrary(user.id);
  const applications = db
    .prepare("SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC")
    .all(user.id) as Application[];

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user.email} active="dashboard" />

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* ------------------------------------------------ master resume */}
        <section className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Master Resume
              </h2>
              <p className="mt-1 text-lg font-semibold">{master.name}</p>
              {master.headline ? (
                <p className="text-sm text-muted-foreground">{master.headline}</p>
              ) : null}
              <p className="mt-3 text-sm text-muted-foreground">
                {library.length} {library.length === 1 ? "entry" : "entries"} in your
                Experience Library · Updated {formatDate(masterRow.updated_at)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <Link href="/resume/master" className="text-primary hover:underline">
                View &amp; edit
              </Link>
              <a
                href={`/api/pdf/${masterRow.id}`}
                className="text-primary hover:underline"
              >
                Download PDF
              </a>
              <Link
                href="/onboard"
                className="text-muted-foreground hover:text-foreground"
              >
                Rebuild master resume
              </Link>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- applications */}
        <div className="mt-10 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">Applications</h2>
          <Link
            href="/tailor"
            className="btn btn-primary px-4 py-2 text-sm"
          >
            Tailor for a job
          </Link>
        </div>

        {applications.length === 0 ? (
          <div className="mt-4 card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No applications yet.{" "}
              <Link href="/tailor" className="text-primary hover:underline">
                Tailor your first resume →
              </Link>
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {applications.map((app) => (
              <li key={app.id}>
                <Link
                  href={`/application/${app.id}`}
                  className="block card p-4 transition-colors hover:border-primary"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium">
                      {app.company} — {app.role}
                    </p>
                    <StatusPill status={app.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(app.created_at)}
                  </p>
                  {app.status === "error" && app.error ? (
                    <p className="mt-2 text-xs text-red-700">{app.error}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
