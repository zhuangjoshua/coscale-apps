import db from "./db";

/** Resend when RESEND_API_KEY is set; console + emails table otherwise. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string;
}) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "TailorCV <onboarding@resend.dev>";

  if (!key) {
    console.log(
      `\n--- email (not sent, no RESEND_API_KEY) ---\nTo: ${opts.to}\nSubject: ${opts.subject}\n\n${opts.body}\n---\n`
    );
    db.prepare(
      "INSERT INTO emails (to_email, subject, body, status) VALUES (?, ?, ?, 'logged')"
    ).run(opts.to, opts.subject, opts.body);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, text: opts.body }),
  });
  db.prepare(
    "INSERT INTO emails (to_email, subject, body, status) VALUES (?, ?, ?, ?)"
  ).run(opts.to, opts.subject, opts.body, res.ok ? "sent" : "error");
}

export function baseUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

/** The public marketing site now lives in this app (app/(marketing)); the
 *  landing is "/". Kept as a helper so brand links stay in one place. */
export function siteUrl() {
  return "/";
}
