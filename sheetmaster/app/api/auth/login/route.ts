import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { oauthClient, SCOPES } from "@/lib/google";

export async function GET(req: NextRequest) {
  const state = randomBytes(16).toString("hex");
  // Default: silent sign-in for returning users (Google skips the consent
  // screen once access is granted). ?consent=1 forces the full screen — used
  // by the "Reconnect Google" banner to guarantee a fresh refresh token.
  const forceConsent = req.nextUrl.searchParams.get("consent") === "1";
  const url = oauthClient().generateAuthUrl({
    access_type: "offline",
    ...(forceConsent ? { prompt: "consent" } : {}),
    scope: SCOPES,
    state,
  });
  const res = NextResponse.redirect(url);
  res.cookies.set("sm_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
