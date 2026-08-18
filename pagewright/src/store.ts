/**
 * Flat-file persistence, scoped per account.
 *
 * Every record carries an `accountId`; reads filter by it and writes stamp it, so two
 * signed-in users never see each other's templates, keys or history. A new account is
 * seeded with its own copy of the starter templates on first read.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Template } from "./blocks.js";

export const ROOT = path.resolve(process.cwd());
export const STORAGE = path.join(ROOT, "storage");
export const OUTPUT = path.join(STORAGE, "output");

/** Used by CLI scripts and any render that isn't attributable to a signed-in viewer. */
export const LOCAL_ACCOUNT = "local";

export interface ApiKey {
  id: string;
  accountId: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsedAt?: string;
  calls: number;
}

export interface Job {
  id: string;
  accountId: string;
  templateId: string;
  templateName: string;
  status: "pending" | "success" | "error";
  format: "pdf" | "png" | "jpeg";
  pages?: number;
  bytes?: number;
  ms?: number;
  file?: string;
  error?: string;
  via: "api" | "editor";
  createdAt: string;
}

export type StoredTemplate = Template & { accountId: string };

interface Shape {
  templates: StoredTemplate[];
  keys: ApiKey[];
  jobs: Job[];
}

const FILES: Record<keyof Shape, string> = {
  templates: path.join(STORAGE, "templates.json"),
  keys: path.join(STORAGE, "api-keys.json"),
  jobs: path.join(STORAGE, "jobs.json"),
};

const cache: Partial<Shape> = {};
const writeQueue = new Map<string, Promise<void>>();

export const newId = (prefix: string) =>
  `${prefix}_${crypto.randomBytes(9).toString("base64url")}`;

export const newApiKey = () => `pw_live_${crypto.randomBytes(24).toString("base64url")}`;

async function readCollection<K extends keyof Shape>(name: K): Promise<Shape[K]> {
  if (cache[name]) return cache[name] as Shape[K];
  try {
    const raw = await fs.readFile(FILES[name], "utf8");
    cache[name] = JSON.parse(raw);
  } catch {
    cache[name] = [] as unknown as Shape[K];
  }
  return cache[name] as Shape[K];
}

async function writeCollection<K extends keyof Shape>(name: K, value: Shape[K]): Promise<void> {
  cache[name] = value;
  const file = FILES[name];
  const prev = writeQueue.get(file) ?? Promise.resolve();
  const next = prev.then(async () => {
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
    await fs.rename(tmp, file);
  });
  writeQueue.set(file, next.catch(() => {}));
  return next;
}

export async function init(): Promise<void> {
  await fs.mkdir(OUTPUT, { recursive: true });
}

// ---------------------------------------------------------------- templates

/** Starter templates are injected rather than imported to keep this module seed-free. */
let seedFactory: (() => Template[]) | null = null;
export function registerSeed(factory: () => Template[]): void {
  seedFactory = factory;
}

const seeding = new Map<string, Promise<void>>();

/** Gives a brand-new account its own copy of the starter templates, exactly once. */
export async function ensureSeeded(accountId: string): Promise<void> {
  if (!seedFactory) return;
  const inflight = seeding.get(accountId);
  if (inflight) return inflight;

  const run = (async () => {
    const all = await readCollection("templates");
    if (all.some((t) => t.accountId === accountId)) return;

    const now = new Date().toISOString();
    const suffix = crypto.createHash("sha1").update(accountId).digest("base64url").slice(0, 6);
    const seeded = seedFactory!().map((tpl) => ({
      ...tpl,
      // Ids stay readable and stable per account, so API snippets keep working.
      id: accountId === LOCAL_ACCOUNT ? tpl.id : `${tpl.id}-${suffix}`,
      accountId,
      createdAt: now,
      updatedAt: now,
    }));
    await writeCollection("templates", [...all, ...seeded]);
  })();

  seeding.set(accountId, run);
  try {
    await run;
  } finally {
    seeding.delete(accountId);
  }
}

export async function listTemplates(accountId: string): Promise<StoredTemplate[]> {
  await ensureSeeded(accountId);
  return (await readCollection("templates")).filter((t) => t.accountId === accountId);
}

export async function getTemplate(
  accountId: string,
  id: string,
): Promise<StoredTemplate | undefined> {
  return (await listTemplates(accountId)).find((t) => t.id === id);
}

export async function saveTemplate(
  accountId: string,
  tpl: Template,
): Promise<StoredTemplate> {
  const all = await readCollection("templates");
  const now = new Date().toISOString();
  const idx = all.findIndex((t) => t.id === tpl.id && t.accountId === accountId);
  const next: StoredTemplate = {
    ...tpl,
    accountId,
    updatedAt: now,
    createdAt: idx >= 0 ? all[idx].createdAt : now,
  };
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  await writeCollection("templates", all);
  return next;
}

export async function deleteTemplate(accountId: string, id: string): Promise<boolean> {
  const all = await readCollection("templates");
  const next = all.filter((t) => !(t.id === id && t.accountId === accountId));
  if (next.length === all.length) return false;
  await writeCollection("templates", next);
  return true;
}

// ---------------------------------------------------------------- api keys

export async function listKeys(accountId: string): Promise<ApiKey[]> {
  return (await readCollection("keys")).filter((k) => k.accountId === accountId);
}

export async function createKey(accountId: string, name: string): Promise<ApiKey> {
  const all = await readCollection("keys");
  const key: ApiKey = {
    id: newId("key"),
    accountId,
    name: name || "Untitled key",
    key: newApiKey(),
    createdAt: new Date().toISOString(),
    calls: 0,
  };
  all.push(key);
  await writeCollection("keys", all);
  return key;
}

export async function deleteKey(accountId: string, id: string): Promise<boolean> {
  const all = await readCollection("keys");
  const next = all.filter((k) => !(k.id === id && k.accountId === accountId));
  if (next.length === all.length) return false;
  await writeCollection("keys", next);
  return true;
}

/** Resolves an API key to its owning account and records the call. */
export async function touchKey(value: string): Promise<ApiKey | undefined> {
  const all = await readCollection("keys");
  const found = all.find((k) => k.key === value);
  if (!found) return undefined;
  found.calls += 1;
  found.lastUsedAt = new Date().toISOString();
  void writeCollection("keys", all);
  return found;
}

// ---------------------------------------------------------------- jobs

export async function listJobs(accountId: string): Promise<Job[]> {
  return (await readCollection("jobs")).filter((j) => j.accountId === accountId);
}

export async function getJob(accountId: string, id: string): Promise<Job | undefined> {
  return (await listJobs(accountId)).find((j) => j.id === id);
}

export async function recordJob(job: Job): Promise<Job> {
  const all = await readCollection("jobs");
  const idx = all.findIndex((j) => j.id === job.id);
  if (idx >= 0) all[idx] = job;
  else all.unshift(job);
  await writeCollection("jobs", all.slice(0, 2000));
  return job;
}
