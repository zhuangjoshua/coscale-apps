import crypto from "crypto";
import { sessionSecret } from "./secret";

/**
 * The print-view key: proves the PDF renderer (or a session-checked link)
 * minted the URL. Session auth happens in the PDF route; this keeps the
 * bare /print URL from being guessable.
 */
export function printKey(row: {
  id: number;
  user_id: number;
  created_at: number;
}) {
  return crypto
    .createHmac("sha256", sessionSecret())
    .update(`${row.id}:${row.user_id}:${row.created_at}`)
    .digest("base64url")
    .slice(0, 24);
}

/** Renders the print view to a PDF buffer with headless Chromium. */
export async function renderResumePdf(printUrl: string): Promise<Buffer> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(printUrl, { waitUntil: "networkidle" });
    return await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
  } finally {
    await browser.close();
  }
}
