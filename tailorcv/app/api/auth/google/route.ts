import { NextRequest, NextResponse } from "next/server";
import { beginGoogleLogin, googleConfigured } from "@/lib/google";

/** Start Google login. `?intent=start` is carried through to the callback. */
export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_unconfigured", req.url));
  }
  const intent = req.nextUrl.searchParams.get("intent") === "start" ? "start" : "";
  const url = await beginGoogleLogin(intent);
  return NextResponse.redirect(url);
}
