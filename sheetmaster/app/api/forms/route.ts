import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { createSpreadsheet, parseSpreadsheetId } from "@/lib/google";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.formData();
  const name = String(body.get("name") || "").trim();
  const sheetInput = String(body.get("spreadsheet") || "");
  // Tab name only applies to user-provided sheets; auto-created ones are always Sheet1
  const sheetName =
    sheetInput.trim() === ""
      ? "Sheet1"
      : String(body.get("sheet_name") || "Sheet1").trim() || "Sheet1";
  const redirectUrl = String(body.get("redirect_url") || "").trim() || null;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Empty sheet field → create a fresh spreadsheet in the user's account
  let spreadsheetId: string | null;
  if (sheetInput.trim() === "") {
    try {
      spreadsheetId = await createSpreadsheet(
        user,
        `${name} — submissions`
      );
    } catch {
      return NextResponse.json(
        { error: "Could not create a spreadsheet in your Google account" },
        { status: 502 }
      );
    }
  } else {
    spreadsheetId = parseSpreadsheetId(sheetInput);
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "That doesn't look like a Google Sheet URL" },
        { status: 400 }
      );
    }
  }

  const id = randomBytes(8).toString("hex");
  db.prepare(
    `INSERT INTO forms (id, user_id, name, spreadsheet_id, sheet_name, redirect_url)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, user.id, name, spreadsheetId, sheetName, redirectUrl);

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  return NextResponse.redirect(`${appUrl}/dashboard/${id}`, { status: 303 });
}
