import Database from "better-sqlite3";
import path from "path";
import { Resume } from "./schema";

const globalForDb = globalThis as unknown as { _tcDb?: Database.Database };

const db =
  globalForDb._tcDb ?? new Database(path.join(process.cwd(), "tailorcv.db"));
globalForDb._tcDb = db;

db.pragma("busy_timeout = 5000");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS login_tokens (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    full_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    links TEXT NOT NULL DEFAULT '[]',
    intake TEXT NOT NULL DEFAULT '',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    org TEXT NOT NULL DEFAULT '',
    dates TEXT NOT NULL DEFAULT '',
    facts TEXT NOT NULL DEFAULT '[]',
    skills TEXT NOT NULL DEFAULT '[]',
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    jd_text TEXT,
    research TEXT,
    changes TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'ready',
    error TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,
    application_id INTEGER REFERENCES applications(id),
    content TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'logged',
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_suggestions_user ON suggestions(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id);
  CREATE INDEX IF NOT EXISTS idx_apps_user ON applications(user_id);
  CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);
  CREATE INDEX IF NOT EXISTS idx_resumes_app ON resumes(application_id);
`);

// Lightweight migrations for columns added after first release
for (const sql of [
  "ALTER TABLE applications ADD COLUMN jd_url TEXT",
  "ALTER TABLE login_tokens ADD COLUMN ip TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN google_sub TEXT",
  "ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN picture TEXT NOT NULL DEFAULT ''",
]) {
  try {
    db.exec(sql);
  } catch {
    /* column already exists */
  }
}
db.exec("CREATE INDEX IF NOT EXISTS idx_login_tokens_email ON login_tokens(email, created_at)");
db.exec("CREATE INDEX IF NOT EXISTS idx_login_tokens_ip ON login_tokens(ip, created_at)");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub)");

export interface User {
  id: number;
  email: string;
  google_sub: string | null;
  name: string;
  picture: string;
  created_at: number;
}

export interface Profile {
  user_id: number;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  links: string; // JSON ResumeLink[]
  intake: string;
  created_at: number;
  updated_at: number;
}

export interface Entry {
  id: number;
  user_id: number;
  kind: "job" | "project" | "education" | "activity" | "skill";
  title: string;
  org: string;
  dates: string;
  facts: string; // JSON string[]
  skills: string; // JSON string[]
  position: number;
  created_at: number;
}

export interface Application {
  id: number;
  user_id: number;
  company: string;
  role: string;
  jd_text: string | null;
  jd_url: string | null;
  research: string | null;
  changes: string; // JSON string[]
  status: "generating" | "ready" | "error";
  error: string | null;
  created_at: number;
}

export interface ResumeRow {
  id: number;
  user_id: number;
  kind: "master" | "tailored";
  application_id: number | null;
  content: string; // JSON Resume
  created_at: number;
  updated_at: number;
}

export interface Suggestion {
  id: number;
  user_id: number;
  kind: "add_bullet" | "reword_bullet" | "add_skill" | "add_activity" | "note";
  payload: string; // JSON SuggestionPayload
  reason: string;
  status: "pending" | "accepted" | "skipped" | "stale";
  created_at: number;
}

export interface SuggestionPayload {
  section: "experience" | "projects" | "education" | "";
  index: number;
  bullet_index: number;
  old_text: string;
  new_text: string;
  skill_category: string;
  skill_item: string;
  activity_title: string;
  activity_detail: string;
  activity_dates: string;
}

export function parseResume(row: ResumeRow): Resume {
  return JSON.parse(row.content) as Resume;
}

export function getMasterResume(userId: number): ResumeRow | undefined {
  return db
    .prepare("SELECT * FROM resumes WHERE user_id = ? AND kind = 'master'")
    .get(userId) as ResumeRow | undefined;
}

export function getLibrary(userId: number): Entry[] {
  return db
    .prepare("SELECT * FROM entries WHERE user_id = ? ORDER BY position, id")
    .all(userId) as Entry[];
}

/** The library serialized for prompts: the model's only source of facts. */
export function libraryAsText(entries: Entry[]): string {
  return entries
    .map((e) => {
      const facts = (JSON.parse(e.facts) as string[])
        .map((f) => `  - ${f}`)
        .join("\n");
      const skills = (JSON.parse(e.skills) as string[]).join(", ");
      return `[${e.kind}] ${e.title}${e.org ? ` @ ${e.org}` : ""}${e.dates ? ` (${e.dates})` : ""}\n${facts}${skills ? `\n  skills: ${skills}` : ""}`;
    })
    .join("\n\n");
}

export default db;
