# Renderkit

Media-generation API + visual template editor. Templates + JSON → PNG / PDF / GIF / MP4,
rendered deterministically by headless Chrome and ffmpeg.

**Everything lives in this folder.** One Node process serves the public site, sign-in,
the dashboard, the editor, and the render API. The only outbound calls at runtime are
Google (sign-in) and — once wired — Stripe. Face detection, fonts, the whisper model
and all UI assets are served from disk here.

## Layout

```
server.tsx          express app: API + dashboard + auth + static site
blocks.tsx          block-template renderer (JSON doc → React → HTML)
editor.tsx          visual editor page (served at /edit/:name)
templates/*.json    block templates (the gallery)
renderkit-site/     public marketing site (Vite SPA); built output in dist/ is served at /
vendor/mediapipe/   face-detection model + wasm for /smartcrop (no CDN)
fonts/              drop .ttf/.otf/.woff2 here → usable by filename in templates
models/             whisper model for /video/subtitle (downloaded, gitignored)
out/                rendered files + render log (gitignored)
```

## Run locally

```bash
npm install
npx playwright install chromium
brew install ffmpeg whisper-cpp poppler        # macOS; see Deploy for Linux
mkdir -p models && curl -L -o models/ggml-base.en.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
(cd renderkit-site && npm install && npm run build)
npm run dev                                     # → http://localhost:8890
```

Without Google credentials the app offers a local `dev@localhost` session.

## Configuration — `.env.local`

```
BASE_URL=https://yourdomain.com          # public origin; used for OAuth redirect + signed URLs
GOOGLE_CLIENT_ID=...                     # console.cloud.google.com → OAuth client (Web)
GOOGLE_CLIENT_SECRET=...                 #   redirect URI: ${BASE_URL}/api/auth/callback
PORT=8890                                # optional
```

Google scopes used: `openid email profile` only (no sensitive scopes → no verification review).

## Deploy (any Linux VPS / Fly / Railway — NOT a static host)

This is a running Node process that needs Chromium and ffmpeg on the box.

```bash
# Ubuntu/Debian
apt-get install -y ffmpeg poppler-utils
npm ci && npx playwright install --with-deps chromium
# whisper: build whisper.cpp or apt package if available; the server calls `whisper-cli`
(cd renderkit-site && npm ci && npm run build)
BASE_URL=https://yourdomain.com PORT=8890 npm start
```

Put it behind Caddy/nginx for TLS. Persist `out/`, `templates/`, `users.json`, `.secret`
across deploys (or move `out/` to R2/S3 — see below).

Minimal systemd unit:

```
[Service]
WorkingDirectory=/srv/renderkit
ExecStart=/usr/bin/npm start
Restart=always
EnvironmentFile=/srv/renderkit/.env.local
```

## Not yet built (launch gap)

API keys / multi-tenancy, usage metering, Stripe billing, persistent job queue
(async jobs are in-memory), object storage for `out/` (currently local disk),
rate limiting, sandboxing untrusted templates. `README` will be updated as each lands.

## API (short)

`POST /render {template, data, format?, width?, height?, async?, webhook_url?}` → `{url}`
Also: `/collections`, `/sets/:name/render`, `/gif`, `/movie`, `/video/overlay|multi-overlay|subtitle|edit`,
`/kenburns`, `/screenshot`, `/pdf/join|rasterize`, `/smartcrop`, `/sign`, `/jobs/:id`,
`/api/templates` (GET/POST/PUT/DELETE). Full reference at `/docs` in the running app.
