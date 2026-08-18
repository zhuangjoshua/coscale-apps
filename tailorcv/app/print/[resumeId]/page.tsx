import db, { ResumeRow, parseResume } from "@/lib/db";
import ResumeView from "@/components/ResumeView";
import { printKey } from "@/lib/pdf";

export const dynamic = "force-dynamic";

/**
 * Standalone print view, loaded by the PDF renderer. Guarded by an HMAC key
 * minted only by session-checked code (the PDF route and resume pages).
 */
export default async function PrintResume(props: PageProps<"/print/[resumeId]">) {
  const { resumeId } = await props.params;
  const search = await props.searchParams;
  const key = typeof search.key === "string" ? search.key : "";

  const row = db
    .prepare("SELECT * FROM resumes WHERE id = ?")
    .get(Number(resumeId)) as ResumeRow | undefined;

  if (!row || key !== printKey(row)) {
    return <p className="p-8 text-sm">Not found.</p>;
  }

  return <ResumeView resume={parseResume(row)} />;
}
