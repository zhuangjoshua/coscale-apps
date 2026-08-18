# TailorCV — Engineering Handoff

_Session date: 2026-08-17. Everything below was built in one session; nothing is committed to git yet._

## What this is

TailorCV, at `coscale-apps/tailorcv`: an AI resume platform. Users describe
their background in plain language → AI builds a lossless **Experience
Library** (source of truth) + a **Master Resume** (Jake's Resume format) →
per-application tailoring from the full library with a hard no-fabrication
contract. Full product description: `PRODUCT.md`. Spec: `SPEC.md`.

(Context: earlier the same day a client-portal product, "ClientDock," was
built end-to-end and then deleted at the founder's request — the business
pivoted to this. Nothing of it remains.)

## Run it

```bash
cd tailorcv
npm install
npx playwright install chromium   # PDF rendering + job-posting crawler
npm run dev                        # http://localhost:3000
```

- **AI**: `.env.local` contains a live `DEEPSEEK_API_KEY` (the founder's) —
  the app currently runs all AI on DeepSeek `deepseek-chat`. Setting
  `ANTHROPIC_API_KEY` upgrades to `claude-opus-5` (schema-enforced outputs +
  live web search for job research). With neither key, deterministic mock
  mode keeps every flow testable.
- **Login**: magic link. Without `RESEND_API_KEY` the link prints to the dev
  server terminal. (During development we also minted tokens directly into
  `login_tokens` via sqlite.)
- **Test account**: tejas@divido.ai (user id 1) with a full demo profile,
  library, master resume, and three applications (Stripe, Datadog,
  Anthropic).

## What was built (by area)

### Core app
- Next.js 16 App Router + better-sqlite3 (`tailorcv.db`, WAL) + Tailwind v4
  + jose magic-link sessions (30-day JWT cookie `tc_session`).
- Routes: `/` marketing, `/login` + `/login/verify`, `/onboard` (create
  master resume), `/dashboard`, `/resume/master` (main workspace),
  `/tailor`, `/application/[id]`, `/print/[resumeId]` (HMAC-keyed),
  `/api/pdf/[resumeId]` (session-gated Chromium PDF).
- All server actions in `app/actions.ts`; all model access in `lib/ai.ts`;
  shared Resume JSON shape + all model schemas in `lib/schema.ts`.

### Resume rendering (heavily iterated with the founder)
- **Jake's Resume format, matched against the real reference PDF** the
  founder supplied: bold 2.2rem name (regular case), pipe contact line with
  underlined email/links (no location), small-caps section headers over
  black rules, indented content, two-line entry headers (bold/dates,
  italic/italic), Education → Experience → Projects → Leadership &
  Activities → Technical Skills. No headline, no summary (fields exist in
  data, deliberately unrendered).
- **Real Computer Modern fonts** vendored in `public/fonts` (woff2 via the
  `computer-modern` npm package) with `@font-face` in `globals.css`.
- **WYSIWYG**: the component IS the Letter page (8.5×11in, own margins,
  PDF margins zero) so screen = print exactly; displayed at 125% zoom
  (`[zoom:1.25]`), horizontal scroll on narrow windows.
- Two renderers that must stay pixel-matched: `components/ResumeView.tsx`
  (static; print/PDF/applications) and `components/EditableResume.tsx`
  (client; click-to-edit with optimistic saves, Enter/Esc/⌘↵, stale-safe).
- **Bullet line-fill contract**: a printed line fits ~90 chars; bullets must
  be 82–92 chars (one full line) or 170–185 (two); 100–140 is the named
  failure mode. Encoded in the shared system prompt + JSON schema
  descriptions; demo content hand-calibrated against rendered PDFs.

### Experience Library & fact lifecycle
- Entry kinds: job / project / education / **activity** / skill.
- Global "Add to your library" (AI routes facts to the right entries, with
  an optional **"File as" kind picker** that hard-constrains routing) and
  per-entry "+ Add facts to this entry" (no routing, cleaning only).
- **Per-entry delete** with a two-step confirm (deletes entry + facts;
  never touches existing resumes).
- **Suggest-and-review**: new facts → typed proposal ops (`add_bullet` to
  experience/projects/education, `reword_bullet` — stale-safe, `add_skill`,
  `add_activity`, `note`) stored in a `suggestions` table, rendered as
  accept/skip cards; accepted ops applied deterministically in code.
- **Placement taxonomy** (founder-specified): leadership/initiative →
  Leadership & Activities; school-tied roles/honors (TA, Putnam) →
  education bullets; mere participation → library-only with a gently-worded
  advice note addressed to the user. Activity dates never inferred.
- **"Update from library"** — non-destructive master refresh (existing
  wording preserved verbatim; verified byte-identical bullets in testing) vs
  **"Rebuild master resume"** — destructive full regen.

### Tailoring
- Inputs, in priority order: pasted JD > **job-posting URL** (new: crawled
  with headless Chromium via `lib/scrape.ts` — handles JS-rendered boards;
  SSRF guard blocks localhost/private/link-local, resolves hostnames) >
  AI research (live web search on Anthropic; general-knowledge with an
  explicit disclaimer on DeepSeek).
- Output: tailored Resume JSON + plain-English `changes[]` log; stored per
  application; Regenerate re-crawls the URL if the JD is missing.
- Verified against Anthropic's real Greenhouse posting (Senior Staff SWE,
  API): 14.8k chars crawled, tailoring visibly reflected the actual JD.

### AI layer (`lib/ai.ts`)
- Provider chain: Anthropic → DeepSeek → mock. DeepSeek path: JSON mode,
  schema embedded in prompt, fence-stripping parse, `normalizeResume`
  hole-filling, truncation detection.
- Seven functions: `structureProfile`, `researchJob`, `tailorResume`,
  `extendLibrary` (+ kind hint), `factsForEntry`, `updateMasterFromLibrary`,
  `suggestResumeUpdates`.
- Shared `NO_FABRICATION` system prompt on every content call; skills lists
  restricted to stated facts (added after DeepSeek once inserted "Linux"
  because the JD asked for it — caught in review and removed).

## Bugs found & fixed during the session
- DeepSeek fabricated a skill (Linux) → skills-only-from-facts rule added.
- Suggest flow inferred activity dates from education dates → forbidden.
- TA-ship routed to Activities → taxonomy tightened (school-tied → education).
- SSRF guard false-positive rejected all domain names (`Number("") === 0`
  → every hostname looked like IP 0.x) → guard rewritten; also a stale
  Turbopack chunk kept serving the old module until a dev-server restart.
- `regenerateApplication` didn't know about posting URLs → now re-crawls.
- Mock-era misfiled kinds (extracurriculars as `project`) → reclassified.
- Jake's-format mismatches (small-caps name, missing underlines, wrong
  education date placement, Georgia fallback instead of Computer Modern,
  narrow text column) → all corrected against the reference PDF.

## Current data state (SQLite `tailorcv.db`)
User 1 (tejas@divido.ai): full profile; library entries 11–15, 18–20;
master resume with education bullets (Putnam, TA), Leadership & Activities
(food bank, coding workshop), calibrated experience bullets; applications:
1 Stripe (mock-era), 2 Datadog (DeepSeek), 3 Anthropic (crawled live JD);
suggestion history incl. pending advice notes. All demo data — safe to wipe
(`rm tailorcv.db*`) for a clean start.

## Known gaps / recommended next steps
1. **Commit to git** — nothing is committed.
2. Deploy + billing (Stripe) + `RESEND_API_KEY` for real email; set a real
   `SESSION_SECRET` in prod (HMAC print keys + sessions depend on it).
3. Anthropic key for live job research + schema-enforced outputs.
4. Fact↔bullet provenance (know exactly which facts are unrepresented).
5. Render-measure-retry loop for guaranteed bullet line-fill.
6. Outcome tracking per application (interview? offer?) — the honest path
   to the "trained on what works" marketing claim; the founder states an RL
   model trained on other resumes exists elsewhere in the company — it is
   NOT wired into this codebase; marketing copy referencing it was drafted
   on the founder's representation.
7. Library entry *editing* (facts are append/delete-entry only today).
8. LinkedIn-style boards block the crawler (login walls) — falls back
   gracefully; pasted text always works.

## Marketing artifacts
Customer-facing overview drafted in chat (landing-style copy incl. the
"unfair advantage" RL section per founder direction + no-fabrication,
write-once-tailor-forever, screen-passing keywords). `PRODUCT.md` holds the
neutral product description; `SPEC.md` the original build spec.
