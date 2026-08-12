import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import db, { Form, Submission } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { parseSchema, generateHtmlExport } from "@/lib/formschema";
import ShareTabs from "./ShareTabs";
import AppHeader from "@/app/AppHeader";

export const dynamic = "force-dynamic";

export default async function FormDetail({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/");

  const { formId } = await params;
  const form = db
    .prepare("SELECT * FROM forms WHERE id = ? AND user_id = ?")
    .get(formId, user.id) as Form | undefined;
  if (!form) notFound();

  const submissions = db
    .prepare(
      "SELECT * FROM submissions WHERE form_id = ? ORDER BY created_at DESC LIMIT 20"
    )
    .all(form.id) as Submission[];

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const endpoint = `${appUrl}/f/${form.id}`;
  const schema = parseSchema(form.schema);
  const hostedUrl = `${appUrl}/form/${form.id}`;
  const snippet = `<form action="${endpoint}" method="POST">
  <input type="email" name="email" placeholder="Email" required />
  <input type="text" name="_gotcha" style="display:none" tabindex="-1" autocomplete="off" />
  <button type="submit">Submit</button>
</form>`;

  return (
    <main className="min-h-screen bg-[#faf9f7]">
      <AppHeader email={user.email} active="dashboard" />

      <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-primary hover:underline"
          >
            ← Back to dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-foreground">{form.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Writes to sheet tab “{form.sheet_name}” ·{" "}
            <a
              href={`https://docs.google.com/spreadsheets/d/${form.spreadsheet_id}`}
              target="_blank"
              className="text-primary hover:underline"
            >
              Open Google Sheet
            </a>
          </p>
        </div>

        <section className="rounded-brand border border-line bg-muted p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Form Builder</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {schema
                  ? `${schema.fields.length} field${schema.fields.length === 1 ? "" : "s"} — edit your form visually.`
                  : "Build this form visually — no HTML needed. Get a hosted page and embeds."}
              </p>
            </div>
            <Link
              href={`/dashboard/${form.id}/builder`}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              {schema ? "Edit in Builder" : "Open Builder"}
            </Link>
          </div>
          {schema && (
            <div className="mt-4 border-t border-line pt-4">
              <ShareTabs
                hostedUrl={hostedUrl}
                htmlExport={generateHtmlExport(schema, endpoint)}
              />
            </div>
          )}
        </section>

        <section className="rounded-brand border bg-white p-6">
          <h2 className="font-semibold text-foreground">Endpoint</h2>
          <code className="mt-2 block rounded bg-muted px-3 py-2 text-sm">
            POST {endpoint}
          </code>
          <h2 className="mt-6 font-semibold text-foreground">
            Copy-paste HTML
          </h2>
          <pre className="mt-2 rounded bg-gray-900 p-4 text-sm text-green-300 overflow-x-auto">
            {snippet}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">
            The hidden <code>_gotcha</code> field is a spam honeypot — bots fill
            it, humans don’t. Add{" "}
            <code>enctype=&quot;multipart/form-data&quot;</code> and an{" "}
            <code>&lt;input type=&quot;file&quot;&gt;</code> to accept file
            uploads (stored in your Drive, linked in the cell). A hidden{" "}
            <code>_redirect</code> field overrides the redirect URL
            per-submission.
          </p>
        </section>

        <section className="rounded-brand border bg-white p-6">
          <h2 className="font-semibold text-foreground">Settings</h2>
          <form
            action={`/api/forms/${form.id}`}
            method="POST"
            className="mt-4 space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#3d3a35]">
                  Form name
                </label>
                <input
                  name="name"
                  defaultValue={form.name}
                  className="mt-1 w-full rounded-brand border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3a35]">
                  Tab name
                </label>
                <input
                  name="sheet_name"
                  defaultValue={form.sheet_name}
                  className="mt-1 w-full rounded-brand border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3a35]">
                  Redirect URL after submit
                </label>
                <input
                  name="redirect_url"
                  defaultValue={form.redirect_url ?? ""}
                  placeholder="https://yoursite.com/thanks"
                  className="mt-1 w-full rounded-brand border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3a35]">
                  Email me on each submission
                </label>
                <input
                  name="notify_email"
                  type="email"
                  defaultValue={form.notify_email ?? ""}
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-brand border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3a35]">
                  Slack / Discord webhook URL
                </label>
                <input
                  name="webhook_url"
                  defaultValue={form.webhook_url ?? ""}
                  placeholder="https://hooks.slack.com/services/…"
                  className="mt-1 w-full rounded-brand border px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Each submission posts to your channel. Create one in Slack
                  (Incoming Webhooks) or Discord (Channel → Integrations).
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3a35]">
                  Maximum submissions
                </label>
                <input
                  name="max_submissions"
                  type="number"
                  min="1"
                  defaultValue={form.max_submissions ?? ""}
                  placeholder="Unlimited"
                  className="mt-1 w-full rounded-brand border px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Form closes automatically when reached. Leave empty for
                  unlimited.
                </p>
                <label className="mt-2 flex items-center gap-2 text-sm text-[#3d3a35]">
                  <input
                    type="checkbox"
                    name="show_counter"
                    defaultChecked={form.show_counter === 1}
                  />
                  Show “spots taken” bar on the hosted form page
                </label>
              </div>
            </div>
            <button className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
              Save settings
            </button>
          </form>
          <form
            action={`/api/forms/${form.id}`}
            method="POST"
            className="mt-4 border-t pt-4"
          >
            <input type="hidden" name="_action" value="delete" />
            <button className="text-sm text-red-600 hover:underline">
              Delete this form and its submission log
            </button>
          </form>
        </section>

        <section className="rounded-brand border bg-white p-6">
          <h2 className="font-semibold text-foreground">
            Recent submissions ({form.submission_count} total)
          </h2>
          <ul className="mt-3 divide-y text-sm">
            {submissions.map((s) => (
              <li key={s.id} className="py-2">
                <span
                  className={
                    s.status === "ok" ? "text-green-600" : "text-red-600"
                  }
                >
                  {s.status === "ok" ? "✓" : "✗"}
                </span>{" "}
                <span className="text-muted-foreground">
                  {new Date(s.created_at * 1000).toLocaleString()}
                </span>{" "}
                <code className="text-foreground">{s.data}</code>
                {s.error && (
                  <div className="text-xs text-red-500">{s.error}</div>
                )}
              </li>
            ))}
            {submissions.length === 0 && (
              <li className="py-2 text-muted-foreground">
                Nothing yet — POST to the endpoint above to test.
              </li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
