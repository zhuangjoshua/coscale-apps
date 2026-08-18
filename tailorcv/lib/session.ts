import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import crypto from "crypto";
import db, { User } from "./db";
import { sessionSecret } from "./secret";

const secret = new TextEncoder().encode(sessionSecret());

const COOKIE_NAME = "tc_session";
const LOGIN_TOKEN_TTL = 60 * 20; // 20 minutes

export async function createSession(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    const user = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(payload.uid as number) as User | undefined;
    return user ?? null;
  } catch {
    return null;
  }
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

const LOGIN_MAX_PER_EMAIL = 3; // links per email per hour
const LOGIN_MAX_PER_IP = 20; // links per IP per hour

/**
 * Throttle magic-link requests so the endpoint can't be used to spam an
 * inbox or burn email quota. Returns false when over the limit.
 */
export function loginRateLimitOk(email: string, ip: string): boolean {
  const since = Math.floor(Date.now() / 1000) - 3600;
  const byEmail = db
    .prepare("SELECT COUNT(*) AS n FROM login_tokens WHERE email = ? AND created_at > ?")
    .get(email, since) as { n: number };
  if (byEmail.n >= LOGIN_MAX_PER_EMAIL) return false;
  if (ip) {
    const byIp = db
      .prepare("SELECT COUNT(*) AS n FROM login_tokens WHERE ip = ? AND created_at > ?")
      .get(ip, since) as { n: number };
    if (byIp.n >= LOGIN_MAX_PER_IP) return false;
  }
  return true;
}

/** Issues a single-use magic-link token for `email`. */
export function createLoginToken(email: string, ip = "") {
  // Opportunistic cleanup so the table doesn't grow forever.
  db.prepare("DELETE FROM login_tokens WHERE expires_at < ?").run(
    Math.floor(Date.now() / 1000) - 3600 // keep 1h past expiry for rate-limit counts
  );
  const token = crypto.randomBytes(32).toString("base64url");
  db.prepare(
    "INSERT INTO login_tokens (token, email, expires_at, ip) VALUES (?, ?, ?, ?)"
  ).run(token, email, Math.floor(Date.now() / 1000) + LOGIN_TOKEN_TTL, ip);
  return token;
}

/** Consumes a magic-link token; creates the account on first login. */
export function consumeLoginToken(token: string): User | null {
  const row = db
    .prepare("SELECT * FROM login_tokens WHERE token = ?")
    .get(token) as
    | { token: string; email: string; expires_at: number; used: number }
    | undefined;
  if (!row || row.expires_at < Math.floor(Date.now() / 1000)) return null;

  // Atomic claim: two concurrent clicks on the same link can't both win.
  const claimed = db
    .prepare("UPDATE login_tokens SET used = 1 WHERE token = ? AND used = 0")
    .run(token);
  if (claimed.changes !== 1) return null;

  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(row.email) as
    | User
    | undefined;
  if (!user) {
    const res = db.prepare("INSERT INTO users (email) VALUES (?)").run(row.email);
    user = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(res.lastInsertRowid as number) as User;
  }
  return user;
}
