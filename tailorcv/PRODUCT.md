# TailorCV — Product Summary

**Tell us what you've done once. We'll build your professional resume and
tailor it for every job you apply to.**

TailorCV removes the two hardest parts of job applications: knowing how to
write strong resume language, and rewriting your resume for every posting.
You describe your background the way you'd tell a friend; the AI writes it
professionally, keeps every fact you've ever shared, and re-emphasizes the
right ones for each job — under a hard rule that it never invents anything.

## Core concepts

**Experience Library — the source of truth.** Everything you tell TailorCV
is stored as atomic facts, organized into entries (jobs, projects,
education, skills). The library is lossless: facts too minor for any resume
are still kept, because a future job might care. It is also the fabrication
guardrail — no resume may contain a claim that isn't in the library.

**Master Resume — your canonical document.** Generated from the library in
professional language, rendered in the Jake's Resume template (Computer
Modern serif, the de-facto SWE standard). Every tailored version starts
from it.

**Applications — one tailored resume per job.** Give a company + role (the
AI researches what the employer prioritizes) or paste the job description.
The AI selects the most relevant facts from the entire library, reorders and
rewords emphasis, and produces a job-specific resume plus a plain-English
"what changed and why" log.

## The full feature set

### Onboarding
- Conversational intake: five plain-language text areas (work, projects,
  education, skills, anything else) plus contact basics. No resume-speak
  required.
- One click builds the Experience Library + Master Resume.

### The resume itself
- Jake's Resume format, faithfully: bold serif name, pipe-separated contact
  line with underlined links, small-caps section rules, two-line entry
  headers (bold title / dates right, italic org / location right), Education
  first, then Experience, Projects, Leadership & Activities, Technical
  Skills.
- Real Computer Modern fonts, bundled — identical on every machine.
- Bullets are written to fill complete printed lines (one or two full lines,
  never a stranded half-line), 3–5 per role.
- The on-screen display **is** the print page: same Letter sheet, same
  margins, shown at 125% zoom. True WYSIWYG.

### Editing
- Click any text on the resume — bullets, titles, dates, summary — and edit
  it in place, in the document's own typography. Enter saves, Esc cancels.
  Optimistic updates; edits appear in the PDF immediately.

### Growing the library (without regenerating anything)
- **Add to a specific entry**: every library card has "+ Add facts to this
  entry" — your text is cleaned into atomic facts and appended there.
- **Add to the library globally**: describe anything; the AI routes each
  fact to the entry it belongs to, or creates a new entry.
- Neither touches the master resume, your edits, or existing applications.

### Suggest-and-review (facts → resume, with you in control)
After you add facts, the AI proposes a diff — never applies one:
- **Add bullet** to an experience/project/education entry
- **Reword bullet** (only applies if the bullet hasn't changed since —
  stale-safe)
- **Add skill** to a category
- **Add activity** to Leadership & Activities
- **Gentle advice** — "leave this one off": low-signal participation is
  kept in the library with a kind explanation of why it won't move a
  recruiter.
Accepted suggestions are applied deterministically in code; the model can't
touch anything you didn't approve.

Placement taxonomy the AI enforces:
- Leadership/initiative/impact (club president, founder, taught, organized)
  → **Leadership & Activities**
- School-tied roles and honors (TA, Putnam, dean's list) → **Education
  bullets**
- Mere participation → **library only, with advice**

### Bulk operations
- **Update from library** — non-destructively weaves unrepresented facts
  into the master resume; existing wording survives verbatim.
- **Rebuild master resume** — full destructive regeneration from a fresh
  intake (clearly separated from the safe path).

### Tailoring workflow
1. "Tailor for a job": company + role, and optionally the pasted JD.
2. No JD? The AI researches the role (live web search on Anthropic;
   general-knowledge with an explicit disclaimer on DeepSeek).
3. Tailored resume generated from the *whole* library — facts absent from
   the master resume surface when this job values them.
4. Application page: rendered resume, "what changed for this application"
   list, research notes/JD, Regenerate, Delete, Download PDF.
5. Dashboard lists every application (company — role — status), so there are
   no `resume_final2.pdf` files anywhere in your life.

### PDF
- One-click download, rendered by headless Chromium from the same component
  the screen uses. Session-authenticated; print URLs are HMAC-keyed.
  Filenames follow the application (`datadog-site-reliability-engineer.pdf`).

### The no-fabrication contract
Every AI call carries a hard constraint: rewrite, reorganize, condense,
emphasize — never invent employers, titles, dates, technologies, metrics, or
accomplishments. Skills lists may only contain items you actually stated.
"Made queries faster" may become "Optimized query performance"; it may never
become "cut latency 40%" unless you said 40%.

## Architecture

- **Stack**: Next.js 16 (App Router), SQLite (`better-sqlite3`), magic-link
  auth (no passwords), Tailwind v4, Playwright for PDFs.
- **AI providers** (`lib/ai.ts`, the only file that talks to models):
  1. **Anthropic** (`claude-opus-5`) when `ANTHROPIC_API_KEY` is set —
     schema-enforced structured outputs + live web search. Preferred.
  2. **DeepSeek** (`deepseek-chat`) when `DEEPSEEK_API_KEY` is set — JSON
     mode with defensive parsing/normalization. Currently active.
  3. **Mock mode** with neither — deterministic stand-ins keep every flow
     testable keyless.
- Seven AI functions: structure profile, research job, tailor resume, route
  library additions, clean per-entry facts, update master from library,
  suggest resume updates.

## Not built yet (known gaps / roadmap)

- Stripe billing, deployment, production email (Resend key), S3-free PDF is
  fine but uploads/exports beyond PDF don't exist
- Library entry edit/delete UI; activity row delete (clear the title as a
  workaround)
- Provenance tracking (bullet ↔ fact ids) for exact "unrepresented facts"
  indicators
- Render-measure-retry loop to guarantee bullet line-fill with any model
- Multiple templates, cover letters, LinkedIn import

---

# Detailed functional reference

## Routes

| Route | Auth | What it does |
|---|---|---|
| `/` | public | Marketing page. Hero, three feature cards, six-step pipeline strip, template preview. CTA switches Sign in / Dashboard based on session. |
| `/login` | public | Email form → `requestLogin` → magic-link email (printed to terminal without `RESEND_API_KEY`). Shows "check your email" state via `?sent=`. |
| `/login/verify?token=` | token | Single-use, 20-min token. Creates the account on first login, sets a 30-day JWT session cookie (`tc_session`), redirects to `/onboard` (no profile) or `/dashboard`. |
| `/onboard` | session | "Create your master resume." Contact basics + five free-text areas (work, projects, education, skills, extra). Prefills from the stored profile by splitting the saved intake on its `## Section` headers. Submitting REPLACES library + master resume (warned twice, ~1 min pending state). |
| `/dashboard` | session | Master Resume card (name, entry count, updated-at, links) + Applications list newest-first with status pills (amber Generating / green Ready / red Failed with error text) + "Tailor for a job." Redirects to `/onboard` if no master resume. |
| `/resume/master` | session | The main workspace. Action bar (Update from library / Download PDF / Rebuild), editable-banner, pending-suggestions review card, the WYSIWYG editable resume sheet (125% zoom), then the Experience Library: global add box + per-entry cards with facts, skills, and "+ Add facts to this entry." |
| `/tailor` | session | Company (req) + role (req) + optional pasted JD. Explains research fallback. Pending state ~1–2 min. Creates the application row `generating`, runs research (if no JD) + tailoring inline, redirects to the application. |
| `/application/[id]` | session+owner | Branches on status: `generating` (refresh/restart), `error` (message + Try again), `ready` (rendered resume sheet, Download PDF, Regenerate, what-changed list, research notes or provided JD, Delete). |
| `/print/[resumeId]?key=` | HMAC key | Bare resume sheet for the PDF renderer. Key = HMAC(id, user, created_at) with `SESSION_SECRET`; minted only by session-checked code. Wrong key → "Not found." |
| `/api/pdf/[resumeId]` | session+owner | Launches headless Chromium against the print URL, returns Letter PDF, zero margins (the sheet carries its own), `Content-Disposition` filename from the application (`{company}-{role}.pdf`) or `master-resume.pdf`. 503 with hint if Chromium missing. |

## Data model (SQLite, WAL)

- `users(id, email unique, created_at)`
- `login_tokens(token pk, email, expires_at, used)` — single-use, 20 min
- `profiles(user_id pk, full_name, email, phone, location, links json, intake text)` — intake kept verbatim for re-onboarding prefill
- `entries(id, user_id, kind job|project|education|skill, title, org, dates, facts json[], skills json[], position)` — the Experience Library
- `resumes(id, user_id, kind master|tailored, application_id nullable, content json Resume, updated_at)`
- `applications(id, user_id, company, role, jd_text nullable, research nullable, changes json[], status generating|ready|error, error)`
- `suggestions(id, user_id, kind, payload json, reason, status pending|accepted|skipped|stale)`
- `emails(to, subject, body, status)` — outbound log / dev inbox

## Resume JSON shape (lib/schema.ts — one shape everywhere)

`{ name, headline, contact{email, phone, location, links[{label,url}]},
summary, experience[{title, org, location, dates, bullets[]}],
projects[{name, description, dates, bullets[]}], education[{degree, school,
dates, notes, bullets[]}], activities[{title, detail, dates}],
skills[{category, items[]}] }`

Rendered by `ResumeView` (static: print/PDF/applications) and
`EditableResume` (client, pixel-identical, click-to-edit) — headline,
summary, and contact location are stored but not rendered (format decision).

## Server actions (app/actions.ts)

| Action | Effect |
|---|---|
| `requestLogin` / `logout` | Magic-link issue / session destroy |
| `buildProfile` | Intake → `structureProfile` → transactionally replace profile, entries, master resume → `/resume/master` |
| `updateResumeSection` | Inline-edit save. Field paths: `headline`, `summary`, `experience.{i}.title\|org\|location\|dates\|bullets`, `projects.{i}.name\|description\|dates\|bullets`, `education.{i}.bullets`, `activities.{i}.title\|detail\|dates`. Bullets = one per line, leading `-`/`•` stripped. |
| `addToLibrary` | Free text → `extendLibrary` → new entries appended + facts appended to existing entries (model-chosen ids validated against the user's real entries) → `generateSuggestions` |
| `addToEntry` | Free text + chosen entry → `factsForEntry` (cleaning only, no routing) → append facts/skills → `generateSuggestions` |
| `updateMasterResume` | `updateMasterFromLibrary` — minimal weave, existing wording preserved |
| `createApplication` | Insert `generating` → JD or `researchJob` → `tailorResume` → tailored resume row + changes → `ready` (or `error` with message) → redirect |
| `regenerateApplication` | Re-run tailoring against current library; replaces the tailored resume |
| `deleteApplication` | Removes application + its resume |
| `acceptSuggestion` | Deterministic apply: add_bullet (experience/projects/education), reword_bullet (only if bullet still matches `old_text`, else marked `stale`), add_skill (dedup, case-insensitive category match), add_activity. Transactional with status update. |
| `skipSuggestion` | Marks skipped, nothing applied |

## AI layer (lib/ai.ts — the only model-facing file)

Provider resolution: `ANTHROPIC_API_KEY` → Anthropic `claude-opus-5`
(streaming + `output_config` JSON-schema-enforced structured outputs;
`web_search` server tool for research; refusal guard) → else
`DEEPSEEK_API_KEY` → DeepSeek `deepseek-chat` (JSON mode, schema embedded in
prompt, fence-stripping parse, `normalizeResume` fills structural holes,
truncation detection) → else deterministic mocks.

| Function | In → Out |
|---|---|
| `structureProfile` | basics + intake → `{entries[], resume}` (lossless library + master) |
| `researchJob` | company, role → prose notes. Anthropic: live web search, max 6. DeepSeek: general knowledge, output prefixed with an explicit not-live disclaimer. |
| `tailorResume` | library text + master + job info → `{resume, changes[]}` |
| `extendLibrary` | existing entries (with ids) + new text → `{additions[], appends[{entry_id, facts, skills}]}` |
| `factsForEntry` | one entry's context + new text → `{facts[], skills[]}` |
| `updateMasterFromLibrary` | master + library → `{resume, changes[]}`, wording-preserving |
| `suggestResumeUpdates` | master + new facts → typed ops (see below) |

Shared system constraint on every content-writing call:
1. **No fabrication** — rewrite/reorganize/emphasize only; never invent
   employers, titles, dates, tech, metrics, degrees, accomplishments; skills
   only from stated facts; weaker phrasing when in doubt.
2. **Bullet metrics** — a printed line fits ~90 chars; bullets must end at a
   line end: 82–92 chars (one full line) or 170–185 (two); 100–140 is the
   named failure mode.
3. **Placement taxonomy** — leadership/initiative → Activities; school-tied
   roles/honors → education bullets; mere participation → library-only with
   a gently-worded note addressed to the user; activity dates never inferred.

## Suggestion lifecycle

`pending` → user clicks → `accepted` (op applied in code, transactionally) |
`skipped` | `stale` (reword target changed since proposal, or payload
invalid). Generation failures never block the fact-add (logged, swallowed).
Note-kind suggestions render as advice with Dismiss only.

## Template spec (Jake's Resume match)

Letter sheet 8.5×11in carrying its own margins (0.55in x / 0.5in y), PDF
margins zero — screen and print are the same box. Computer Modern (bundled
woff2, 400/700 roman+italic). Name `2.2rem` bold; contact line `0.78rem`
with underlined email/links; small-caps section headers over full-width
black rules; content indented `pl-4`; two-line entry headers; disc bullets
`0.9rem` tight; skills as bold-label lines. Empty-title activity rows are
hidden in the static renderer (clearing a title deletes the row); editor
shows placeholders for empty editable fields.

## Auth & security details

30-day HS256 JWT cookie (`httpOnly`, `sameSite=lax`, `secure` in prod).
Magic-link tokens single-use with expiry. Every query scoped by `user_id`;
suggestion entry-ids revalidated against the owner's rows before writes.
Print view HMAC-gated; PDF route session-gated; `.env.local` (provider keys)
gitignored.
