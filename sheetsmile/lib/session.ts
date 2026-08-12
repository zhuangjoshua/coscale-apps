import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import db, { User } from "./db";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "dev-secret-change-me"
);

const COOKIE_NAME = "sm_session";

export async function createSession(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
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
