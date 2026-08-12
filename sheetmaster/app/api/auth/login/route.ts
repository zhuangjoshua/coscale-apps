import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { oauthClient, SCOPES } from "@/lib/google";

export async function GET() {
  const state = randomBytes(16).toString("hex");
  const url = oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // ensures a refresh_token is issued every time
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
