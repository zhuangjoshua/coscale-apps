// Renderkit — engine + dashboard.
// Bannerbear-equivalent surface: images, PDFs, GIFs, movies, video overlay,
// screenshots, collections, async jobs + webhooks, signed URLs, auto-fit text,
// custom fonts, effects, transparent renders, template CRUD.
import express from "express";
import { chromium, Browser } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { randomBytes, createHmac } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const exec = promisify(execFile);
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, "out");
const FONTS = path.join(ROOT, "fonts");
const LOG = path.join(OUT, "renders.json");
const SECRET_FILE = path.join(ROOT, ".secret");
const PORT = Number(process.env.PORT || 8890);

fs.mkdirSync(FONTS, { recursive: true });
if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, randomBytes(24).toString("hex"));
const SECRET = fs.readFileSync(SECRET_FILE, "utf8").trim();

// ---------- env (.env.local) ----------
try {
  for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}
const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ---------- sessions (signed cookie, no deps) ----------
type SessionUser = { email: string; name?: string; picture?: string };
function signSession(u: SessionUser): string {
  const body = Buffer.from(JSON.stringify({ ...u, exp: Date.now() + 30 * 864e5 })).toString("base64url");
  return `${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
}
function readSession(req: express.Request): SessionUser | null {
  const raw = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith("rk_session="))?.slice(11);
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  if (createHmac("sha256", SECRET).update(body).digest("base64url") !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    if (data.exp < Date.now()) return null;
    return { email: data.email, name: data.name, picture: data.picture };
  } catch { return null; }
}
function setSessionCookie(res: express.Response, u: SessionUser) {
  res.setHeader("Set-Cookie", `rk_session=${signSession(u)}; HttpOnly; Path=/; Max-Age=${30 * 86400}; SameSite=Lax`);
}
const USERS = path.join(ROOT, "users.json");
function upsertUser(u: SessionUser) {
  let all: any[] = [];
  try { all = JSON.parse(fs.readFileSync(USERS, "utf8")); } catch {}
  if (!all.find((x) => x.email === u.email)) {
    all.push({ ...u, created_at: new Date().toISOString() });
    fs.writeFileSync(USERS, JSON.stringify(all, null, 2));
  }
}

let browser: Browser;
async function getBrowser() {
  if (!browser || !browser.isConnected()) browser = await chromium.launch();
  return browser;
}

// ---------- render log ----------
type RenderRecord = {
  id: string; template?: string; kind: string; format: string; width: number; height: number;
  file: string; ms: number; at: string; data?: unknown;
};
function readLog(): RenderRecord[] {
  try { return JSON.parse(fs.readFileSync(LOG, "utf8")); } catch { return []; }
}
function appendLog(r: RenderRecord) {
  const all = readLog(); all.unshift(r); fs.writeFileSync(LOG, JSON.stringify(all.slice(0, 500), null, 2));
}
const urlOf = (file: string) => `http://localhost:${PORT}/out/${file}`;

// ---------- templates ----------
import { renderBlockTemplate, sampleOf, type BlockDoc } from "./blocks.tsx";

function listTemplates(): string[] {
  return [...new Set(fs.readdirSync(path.join(ROOT, "templates"))
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".json"))
    .map((f) => f.replace(/\.(tsx|json)$/, "")))].sort();
}
function blockDocPath(name: string) { return path.join(ROOT, "templates", `${name}.json`); }
function readBlockDoc(name: string): BlockDoc | null {
  const file = blockDocPath(name);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}
// Returns a module-shaped object for BOTH template kinds:
// { default: (data) => ReactElement, sample, kind, doc? }
async function loadTemplate(name: string) {
  const doc = readBlockDoc(name);
  if (doc) {
    return {
      default: (data: any) => renderBlockTemplate(doc, data ?? {}),
      sample: sampleOf(doc),
      kind: "block" as const,
      doc,
    };
  }
  const file = path.join(ROOT, "templates", `${name}.tsx`);
  if (!fs.existsSync(file)) return null;
  const mod = await import(`${file}?v=${fs.statSync(file).mtimeMs}`);
  return { ...mod, kind: "code" as const };
}

// ---------- fonts ----------
function fontFaces(): string {
  if (!fs.existsSync(FONTS)) return "";
  return fs.readdirSync(FONTS)
    .filter((f) => /\.(ttf|otf|woff2?)$/i.test(f))
    .map((f) => {
      const family = f.replace(/\.(ttf|otf|woff2?)$/i, "");
      return `@font-face { font-family: '${family}'; src: url('http://localhost:${PORT}/fonts/${encodeURIComponent(f)}'); }`;
    }).join("\n");
}

// ---------- effects ----------
const EFFECTS: Record<string, string> = {
  grayscale: "grayscale(1)", sepia: "sepia(1)", blur: "blur(4px)",
  invert: "invert(1)", saturate: "saturate(2)", contrast: "contrast(1.4)",
  brightness: "brightness(1.25)", vintage: "sepia(.4) contrast(1.2) saturate(.8)",
};

function htmlShell(body: string, width: number, height: number, opts?: { transparent?: boolean; effects?: string[] }) {
  const filter = (opts?.effects ?? []).map((e) => EFFECTS[e]).filter(Boolean).join(" ");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  ${fontFaces()}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${width}px; height: ${height}px; ${opts?.transparent ? "background: transparent;" : ""} }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; ${filter ? `filter: ${filter};` : ""} }
  </style></head><body>${body}
  <script>
  // auto-fit: any element with data-fit shrinks font-size until content fits its box
  document.querySelectorAll('[data-fit]').forEach(function(el){
    var s = parseFloat(getComputedStyle(el).fontSize);
    var min = parseFloat(el.getAttribute('data-fit-min') || '10');
    while ((el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) && s > min) {
      s -= 1; el.style.fontSize = s + 'px';
    }
  });
  // nudge clamp: a nudged block that would cross the canvas edge is pulled back
  // to exactly the edge, so nudge can never push content off-screen.
  document.querySelectorAll('[data-nudge]').forEach(function(el){
    var parts = (el.getAttribute('data-nudge') || '0,0').split(',');
    var dx = parseFloat(parts[0]) || 0, dy = parseFloat(parts[1]) || 0;
    var W = document.documentElement.clientWidth, H = document.documentElement.clientHeight;
    var r = el.getBoundingClientRect();
    var ax = 0, ay = 0;
    if (r.left < 0) ax = -r.left; else if (r.right > W) ax = W - r.right;
    if (r.top < 0) ay = -r.top; else if (r.bottom > H) ay = H - r.bottom;
    if (ax || ay) el.style.transform = 'translate(' + (dx + ax) + 'px, ' + (dy + ay) + 'px)';
  });
  </script></body></html>`;
}

// ---------- core render ----------
type RenderOpts = {
  template: string; data: any; width: number; height: number; format: string;
  transparent?: boolean; effects?: string[]; kind?: string;
};
async function renderAsset(opts: RenderOpts): Promise<RenderRecord> {
  const t0 = Date.now();
  const mod = await loadTemplate(opts.template);
  if (!mod) throw Object.assign(new Error(`template not found: ${opts.template}`), { status: 404 });
  const html = htmlShell(renderToStaticMarkup(mod.default(opts.data ?? {})), opts.width, opts.height,
    { transparent: opts.transparent, effects: opts.effects });
  const page = await (await getBrowser()).newPage({
    viewport: { width: opts.width, height: opts.height }, deviceScaleFactor: 2,
  });
  try {
    await page.setContent(html, { waitUntil: "networkidle" });
    const id = randomBytes(8).toString("hex");
    const filename = opts.format === "pdf" ? `${id}.pdf` : `${id}.png`;
    if (opts.format === "pdf") {
      await page.pdf({ path: path.join(OUT, filename), width: `${opts.width}px`, height: `${opts.height}px`, printBackground: true });
    } else {
      await page.screenshot({ path: path.join(OUT, filename), omitBackground: !!opts.transparent });
    }
    const rec: RenderRecord = {
      id, template: opts.template, kind: opts.kind ?? "image", format: opts.format,
      width: opts.width, height: opts.height, file: filename, ms: Date.now() - t0,
      at: new Date().toISOString(), data: opts.data,
    };
    appendLog(rec);
    return rec;
  } finally {
    await page.close();
  }
}

// Render a template to a PNG file WITHOUT logging (internal frames etc).
async function renderFrame(template: string, data: any, width: number, height: number, file: string, transparent = false) {
  const mod = await loadTemplate(template);
  if (!mod) throw Object.assign(new Error(`template not found: ${template}`), { status: 404 });
  const html = htmlShell(renderToStaticMarkup(mod.default(data ?? {})), width, height, { transparent });
  const page = await (await getBrowser()).newPage({ viewport: { width, height }, deviceScaleFactor: transparent ? 1 : 2 });
  try {
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.screenshot({ path: file, omitBackground: transparent });
  } finally {
    await page.close();
  }
}

async function fetchToTmp(url: string, ext: string): Promise<string> {
  const tmp = path.join(os.tmpdir(), `bm-${randomBytes(6).toString("hex")}${ext}`);
  if (url.startsWith(`http://localhost:${PORT}/out/`)) {
    fs.copyFileSync(path.join(OUT, path.basename(url)), tmp); return tmp;
  }
  const res = await fetch(url, { headers: { "user-agent": "Renderkit/0.1 (local dev)" } });
  if (!res.ok) throw new Error(`fetch failed ${res.status}: ${url}`);
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  return tmp;
}

// ---------- async job queue ----------
type Job = { id: string; status: "queued" | "rendering" | "done" | "error"; result?: any; error?: string; webhook_url?: string };
const jobs = new Map<string, Job>();
async function runJob(job: Job, fn: () => Promise<any>) {
  job.status = "rendering";
  try {
    job.result = await fn();
    job.status = "done";
  } catch (e: any) {
    job.status = "error"; job.error = String(e?.message || e);
  }
  if (job.webhook_url) {
    fetch(job.webhook_url, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ job_id: job.id, status: job.status, result: job.result ?? null, error: job.error ?? null }),
    }).catch(() => {});
  }
}

const app = express();
app.use(express.json({ limit: "8mb" }));
app.use("/out", express.static(OUT));
app.use("/fonts", express.static(FONTS));
app.use("/vendor", express.static(path.join(ROOT, "vendor")));

// ============================================================ AUTH

app.get("/api/auth/login", (req, res) => {
  if (!GOOGLE_ID) return res.redirect("/api/auth/dev-info");
  const state = randomBytes(12).toString("hex");
  res.setHeader("Set-Cookie", `rk_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);
  const q = new URLSearchParams({
    client_id: GOOGLE_ID,
    redirect_uri: `${BASE_URL}/api/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
});

app.get("/api/auth/callback", async (req, res) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    const cookieState = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith("rk_state="))?.slice(9);
    if (!code || !state || state !== cookieState) return res.status(400).send("bad state");
    const tok = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: GOOGLE_ID!, client_secret: GOOGLE_SECRET!,
        redirect_uri: `${BASE_URL}/api/auth/callback`, grant_type: "authorization_code",
      }),
    }).then((r) => r.json());
    if (!tok.access_token) return res.status(401).send("token exchange failed");
    const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${tok.access_token}` },
    }).then((r) => r.json());
    if (!info.email) return res.status(401).send("no email from Google");
    const user = { email: info.email, name: info.name, picture: info.picture };
    upsertUser(user);
    setSessionCookie(res, user);
    res.redirect("/app");
  } catch (err: any) {
    res.status(500).send(String(err?.message || err));
  }
});

// dev sign-in — only exists while Google OAuth is not configured
app.get("/api/auth/dev-info", (_req, res) => {
  if (GOOGLE_ID) return res.redirect("/");
  res.type("html").send(pageShell("", `<div class="wrap" style="max-width:560px">
    <h1>Google OAuth not configured yet</h1>
    <div class="sub" style="line-height:1.7">Create an OAuth client at console.cloud.google.com
    (Web application, redirect URI <code>${BASE_URL}/api/auth/callback</code>) and put
    <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code> in <code>.env.local</code>.<br><br>
    Until then you can use a local dev session:</div>
    <a href="/api/auth/dev"><button>Continue as dev@localhost</button></a>
  </div>`));
});
app.get("/api/auth/dev", (_req, res) => {
  if (GOOGLE_ID) return res.redirect("/");
  const user = { email: "dev@localhost", name: "Local Dev" };
  upsertUser(user);
  setSessionCookie(res, user);
  res.redirect("/app");
});

app.get("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "rk_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
  res.redirect("/");
});

// ============================================================ API

// POST /render — { template, data, width?, height?, format? png|pdf, transparent?, effects?, async?, webhook_url? }
app.post("/render", async (req, res) => {
  const { template, data = {}, width = 1200, height = 630, format = "png",
    transparent = false, effects = [], async: isAsync = false, webhook_url } = req.body ?? {};
  if (!template || !/^[a-z0-9-_]+$/i.test(template)) {
    return res.status(400).json({ error: "template (alphanumeric name) is required" });
  }
  const opts: RenderOpts = { template, data, width: Number(width), height: Number(height), format, transparent, effects };
  if (isAsync) {
    const job: Job = { id: randomBytes(8).toString("hex"), status: "queued", webhook_url };
    jobs.set(job.id, job);
    runJob(job, async () => { const r = await renderAsset(opts); return { url: urlOf(r.file), ...r }; });
    return res.status(202).json({ job_id: job.id, status_url: `http://localhost:${PORT}/jobs/${job.id}` });
  }
  try {
    const rec = await renderAsset(opts);
    res.json({ url: urlOf(rec.file), ...rec });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: String(err?.message || err) });
  }
});

// GET /jobs/:id
app.get("/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "no such job" });
  res.json(job);
});

// POST /collections — { template, items: [data, ...], width?, height? } → one image per item
app.post("/collections", async (req, res) => {
  const { template, items = [], width = 1200, height = 630 } = req.body ?? {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: "items[] required" });
  if (items.length > 50) return res.status(400).json({ error: "max 50 items per collection" });
  try {
    const results = [];
    for (const data of items) {
      const rec = await renderAsset({ template, data, width: Number(width), height: Number(height), format: "png", kind: "collection" });
      results.push({ url: urlOf(rec.file), id: rec.id, ms: rec.ms });
    }
    res.json({ count: results.length, images: results });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: String(err?.message || err) });
  }
});

// POST /screenshot — { url, width?, height?, full_page?, mobile? }
app.post("/screenshot", async (req, res) => {
  const t0 = Date.now();
  const { url, width = 1280, height = 800, full_page = false, mobile = false } = req.body ?? {};
  if (!url || !/^https?:\/\//.test(url)) return res.status(400).json({ error: "http(s) url required" });
  try {
    const page = await (await getBrowser()).newPage({
      viewport: { width: Number(width), height: Number(height) },
      deviceScaleFactor: 2,
      ...(mobile ? { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", isMobile: true, hasTouch: true } : {}),
    });
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      const id = randomBytes(8).toString("hex");
      const filename = `${id}.png`;
      await page.screenshot({ path: path.join(OUT, filename), fullPage: !!full_page });
      const rec: RenderRecord = {
        id, kind: "screenshot", format: "png", width: Number(width), height: Number(height),
        file: filename, ms: Date.now() - t0, at: new Date().toISOString(), data: { url },
      };
      appendLog(rec);
      res.json({ url: urlOf(filename), ...rec });
    } finally { await page.close(); }
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// POST /gif — { template, frames: [data, ...], frame_ms?, width?, height? } → animated gif
app.post("/gif", async (req, res) => {
  const t0 = Date.now();
  const { template, frames = [], frame_ms = 800, width = 1200, height = 630 } = req.body ?? {};
  if (!Array.isArray(frames) || frames.length < 2) return res.status(400).json({ error: "frames[] (>=2) required" });
  if (frames.length > 30) return res.status(400).json({ error: "max 30 frames" });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bmgif-"));
  try {
    for (let i = 0; i < frames.length; i++) {
      await renderFrame(template, frames[i], Number(width), Number(height), path.join(dir, `f${String(i).padStart(3, "0")}.png`));
    }
    const id = randomBytes(8).toString("hex");
    const filename = `${id}.gif`;
    const fps = Math.max(0.5, Math.min(30, 1000 / Number(frame_ms)));
    await exec("ffmpeg", ["-y", "-framerate", String(fps), "-i", path.join(dir, "f%03d.png"),
      "-vf", "split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer",
      "-loop", "0", path.join(OUT, filename)]);
    const rec: RenderRecord = {
      id, template, kind: "gif", format: "gif", width: Number(width), height: Number(height),
      file: filename, ms: Date.now() - t0, at: new Date().toISOString(), data: { frames: frames.length, frame_ms },
    };
    appendLog(rec);
    res.json({ url: urlOf(filename), ...rec });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: String(err?.message || err) });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// POST /movie — { slides: [{template, data} | {image_url}], slide_ms?, transition_ms?, width?, height? } → mp4 slideshow with crossfades
app.post("/movie", async (req, res) => {
  const t0 = Date.now();
  const { slides = [], slide_ms = 2500, transition_ms = 500, width = 1280, height = 720 } = req.body ?? {};
  if (!Array.isArray(slides) || slides.length < 2) return res.status(400).json({ error: "slides[] (>=2) required" });
  if (slides.length > 10) return res.status(400).json({ error: "max 10 slides" });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bmmov-"));
  try {
    const files: string[] = [];
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      const f = path.join(dir, `s${i}.png`);
      if (s.image_url) {
        const tmp = await fetchToTmp(s.image_url, ".png");
        await exec("ffmpeg", ["-y", "-i", tmp, "-vf", `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`, f]);
      } else {
        await renderFrame(s.template, s.data ?? {}, Number(width), Number(height), f);
        // downscale 2x retina frame back to target dims for the video pipeline
        await exec("ffmpeg", ["-y", "-i", f, "-vf", `scale=${width}:${height}`, path.join(dir, `sc${i}.png`)]);
        fs.renameSync(path.join(dir, `sc${i}.png`), f);
      }
      files.push(f);
    }
    const dur = Number(slide_ms) / 1000, tr = Number(transition_ms) / 1000;
    const inputs = files.flatMap((f) => ["-loop", "1", "-t", String(dur + tr), "-i", f]);
    let filter = "", last = "[0:v]";
    for (let i = 1; i < files.length; i++) {
      const off = i * dur;
      const out = i === files.length - 1 ? "[v]" : `[x${i}]`;
      filter += `${last}[${i}:v]xfade=transition=fade:duration=${tr}:offset=${off}${out};`;
      last = `[x${i}]`;
    }
    filter = filter.replace(/;$/, "");
    const id = randomBytes(8).toString("hex");
    const filename = `${id}.mp4`;
    await exec("ffmpeg", ["-y", ...inputs, "-filter_complex", filter, "-map", "[v]",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(OUT, filename)]);
    const rec: RenderRecord = {
      id, kind: "movie", format: "mp4", width: Number(width), height: Number(height),
      file: filename, ms: Date.now() - t0, at: new Date().toISOString(), data: { slides: slides.length, slide_ms, transition_ms },
    };
    appendLog(rec);
    res.json({ url: urlOf(filename), ...rec });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: String(err?.stderr || err?.message || err) });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// POST /video/overlay — { video_url, template, data, width?, height? } → template rendered transparent, composited over the video
app.post("/video/overlay", async (req, res) => {
  const t0 = Date.now();
  const { video_url, template, data = {} } = req.body ?? {};
  if (!video_url) return res.status(400).json({ error: "video_url required" });
  if (!template) return res.status(400).json({ error: "template required" });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bmov-"));
  try {
    const video = await fetchToTmp(video_url, ".mp4");
    // probe video dimensions
    const probe = await exec("ffprobe", ["-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0", video]);
    const [vw, vh] = probe.stdout.trim().split("x").map(Number);
    const overlay = path.join(dir, "overlay.png");
    await renderFrame(template, data, vw, vh, overlay, true);
    const id = randomBytes(8).toString("hex");
    const filename = `${id}.mp4`;
    await exec("ffmpeg", ["-y", "-i", video, "-i", overlay,
      "-filter_complex", `[1:v]scale=${vw}:${vh}[ov];[0:v][ov]overlay=0:0`,
      "-c:a", "copy", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      path.join(OUT, filename)]);
    const rec: RenderRecord = {
      id, template, kind: "video-overlay", format: "mp4", width: vw, height: vh,
      file: filename, ms: Date.now() - t0, at: new Date().toISOString(), data,
    };
    appendLog(rec);
    res.json({ url: urlOf(filename), ...rec });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: String(err?.stderr || err?.message || err) });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// POST /video/multi-overlay — { video_url, overlays: [{template, data, start_s, end_s}] }
// Timed template slides over one video: intro card 0-3s, lower third 3-10s, etc.
app.post("/video/multi-overlay", async (req, res) => {
  const t0 = Date.now();
  const { video_url, overlays = [] } = req.body ?? {};
  if (!video_url) return res.status(400).json({ error: "video_url required" });
  if (!Array.isArray(overlays) || !overlays.length) return res.status(400).json({ error: "overlays[] required" });
  if (overlays.length > 10) return res.status(400).json({ error: "max 10 overlays" });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bmmo-"));
  try {
    const video = await fetchToTmp(video_url, ".mp4");
    const probe = await exec("ffprobe", ["-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0", video]);
    const [vw, vh] = probe.stdout.trim().split("x").map(Number);
    const inputs: string[] = ["-i", video];
    let filter = "", last = "[0:v]";
    for (let i = 0; i < overlays.length; i++) {
      const ov = overlays[i];
      const png = path.join(dir, `ov${i}.png`);
      await renderFrame(ov.template, ov.data ?? {}, vw, vh, png, true);
      inputs.push("-i", png);
      const start = Number(ov.start_s ?? 0), end = Number(ov.end_s ?? 1e9);
      const out = i === overlays.length - 1 ? "[v]" : `[m${i}]`;
      filter += `${last}[${i + 1}:v]overlay=0:0:enable='between(t,${start},${end})'${out};`;
      last = `[m${i}]`;
    }
    filter = filter.replace(/;$/, "");
    const id = randomBytes(8).toString("hex");
    const filename = `${id}.mp4`;
    await exec("ffmpeg", ["-y", ...inputs, "-filter_complex", filter, "-map", "[v]",
      "-map", "0:a?", "-c:a", "copy", "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart", path.join(OUT, filename)]);
    const rec: RenderRecord = {
      id, kind: "multi-overlay", format: "mp4", width: vw, height: vh,
      file: filename, ms: Date.now() - t0, at: new Date().toISOString(),
      data: { overlays: overlays.map((o: any) => ({ template: o.template, start_s: o.start_s, end_s: o.end_s })) },
    };
    appendLog(rec);
    res.json({ url: urlOf(filename), ...rec });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: String(err?.stderr || err?.message || err) });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// POST /video/edit — { video_url, start_s?, end_s?, mute?, gif_preview? }
app.post("/video/edit", async (req, res) => {
  const t0 = Date.now();
  const { video_url, start_s, end_s, mute = false, gif_preview = false } = req.body ?? {};
  if (!video_url) return res.status(400).json({ error: "video_url required" });
  try {
    const video = await fetchToTmp(video_url, ".mp4");
    const id = randomBytes(8).toString("hex");
    if (gif_preview) {
      const filename = `${id}.gif`;
      const args = ["-y"];
      if (start_s != null) args.push("-ss", String(start_s));
      args.push("-i", video, "-t", String(end_s != null && start_s != null ? end_s - start_s : 3),
        "-vf", "fps=10,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
        path.join(OUT, filename));
      await exec("ffmpeg", args);
      const rec: RenderRecord = { id, kind: "gif-preview", format: "gif", width: 480, height: 0,
        file: filename, ms: Date.now() - t0, at: new Date().toISOString(), data: { video_url } };
      appendLog(rec);
      return res.json({ url: urlOf(filename), ...rec });
    }
    const filename = `${id}.mp4`;
    const args = ["-y"];
    if (start_s != null) args.push("-ss", String(start_s));
    args.push("-i", video);
    if (end_s != null) args.push("-to", String(start_s != null ? end_s - start_s : end_s));
    if (mute) args.push("-an"); else args.push("-c:a", "copy");
    args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(OUT, filename));
    await exec("ffmpeg", args);
    const rec: RenderRecord = { id, kind: "video-edit", format: "mp4", width: 0, height: 0,
      file: filename, ms: Date.now() - t0, at: new Date().toISOString(), data: { start_s, end_s, mute } };
    appendLog(rec);
    res.json({ url: urlOf(filename), ...rec });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.stderr || err?.message || err) });
  }
});

// POST /kenburns — { image_url, duration_s?, direction? in|out, width?, height? } → zoom/pan mp4 from a still
app.post("/kenburns", async (req, res) => {
  const t0 = Date.now();
  const { image_url, duration_s = 5, direction = "in", width = 1280, height = 720 } = req.body ?? {};
  if (!image_url) return res.status(400).json({ error: "image_url required" });
  try {
    const img = await fetchToTmp(image_url, ".png");
    const id = randomBytes(8).toString("hex");
    const filename = `${id}.mp4`;
    const frames = Math.round(Number(duration_s) * 25);
    const zoom = direction === "out"
      ? `if(eq(on,1),1.3,max(zoom-0.0015,1.0))`
      : `min(zoom+0.0015,1.3)`;
    await exec("ffmpeg", ["-y", "-loop", "1", "-i", img,
      "-vf", `scale=${width * 4}:-1,zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=25`,
      "-t", String(duration_s), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      path.join(OUT, filename)]);
    const rec: RenderRecord = { id, kind: "kenburns", format: "mp4", width: Number(width), height: Number(height),
      file: filename, ms: Date.now() - t0, at: new Date().toISOString(), data: { image_url, direction } };
    appendLog(rec);
    res.json({ url: urlOf(filename), ...rec });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.stderr || err?.message || err) });
  }
});

// POST /video/subtitle — { video_url, style? } → whisper transcription burned in as styled captions
app.post("/video/subtitle", async (req, res) => {
  const t0 = Date.now();
  const { video_url, style = {} } = req.body ?? {};
  if (!video_url) return res.status(400).json({ error: "video_url required" });
  const model = path.join(ROOT, "models", "ggml-base.en.bin");
  if (!fs.existsSync(model)) return res.status(503).json({ error: "whisper model missing: models/ggml-base.en.bin" });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bmsub-"));
  try {
    const video = await fetchToTmp(video_url, ".mp4");
    const wav = path.join(dir, "audio.wav");
    await exec("ffmpeg", ["-y", "-i", video, "-ar", "16000", "-ac", "1", wav]);
    await exec("whisper-cli", ["-m", model, "-f", wav, "-osrt", "-of", path.join(dir, "subs")]);
    const srt = path.join(dir, "subs.srt");
    if (!fs.existsSync(srt)) throw new Error("transcription produced no output");
    const transcript = fs.readFileSync(srt, "utf8");
    // Burn-in without libass: each cue is rendered by Chrome as a transparent
    // overlay PNG and composited with enable='between(t,start,end)'.
    const toSec = (ts: string) => {
      const m = ts.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
      return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000 : 0;
    };
    const cues = transcript.split(/\r?\n\r?\n/).map((block) => {
      const lines = block.trim().split(/\r?\n/);
      const timing = lines.find((l) => l.includes("-->"));
      if (!timing) return null;
      const [a, b] = timing.split("-->");
      const text = lines.slice(lines.indexOf(timing) + 1).join(" ").trim();
      return text ? { start: toSec(a), end: toSec(b), text } : null;
    }).filter(Boolean) as { start: number; end: number; text: string }[];
    if (!cues.length) throw new Error("no speech detected");
    if (cues.length > 60) throw new Error("too many cues (>60) for overlay burn-in");
    const probe = await exec("ffprobe", ["-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0", video]);
    const [vw, vh] = probe.stdout.trim().split("x").map(Number);
    const fontSize = style.font_size ?? Math.round(vh / 18);
    const marginV = style.margin_v ?? Math.round(vh / 14);
    const color = style.color ?? "#ffffff";
    const inputs: string[] = ["-i", video];
    let filter = "", last = "[0:v]";
    for (let i = 0; i < cues.length; i++) {
      const cuePng = path.join(dir, `cue${i}.png`);
      const html = htmlShell(
        `<div style="position:absolute;left:0;right:0;bottom:${marginV}px;display:flex;justify-content:center">
          <div style="max-width:86%;background:rgba(0,0,0,0.62);color:${color};font-size:${fontSize}px;
            font-weight:700;line-height:1.3;padding:${Math.round(fontSize * 0.35)}px ${Math.round(fontSize * 0.7)}px;
            border-radius:${Math.round(fontSize * 0.3)}px;text-align:center">${cues[i].text
              .replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>
        </div>`, vw, vh, { transparent: true });
      const page = await (await getBrowser()).newPage({ viewport: { width: vw, height: vh } });
      try {
        await page.setContent(html, { waitUntil: "load" });
        await page.screenshot({ path: cuePng, omitBackground: true });
      } finally { await page.close(); }
      inputs.push("-i", cuePng);
      const out = i === cues.length - 1 ? "[v]" : `[c${i}]`;
      filter += `${last}[${i + 1}:v]overlay=0:0:enable='between(t,${cues[i].start},${cues[i].end})'${out};`;
      last = `[c${i}]`;
    }
    filter = filter.replace(/;$/, "");
    const id = randomBytes(8).toString("hex");
    const filename = `${id}.mp4`;
    await exec("ffmpeg", ["-y", ...inputs, "-filter_complex", filter, "-map", "[v]",
      "-map", "0:a?", "-c:a", "copy", "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart", path.join(OUT, filename)]);
    const rec: RenderRecord = { id, kind: "subtitled", format: "mp4", width: 0, height: 0,
      file: filename, ms: Date.now() - t0, at: new Date().toISOString(), data: { video_url } };
    appendLog(rec);
    res.json({ url: urlOf(filename), transcript, ...rec });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.stderr || err?.message || err) });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- PDF utilities ----------
// POST /pdf/join — { pdf_urls: [...] } → one merged pdf
app.post("/pdf/join", async (req, res) => {
  const t0 = Date.now();
  const { pdf_urls = [] } = req.body ?? {};
  if (!Array.isArray(pdf_urls) || pdf_urls.length < 2) return res.status(400).json({ error: "pdf_urls[] (>=2) required" });
  try {
    const { PDFDocument } = await import("pdf-lib");
    const merged = await PDFDocument.create();
    for (const u of pdf_urls) {
      const tmp = await fetchToTmp(u, ".pdf");
      const doc = await PDFDocument.load(fs.readFileSync(tmp));
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }
    const id = randomBytes(8).toString("hex");
    const filename = `${id}.pdf`;
    fs.writeFileSync(path.join(OUT, filename), await merged.save());
    const rec: RenderRecord = { id, kind: "pdf-join", format: "pdf", width: 0, height: 0,
      file: filename, ms: Date.now() - t0, at: new Date().toISOString(), data: { count: pdf_urls.length } };
    appendLog(rec);
    res.json({ url: urlOf(filename), pages: merged.getPageCount(), ...rec });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// POST /pdf/rasterize — { pdf_url, dpi? (<=300), format? png|jpg } → one image per page
app.post("/pdf/rasterize", async (req, res) => {
  const t0 = Date.now();
  const { pdf_url, dpi = 150, format = "png" } = req.body ?? {};
  if (!pdf_url) return res.status(400).json({ error: "pdf_url required" });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bmras-"));
  try {
    const pdf = await fetchToTmp(pdf_url, ".pdf");
    const id = randomBytes(8).toString("hex");
    await exec("pdftoppm", [format === "jpg" ? "-jpeg" : "-png", "-r", String(Math.min(300, Number(dpi))),
      pdf, path.join(dir, "page")]);
    const pages = fs.readdirSync(dir).filter((f) => f.startsWith("page")).sort();
    const urls = pages.map((p, i) => {
      const filename = `${id}-p${i + 1}.${format === "jpg" ? "jpg" : "png"}`;
      fs.copyFileSync(path.join(dir, p), path.join(OUT, filename));
      return urlOf(filename);
    });
    const rec: RenderRecord = { id, kind: "pdf-rasterize", format, width: 0, height: 0,
      file: path.basename(urls[0] ?? ""), ms: Date.now() - t0, at: new Date().toISOString(), data: { pages: urls.length, dpi } };
    appendLog(rec);
    res.json({ pages: urls, ...rec });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.stderr || err?.message || err) });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- template sets ----------
const SETS = path.join(ROOT, "sets.json");
function readSets(): Record<string, string[]> {
  try { return JSON.parse(fs.readFileSync(SETS, "utf8")); } catch { return {}; }
}
app.get("/api/sets", (_req, res) => res.json(readSets()));
app.post("/api/sets", (req, res) => {
  const { name, templates } = req.body ?? {};
  if (!name || !/^[a-z0-9-_]+$/i.test(name)) return res.status(400).json({ error: "bad name" });
  if (!Array.isArray(templates) || !templates.length) return res.status(400).json({ error: "templates[] required" });
  const sets = readSets(); sets[name] = templates; fs.writeFileSync(SETS, JSON.stringify(sets, null, 2));
  res.json({ name, templates });
});
// POST /sets/:name/render — { data, sizes? {template: [w,h]} } → same data through every template in the set
app.post("/sets/:name/render", async (req, res) => {
  const sets = readSets();
  const templates = sets[req.params.name];
  if (!templates) return res.status(404).json({ error: "no such set" });
  const { data = {}, sizes = {} } = req.body ?? {};
  try {
    const images = [];
    for (const t of templates) {
      const [w, h] = sizes[t] ?? [1200, 630];
      const rec = await renderAsset({ template: t, data, width: w, height: h, format: "png", kind: "set" });
      images.push({ template: t, url: urlOf(rec.file), ms: rec.ms });
    }
    res.json({ set: req.params.name, count: images.length, images });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: String(err?.message || err) });
  }
});

// ---------- smart crop (face detect via MediaPipe inside headless Chrome) ----------
// POST /smartcrop — { image_url, width, height } → crop centered on the detected face
app.post("/smartcrop", async (req, res) => {
  const t0 = Date.now();
  const { image_url, width = 800, height = 800 } = req.body ?? {};
  if (!image_url) return res.status(400).json({ error: "image_url required" });
  try {
    // fetch server-side and pass a data URL into the page: immune to CORS/hotlink blocks
    const tmp = await fetchToTmp(image_url, ".img");
    const b64 = `data:image/*;base64,${fs.readFileSync(tmp).toString("base64")}`;
    const page = await (await getBrowser()).newPage({ viewport: { width: 100, height: 100 } });
    try {
      // load a same-origin page so the vendored ES module + wasm resolve locally (no CDN)
      await page.goto(`http://localhost:${PORT}/vendor/mediapipe/blank.html`);
      const dataUrl: string = await page.evaluate(async ({ imgUrl, W, H }) => {
        const vision = await import("/vendor/mediapipe/vision_bundle.mjs" as any);
        const files = await vision.FilesetResolver.forVisionTasks(
          "/vendor/mediapipe/wasm");
        const detector = await vision.FaceDetector.createFromOptions(files, {
          baseOptions: { modelAssetPath: "/vendor/mediapipe/blaze_face_short_range.tflite" },
          runningMode: "IMAGE",
        });
        const img = new Image();
        await new Promise((ok, bad) => {
          img.onload = ok;
          img.onerror = () => bad(new Error("image failed to load"));
          img.src = imgUrl;
        });
        const dets = detector.detect(img).detections;
        // focus = face center, else image center
        let fx = img.naturalWidth / 2, fy = img.naturalHeight / 2;
        if (dets.length) {
          const b = dets[0].boundingBox;
          fx = b.originX + b.width / 2; fy = b.originY + b.height / 2;
        }
        const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
        const sw = W / scale, sh = H / scale;
        const sx = Math.max(0, Math.min(img.naturalWidth - sw, fx - sw / 2));
        const sy = Math.max(0, Math.min(img.naturalHeight - sh, fy - sh / 2));
        const canvas = document.createElement("canvas");
        canvas.width = W; canvas.height = H;
        canvas.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        return canvas.toDataURL("image/png");
      }, { imgUrl: b64, W: Number(width), H: Number(height) });
      const id = randomBytes(8).toString("hex");
      const filename = `${id}.png`;
      fs.writeFileSync(path.join(OUT, filename), Buffer.from(dataUrl.split(",")[1], "base64"));
      const rec: RenderRecord = { id, kind: "smartcrop", format: "png", width: Number(width), height: Number(height),
        file: filename, ms: Date.now() - t0, at: new Date().toISOString(), data: { image_url } };
      appendLog(rec);
      res.json({ url: urlOf(filename), ...rec });
    } finally { await page.close(); }
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// ---------- signed URLs ----------
function sign(template: string, d: string) {
  return createHmac("sha256", SECRET).update(`${template}.${d}`).digest("hex").slice(0, 32);
}
// POST /sign — { template, data, width?, height? } → a stable GET url anyone can hit
app.post("/sign", (req, res) => {
  const { template, data = {}, width = 1200, height = 630 } = req.body ?? {};
  if (!template) return res.status(400).json({ error: "template required" });
  const d = Buffer.from(JSON.stringify({ data, width, height })).toString("base64url");
  res.json({ url: `http://localhost:${PORT}/r/${template}.png?d=${d}&s=${sign(template, d)}` });
});
// GET /r/:template.png?d=...&s=... — render on demand, cached by signature
const signedCache = new Map<string, string>();
app.get("/r/:name.png", async (req, res) => {
  const name = req.params.name;
  const { d, s } = req.query as { d?: string; s?: string };
  if (!d || !s || sign(name, d) !== s) return res.status(403).json({ error: "bad signature" });
  const cacheKey = `${name}.${d}`;
  const hit = signedCache.get(cacheKey);
  if (hit && fs.existsSync(path.join(OUT, hit))) return res.sendFile(path.join(OUT, hit));
  try {
    const { data, width = 1200, height = 630 } = JSON.parse(Buffer.from(d, "base64url").toString());
    const rec = await renderAsset({ template: name, data, width: Number(width), height: Number(height), format: "png", kind: "signed-url" });
    signedCache.set(cacheKey, rec.file);
    res.sendFile(path.join(OUT, rec.file));
  } catch (err: any) {
    res.status(err.status || 500).json({ error: String(err?.message || err) });
  }
});

// ---------- template CRUD ----------
app.get("/api/templates", async (_req, res) => {
  const out = [] as any[];
  for (const name of listTemplates()) {
    const mod = await loadTemplate(name);
    out.push({ name, sample: mod?.sample ?? {} });
  }
  res.json(out);
});
app.get("/api/templates/:name", async (req, res) => {
  const name = req.params.name;
  if (!/^[a-z0-9-_]+$/i.test(name)) return res.status(400).json({ error: "bad name" });
  const mod = await loadTemplate(name);
  if (!mod) return res.status(404).json({ error: "not found" });
  if (mod.kind === "block") {
    return res.json({ name, kind: "block", sample: mod.sample ?? {}, doc: mod.doc });
  }
  res.json({ name, kind: "code", sample: mod.sample ?? {}, source: fs.readFileSync(path.join(ROOT, "templates", `${name}.tsx`), "utf8") });
});
// PUT /api/templates/:name — save a block doc (create or update)
app.put("/api/templates/:name", (req, res) => {
  const name = req.params.name;
  if (!/^[a-z0-9-_]+$/i.test(name)) return res.status(400).json({ error: "bad name" });
  const { doc } = req.body ?? {};
  if (!doc || doc.kind !== "block" || !doc.regions || !doc.theme || !doc.canvas) {
    return res.status(400).json({ error: "body must be { doc: BlockDoc }" });
  }
  doc.name = name;
  fs.writeFileSync(blockDocPath(name), JSON.stringify(doc, null, 2));
  res.json({ ok: true, name });
});
// POST /blockpreview — { doc, data } → { html } for the editor's live iframe
app.post("/blockpreview", (req, res) => {
  const { doc, data } = req.body ?? {};
  if (!doc || !doc.regions) return res.status(400).json({ error: "doc required" });
  try {
    const el = renderBlockTemplate(doc, data ?? sampleOf(doc));
    const html = htmlShell(renderToStaticMarkup(el), doc.canvas?.width ?? 1200, doc.canvas?.height ?? 630);
    res.json({ html });
  } catch (err: any) {
    res.status(400).json({ error: String(err?.message || err) });
  }
});
// POST /api/templates — { name, source } — create/update a template from source code
app.post("/api/templates", async (req, res) => {
  const { name, source } = req.body ?? {};
  if (!name || !/^[a-z0-9-_]+$/i.test(name)) return res.status(400).json({ error: "bad name" });
  if (!source || typeof source !== "string") return res.status(400).json({ error: "source required" });
  const file = path.join(ROOT, "templates", `${name}.tsx`);
  fs.writeFileSync(file, source);
  try {
    const mod = await loadTemplate(name);
    if (typeof mod?.default !== "function") throw new Error("default export must be a component function");
    res.json({ name, ok: true });
  } catch (err: any) {
    fs.unlinkSync(file);
    res.status(400).json({ error: `template rejected: ${String(err?.message || err)}` });
  }
});
app.delete("/api/templates/:name", (req, res) => {
  const name = req.params.name;
  if (!/^[a-z0-9-_]+$/i.test(name)) return res.status(400).json({ error: "bad name" });
  const tsx = path.join(ROOT, "templates", `${name}.tsx`);
  const json = blockDocPath(name);
  if (!fs.existsSync(tsx) && !fs.existsSync(json)) return res.status(404).json({ error: "not found" });
  if (fs.existsSync(tsx)) fs.unlinkSync(tsx);
  if (fs.existsSync(json)) fs.unlinkSync(json);
  res.json({ ok: true });
});

// GET /edit/:name — the block editor (page built in editor.tsx)
app.get("/edit/:name", async (req, res) => {
  if (!requireUser(req, res)) return;
  const name = req.params.name;
  if (!/^[a-z0-9-_]+$/i.test(name)) return res.status(400).end();
  try {
    const { editorPage } = await import("./editor.tsx");
    res.type("html").send(editorPage(name));
  } catch (err: any) {
    res.status(503).type("html").send(`<body style="background:#0b0d12;color:#8b93a5;font-family:system-ui;padding:60px">
      editor not available yet: ${String(err?.message || err)}</body>`);
  }
});
app.get("/api/renders", (_req, res) => res.json(readLog()));
app.get("/api/fonts", (_req, res) => {
  res.json(fs.readdirSync(FONTS).filter((f) => /\.(ttf|otf|woff2?)$/i.test(f))
    .map((f) => f.replace(/\.(ttf|otf|woff2?)$/i, "")));
});

// ---------- previews ----------
const previewCache = new Map<string, { file: string; mtime: number }>();
app.get("/preview/:name.png", async (req, res) => {
  const name = req.params.name;
  if (!/^[a-z0-9-_]+$/i.test(name)) return res.status(400).end();
  const tsx = path.join(ROOT, "templates", `${name}.tsx`);
  const file = fs.existsSync(blockDocPath(name)) ? blockDocPath(name) : tsx;
  if (!fs.existsSync(file)) return res.status(404).end();
  const mtime = fs.statSync(file).mtimeMs;
  const hit = previewCache.get(name);
  if (hit && hit.mtime === mtime && fs.existsSync(path.join(OUT, hit.file))) {
    return res.sendFile(path.join(OUT, hit.file));
  }
  try {
    const mod = await loadTemplate(name);
    const rec = await renderAsset({ template: name, data: mod?.sample ?? {}, width: 1200, height: 630, format: "png", kind: "preview" });
    previewCache.set(name, { file: rec.file, mtime });
    res.sendFile(path.join(OUT, rec.file));
  } catch { res.status(500).end(); }
});

// ============================================================ UI

const CSS = `
:root { --bg:#0E1116; --panel:#1A2029; --line:#2A3340; --text:#F2F5F8; --dim:#9AA5B1; --accent:#F5A524; --ok:#3ecf8e; }
* { margin:0; padding:0; box-sizing:border-box; }
body { background:var(--bg); color:var(--text); font-family:'Avenir Next',Montserrat,'Segoe UI',system-ui,sans-serif; min-height:100vh; }
a { color:inherit; text-decoration:none; }
.nav { display:flex; align-items:center; gap:28px; padding:16px 32px; background:var(--bg); border-bottom:1px solid var(--line); }
.nav .logo { font-weight:800; font-size:17px; letter-spacing:-0.02em; }
.nav .logo span { color:var(--accent); }
.nav a.link { color:var(--dim); font-size:14px; }
.nav a.link:hover, .nav a.link.on { color:var(--text); }
.wrap { max-width:1200px; margin:0 auto; padding:36px 32px; }
h1 { font-size:24px; letter-spacing:-0.02em; margin-bottom:6px; }
.sub { color:var(--dim); font-size:14px; margin-bottom:28px; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:20px; }
.card { background:var(--panel); border:1px solid var(--line); border-radius:10px; overflow:hidden; transition:border-color .15s; }
.card:hover { border-color:var(--accent); }
.card img, .card video { width:100%; aspect-ratio:1200/630; object-fit:cover; display:block; background:#000; }
.card .meta { padding:12px 16px; display:flex; justify-content:space-between; align-items:center; gap:8px; }
.card .meta b { font-size:14px; }
.card .meta span { color:var(--dim); font-size:12px; white-space:nowrap; }
.split { display:grid; grid-template-columns:420px 1fr; gap:24px; align-items:start; }
.panel { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:18px; }
.panel h3 { font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:var(--dim); margin-bottom:12px; }
textarea, select, input { width:100%; background:#0e1118; color:var(--text); border:1px solid var(--line); border-radius:8px; padding:10px 12px; font-size:13px; font-family:ui-monospace,'SF Mono',Menlo,monospace; }
textarea { min-height:220px; resize:vertical; line-height:1.5; }
.row { display:flex; gap:10px; margin-top:10px; }
button { background:var(--accent); color:#1c1302; border:0; border-radius:8px; padding:10px 18px; font-size:14px; font-weight:700; cursor:pointer; }
button:hover { filter:brightness(1.1); }
button.ghost { background:transparent; color:var(--dim); border:1px solid var(--line); font-weight:500; }
.result img, .result video { width:100%; border-radius:8px; border:1px solid var(--line); display:block; }
.stat { color:var(--ok); font-size:13px; margin:10px 0; font-family:ui-monospace,monospace; }
pre.code { background:#0e1118; border:1px solid var(--line); border-radius:8px; padding:14px; font-size:12px; line-height:1.55; overflow:auto; max-height:420px; color:#c9d4e6; font-family:ui-monospace,'SF Mono',Menlo,monospace; }
.hint { color:var(--dim); font-size:12px; margin-top:8px; line-height:1.5; }
.renders { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; }
.renders .card .meta { padding:10px 12px; }
.empty { color:var(--dim); padding:60px 0; text-align:center; }
.pill { display:inline-block; border:1px solid var(--line); color:var(--dim); border-radius:999px; padding:2px 10px; font-size:11px; }
.endpoint { margin-bottom:20px; }
`;

function pageShell(active: string, body: string, user?: SessionUser | null) {
  const right = user
    ? `<span style="color:var(--dim);font-size:13px">${user.email}</span>
       <a class="link" href="/api/auth/logout">Sign out</a>`
    : `<a href="/api/auth/login"><button style="padding:7px 16px;font-size:13px">Sign in</button></a>`;
  const links = user ? `
    <a class="link ${active === "guide" ? "on" : ""}" href="/guide">How It Works</a>
    <a class="link ${active === "templates" ? "on" : ""}" href="/app">Templates</a>
    <a class="link ${active === "tools" ? "on" : ""}" href="/tools">Tools</a>
    <a class="link ${active === "renders" ? "on" : ""}" href="/renders">Renders</a>
    <a class="link ${active === "docs" ? "on" : ""}" href="/docs">API</a>` : `
    <a class="link ${active === "docs" ? "on" : ""}" href="/docs">API</a>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Renderkit</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta name="viewport" content="width=device-width,initial-scale=1"><style>${CSS}</style></head><body>
  <nav class="nav">
    <a class="logo" href="/" style="display:flex;align-items:center;gap:10px">
      <span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:#191e27;border-radius:8px">
        <img src="/brand-logo.png" alt="" style="height:17px;width:auto">
      </span>
      <span style="letter-spacing:0.14em;font-weight:600;font-size:15px;color:var(--text)">renderkit</span></a>
    ${links}
    <span style="flex:1"></span>
    ${right}
  </nav>${body}</body></html>`;
}

function landingPage() {
  return pageShell("", `<div class="wrap" style="max-width:880px;text-align:center;padding-top:70px">
    <h1 style="font-size:44px;line-height:1.15;letter-spacing:-0.03em">Your app's data,<br>
      <span style="color:var(--accent)">rendered into finished visuals.</span></h1>
    <div class="sub" style="font-size:17px;max-width:620px;margin:18px auto 30px;line-height:1.65">
      Design a template once — visually or in code. Then every order, student, listing or post
      becomes an on-brand image, PDF, GIF or video, automatically, via one API call.</div>
    <a href="/api/auth/login"><button style="font-size:16px;padding:13px 30px">Sign in with Google</button></a>
    <div class="hint" style="margin-top:10px">Free while in development</div>
    <div class="grid" style="margin-top:60px;text-align:left">
      ${[
        ["Visual editor", "Drag blocks, bind them to your data fields, position anything anywhere. No code required."],
        ["One API call", "POST your JSON, get a finished PNG, PDF, GIF or MP4 back in ~600ms."],
        ["Layouts that adapt", "7 items make 7 rows. Long names shrink to fit. No frozen boxes, no manual variants."],
        ["Video too", "Watermarks, timed overlays, slideshows, auto-transcribed subtitles."],
        ["Dynamic og:images", "One signed URL per page — social cards render on demand, zero backend code."],
        ["Deterministic", "Same input, same pixels. Real brand fonts, never a misspelled name."],
      ].map(([t, d]) => `<div class="panel"><h3>${t}</h3><div class="hint" style="font-size:13px;line-height:1.6">${d}</div></div>`).join("")}
    </div>
  </div>`);
}

// gate: everything in the app UI requires a session.
// Logged-out visitors are sent into the sign-in flow (so "Log in" links Just Work).
function requireUser(req: express.Request, res: express.Response): SessionUser | null {
  const user = readSession(req);
  if (!user) { res.redirect("/api/auth/login"); return null; }
  return user;
}

// ---------- public front: the renderkit-site SPA ----------
const SITE_DIST = path.join(ROOT, "renderkit-site", "dist");
const siteBuilt = () => fs.existsSync(path.join(SITE_DIST, "index.html"));
app.use(express.static(SITE_DIST, { index: false }));

app.get("/", (req, res) => {
  const user = readSession(req);
  if (user) return res.redirect("/app");
  if (siteBuilt()) return res.sendFile(path.join(SITE_DIST, "index.html"));
  res.type("html").send(landingPage());
});

// stale prototype links like /product.html -> the SPA route
app.get(/^\/([a-z-]+)\.html$/, (req, res) => res.redirect(`/${(req.params as any)[0]}`));

// SPA marketing routes — all serve the same index.html, router takes over client-side
for (const route of ["/store", "/faq", "/pricing", "/privacy", "/terms", "/product", "/blog", "/articles"]) {
  app.get(route, (_req, res) => {
    if (siteBuilt()) return res.sendFile(path.join(SITE_DIST, "index.html"));
    res.redirect("/");
  });
}

app.get("/app", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const cards = listTemplates().map((t) => {
    const isBlock = !!readBlockDoc(t);
    return `
    <a class="card" href="${isBlock ? `/edit/${t}` : `/t/${t}`}">
      <img src="/preview/${t}.png" loading="lazy">
      <div class="meta"><b>${t}</b>${isBlock
        ? '<span class="pill" style="color:var(--accent);border-color:var(--accent)">visual editor</span>'
        : `<span>templates/${t}.tsx</span>`}</div>
    </a>`;
  }).join("");
  res.type("html").send(pageShell("templates", `<div class="wrap">
    <h1>Templates</h1>
    <div class="sub">Block templates open in the visual editor — <a href="/new" style="color:var(--accent)">create a new one</a>.</div>
    <div class="grid">${cards || '<div class="empty">No templates yet</div>'}</div>
  </div>`, user));
});

// GET /new — create a fresh block template and jump into the editor
app.get("/new", (req, res) => {
  if (!requireUser(req, res)) return;
  let n = 1;
  while (fs.existsSync(blockDocPath(`untitled-${n}`))) n++;
  const name = `untitled-${n}`;
  const doc: BlockDoc = {
    name, kind: "block",
    canvas: { width: 1200, height: 630 },
    preset: "stacked",
    theme: { bg: "#101418", accent: "#4da3ff", text: "#eef2f7", muted: "#8b93a5", font: "" },
    fields: {
      title: { type: "text", label: "Title", default: "Your headline here" },
      subtitle: { type: "text", label: "Subtitle", default: "Supporting line" },
    },
    regions: {
      top: [],
      middle: [{ id: "n1", type: "text", bind: "title", style: { size: 56, weight: 800 } } as any],
      bottom: [{ id: "n2", type: "text", bind: "subtitle", style: { size: 24, color: "muted" } } as any],
    },
  };
  fs.writeFileSync(blockDocPath(name), JSON.stringify(doc, null, 2));
  res.redirect(`/edit/${name}`);
});

app.get("/t/:name", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const name = req.params.name;
  if (!/^[a-z0-9-_]+$/i.test(name)) return res.status(400).end();
  const mod = await loadTemplate(name);
  if (!mod) return res.status(404).type("html").send(pageShell("templates", `<div class="wrap"><div class="empty">No template named ${name}</div></div>`, user));
  const sample = JSON.stringify(mod.sample ?? {}, null, 2);
  const rawSource = mod.kind === "block"
    ? JSON.stringify((mod as any).doc, null, 2)
    : fs.readFileSync(path.join(ROOT, "templates", `${name}.tsx`), "utf8");
  const source = rawSource.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  res.type("html").send(pageShell("templates", `<div class="wrap">
    <h1>${name}</h1>
    <div class="sub">Edit the JSON, render, repeat. The template is code — its layout adapts to whatever you send.</div>
    <div class="split">
      <div>
        <div class="panel">
          <h3>Data</h3>
          <textarea id="data">${sample.replace(/</g, "&lt;")}</textarea>
          <div class="row">
            <select id="size">
              <option value="1200x630">1200 × 630 — social/OG</option>
              <option value="1080x1080">1080 × 1080 — square</option>
              <option value="1080x1920">1080 × 1920 — story</option>
              <option value="1600x900">1600 × 900 — wide</option>
            </select>
            <select id="format"><option>png</option><option>pdf</option></select>
          </div>
          <div class="row">
            <select id="effect">
              <option value="">no effect</option>
              ${Object.keys(EFFECTS).map((e) => `<option>${e}</option>`).join("")}
            </select>
            <label style="display:flex;align-items:center;gap:6px;color:var(--dim);font-size:13px;white-space:nowrap">
              <input type="checkbox" id="transparent" style="width:auto"> transparent
            </label>
          </div>
          <div class="row"><button onclick="render()">Render</button>
          <button class="ghost" onclick="copyCurl()">Copy curl</button>
          <button class="ghost" onclick="signUrl()">Signed URL</button></div>
          <div class="hint" id="hint">POST /render with this JSON — same call your app would make.</div>
        </div>
      </div>
      <div>
        <div class="panel result">
          <h3>Output</h3>
          <div class="stat" id="stat">–</div>
          <div id="out"><img src="/preview/${name}.png"></div>
        </div>
        <div class="panel" style="margin-top:20px">
          <h3>Template source — templates/${name}.tsx</h3>
          <pre class="code">${source}</pre>
        </div>
      </div>
    </div>
  </div>
  <script>
  function opts() {
    const [w, h] = document.getElementById('size').value.split('x').map(Number);
    const effect = document.getElementById('effect').value;
    return {
      template: '${name}',
      data: JSON.parse(document.getElementById('data').value),
      width: w, height: h,
      format: document.getElementById('format').value,
      transparent: document.getElementById('transparent').checked,
      effects: effect ? [effect] : [],
    };
  }
  async function render() {
    let o; try { o = opts(); } catch(e) { document.getElementById('stat').textContent = 'bad JSON: ' + e.message; return; }
    document.getElementById('stat').textContent = 'rendering…';
    const res = await fetch('/render', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(o) });
    const j = await res.json();
    if (!j.url) { document.getElementById('stat').textContent = j.error; return; }
    document.getElementById('stat').textContent = j.ms + 'ms · ' + j.width + '×' + j.height + ' · ' + j.format;
    document.getElementById('out').innerHTML = o.format === 'pdf'
      ? '<a href="'+j.url+'" target="_blank"><button>Open PDF</button></a>'
      : '<img src="'+j.url+'">';
  }
  function copyCurl() {
    const o = opts();
    navigator.clipboard.writeText("curl -X POST http://localhost:${PORT}/render -H 'content-type: application/json' -d '" + JSON.stringify(o).replace(/'/g, "'\\\\''") + "'");
    document.getElementById('hint').textContent = 'curl copied to clipboard';
  }
  async function signUrl() {
    const o = opts();
    const res = await fetch('/sign', { method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ template: o.template, data: o.data, width: o.width, height: o.height }) });
    const j = await res.json();
    navigator.clipboard.writeText(j.url);
    document.getElementById('hint').innerHTML = 'signed URL copied — anyone can GET it, no API call needed: <br>' + j.url.slice(0, 80) + '…';
  }
  </script>`, user));
});

// Tools page: screenshot / gif / movie playground
app.get("/tools", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const templates = listTemplates();
  res.type("html").send(pageShell("tools", `<div class="wrap">
    <h1>Tools</h1>
    <div class="sub">The non-image endpoints, driveable from the browser. Results land in <a href="/renders" style="color:var(--accent)">Renders</a>.</div>
    <div class="grid">
      <div class="panel">
        <h3>Screenshot a URL</h3>
        <input id="ss-url" placeholder="https://example.com" value="https://example.com">
        <div class="row">
          <label style="display:flex;align-items:center;gap:6px;color:var(--dim);font-size:13px"><input type="checkbox" id="ss-full" style="width:auto"> full page</label>
          <label style="display:flex;align-items:center;gap:6px;color:var(--dim);font-size:13px"><input type="checkbox" id="ss-mobile" style="width:auto"> mobile</label>
        </div>
        <div class="row"><button onclick="shot()">Capture</button></div>
        <div class="stat" id="ss-stat">–</div>
        <div id="ss-out"></div>
      </div>
      <div class="panel">
        <h3>Animated GIF from a template</h3>
        <select id="gif-t">${templates.map((t) => `<option>${t}</option>`).join("")}</select>
        <div class="hint">Renders the template once per frame below (JSON array), assembles a looping GIF.</div>
        <textarea id="gif-frames" style="min-height:120px">[
  { "title": "Frame one" },
  { "title": "Frame two" },
  { "title": "Frame three" }
]</textarea>
        <div class="row"><button onclick="gif()">Build GIF</button></div>
        <div class="stat" id="gif-stat">–</div>
        <div id="gif-out"></div>
      </div>
      <div class="panel">
        <h3>Movie — template slides with crossfade</h3>
        <select id="mov-t">${templates.map((t) => `<option>${t}</option>`).join("")}</select>
        <div class="hint">Each JSON entry becomes a ~2.5s slide; fade between slides; outputs mp4.</div>
        <textarea id="mov-slides" style="min-height:120px">[
  { "title": "Slide one" },
  { "title": "Slide two" },
  { "title": "Slide three" }
]</textarea>
        <div class="row"><button onclick="movie()">Build movie</button></div>
        <div class="stat" id="mov-stat">–</div>
        <div id="mov-out"></div>
      </div>
    </div>
  </div>
  <script>
  async function shot() {
    document.getElementById('ss-stat').textContent = 'capturing…';
    const res = await fetch('/screenshot', { method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ url: document.getElementById('ss-url').value,
        full_page: document.getElementById('ss-full').checked, mobile: document.getElementById('ss-mobile').checked }) });
    const j = await res.json();
    document.getElementById('ss-stat').textContent = j.url ? j.ms + 'ms' : j.error;
    if (j.url) document.getElementById('ss-out').innerHTML = '<img style="width:100%;border-radius:8px;margin-top:8px" src="'+j.url+'">';
  }
  async function gif() {
    document.getElementById('gif-stat').textContent = 'building…';
    let frames; try { frames = JSON.parse(document.getElementById('gif-frames').value); } catch(e) { document.getElementById('gif-stat').textContent = e.message; return; }
    const res = await fetch('/gif', { method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ template: document.getElementById('gif-t').value, frames }) });
    const j = await res.json();
    document.getElementById('gif-stat').textContent = j.url ? j.ms + 'ms' : j.error;
    if (j.url) document.getElementById('gif-out').innerHTML = '<img style="width:100%;border-radius:8px;margin-top:8px" src="'+j.url+'">';
  }
  async function movie() {
    document.getElementById('mov-stat').textContent = 'building…';
    let slides; try { slides = JSON.parse(document.getElementById('mov-slides').value).map(d => ({ template: document.getElementById('mov-t').value, data: d })); } catch(e) { document.getElementById('mov-stat').textContent = e.message; return; }
    const res = await fetch('/movie', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ slides }) });
    const j = await res.json();
    document.getElementById('mov-stat').textContent = j.url ? j.ms + 'ms' : j.error;
    if (j.url) document.getElementById('mov-out').innerHTML = '<video controls autoplay muted loop style="width:100%;border-radius:8px;margin-top:8px" src="'+j.url+'"></video>';
  }
  </script>`, user));
});

app.get("/renders", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const rows = readLog().filter((r) => r.kind !== "preview").map((r) => `
    <div class="card">
      ${r.format === "pdf"
        ? `<a href="/out/${r.file}" target="_blank"><div style="aspect-ratio:1200/630;display:flex;align-items:center;justify-content:center;color:var(--dim)">PDF — open</div></a>`
        : r.format === "mp4"
          ? `<video controls muted loop src="/out/${r.file}"></video>`
          : `<a href="/out/${r.file}" target="_blank"><img src="/out/${r.file}" loading="lazy"></a>`}
      <div class="meta"><b>${r.template ?? r.kind}</b><span class="pill">${r.kind}</span><span>${r.ms}ms</span></div>
    </div>`).join("");
  res.type("html").send(pageShell("renders", `<div class="wrap">
    <h1>Renders</h1><div class="sub">Every asset produced through the API, newest first.</div>
    <div class="renders">${rows || '<div class="empty">Nothing rendered yet</div>'}</div>
  </div>`, user));
});

// How-to-use guide — the narrative version of the docs
app.get("/guide", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const step = (n: string, title: string, body: string) => `
    <div class="panel" style="margin-bottom:18px"><h3 style="display:flex;gap:10px;align-items:center">
      <span style="display:inline-flex;width:22px;height:22px;border-radius:999px;background:var(--accent);color:#1c1302;align-items:center;justify-content:center;font-size:12px">${n}</span>${title}</h3>
      <div style="font-size:14px;line-height:1.7;color:var(--text)">${body}</div></div>`;
  res.type("html").send(pageShell("guide", `<div class="wrap" style="max-width:860px">
    <h1>How It Works</h1>
    <div class="sub">The whole product in one sentence: <b>design a template once, then turn every row of your data into a finished image, PDF, GIF or video — automatically.</b></div>

    ${step("1", "Create or pick a template", `
      Go to <a href="/app" style="color:var(--accent)">Templates</a> and open one in the visual editor, or
      <a href="/new" style="color:var(--accent)">create a new one</a>. A template is made of <b>blocks</b>
      (text, image, stars, badge, divider, list) arranged in three stacking regions — TOP, MIDDLE, BOTTOM —
      plus a FLOATING layer for anything you want to place freely with position sliders.
      Pick a <b>preset</b> for the overall frame: stacked, image left/right, or full-background image.`)}

    ${step("2", "Bind blocks to your data", `
      Select a block and look at <b>SOURCE</b>. A block bound to a <b>field</b> (like <code>name</code> or
      <code>price</code>) is a placeholder: it shows the field's default in previews, and your real data at
      render time. This is the whole point — one template, unlimited different renders.
      Use <i>static value</i> only for things that never change (your company name, a decorative mark).
      Type in the <b>TEXT</b> box to change what a block says; use the theme panel (click empty space)
      for brand colors and fonts.`)}

    ${step("3", "Test it", `
      Edit the JSON-free way: change field defaults, watch the live preview. Then hit <b>Render PNG</b>
      in the editor to produce a real file. Every render ever made is listed under
      <a href="/renders" style="color:var(--accent)">Renders</a>.`)}

    ${step("4", "Call it from your software", `
      Each template is an API endpoint. Send your data, get a finished file back:
      <pre class="code" style="margin-top:10px">curl -X POST http://localhost:${PORT}/render \\
  -H 'content-type: application/json' \\
  -d '{"template":"certificate-block","format":"pdf",
       "data":{"name":"Maria Chen","course":"Advanced TypeScript"}}'

→ { "url": "http://localhost:${PORT}/out/…pdf" }</pre>
      Put that call wherever the event happens — order placed, student graduated, listing published —
      and every event produces its asset automatically. Field defaults fill in anything you don't send.`)}

    ${step("5", "Go beyond single images", `
      <b>PDF</b>: <code>"format":"pdf"</code> on the same call. &nbsp;<b>Bulk</b>: POST <code>/collections</code>
      with an array of data objects. &nbsp;<b>GIFs & slideshows</b>: the
      <a href="/tools" style="color:var(--accent)">Tools</a> page drives them from the browser.
      &nbsp;<b>Social previews with zero backend</b>: POST <code>/sign</code> once and paste the returned URL
      into an <code>og:image</code> tag — it renders on demand when anyone shares the link.
      Full endpoint reference: <a href="/docs" style="color:var(--accent)">API</a>.`)}

    <div class="panel" style="margin-bottom:18px"><h3>Things worth knowing</h3>
      <div style="font-size:14px;line-height:1.8;color:var(--text)">
      • <b>Layouts adapt.</b> A list block makes one row per item — 3 items or 30, same template.<br>
      • <b>Long text protects itself.</b> Blocks with "Shrink to fit" scale their text down instead of overflowing.<br>
      • <b>Nothing falls off the canvas.</b> Nudge stops at the edges; floating positions are always on-canvas.<br>
      • <b>Renders are deterministic.</b> Same template + same data = the identical file, every time.<br>
      • <b>API data always wins.</b> Field defaults are just what shows when a key isn't sent.</div></div>
  </div>`, user));
});

app.get("/docs", (req, res) => {
  const user = readSession(req);
  const ep = (method: string, route: string, desc: string, body: string) => `
    <div class="panel endpoint"><h3>${method} ${route}</h3>
    <div class="hint" style="margin:0 0 10px">${desc}</div>
    <pre class="code">${body}</pre></div>`;
  res.type("html").send(pageShell("docs", `<div class="wrap">
    <h1>API</h1><div class="sub">Everything the dashboard does is one of these calls. Templates are .tsx files — POST them or drop them in <code>templates/</code>.</div>
    ${ep("POST", "/render", "Template + data → PNG or PDF. Supports transparent, effects, async + webhook.",
      `{ "template": "receipt", "data": { ... }, "width": 1200, "height": 630,
  "format": "png" | "pdf", "transparent": false, "effects": ["grayscale"],
  "async": false, "webhook_url": "https://..." }
→ { "url": "...", "ms": 610 }        (async → { "job_id", "status_url" })`)}
    ${ep("POST", "/collections", "One template, many data objects → many images in one call.",
      `{ "template": "og-card", "items": [ {...}, {...}, {...} ] }
→ { "count": 3, "images": [ { "url": ... }, ... ] }`)}
    ${ep("POST", "/gif", "Template rendered once per frame → looping animated GIF.",
      `{ "template": "og-card", "frames": [ {...}, {...} ], "frame_ms": 800 }`)}
    ${ep("POST", "/movie", "Slides (template+data or image_url) → mp4 slideshow with crossfades.",
      `{ "slides": [ { "template": "og-card", "data": {...} }, { "image_url": "https://..." } ],
  "slide_ms": 2500, "transition_ms": 500, "width": 1280, "height": 720 }`)}
    ${ep("POST", "/video/overlay", "Render template transparent, composite over a video (watermarks, lower-thirds, frames).",
      `{ "video_url": "https://.../clip.mp4", "template": "watermark", "data": {...} }`)}
    ${ep("POST", "/screenshot", "Capture any public URL.",
      `{ "url": "https://example.com", "width": 1280, "full_page": false, "mobile": false }`)}
    ${ep("POST", "/sign", "Mint a permanent GET URL that renders on demand (og:image tags, no backend call).",
      `{ "template": "og-card", "data": {...} } → { "url": "http://.../r/og-card.png?d=...&s=..." }`)}
    ${ep("GET", "/jobs/:id", "Poll an async render.", `→ { "status": "queued|rendering|done|error", "result": {...} }`)}
    ${ep("POST", "/api/templates", "Create/update a template from source. GET lists; DELETE removes.",
      `{ "name": "my-card", "source": "import React from 'react'; export default ..." }`)}
    <div class="panel endpoint"><h3>Auto-fit text & custom fonts</h3>
    <div class="hint">Any element with <code>data-fit</code> shrinks its font-size until content fits its box (floor: <code>data-fit-min</code>). Drop .ttf/.otf/.woff2 files into <code>fonts/</code> and use the filename as <code>fontFamily</code> in any template.</div></div>
  </div>`, user));
});

app.listen(PORT, () => {
  console.log(`Renderkit on http://localhost:${PORT}`);
  getBrowser();
});
