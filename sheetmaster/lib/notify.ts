/**
 * Submission email notifications via Resend's HTTP API (no SDK needed).
 * Silently no-ops when RESEND_API_KEY is not configured.
 */
export async function sendNotification(
  to: string,
  formName: string,
  fields: Record<string, string>
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const rows = Object.entries(fields)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;font-weight:600">${escapeHtml(
          k
        )}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`
    )
    .join("");

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || "SheetSmile <onboarding@resend.dev>",
        to: [to],
        subject: `New submission: ${formName}`,
        html: `<h2>New submission on “${escapeHtml(
          formName
        )}”</h2><table>${rows}</table>`,
      }),
    });
  } catch (err) {
    // Notification failure must never fail the submission
    console.error("notify failed:", err);
  }
}

const MAX_WEBHOOK_VALUE = 300; // keep chat messages readable

/**
 * Posts a submission notice to a Slack or Discord incoming webhook.
 * Payload shape is detected from the URL; anything else gets generic JSON.
 * Failures never affect the submission.
 */
export async function sendWebhook(
  webhookUrl: string,
  formName: string,
  fields: Record<string, string>
) {
  const lines = Object.entries(fields).map(([k, v]) => {
    const val = v.length > MAX_WEBHOOK_VALUE ? v.slice(0, MAX_WEBHOOK_VALUE) + "…" : v;
    return `*${k}:* ${val}`;
  });
  const text = `📥 New submission on *${formName}*\n${lines.join("\n")}`;

  let body: object;
  if (webhookUrl.includes("discord.com/api/webhooks")) {
    // Discord uses `content` and markdown bold with **
    body = { content: text.replace(/\*/g, "**").slice(0, 1900) };
  } else if (webhookUrl.includes("hooks.slack.com")) {
    body = { text };
  } else {
    // Generic webhook: raw JSON payload for custom integrations
    body = { form: formName, fields };
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("webhook failed:", err);
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
