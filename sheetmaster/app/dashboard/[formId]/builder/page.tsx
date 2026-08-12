import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import db, { Form } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { parseSchema, FormSchema } from "@/lib/formschema";
import Builder from "./Builder";

export const dynamic = "force-dynamic";

export default async function BuilderPage({
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

  const schema: FormSchema = parseSchema(form.schema) ?? {
    title: form.name,
    description: "",
    submitLabel: "Submit",
    fields: [],
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <Link
          href={`/dashboard/${form.id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to form
        </Link>
        <span className="text-sm text-gray-500">Form Builder · {form.name}</span>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Builder formId={form.id} initialSchema={schema} />
      </div>
    </main>
  );
}
