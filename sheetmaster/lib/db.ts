import Database from "better-sqlite3";
import path from "path";

const globalForDb = globalThis as unknown as { _smDb?: Database.Database };

const db =
  globalForDb._smDb ??
  new Database(path.join(process.cwd(), "sheetmaster.db"));
globalForDb._smDb = db;

db.pragma("busy_timeout = 5000");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_sub TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS forms (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    spreadsheet_id TEXT NOT NULL,
    sheet_name TEXT NOT NULL DEFAULT 'Sheet1',
    redirect_url TEXT,
    submission_count INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id TEXT NOT NULL REFERENCES forms(id),
    data TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ok',
    error TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );
`);

// Lightweight migrations for columns added after first release
try {
  db.exec("ALTER TABLE forms ADD COLUMN notify_email TEXT");
} catch {
  /* column already exists */
}
try {
  db.exec("ALTER TABLE users ADD COLUMN grant_broken INTEGER DEFAULT 0");
} catch {
  /* column already exists */
}
try {
  db.exec("ALTER TABLE forms ADD COLUMN schema TEXT");
} catch {
  /* column already exists */
}
try {
  db.exec("ALTER TABLE forms ADD COLUMN webhook_url TEXT");
} catch {
  /* column already exists */
}
try {
  db.exec("ALTER TABLE forms ADD COLUMN max_submissions INTEGER");
} catch {
  /* column already exists */
}
try {
  db.exec("ALTER TABLE forms ADD COLUMN show_counter INTEGER DEFAULT 0");
} catch {
  /* column already exists */
}

export interface User {
  id: number;
  google_sub: string;
  email: string;
  name: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: number | null;
  grant_broken: number;
}

export interface Form {
  id: string;
  user_id: number;
  name: string;
  spreadsheet_id: string;
  sheet_name: string;
  redirect_url: string | null;
  notify_email: string | null;
  schema: string | null;
  webhook_url: string | null;
  max_submissions: number | null;
  show_counter: number;
  submission_count: number;
  created_at: number;
}

export interface Submission {
  id: number;
  form_id: string;
  data: string;
  status: string;
  error: string | null;
  created_at: number;
}

export default db;
