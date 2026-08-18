# Pagewright

Templated document generation. Design a document once, then POST JSON to get a
finished PDF — the CraftMyPDF model, built end to end.

Two processes make one product:

| | |
| --- | --- |
| `pagewright/` | document service — Express + Chromium. Renders, stores, serves the API. |
| `pagewright/pagewright-site/` | the site and the signed-in editor (static SPA). |

```bash
# document service
npm install && npm start          # http://localhost:4310

# site + editor, in another shell
cd pagewright-site && npm install && npm run dev   # http://localhost:5173
```

Sign in on the site and `/app` lands on the editor. The service stays separate
because the layout engine drives a headless browser, which the site's static/action
runtime cannot host.

**Auth.** The browser sends its Supabase access token as `Authorization: Bearer …`
and the service scopes every template, key and job to that account. Verification
mode comes from the environment:

| Variable | Effect |
| --- | --- |
| `PAGEWRIGHT_JWT_SECRET` | HS256 verification with Supabase's JWT secret |
| `PAGEWRIGHT_JWKS_URL` | RS256 verification via JWKS |
| neither | **dev only** — tokens decoded but not verified; anonymous callers get the `local` account. Logs a warning. |
| `PAGEWRIGHT_ALLOWED_ORIGINS` | CORS allowlist (default: localhost 5173/4173/8853) |
| `VITE_PAGEWRIGHT_API` | site → service base URL (default `http://localhost:4310`) |

Set one of the first two before deploying. Verified: a forged signature, a missing
token and an expired token all return 401; two accounts each see only their own
templates.

```bash
npm run smoke      # 38 end-to-end checks
npm run lengths    # adversarial length probe
npm run typecheck
```

The original self-hosted editor is still served at `/legacy` for working without
the site running. `pagewright-site` also exposes `/dev/editor`, an ungated editor
for local use when Supabase auth isn't configured — it is inside an
`import.meta.env.DEV` branch, so it is compiled out of production builds.

First boot seeds five templates: **Invoice**, **Quote / estimate**, **Certificate**,
**Monthly report** and a **Fillable intake form**.

The quote is the reference template — it exercises every capability at once: a
flowing line-item table, conditional sections, a deposit/balance split computed
from the data, and an acceptance block whose name and date are real AcroForm
fields, so the customer signs the PDF instead of printing it.

## Why it's a flow engine, not a canvas

The distinction that separates this class of product from image-generation APIs
(Bannerbear et al.) is the layout model. A canvas answers *"where does this element
go?"* — fixed coordinates, one page. A document engine answers *"how much room does
this content need?"* Content pushes content, tables break across pages, headers
repeat.

Pagewright is flow-based throughout:

| Concern | How |
| --- | --- |
| Pagination | normal document flow, `break-inside: avoid` on rows |
| Repeating table headers | `thead { display: table-header-group }` |
| Running header/footer | Chromium `displayHeaderFooter` templates |
| Page numbers | `<span class="pageNumber">` / `<span class="totalPages">` |
| Explicit breaks | `pagebreak` block |
| Conditional sections | `when` on any block — compiles to an `{{#if}}` wrapper |

Verified: the seeded invoice with 4 line items is 1 page; the same template with
200 line items is 9 pages, the column header repeats on all 8 pages that carry
rows, and footers read `Page 1 of 9` … `Page 9 of 9`.

## Unknown lengths

The whole point of the engine, so it's probed directly — `npm run lengths` renders
the quote against deliberately wrong-sized data and reports page count plus any
content escaping the page box horizontally.

| Case | Result |
| --- | --- |
| 0 rows | empty-state row, no crash |
| 1 / 7 / 150 rows | 2 → 2 → 9 pages, header repeats |
| 600-char cell | wraps, row grows, stays intact |
| unbroken 300-char token | wraps (see `overflow-wrap: anywhere`) |
| row taller than one page | splits across 5 pages rather than clipping |
| very long company name | brand bar reflows |
| all optional fields missing | renders, conditional sections drop out |
| 30× scope paragraph | 4 pages |

Two behaviours worth knowing: rows carry `break-inside: avoid`, but a row taller
than a page break anyway (correct — the alternative is clipping); and text is
never auto-shrunk to fit, unlike a canvas product, because a document grows
downward instead.

## Deploying (standalone)

One process serves the site, the editor and the API. No external platform, no Supabase,
no second host.

```bash
npm install
npm run build:site          # builds the SPA into pagewright-site/dist
GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… PAGEWRIGHT_SESSION_SECRET=… npm start
```

Or with Docker, which brings its own Chromium:

```bash
docker build -t pagewright .
docker run -p 4310:4310 --env-file .env pagewright
```

**Google sign-in** uses the server-side authorization-code flow — no third-party script
loads in the page. In Google Cloud Console create an OAuth 2.0 Client ID (Web
application) and add the redirect URI:

```
https://YOUR-DOMAIN/api/auth/google/callback
```

Then set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `PAGEWRIGHT_SESSION_SECRET`
(see `.env.example`). The service verifies Google's ID token against Google's JWKS and
sets its own httpOnly session cookie; the browser never handles a token.

Without those variables the service runs in an unverified dev mode and says so on boot.

**Persistence** is flat files under `storage/` — mount it as a volume, or move it to a
database before you have real customers.

## Architecture

```
template (blocks + page + theme)
      │  blocks.ts        → HTML with {{ }} tokens still in it, compiled once
      ▼
   + JSON data
      │  template-engine.ts → merge
      ▼
    HTML
      │  render.ts        → Chromium print → PDF / screenshot → PNG, JPEG
      ▼
    bytes
      │  forms.ts         → stamp AcroForm widgets over field placeholders
      ▼
   stored artifact + job receipt
```

- `src/template-engine.ts` — `{{path}}`, `{{{raw}}}`, `{{#each}}`, `{{#if}}/{{else}}`,
  `{{#unless}}`, `../` parent scope, subexpressions `{{money (sum items "total") currency}}`,
  and helpers (`money`, `date`, `sum`, `number`, `multiply`, `upper`, `default`, `eq`, `gt`, `length`).
- `src/blocks.ts` — the block model the editor manipulates, compiled to HTML + CSS.
- `src/render.ts` — one long-lived Chromium, a context per render.
- `src/forms.ts` — fillable fields and the PDF join utility.
- `src/store.ts` — flat-file persistence (templates, API keys, job log).

## Editor

`http://localhost:4310` — template list, block editor with drag-reorder, JSON sample
data, page setup, theme, and a live preview that re-renders through the same pipeline
the API uses. **Data → Stress test: 200 rows** expands the sample array in place to
demonstrate pagination.

## API

Authenticate with `X-API-KEY` (create keys in the sidebar).

### `POST /v1/create`

```json
{
  "template_id": "tpl_invoice",
  "export_type": "json",
  "output_file": "acme-invoice.pdf",
  "format": "pdf",
  "field_values": { "full_name": "Dana Whitfield" },
  "webhook_url": "https://example.com/hook",
  "data": { "invoice_number": "INV-9001", "items": [ … ] }
}
```

| Field | Values |
| --- | --- |
| `export_type` | `json` (default, returns a URL), `base64`, `file` (binary body) |
| `format` | `pdf` (default), `png`, `jpeg` |
| `field_values` | prefill for fillable fields, keyed by field name |
| `webhook_url` | optional; POSTed on completion |

Response: `{ status, transaction_ref, pages, bytes, ms, file }`

### Other routes

- `GET /v1/templates` — list templates
- `GET /v1/status/:transaction_ref` — job state
- `POST /v1/merge` `{ files: [url | base64, …] }` — join PDFs
- `GET /healthz`

## Known limits

- **Fillable field placement is arithmetic.** Placeholder geometry is measured in
  continuous document flow and mapped onto pages by dividing by content height. It
  holds on real multi-page documents — the quote's acceptance fields land on page 2
  alongside their printed labels — but a field sitting exactly on a natural page break
  inside a long flowing table can be placed a page off. Use an explicit `pagebreak`
  block in those templates.
- **No auth on the dashboard.** `/api/*` is unauthenticated and assumes a local or
  otherwise protected deployment. Only `/v1/*` checks keys.
- **Storage is flat files** under `storage/`. Fine for one process; a real deployment
  needs a database and object storage.
- **Fonts are whatever Chromium has.** No webfont upload yet; set a `font` stack in
  Theme that resolves on the host.
- `.jpeg` output is available via the API but the editor previews PDF and PNG only.
