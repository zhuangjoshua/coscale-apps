/**
 * Google sign-in for the standalone deployment.
 *
 * Server-side authorization-code flow, chosen over Google's browser SDK so the page
 * loads no third-party script: the browser is redirected to Google, Google redirects
 * back with a code, and the exchange happens server to server. We verify the returned
 * ID token against Google's JWKS and mint our own session JWT.
 */

import crypto from "node:crypto";

const GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const SESSION_SECRET = process.env.PAGEWRIGHT_SESSION_SECRET ?? "";
export const SESSION_TTL_SECONDS = Number(process.env.PAGEWRIGHT_SESSION_TTL ?? 7 * 24 * 3600);

export const googleConfigured = (): boolean =>
  Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && SESSION_SECRET);

export function missingGoogleConfig(): string[] {
  return [
    GOOGLE_CLIENT_ID ? null : "GOOGLE_CLIENT_ID",
    GOOGLE_CLIENT_SECRET ? null : "GOOGLE_CLIENT_SECRET",
    SESSION_SECRET ? null : "PAGEWRIGHT_SESSION_SECRET",
  ].filter((v): v is string => Boolean(v));
}

/** Signed, expiring state parameter — CSRF protection for the redirect round trip. */
export function signState(returnTo: string): string {
  const body = b64urlEncode(JSON.stringify({ returnTo, exp: Date.now() + 10 * 60_000 }));
  const mac = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function readState(state: string): { returnTo: string } | null {
  const [body, mac] = String(state).split(".");
  if (!body || !mac) return null;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  if (expected.length !== mac.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(mac))) return null;
  try {
    const parsed = JSON.parse(b64urlDecode(body).toString("utf8")) as { returnTo?: string; exp?: number };
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return { returnTo: typeof parsed.returnTo === "string" ? parsed.returnTo : "/app" };
  } catch {
    return null;
  }
}

export function authorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/** Exchanges the authorization code for tokens, server to server. */
export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const resp = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const body = (await resp.json()) as { id_token?: string; error_description?: string; error?: string };
  if (!resp.ok || !body.id_token) {
    throw new Error(body.error_description || body.error || `Token exchange failed (${resp.status})`);
  }
  return body.id_token;
}

const b64urlEncode = (input: Buffer | string): string =>
  Buffer.from(input).toString("base64url");

const b64urlDecode = (input: string): Buffer => Buffer.from(input, "base64url");

interface Jwk { kid?: string; [key: string]: unknown }

let jwksCache: { fetchedAt: number; keys: Jwk[] } | null = null;

async function googleKeys(): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < 60 * 60_000) return jwksCache.keys;
  const resp = await fetch(GOOGLE_JWKS);
  if (!resp.ok) throw new Error(`Google JWKS fetch failed (${resp.status})`);
  const body = (await resp.json()) as { keys?: Jwk[] };
  jwksCache = { fetchedAt: Date.now(), keys: body.keys ?? [] };
  return jwksCache.keys;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

/** Verifies a Google ID token end to end. Throws with a specific reason on failure. */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed ID token");

  const header = JSON.parse(b64urlDecode(parts[0]).toString("utf8")) as Record<string, unknown>;
  const payload = JSON.parse(b64urlDecode(parts[1]).toString("utf8")) as Record<string, unknown>;

  const key = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!key) throw new Error("Unknown signing key");

  const publicKey = crypto.createPublicKey({ key: key as crypto.JsonWebKey, format: "jwk" });
  const ok = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    b64urlDecode(parts[2]),
  );
  if (!ok) throw new Error("Invalid signature");

  if (!GOOGLE_ISSUERS.has(String(payload.iss))) throw new Error("Unexpected issuer");
  if (String(payload.aud) !== GOOGLE_CLIENT_ID) throw new Error("Token was not issued for this app");
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) throw new Error("Token expired");
  if (payload.email_verified === false) throw new Error("Google account email is not verified");

  const sub = String(payload.sub ?? "");
  const email = String(payload.email ?? "");
  if (!sub) throw new Error("Token carries no subject");

  return {
    sub,
    email,
    name: typeof payload.name === "string" ? payload.name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}

/** Our own session token — HS256, verified by src/auth.ts on every request. */
export function mintSessionToken(identity: GoogleIdentity): string {
  if (!SESSION_SECRET) throw new Error("PAGEWRIGHT_SESSION_SECRET is not set");
  const header = b64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64urlEncode(
    JSON.stringify({
      sub: `google:${identity.sub}`,
      email: identity.email,
      name: identity.name,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    }),
  );
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}
