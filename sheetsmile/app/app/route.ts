import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// The marketing SPA's "Get Started" CTAs point at /app — route them into the
// real product: dashboard when signed in, Google sign-in otherwise.
export async function GET() {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const user = await getSessionUser();
  return NextResponse.redirect(
    user ? `${appUrl}/dashboard` : `${appUrl}/api/auth/login`
  );
}
