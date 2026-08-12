import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { spaResponse } from "@/lib/spa";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (user) {
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/dashboard`);
  }
  return spaResponse();
}
