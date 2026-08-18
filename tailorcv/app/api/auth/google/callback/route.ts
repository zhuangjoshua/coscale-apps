import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { completeGoogleLogin } from "@/lib/google";
import { createSession } from "@/lib/session";

/** Google sends the user back here; we verify, create the session, and route. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") || "";
  const state = req.nextUrl.searchParams.get("state") || "";
  if (req.nextUrl.searchParams.get("error") || !code) {
    return NextResponse.redirect(new URL("/login?error=google", req.url));
  }
  try {
    const { user } = await completeGoogleLogin(code, state);
    await createSession(user.id);
    const hasProfile = db.prepare("SELECT 1 FROM profiles WHERE user_id = ?").get(user.id);
    return NextResponse.redirect(new URL(hasProfile ? "/dashboard" : "/onboard", req.url));
  } catch (e) {
    console.error("Google login failed:", e);
    return NextResponse.redirect(new URL("/login?error=google", req.url));
  }
}
