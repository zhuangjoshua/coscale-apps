import crypto from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { cookies } from "next/headers";
import db, { User } from "./db";
import { baseUrl } from "./email";

/**
 * Google login (OpenID Connect, Authorization Code + PKCE).
 * The only sign-in method in production. Needs GOOGLE_CLIENT_ID and
 * GOOGLE_CLIENT_SECRET; the redirect URI registered in Google Cloud must be
 * `${APP_URL}/api/auth/google/callback`.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const STATE_COOKIE = "tc_oauth";
const STATE_TTL = 60 * 10; // 10 minutes to complete the Google screen

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(): string {
  return `${baseUrl()}/api/auth/google/callback`;
}

/** Build the Google consent URL and stash state + PKCE verifier in a cookie. */
export async function beginGoogleLogin(intent: string): Promise<string> {
  const state = crypto.randomBytes(16).toString("base64url");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

  const store = await cookies();
  store.set(STATE_COOKIE, JSON.stringify({ state, verifier, intent }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_TTL,
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params}`;
}

export interface GoogleLoginResult {
  user: User;
  intent: string;
}

/**
 * Finish the flow: check state, exchange the code, verify the ID token,
 * upsert the user. Throws on any mismatch — the caller turns that into a
 * redirect to /login?error=google.
 */
export async function completeGoogleLogin(
  code: string,
  state: string
): Promise<GoogleLoginResult> {
  const store = await cookies();
  const raw = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  if (!raw) throw new Error("Login session expired — please try again");
  const saved = JSON.parse(raw) as { state: string; verifier: string; intent: string };
  if (!state || saved.state !== state) throw new Error("State mismatch");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: saved.verifier,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("Google returned no ID token");

  const { payload } = await jwtVerify(tokens.id_token, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: process.env.GOOGLE_CLIENT_ID!,
  });
  const sub = String(payload.sub || "");
  const email = String(payload.email || "").toLowerCase();
  if (!sub || !email || payload.email_verified !== true) {
    throw new Error("Google account has no verified email");
  }
  const name = typeof payload.name === "string" ? payload.name : "";
  const picture = typeof payload.picture === "string" ? payload.picture : "";

  return { user: upsertGoogleUser({ sub, email, name, picture }), intent: saved.intent };
}

function upsertGoogleUser(g: { sub: string; email: string; name: string; picture: string }): User {
  // Match by Google id first, then by email (accounts created before Google
  // login existed, or via the dev fallback), else create.
  let user =
    (db.prepare("SELECT * FROM users WHERE google_sub = ?").get(g.sub) as User | undefined) ??
    (db.prepare("SELECT * FROM users WHERE email = ?").get(g.email) as User | undefined);
  if (user) {
    db.prepare(
      "UPDATE users SET google_sub = ?, email = ?, name = ?, picture = ? WHERE id = ?"
    ).run(g.sub, g.email, g.name, g.picture, user.id);
  } else {
    const res = db
      .prepare("INSERT INTO users (email, google_sub, name, picture) VALUES (?, ?, ?, ?)")
      .run(g.email, g.sub, g.name, g.picture);
    user = { id: res.lastInsertRowid as number } as User;
  }
  return db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as User;
}
