import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { consumeLoginToken, createSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  // Dev-only email fallback; see requestLogin.
  const { googleConfigured } = await import("@/lib/google");
  if (googleConfigured() || process.env.NODE_ENV === "production") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const token = req.nextUrl.searchParams.get("token");
  const user = token ? consumeLoginToken(token) : null;

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=expired", req.url));
  }

  await createSession(user.id);
  const hasProfile = db
    .prepare("SELECT 1 FROM profiles WHERE user_id = ?")
    .get(user.id);
  return NextResponse.redirect(new URL(hasProfile ? "/dashboard" : "/onboard", req.url));
}
