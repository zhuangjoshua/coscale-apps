import { google } from "googleapis";
import db, { User } from "./db";

export const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
];

export function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL || "http://localhost:3000"}/api/auth/callback`
  );
}

/**
 * Returns an OAuth2 client with a valid access token for this user,
 * refreshing (and persisting) it if expired or near expiry.
 */
export async function authedClient(user: User) {
  const client = oauthClient();
  client.setCredentials({
    access_token: user.access_token,
    refresh_token: user.refresh_token,
    expiry_date: user.token_expiry ?? undefined,
  });

  const nearExpiry =
    !user.token_expiry || user.token_expiry < Date.now() + 60_000;
  if (nearExpiry) {
    if (!user.refresh_token) {
      markGrantBroken(user.id);
      throw new Error("no_refresh_token");
    }
    try {
      const { credentials } = await client.refreshAccessToken();
      client.setCredentials(credentials);
      db.prepare(
        "UPDATE users SET access_token = ?, token_expiry = ?, grant_broken = 0 WHERE id = ?"
      ).run(credentials.access_token, credentials.expiry_date, user.id);
    } catch (err) {
      // invalid_grant = user revoked access or token expired permanently
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("invalid_grant")) markGrantBroken(user.id);
      throw err;
    }
  }

  return client;
}

function markGrantBroken(userId: number) {
  db.prepare("UPDATE users SET grant_broken = 1 WHERE id = ?").run(userId);
}

/** Extracts a spreadsheet ID from a full URL or returns the input if already an ID. */
export function parseSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Creates a new spreadsheet in the user's account and returns its ID.
 * The sheet is owned by the user — we only hold the ID.
 */
export async function createSpreadsheet(
  user: User,
  title: string
): Promise<string> {
  const client = await authedClient(user);
  const sheets = google.sheets({ version: "v4", auth: client });
  const res = await sheets.spreadsheets.create({
    requestBody: { properties: { title } },
    fields: "spreadsheetId",
  });
  return res.data.spreadsheetId!;
}

/**
 * Uploads a file to the owner's Drive (in a "SheetSmile Uploads" folder)
 * and returns a shareable link to put in the cell.
 */
export async function uploadFile(
  user: User,
  file: File
): Promise<string> {
  const client = await authedClient(user);
  const drive = google.drive({ version: "v3", auth: client });

  // Find or create the uploads folder
  const list = await drive.files.list({
    q: "name = 'SheetSmile Uploads' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: "files(id)",
    pageSize: 1,
  });
  let folderId = list.data.files?.[0]?.id;
  if (!folderId) {
    const folder = await drive.files.create({
      requestBody: {
        name: "SheetSmile Uploads",
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });
    folderId = folder.data.id!;
  }

  const { Readable } = await import("stream");
  const buffer = Buffer.from(await file.arrayBuffer());
  const created = await drive.files.create({
    requestBody: { name: file.name || "upload", parents: [folderId] },
    media: {
      mimeType: file.type || "application/octet-stream",
      body: Readable.from(buffer),
    },
    fields: "id, webViewLink",
  });
  return created.data.webViewLink ?? `https://drive.google.com/file/d/${created.data.id}/view`;
}

/**
 * Appends one submission as a row, mapping incoming field names to the
 * sheet's header row. Unknown fields become new columns; a missing header
 * row is created from the submission's fields. "Submitted At" is always set.
 */
export async function appendSubmission(
  user: User,
  spreadsheetId: string,
  sheetName: string,
  fields: Record<string, string>
) {
  const client = await authedClient(user);
  const sheets = google.sheets({ version: "v4", auth: client });

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  });
  let headers: string[] = (headerRes.data.values?.[0] ?? []).map(String);

  const incoming: Record<string, string> = {
    "Submitted At": new Date().toISOString(),
    ...fields,
  };
  const newCols = Object.keys(incoming).filter((k) => !headers.includes(k));

  if (newCols.length > 0) {
    headers = [...headers, ...newCols];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!1:1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }

  const row = headers.map((h) => incoming[h] ?? "");
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}
