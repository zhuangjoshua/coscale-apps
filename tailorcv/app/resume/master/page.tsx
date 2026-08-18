import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/app/AppHeader";
import EditableResume from "@/components/EditableResume";
import AddToLibrary from "./AddToLibrary";
import AddToEntry from "./AddToEntry";
import UpdateMasterButton from "./UpdateMasterButton";
import SuggestionsCard from "./SuggestionsCard";
import db, { Entry, Suggestion, getLibrary, getMasterResume, parseResume } from "@/lib/db";
import { deleteEntry } from "@/app/actions";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MasterResumePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const row = getMasterResume(user.id);
  if (!row) redirect("/onboard");

  const resume = parseResume(row);
  const library = getLibrary(user.id);
  const suggestions = db
    .prepare(
      "SELECT * FROM suggestions WHERE user_id = ? AND status = 'pending' ORDER BY id"
    )
    .all(user.id) as Suggestion[];

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user.email} active="resume" />

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* ------------------------------------------------- action bar */}
        <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Master resume</h1>
            <p className="text-sm text-muted-foreground">
              Your canonical resume. Every tailored version starts here.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <UpdateMasterButton />
            <a
              href={`/api/pdf/${row.id}`}
              className="btn btn-primary px-3 py-2 text-sm"
            >
              Download PDF
            </a>
            <Link
              href="/onboard"
              className="btn btn-outline px-3 py-2 text-sm"
            >
              Rebuild master resume
            </Link>
          </div>
        </div>

        {/* ------------------------------------------------ the resume */}
        <div className="no-print mb-2 flex items-center gap-2 rounded-brand border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary-dark">
          <span aria-hidden="true">✏️</span>
          <span>
            <strong className="font-semibold">This resume is editable.</strong>{" "}
            Click any text — a bullet, a title, a date — to change it in place.
            Edits save instantly and show up in the PDF.
          </span>
        </div>
        <SuggestionsCard suggestions={suggestions} />
        <div className="overflow-x-auto"><div className="mx-auto w-fit border shadow-lg [zoom:1.25]">
          <EditableResume resume={resume} resumeId={row.id} />
        </div></div>

        {/* -------------------------------------------- experience library */}
        <section className="no-print mt-10">
          <h2 className="text-sm font-semibold">Experience Library</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            The source of truth behind every resume. It keeps every fact
            you&rsquo;ve told us — including details too minor for the master
            resume above — and when you tailor for a job, the AI picks the
            facts that job cares about from here. It is also the fabrication
            guardrail: nothing appears on any resume unless it&rsquo;s in this
            library.
          </p>

          <div className="mt-3">
            <AddToLibrary />
          </div>

          <div className="mt-3 space-y-3">
            {library.length === 0 && (
              <div className="card p-4 text-sm text-muted-foreground">
                Your library is empty. Rebuild master resume to rebuild it.
              </div>
            )}
            {library.map((entry) => (
              <LibraryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------- library */

function LibraryCard({ entry }: { entry: Entry }) {
  const facts = JSON.parse(entry.facts) as string[];
  const skills = JSON.parse(entry.skills) as string[];

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="rounded-brand bg-muted px-2 py-0.5 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            {entry.kind}
          </span>
          <span className="ml-2 text-sm font-medium">{entry.title}</span>
          {entry.org && (
            <span className="text-sm text-muted-foreground"> — {entry.org}</span>
          )}
        </div>
        {entry.dates && (
          <span className="text-sm text-muted-foreground">{entry.dates}</span>
        )}
      </div>

      {facts.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
          {facts.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}

      {skills.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium">Skills:</span> {skills.join(", ")}
        </p>
      )}

      <div className="mt-1 flex items-center justify-between gap-4">
        <AddToEntry entryId={entry.id} />
        <details className="shrink-0 text-right">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-warn">
            Delete entry
          </summary>
          <form action={deleteEntry} className="mt-1">
            <input type="hidden" name="entry_id" value={entry.id} />
            <button className="rounded-brand border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100">
              Yes, delete &ldquo;{entry.title.slice(0, 30)}&rdquo; and its facts
            </button>
          </form>
        </details>
      </div>
    </div>
  );
}
