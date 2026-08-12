import { NextRequest, NextResponse } from "next/server";
import db, { Form } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

// HTML forms can only POST, so update and delete both come through POST,
// distinguished by the _action field.
export async function POST(
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

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const body = await req.formData();
  const action = String(body.get("_action") || "update");

  if (action === "delete") {
    db.prepare("DELETE FROM submissions WHERE form_id = ?").run(form.id);
    db.prepare("DELETE FROM forms WHERE id = ?").run(form.id);
    return NextResponse.redirect(`${appUrl}/dashboard`, { status: 303 });
  }

  const name = String(body.get("name") || form.name).trim() || form.name;
  const sheetName =
    String(body.get("sheet_name") || form.sheet_name).trim() || form.sheet_name;
  const redirectUrl = String(body.get("redirect_url") || "").trim() || null;
  const notifyEmail = String(body.get("notify_email") || "").trim() || null;
  const webhookUrl = String(body.get("webhook_url") || "").trim() || null;
  const maxRaw = String(body.get("max_submissions") || "").trim();
  const maxSubmissions =
    maxRaw !== "" && /^\d+$/.test(maxRaw) ? parseInt(maxRaw, 10) : null;
  const showCounter = body.get("show_counter") ? 1 : 0;

  db.prepare(
    `UPDATE forms SET name = ?, sheet_name = ?, redirect_url = ?, notify_email = ?,
       webhook_url = ?, max_submissions = ?, show_counter = ?
     WHERE id = ?`
  ).run(
    name,
    sheetName,
    redirectUrl,
    notifyEmail,
    webhookUrl,
    maxSubmissions,
    showCounter,
    form.id
  );

  return NextResponse.redirect(`${appUrl}/dashboard/${form.id}`, {
    status: 303,
  });
}
