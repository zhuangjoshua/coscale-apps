import { NextRequest, NextResponse } from "next/server";
import { oauthClient } from "@/lib/google";
import db, { User } from "@/lib/db";
import { createSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  if (!code) return NextResponse.redirect(`${appUrl}/?error=oauth_denied`);

  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("sm_oauth_state")?.value;
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${appUrl}/?error=bad_state`);
  }

  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const idToken = tokens.id_token;
  if (!idToken) return NextResponse.redirect(`${appUrl}/?error=no_id_token`);
  const payload = JSON.parse(
    Buffer.from(idToken.split(".")[1], "base64").toString()
  );

  const existing = db
    .prepare("SELECT * FROM users WHERE google_sub = ?")
    .get(payload.sub) as User | undefined;

  let userId: number;
  if (existing) {
    // Google only returns refresh_token on first consent — keep the old one if absent
    db.prepare(
      `UPDATE users SET email = ?, name = ?, access_token = ?,
       refresh_token = COALESCE(?, refresh_token), token_expiry = ? WHERE id = ?`
    ).run(
      payload.email,
      payload.name ?? null,
      tokens.access_token,
      tokens.refresh_token ?? null,
      tokens.expiry_date,
      existing.id
    );
    userId = existing.id;
  } else {
    const res = db
      .prepare(
        `INSERT INTO users (google_sub, email, name, access_token, refresh_token, token_expiry)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        payload.sub,
        payload.email,
        payload.name ?? null,
        tokens.access_token,
        tokens.refresh_token ?? null,
        tokens.expiry_date
      );
    userId = Number(res.lastInsertRowid);
  }

  await createSession(userId);
  const res = NextResponse.redirect(`${appUrl}/dashboard`);
  res.cookies.delete("sm_oauth_state");
  return res;
}
