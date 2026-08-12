import { NextRequest, NextResponse } from "next/server";
import db, { Form } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { FormSchema } from "@/lib/formschema";

const MAX_FIELDS = 50;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { formId } = await params;
  const form = db
    .prepare("SELECT * FROM forms WHERE id = ? AND user_id = ?")
    .get(formId, user.id) as Form | undefined;
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let schema: FormSchema;
  try {
    schema = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof schema.title !== "string" ||
    !Array.isArray(schema.fields) ||
    schema.fields.length > MAX_FIELDS
  ) {
    return NextResponse.json({ error: "Invalid schema" }, { status: 400 });
  }

  db.prepare("UPDATE forms SET schema = ? WHERE id = ?").run(
    JSON.stringify(schema),
    form.id
  );
  return NextResponse.json({ ok: true });
}
