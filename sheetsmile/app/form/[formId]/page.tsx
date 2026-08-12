import { notFound } from "next/navigation";
import db, { Form } from "@/lib/db";
import { parseSchema, fieldName } from "@/lib/formschema";

export const dynamic = "force-dynamic";

export default async function HostedForm({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  const form = db.prepare("SELECT * FROM forms WHERE id = ?").get(formId) as
    | Form
    | undefined;
  if (!form) notFound();

  const schema = parseSchema(form.schema);
  if (!schema) notFound(); // only forms built with the builder have a hosted page

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const endpoint = `${appUrl}/f/${form.id}`;
  const hasFile = schema.fields.some((f) => f.type === "file");

  const isClosed =
    form.max_submissions !== null &&
    form.submission_count >= form.max_submissions;
  if (isClosed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-muted px-4">
        <div className="mx-auto max-w-lg rounded-xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-foreground">{schema.title}</h1>
          <p className="mt-3 text-muted-foreground">
            This form is closed — all {form.max_submissions} spots have been
            taken. Thanks for your interest!
          </p>
        </div>
      </main>
    );
  }

  const showBar = form.show_counter === 1 && form.max_submissions !== null;
  const spotsTaken = form.submission_count;
  const spotsPct = form.max_submissions
    ? Math.min(100, Math.round((spotsTaken / form.max_submissions) * 100))
    : 0;

  const inputClass =
    "mt-1 w-full rounded-brand border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none";

  return (
    <main className="min-h-screen bg-muted px-4 py-12">
      <div className="mx-auto max-w-lg">
        <form
          action={endpoint}
          method="POST"
          encType={hasFile ? "multipart/form-data" : undefined}
          className="rounded-xl border bg-white p-8 shadow-sm"
        >
          <h1 className="text-2xl font-bold text-foreground">{schema.title}</h1>
          {schema.description && (
            <p className="mt-2 text-sm text-muted-foreground">{schema.description}</p>
          )}

          {showBar && (
            <div className="mt-4">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>
                  {spotsTaken} of {form.max_submissions} spots taken
                </span>
                <span>{form.max_submissions! - spotsTaken} left</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${spotsPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-6 space-y-5">
            {schema.fields.map((f) => {
              const name = fieldName(f);
              if (f.type === "hidden") {
                return (
                  <input
                    key={f.id}
                    type="hidden"
                    name={name}
                    value={f.value ?? ""}
                  />
                );
              }
              return (
                <div key={f.id}>
                  <label className="block text-sm font-medium text-foreground">
                    {f.label}
                    {f.required && <span className="text-red-500"> *</span>}
                  </label>
                  {f.instructions && (
                    <p className="text-xs text-muted-foreground">{f.instructions}</p>
                  )}
                  {f.type === "paragraph" ? (
                    <textarea
                      name={name}
                      placeholder={f.placeholder}
                      required={f.required}
                      rows={4}
                      className={inputClass}
                    />
                  ) : f.type === "dropdown" ? (
                    <select name={name} required={f.required} className={inputClass}>
                      <option value="">Choose…</option>
                      {(f.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "multiple_choice" ? (
                    <div className="mt-1 space-y-1">
                      {(f.options ?? []).map((opt) => (
                        <label
                          key={opt}
                          className="flex items-center gap-2 text-sm text-[#3d3a35]"
                        >
                          <input
                            type="radio"
                            name={name}
                            value={opt}
                            required={f.required}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : f.type === "checkbox" ? (
                    <input
                      type="checkbox"
                      name={name}
                      value="yes"
                      required={f.required}
                      className="mt-1"
                    />
                  ) : f.type === "file" ? (
                    <input
                      type="file"
                      name={name}
                      required={f.required}
                      className="mt-1 w-full text-sm"
                    />
                  ) : (
                    <input
                      type={
                        f.type === "phone"
                          ? "tel"
                          : f.type === "text"
                            ? "text"
                            : f.type
                      }
                      name={name}
                      placeholder={f.placeholder}
                      required={f.required}
                      className={inputClass}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <input
            type="text"
            name="_gotcha"
            style={{ display: "none" }}
            tabIndex={-1}
            autoComplete="off"
          />
          <button
            type="submit"
            className="mt-8 w-full rounded-full bg-primary px-4 py-2.5 font-medium text-white hover:bg-primary-dark"
          >
            {schema.submitLabel || "Submit"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-gray-400">
          Powered by SheetSmile
        </p>
      </div>
    </main>
  );
}
