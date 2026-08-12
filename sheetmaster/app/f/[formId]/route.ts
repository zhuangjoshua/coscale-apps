import { NextRequest, NextResponse } from "next/server";
import db, { Form, User } from "@/lib/db";
import { appendSubmission, uploadFile } from "@/lib/google";
import { allowSubmission } from "@/lib/ratelimit";
import { sendNotification, sendWebhook } from "@/lib/notify";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const MAX_FIELDS = 100;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

interface ParsedBody {
  fields: Record<string, string>;
  files: File[];
}

async function parseBody(req: NextRequest): Promise<ParsedBody> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = await req.json();
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      fields[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
    }
    return { fields, files: [] };
  }
  // handles both urlencoded and multipart
  const formData = await req.formData();
  const fields: Record<string, string> = {};
  const files: File[] = [];
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") {
      fields[k] = v;
    } else if (v.size > 0) {
      files.push(v);
      fields[k] = `[uploading: ${v.name}]`; // placeholder replaced after upload
    }
  }
  return { fields, files };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params;
  const form = db.prepare("SELECT * FROM forms WHERE id = ?").get(formId) as
    | Form
    | undefined;
  if (!form) {
    return NextResponse.json(
      { error: "Form not found" },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  // Submission cap: closed forms reject before any parsing or sheet work
  if (
    form.max_submissions !== null &&
    form.submission_count >= form.max_submissions
  ) {
    const accepts = req.headers.get("accept") || "";
    if (!accepts.includes("application/json")) {
      const appUrl = process.env.APP_URL || "http://localhost:3000";
      return NextResponse.redirect(`${appUrl}/closed`, { status: 303 });
    }
    return NextResponse.json(
      { error: "This form is closed — it has reached its submission limit" },
      { status: 403, headers: CORS_HEADERS }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowSubmission(form.id, ip)) {
    return NextResponse.json(
      { error: "Too many submissions, slow down" },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  let parsed: ParsedBody;
  try {
    parsed = await parseBody(req);
  } catch {
    return NextResponse.json(
      { error: "Could not parse request body" },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  const { fields, files } = parsed;

  if (Object.keys(fields).length > MAX_FIELDS) {
    return NextResponse.json(
      { error: "Too many fields" },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File ${f.name} exceeds 10 MB limit` },
        { status: 413, headers: CORS_HEADERS }
      );
    }
  }

  // Special fields (underscore-prefixed) are directives, not data
  const redirectOverride = fields["_redirect"];
  const isSpam = Boolean(fields["_gotcha"]);
  for (const key of Object.keys(fields)) {
    if (key.startsWith("_")) delete fields[key];
  }

  // Honeypot: silently accept but drop submissions that fill the hidden field
  if (isSpam) {
    return respondOk(req, form, redirectOverride);
  }

  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(form.user_id) as User;

  try {
    // Upload files to the owner's Drive, replace placeholders with links
    for (const file of files) {
      const link = await uploadFile(user, file);
      for (const [k, v] of Object.entries(fields)) {
        if (v === `[uploading: ${file.name}]`) fields[k] = link;
      }
    }

    await appendSubmission(user, form.spreadsheet_id, form.sheet_name, fields);
    db.prepare(
      "UPDATE forms SET submission_count = submission_count + 1 WHERE id = ?"
    ).run(form.id);
    db.prepare(
      "INSERT INTO submissions (form_id, data, status) VALUES (?, ?, 'ok')"
    ).run(form.id, JSON.stringify(fields));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    db.prepare(
      "INSERT INTO submissions (form_id, data, status, error) VALUES (?, ?, 'error', ?)"
    ).run(form.id, JSON.stringify(fields), message);
    return NextResponse.json(
      { error: "Failed to write to sheet" },
      { status: 502, headers: CORS_HEADERS }
    );
  }

  if (form.notify_email) {
    // fire-and-forget; never blocks or fails the response
    void sendNotification(form.notify_email, form.name, fields);
  }
  if (form.webhook_url) {
    void sendWebhook(form.webhook_url, form.name, fields);
  }

  return respondOk(req, form, redirectOverride);
}

function respondOk(req: NextRequest, form: Form, redirectOverride?: string) {
  const accepts = req.headers.get("accept") || "";
  const isBrowserFormPost = !accepts.includes("application/json");
  if (isBrowserFormPost) {
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const target = safeRedirect(redirectOverride) || form.redirect_url || `${appUrl}/thanks`;
    return NextResponse.redirect(target, { status: 303 });
  }
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

function safeRedirect(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return url;
  } catch {
    /* invalid URL */
  }
  return null;
}
