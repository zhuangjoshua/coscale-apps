/**
 * Client for the Pagewright document service.
 *
 * The service is a separate origin because it drives a headless browser to lay out and
 * paginate PDFs — work the static-SPA action runtime cannot host. Every request carries
 * the signed-in user's Supabase access token; the service scopes all data to that account.
 */

import { devSessionToken } from "./dev-session";
import { getSupabaseAccessToken } from "./product-auth";

export const API_BASE = String(
  import.meta.env.VITE_PAGEWRIGHT_API ?? "http://localhost:4310",
).replace(/\/$/, "");

// ---------------------------------------------------------------- types

export type Align = "left" | "center" | "right";
export type ColumnFormat = "text" | "money" | "number" | "date";

export interface Column {
  header: string;
  path: string;
  align?: Align;
  width?: string;
  format?: ColumnFormat;
}

export interface Block {
  id: string;
  type: string;
  when?: string;
  [key: string]: unknown;
}

export interface PageSetup {
  format: "A4" | "Letter" | "Legal" | "A3" | "A5";
  orientation: "portrait" | "landscape";
  margin: { top: string; right: string; bottom: string; left: string };
  header?: { enabled: boolean; html: string };
  footer?: { enabled: boolean; html: string };
}

export interface Theme {
  font: string;
  accent: string;
  ink: string;
  muted: string;
  rule: string;
  fontSize: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  blocks: Block[];
  page: PageSetup;
  theme: Theme;
  css?: string;
  sampleData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsedAt?: string;
  calls: number;
}

export interface Job {
  id: string;
  templateId: string;
  templateName: string;
  status: "pending" | "success" | "error";
  format: string;
  pages?: number;
  bytes?: number;
  ms?: number;
  file?: string;
  error?: string;
  via: string;
  createdAt: string;
}

export interface Bootstrap {
  account: { id: string; email?: string; verified: boolean };
  templates: Template[];
  keys: ApiKey[];
  jobs: Job[];
}

export interface RenderedPreview {
  blob: Blob;
  pages: string;
  ms: string;
}

export class PagewrightError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "PagewrightError";
  }
}

// ---------------------------------------------------------------- transport

async function authHeaders(): Promise<Record<string, string>> {
  const token = (await getSupabaseAccessToken()) || devSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(await authHeaders()),
    ...((init.headers as Record<string, string>) ?? {}),
  };

  const resp = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init, headers });
  if (!resp.ok) {
    let message = resp.statusText;
    try {
      message = ((await resp.json()) as { message?: string }).message ?? message;
    } catch {
      /* non-JSON error body; keep the status text */
    }
    throw new PagewrightError(message, resp.status);
  }
  return (await resp.json()) as T;
}

// ---------------------------------------------------------------- api

export const pagewright = {
  bootstrap: () => request<Bootstrap>("/api/bootstrap"),

  createTemplate: (name: string, from?: string) =>
    request<Template>("/api/templates", {
      method: "POST",
      body: JSON.stringify({ name, from }),
    }),

  saveTemplate: (template: Template) =>
    request<Template>(`/api/templates/${template.id}`, {
      method: "PUT",
      body: JSON.stringify(template),
    }),

  deleteTemplate: (id: string) =>
    request<{ status: string }>(`/api/templates/${id}`, { method: "DELETE" }),

  createKey: (name: string) =>
    request<ApiKey>("/api/keys", { method: "POST", body: JSON.stringify({ name }) }),

  deleteKey: (id: string) =>
    request<{ status: string }>(`/api/keys/${id}`, { method: "DELETE" }),

  inspect: (id: string, template: Template) =>
    request<{ html: string; paths: string[]; merged: string }>(
      `/api/templates/${id}/inspect`,
      { method: "POST", body: JSON.stringify({ template }) },
    ),

  /** Renders through the same pipeline the public API uses, so preview == output. */
  async preview(
    id: string,
    template: Template,
    data: Record<string, unknown>,
    format: "pdf" | "png",
  ): Promise<RenderedPreview> {
    const resp = await fetch(`${API_BASE}/api/templates/${id}/preview`, {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ template, data, format }),
    });
    if (!resp.ok) {
      let message = resp.statusText;
      try {
        message = ((await resp.json()) as { message?: string }).message ?? message;
      } catch {
        /* keep status text */
      }
      throw new PagewrightError(message, resp.status);
    }
    return {
      blob: await resp.blob(),
      pages: resp.headers.get("X-Pagewright-Pages") ?? "?",
      ms: resp.headers.get("X-Pagewright-Ms") ?? "?",
    };
  },
};
