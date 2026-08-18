import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { LANDING_HTML } from "./_site/html";

export const dynamic = "force-dynamic";

/** Public landing. Signed-in users skip straight to their dashboard. */
export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  return <main dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />;
}
