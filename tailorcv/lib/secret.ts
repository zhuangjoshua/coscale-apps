/**
 * The one secret behind session JWTs and print-view HMAC keys.
 * A dev default keeps `npm run dev` keyless; production must set it — a
 * known default would let anyone mint a session for any user id.
 */
export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set (>=16 chars) in production — e.g. `openssl rand -base64 32`"
    );
  }
  return "dev-secret-change-me";
}
