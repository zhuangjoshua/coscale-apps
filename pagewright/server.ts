/**
 * Pagewright — templated document generation.
 *
 * Surfaces:
 *   /api/*   dashboard API for the signed-in editor. Identity comes from the site's
 *            bearer token (see src/auth.ts); every record is scoped to that account.
 *   /v1/*    public generation API, authenticated with X-API-KEY. The key determines
 *            which account's templates are visible.
 *   /legacy  the original self-hosted editor, kept for local use.
 */

import express, { type NextFunction, type Request, type Response } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_PAGE,
  DEFAULT_THEME,
  compileTemplate,
  type Template,
} from "./src/blocks.js";
import { extractPaths, render } from "./src/template-engine.js";
import { generate } from "./src/pipeline.js";
import { mergePdfs } from "./src/forms.js";
import { closeBrowser, getBrowser } from "./src/render.js";
import { SESSION_COOKIE, resolveViewer, type Viewer } from "./src/auth.js";
import {
  authorizeUrl,
  exchangeCode,
  googleConfigured,
  missingGoogleConfig,
  mintSessionToken,
  readState,
  signState,
  SESSION_TTL_SECONDS,
  verifyGoogleIdToken,
} from "./src/google-auth.js";
import * as store from "./src/store.js";
import { SEED_TEMPLATES } from "./seed/templates.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4310);

// Each account gets its own copy of the starter templates on first read.
store.registerSeed(() => SEED_TEMPLATES.map((t) => structuredClone(t)));

const ALLOWED_ORIGINS = (
  process.env.PAGEWRIGHT_ALLOWED_ORIGINS ??
  "http://localhost:5173,http://localhost:4173,http://localhost:8853"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();

// The editor is served from the site's origin, so the API is cross-origin by design.
app.use((req, res, next) => {
  const origin = req.header("origin");
  if (origin && (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-KEY");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "X-Pagewright-Pages, X-Pagewright-Ms");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "8mb" }));
app.use("/legacy", express.static(path.join(HERE, "public")));

// The built site ships alongside the engine: one origin, one process, no CORS.
const SITE_DIR = process.env.PAGEWRIGHT_SITE_DIR ?? path.join(HERE, "pagewright-site", "dist");
app.use(express.static(SITE_DIR, { index: false }));
app.use(
  "/files",
  express.static(store.OUTPUT, {
    maxAge: "1h",
    setHeaders: (res) => res.setHeader("Content-Disposition", "inline"),
  }),
);

const fail = (res: Response, code: number, message: string, extra: object = {}) =>
  res.status(code).json({ status: "error", message, ...extra });

const asyncRoute =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// ---------------------------------------------------------------- identity

/** Resolves the signed-in viewer or answers 401. */
async function viewerOr401(req: Request, res: Response): Promise<Viewer | null> {
  const viewer = await resolveViewer(req.header("authorization"), req.header("cookie"));
  if (!viewer) {
    fail(res, 401, "Sign in required");
    return null;
  }
  return viewer;
}

// ---------------------------------------------------------------- auth

/** Whether sign-in is usable, so the UI can explain itself instead of failing. */
app.get("/api/auth/config", (_req, res) => {
  res.json({ provider: "google", configured: googleConfigured(), missing: missingGoogleConfig() });
});

const redirectUri = (req: Request) => absoluteUrl(req, "/api/auth/google/callback");

/** Step 1 — hand the browser to Google. */
app.get("/api/auth/google/start", (req, res) => {
  if (!googleConfigured()) {
    return fail(res, 503, "Google sign-in is not configured on this server", {
      missing: missingGoogleConfig(),
    });
  }
  const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "/app";
  // Only same-site paths, so the state cannot be used as an open redirect.
  const safeReturn = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/app";
  res.redirect(authorizeUrl(redirectUri(req), signState(safeReturn)));
});

/** Step 2 — exchange the code server to server and set the session cookie. */
app.get("/api/auth/google/callback", asyncRoute(async (req, res) => {
  if (!googleConfigured()) return fail(res, 503, "Google sign-in is not configured");

  if (req.query.error) {
    return res.redirect(`/?authError=${encodeURIComponent(String(req.query.error))}`);
  }

  const state = readState(String(req.query.state ?? ""));
  if (!state) return fail(res, 400, "Invalid or expired sign-in state");

  const code = String(req.query.code ?? "");
  if (!code) return fail(res, 400, "Missing authorization code");

  try {
    const idToken = await exchangeCode(code, redirectUri(req));
    const identity = await verifyGoogleIdToken(idToken);
    const accountId = `google:${identity.sub}`;
    await store.ensureSeeded(accountId);

    const secure = (req.header("x-forwarded-proto") ?? "http") === "https";
    res.cookie?.(SESSION_COOKIE, mintSessionToken(identity), {
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: SESSION_TTL_SECONDS * 1000,
      path: "/",
    });
    res.redirect(state.returnTo);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign-in failed";
    res.redirect(`/?authError=${encodeURIComponent(message)}`);
  }
}));

app.post("/api/auth/logout", (req, res) => {
  const secure = (req.header("x-forwarded-proto") ?? "http") === "https";
  res.cookie?.(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure, maxAge: 0, path: "/" });
  res.json({ status: "success" });
});

// ---------------------------------------------------------------- dashboard API

app.get(["/api/me", "/api/auth/me"], asyncRoute(async (req, res) => {
  const viewer = await resolveViewer(req.header("authorization"), req.header("cookie"));
  res.json({
    signedIn: Boolean(viewer),
    accountId: viewer?.accountId ?? null,
    email: viewer?.email ?? null,
    verified: viewer?.verified ?? false,
  });
}));

app.get("/api/bootstrap", asyncRoute(async (req, res) => {
  const viewer = await viewerOr401(req, res);
  if (!viewer) return;
  const [templates, keys, jobs] = await Promise.all([
    store.listTemplates(viewer.accountId),
    store.listKeys(viewer.accountId),
    store.listJobs(viewer.accountId),
  ]);
  res.json({
    account: { id: viewer.accountId, email: viewer.email, verified: viewer.verified },
    templates,
    keys,
    jobs: jobs.slice(0, 60),
  });
}));

app.post("/api/templates", asyncRoute(async (req, res) => {
  const viewer = await viewerOr401(req, res);
  if (!viewer) return;

  const name = String(req.body?.name || "Untitled template").slice(0, 80);
  const from = req.body?.from
    ? await store.getTemplate(viewer.accountId, String(req.body.from))
    : undefined;

  const tpl: Template = from
    ? { ...structuredClone(from), id: store.newId("tpl"), name, createdAt: "", updatedAt: "" }
    : {
        id: store.newId("tpl"),
        name,
        description: "",
        blocks: [
          { id: "b1", type: "heading", level: 1, text: "{{title}}" },
          { id: "b2", type: "text", text: "Start editing — every {{token}} is filled from your JSON." },
        ],
        page: structuredClone(DEFAULT_PAGE),
        theme: structuredClone(DEFAULT_THEME),
        sampleData: { title: "Hello", doc: { footer: "" } },
        createdAt: "",
        updatedAt: "",
      };

  res.json(await store.saveTemplate(viewer.accountId, tpl));
}));

app.put("/api/templates/:id", asyncRoute(async (req, res) => {
  const viewer = await viewerOr401(req, res);
  if (!viewer) return;

  const existing = await store.getTemplate(viewer.accountId, req.params.id);
  if (!existing) return fail(res, 404, "Template not found");

  const patch = req.body ?? {};
  const next: Template = {
    ...existing,
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    blocks: patch.blocks ?? existing.blocks,
    page: patch.page ?? existing.page,
    theme: patch.theme ?? existing.theme,
    css: patch.css ?? existing.css,
    sampleData: patch.sampleData ?? existing.sampleData,
  };
  res.json(await store.saveTemplate(viewer.accountId, next));
}));

app.delete("/api/templates/:id", asyncRoute(async (req, res) => {
  const viewer = await viewerOr401(req, res);
  if (!viewer) return;
  const ok = await store.deleteTemplate(viewer.accountId, req.params.id);
  if (!ok) return fail(res, 404, "Template not found");
  res.json({ status: "success" });
}));

/** Live preview — renders straight to the browser, no stored artifact. */
app.post("/api/templates/:id/preview", asyncRoute(async (req, res) => {
  const viewer = await viewerOr401(req, res);
  if (!viewer) return;

  const tpl = await store.getTemplate(viewer.accountId, req.params.id);
  if (!tpl) return fail(res, 404, "Template not found");

  const overrides = req.body?.template as Partial<Template> | undefined;
  const merged: Template = overrides ? { ...tpl, ...overrides, id: tpl.id } : tpl;
  const data = (req.body?.data as Record<string, unknown>) ?? merged.sampleData ?? {};
  const format = req.body?.format === "png" ? "png" : "pdf";

  const result = await generate({
    template: merged,
    data,
    format,
    via: "editor",
    persist: false,
    accountId: viewer.accountId,
  });

  res.setHeader("Content-Type", format === "pdf" ? "application/pdf" : "image/png");
  res.setHeader("X-Pagewright-Pages", String(result.pages));
  res.setHeader("X-Pagewright-Ms", String(result.ms));
  res.send(result.buffer);
}));

/** Compiled HTML + detected data paths, for the editor's inspector panel. */
app.post("/api/templates/:id/inspect", asyncRoute(async (req, res) => {
  const viewer = await viewerOr401(req, res);
  if (!viewer) return;

  const tpl = await store.getTemplate(viewer.accountId, req.params.id);
  if (!tpl) return fail(res, 404, "Template not found");

  const merged: Template = req.body?.template ? { ...tpl, ...req.body.template, id: tpl.id } : tpl;
  const html = compileTemplate(merged);
  res.json({
    html,
    paths: extractPaths(html),
    merged: render(html, (req.body?.data as Record<string, unknown>) ?? merged.sampleData ?? {}),
  });
}));

app.get("/api/keys", asyncRoute(async (req, res) => {
  const viewer = await viewerOr401(req, res);
  if (!viewer) return;
  res.json(await store.listKeys(viewer.accountId));
}));

app.post("/api/keys", asyncRoute(async (req, res) => {
  const viewer = await viewerOr401(req, res);
  if (!viewer) return;
  res.json(await store.createKey(viewer.accountId, String(req.body?.name || "Untitled key")));
}));

app.delete("/api/keys/:id", asyncRoute(async (req, res) => {
  const viewer = await viewerOr401(req, res);
  if (!viewer) return;
  const ok = await store.deleteKey(viewer.accountId, req.params.id);
  if (!ok) return fail(res, 404, "Key not found");
  res.json({ status: "success" });
}));

app.get("/api/jobs", asyncRoute(async (req, res) => {
  const viewer = await viewerOr401(req, res);
  if (!viewer) return;
  res.json((await store.listJobs(viewer.accountId)).slice(0, 100));
}));

// ---------------------------------------------------------------- public API

/** Resolves an API key to its owning account. */
async function keyAccountOr4xx(req: Request, res: Response): Promise<string | null> {
  const provided = req.header("X-API-KEY") ?? req.header("x-api-key");
  if (!provided) {
    fail(res, 401, "Missing X-API-KEY header");
    return null;
  }
  const key = await store.touchKey(provided);
  if (!key) {
    fail(res, 403, "Invalid API key");
    return null;
  }
  return key.accountId;
}

app.get("/v1/templates", asyncRoute(async (req, res) => {
  const accountId = await keyAccountOr4xx(req, res);
  if (!accountId) return;
  const templates = await store.listTemplates(accountId);
  res.json({
    status: "success",
    templates: templates.map((t) => ({
      template_id: t.id,
      name: t.name,
      description: t.description,
      updated_at: t.updatedAt,
    })),
  });
}));

app.post("/v1/create", asyncRoute(async (req, res) => {
  const accountId = await keyAccountOr4xx(req, res);
  if (!accountId) return;

  const body = req.body ?? {};
  const templateId = String(body.template_id ?? "");
  if (!templateId) return fail(res, 400, "template_id is required");

  const tpl = await store.getTemplate(accountId, templateId);
  if (!tpl) return fail(res, 404, `Unknown template_id: ${templateId}`);

  const format = ["pdf", "png", "jpeg"].includes(body.format) ? body.format : "pdf";
  const exportType = ["json", "base64", "file"].includes(body.export_type)
    ? body.export_type
    : "json";

  if (body.data !== undefined && (typeof body.data !== "object" || body.data === null)) {
    return fail(res, 400, "data must be a JSON object");
  }

  const result = await generate({
    template: tpl,
    data: (body.data as Record<string, unknown>) ?? tpl.sampleData ?? {},
    format,
    fieldValues: body.field_values ?? {},
    outputFile: body.output_file,
    via: "api",
    persist: exportType !== "file",
    accountId,
  });

  if (body.webhook_url) {
    const target = String(body.webhook_url);
    void fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "success",
        transaction_ref: result.job?.id,
        file: result.url ? absoluteUrl(req, result.url) : undefined,
        pages: result.pages,
      }),
    }).catch((err) => console.warn(`[webhook] ${target}: ${err.message}`));
  }

  if (exportType === "file") {
    res.setHeader("Content-Type", format === "pdf" ? "application/pdf" : `image/${format}`);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${String(body.output_file || `output.${format}`).replace(/"/g, "")}"`,
    );
    return res.send(result.buffer);
  }

  if (exportType === "base64") {
    return res.json({
      status: "success",
      transaction_ref: result.job?.id,
      pages: result.pages,
      ms: result.ms,
      file: result.buffer.toString("base64"),
    });
  }

  res.json({
    status: "success",
    transaction_ref: result.job?.id,
    pages: result.pages,
    bytes: result.buffer.length,
    ms: result.ms,
    file: result.url ? absoluteUrl(req, result.url) : undefined,
  });
}));

app.get("/v1/status/:id", asyncRoute(async (req, res) => {
  const accountId = await keyAccountOr4xx(req, res);
  if (!accountId) return;
  const job = await store.getJob(accountId, req.params.id);
  if (!job) return fail(res, 404, "Unknown transaction_ref");
  res.json({
    status: "success",
    transaction_ref: job.id,
    state: job.status,
    pages: job.pages,
    ms: job.ms,
    file: job.file ? absoluteUrl(req, `/files/${job.file}`) : undefined,
    error: job.error,
  });
}));

app.post("/v1/merge", asyncRoute(async (req, res) => {
  const accountId = await keyAccountOr4xx(req, res);
  if (!accountId) return;

  const files = req.body?.files;
  if (!Array.isArray(files) || files.length < 2) {
    return fail(res, 400, "files must be an array of at least two PDFs (URL or base64)");
  }

  const buffers: Buffer[] = [];
  for (const entry of files) {
    const value = String(entry);
    if (/^https?:\/\//i.test(value)) {
      const resp = await fetch(value);
      if (!resp.ok) return fail(res, 400, `Could not fetch ${value} (${resp.status})`);
      buffers.push(Buffer.from(await resp.arrayBuffer()));
    } else if (value.startsWith("/files/")) {
      buffers.push(await fs.readFile(path.join(store.OUTPUT, path.basename(value))));
    } else {
      buffers.push(Buffer.from(value.replace(/^data:.*?;base64,/, ""), "base64"));
    }
  }

  const merged = await mergePdfs(buffers);
  const name = `${store.newId("merge")}.pdf`;
  await fs.writeFile(path.join(store.OUTPUT, name), merged);
  res.json({ status: "success", file: absoluteUrl(req, `/files/${name}`), bytes: merged.length });
}));

app.get("/healthz", (_req, res) => res.json({ status: "ok" }));

// Anything not an API route falls through to the SPA shell so /app, /pricing etc.
// deep-link. Returns 404 when the site has not been built yet.
app.get(/^(?!\/(api|v1|files|legacy|healthz)\b).*/, (_req, res) => {
  res.sendFile(path.join(SITE_DIR, "index.html"), (err) => {
    if (err) res.status(404).json({ status: "error", message: "Site build not found. Run npm run build:site." });
  });
});

function absoluteUrl(req: Request, pathname: string): string {
  const host = req.header("host") ?? `localhost:${PORT}`;
  const proto = req.header("x-forwarded-proto") ?? "http";
  return `${proto}://${host}${pathname}`;
}

// ---------------------------------------------------------------- errors

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[pagewright]", err);
  if (res.headersSent) return;
  res.status(500).json({ status: "error", message: err.message });
});

// ---------------------------------------------------------------- boot

async function main(): Promise<void> {
  await store.init();

  const server = app.listen(PORT, () => {
    console.log(`[pagewright] api  http://localhost:${PORT}`);
    console.log(`[pagewright] cors ${ALLOWED_ORIGINS.join(", ")}`);
    console.log(
      googleConfigured()
        ? "[pagewright] google sign-in configured"
        : "[pagewright] google sign-in NOT configured (set GOOGLE_CLIENT_ID and PAGEWRIGHT_SESSION_SECRET)",
    );
  });

  getBrowser().catch((err) => console.warn("[pagewright] browser warmup failed:", err.message));

  const shutdown = async () => {
    server.close();
    await closeBrowser();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
