/**
 * Viewer identity for the dashboard API.
 *
 * The site is a static SPA authenticated by the Takyon/Supabase rail, so the browser
 * holds a JWT and sends it as `Authorization: Bearer …`. This module turns that token
 * into an account id without taking a dependency on the rail itself.
 *
 * Verification mode is chosen by environment:
 *   PAGEWRIGHT_JWT_SECRET   HS256 shared secret (Supabase "JWT secret")
 *   PAGEWRIGHT_JWKS_URL     RS256 via a JWKS endpoint
 *   neither                 DEV ONLY — the token is decoded but NOT verified
 *
 * Dev mode is loud on purpose: an unverified token means anyone can claim any account.
 */

import crypto from "node:crypto";

export interface Viewer {
  accountId: string;
  email?: string;
  verified: boolean;
}

// PAGEWRIGHT_SESSION_SECRET signs the sessions we mint after Google sign-in;
// PAGEWRIGHT_JWT_SECRET stays supported for an externally issued HS256 token.
const SECRET =
  process.env.PAGEWRIGHT_SESSION_SECRET ?? process.env.PAGEWRIGHT_JWT_SECRET ?? "";
const JWKS_URL = process.env.PAGEWRIGHT_JWKS_URL ?? "";
export const DEV_ACCOUNT = process.env.PAGEWRIGHT_DEV_ACCOUNT ?? "local";

let warned = false;
function warnOnce(): void {
  if (warned) return;
  warned = true;
  console.warn(
    "[pagewright] no PAGEWRIGHT_SESSION_SECRET / PAGEWRIGHT_JWT_SECRET / PAGEWRIGHT_JWKS_URL set — tokens are decoded but NOT verified. Development only.",
  );
}

const b64url = (input: string): Buffer =>
  Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");

interface Jwk {
  kid?: string;
  kty?: string;
  alg?: string;
  [key: string]: unknown;
}

let jwksCache: { fetchedAt: number; keys: Jwk[] } | null = null;

async function jwks(): Promise<Jwk[]> {
  const fresh = jwksCache && Date.now() - jwksCache.fetchedAt < 10 * 60_000;
  if (fresh) return jwksCache!.keys;
  const resp = await fetch(JWKS_URL);
  if (!resp.ok) throw new Error(`JWKS fetch failed (${resp.status})`);
  const body = (await resp.json()) as { keys?: Jwk[] };
  jwksCache = { fetchedAt: Date.now(), keys: body.keys ?? [] };
  return jwksCache.keys;
}

async function verifySignature(
  header: Record<string, unknown>,
  signingInput: string,
  signature: Buffer,
): Promise<boolean> {
  const alg = String(header.alg ?? "");

  if (SECRET && alg === "HS256") {
    const expected = crypto.createHmac("sha256", SECRET).update(signingInput).digest();
    return expected.length === signature.length && crypto.timingSafeEqual(expected, signature);
  }

  if (JWKS_URL && alg.startsWith("RS")) {
    const key = (await jwks()).find((k) => !header.kid || k.kid === header.kid);
    if (!key) return false;
    const publicKey = crypto.createPublicKey({ key: key as crypto.JsonWebKey, format: "jwk" });
    return crypto.verify("RSA-SHA256", Buffer.from(signingInput), publicKey, signature);
  }

  return false;
}

export const SESSION_COOKIE = "pw_session";

/** Minimal cookie reader — avoids a dependency for one header. */
export function cookieValue(header: string | undefined, name: string): string {
  for (const part of (header ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return "";
}

/**
 * Resolves a bearer token or session cookie to a viewer. Returns null when a
 * credential is present but invalid, so callers can distinguish "anonymous" from
 * "bad credentials".
 */
export async function resolveViewer(
  authorization: string | undefined,
  cookieHeader?: string,
): Promise<Viewer | null> {
  const token =
    (authorization ?? "").replace(/^Bearer\s+/i, "").trim() ||
    cookieValue(cookieHeader, SESSION_COOKIE);
  if (!token) {
    if (!SECRET && !JWKS_URL) {
      warnOnce();
      return { accountId: DEV_ACCOUNT, email: undefined, verified: false };
    }
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(b64url(parts[0]).toString("utf8"));
    payload = JSON.parse(b64url(parts[1]).toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;

  let verified = false;
  if (SECRET || JWKS_URL) {
    try {
      verified = await verifySignature(header, `${parts[0]}.${parts[1]}`, b64url(parts[2]));
    } catch (err) {
      console.warn("[pagewright] token verification error:", (err as Error).message);
      verified = false;
    }
    if (!verified) return null;
  } else {
    warnOnce();
  }

  const accountId = String(payload.sub ?? payload.user_id ?? payload.account_id ?? "").trim();
  if (!accountId) return null;

  const email = typeof payload.email === "string" ? payload.email : undefined;
  return { accountId, email, verified };
}
