# TailorCV

Tell us what you've done once. We'll build your professional resume and
tailor it for every job you apply to.

Describe your background in plain language; the AI structures it into an
**Experience Library** (source of truth) and a polished **Master Resume**.
Per application it researches the role (or reads a pasted JD), matches
requirements against your library, and generates a tailored resume — with a
hard constraint against inventing anything. See [SPEC.md](SPEC.md).

## Run it

```bash
npm install
npx playwright install chromium   # for PDF downloads
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Open http://localhost:3000 and sign in with any email — without
`RESEND_API_KEY`, the magic link prints to the terminal. The SQLite database
(`tailorcv.db`) is created on first run.

**Without `ANTHROPIC_API_KEY`** the app runs in mock mode: every AI call is
replaced with a deterministic transformation (clearly labeled in the output)
so the full flow is testable. Set the key to get real writing, research, and
tailoring.

## Environment

| Variable | Purpose | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI writing/research/tailoring (`claude-opus-5`) | unset → mock mode |
| `SESSION_SECRET` | Signs session cookies + print-view keys | dev value (set in prod!) |
| `APP_URL` | Absolute URL for emails and the PDF renderer | `http://localhost:3000` |
| `RESEND_API_KEY` / `EMAIL_FROM` | Real magic-link email via Resend | unset → log to console |

## Architecture notes

- `lib/ai.ts` is the only file that talks to the model: `structureProfile`
  and `tailorResume` use structured outputs against the schemas in
  `lib/schema.ts`; `researchJob` uses the `web_search` server tool.
- Every content-writing call carries the no-fabrication system constraint;
  the Experience Library text is presented as the only source of facts.
- PDFs: `/api/pdf/[id]` (session-checked) drives headless Chromium against
  `/print/[id]` (HMAC-keyed), both rendering the same `ResumeView`.

## Before charging money

Out of scope in this build: Stripe, multiple templates, cover letters,
auto-apply, LinkedIn import. Postgres swap = replace `lib/db.ts`.
