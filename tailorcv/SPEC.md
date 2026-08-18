# TailorCV — MVP spec

**Tell us what you've done once. We'll build your professional resume and
tailor it for every job you apply to.**

The user describes their background in plain language. The AI structures it
into an **Experience Library** (the source of truth) and writes a polished
**Master Resume**. For each application, the platform researches the role (or
reads a pasted job description), selects the most relevant experience, and
generates a tailored resume — rewriting and re-emphasizing, never inventing.

## Core constraint: no fabrication

Every AI call that writes resume content carries a hard system-prompt
constraint: it may rewrite, reorganize, shorten, and emphasize facts from the
Experience Library, but may not add technologies, employers, dates, metrics,
degrees, or accomplishments the user did not provide. The library is the only
source of facts; the tailored output is a projection of it.

## Roles & auth

Single-role app. Email magic link → 30-day session cookie (same pattern as
the other coscale apps). No client-side accounts to manage.

## AI layer (`lib/ai.ts`)

Anthropic SDK, model `claude-opus-5`, adaptive thinking (default), streaming
with `finalMessage()` for long generations.

| Function | Input | Output | API features |
|---|---|---|---|
| `structureProfile` | free-text intake (background, jobs, projects, education, skills) | Experience Library entries + Master Resume JSON | structured outputs (`output_config.format`) |
| `researchJob` | company + title | plain-text research notes on responsibilities/skills/stack | `web_search_20260209` server tool (no `output_config` — citations conflict) |
| `tailorResume` | library + master resume + job description or research notes | tailored Resume JSON + change summary | structured outputs |

**Mock mode:** when `ANTHROPIC_API_KEY` is unset, each function returns a
deterministic transformation of its input (clearly labeled) so the full
product flow works locally without a key. `lib/ai.ts` is the only file that
knows which mode it is in.

## Data model (SQLite)

- `users`, `login_tokens`, `emails` — standard auth plumbing
- `profiles` — one per user: name, email, phone, location, links, raw intake
  text (kept so the user can re-run structuring)
- `entries` — Experience Library: kind (`job|project|education|skill`),
  title, org, dates, `facts` (JSON array of atomic fact strings), skills
- `resumes` — `kind` = `master` or `tailored`, `content` (Resume JSON),
  `application_id` nullable
- `applications` — company, role, `jd_text` (pasted) or `research` (notes),
  status (`researching|ready|generating|complete`), change summary

## Resume JSON (single shared schema, `lib/schema.ts`)

```
{ name, headline, contact{email,phone,location,links[]}, summary,
  experience[{title, org, location, dates, bullets[]}],
  projects[{name, description, bullets[]}],
  education[{degree, school, dates, notes}],
  skills[{category, items[]}] }
```

## Screens

- `/` marketing, `/login` + `/login/verify` magic link
- `/onboard` — conversational intake: big free-text areas → "Build my resume"
  → AI structures profile → redirect to master resume
- `/dashboard` — Master Resume card + Applications list (company — role —
  status), "Tailor for a job" button
- `/resume/master` — rendered master resume, edit any bullet/section, view
  Experience Library beneath it
- `/tailor` — form: company + title, or paste full JD → creates application,
  runs research (if needed) + tailoring
- `/application/[id]` — tailored resume preview, what-changed summary,
  research notes, download PDF, regenerate
- `/api/pdf/[resumeId]` — Playwright renders the print view to PDF
- `/print/[resumeId]` — print-optimized standalone resume page (also what
  Playwright loads)

## Out of scope (v1)

Stripe billing, multiple resume templates, cover letters, auto-apply,
interview prep, LinkedIn import, team accounts.
