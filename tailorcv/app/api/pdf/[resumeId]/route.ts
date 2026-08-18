import { NextRequest, NextResponse } from "next/server";
import db, { Application, ResumeRow } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { printKey, renderResumePdf } from "@/lib/pdf";
import { baseUrl } from "@/lib/email";

/** Session-authenticated PDF download of any resume the user owns. */
export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/pdf/[resumeId]">
) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { resumeId } = await ctx.params;
  const row = db
    .prepare("SELECT * FROM resumes WHERE id = ? AND user_id = ?")
    .get(Number(resumeId), user.id) as ResumeRow | undefined;
  if (!row) return new NextResponse("Not found", { status: 404 });

  const printUrl = `${baseUrl()}/print/${row.id}?key=${printKey(row)}`;
  let pdf: Buffer;
  try {
    pdf = await renderResumePdf(printUrl);
  } catch (e) {
    console.error("PDF render failed:", e);
    return new NextResponse(
      "PDF rendering unavailable (is Chromium installed? npx playwright install chromium)",
      { status: 503 }
    );
  }

  let name = "resume";
  if (row.application_id) {
    const app = db
      .prepare("SELECT company, role FROM applications WHERE id = ?")
      .get(row.application_id) as Pick<Application, "company" | "role"> | undefined;
    if (app) name = `${app.company}-${app.role}`;
  } else {
    name = "master-resume";
  }
  const safe = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safe}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
