import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

export async function GET() {
  await destroySession();
  return NextResponse.redirect(
    `${process.env.APP_URL || "http://localhost:3000"}/`
  );
}
