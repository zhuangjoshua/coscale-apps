import Link from "next/link";
import { redirect } from "next/navigation";
import db, { Form } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import NewFormFields from "./NewFormFields";
import AppHeader from "@/app/AppHeader";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/");

  const forms = db
    .prepare("SELECT * FROM forms WHERE user_id = ? ORDER BY created_at DESC")
    .all(user.id) as Form[];

  return (
    <main className="min-h-screen bg-[#faf9f7]">
      <AppHeader email={user.email} active="dashboard" />

      <div className="mx-auto max-w-3xl px-4 py-10">
        {user.grant_broken === 1 && (
          <div className="mb-6 rounded-brand border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Google connection broken.</strong> We can no longer write
            to your sheets — submissions are failing. This happens if you
            revoked access or changed your password.{" "}
            <a href="/api/auth/login?consent=1" className="font-medium underline">
              Reconnect Google
            </a>
          </div>
        )}
        <h1 className="text-2xl font-bold text-foreground">Your forms</h1>

        <ul className="mt-6 space-y-3">
          {forms.map((f) => (
            <li key={f.id}>
              <Link
                href={`/dashboard/${f.id}`}
                className="group block rounded-brand border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground group-hover:text-primary">
                    {f.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {f.submission_count} submissions
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                  <span>/f/{f.id}</span>
                  <span className="font-medium text-primary">
                    Manage{" "}
                    <span className="inline-block transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </span>
                </div>
              </Link>
            </li>
          ))}
          {forms.length === 0 && (
            <li className="text-muted-foreground">No forms yet — create one below.</li>
          )}
        </ul>

        <h2 className="mt-12 text-2xl font-bold text-foreground">
          Create a New Form
        </h2>
        <form
          action="/api/forms"
          method="POST"
          className="mt-6 rounded-brand border bg-white p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-[#3d3a35]">
              Form name
            </label>
            <input
              name="name"
              required
              placeholder="Newsletter signup"
              className="mt-1 w-full rounded-brand border px-3 py-2 text-sm"
            />
          </div>
          <NewFormFields />
          <button className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
            Create form
          </button>
        </form>
      </div>
    </main>
  );
}
