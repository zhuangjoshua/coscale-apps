import Anthropic from "@anthropic-ai/sdk";
import {
  EXTEND_JSON_SCHEMA,
  FACTS_JSON_SCHEMA,
  SUGGEST_JSON_SCHEMA,
  LIBRARY_JSON_SCHEMA,
  LibraryEntryDraft,
  Resume,
  TAILORED_JSON_SCHEMA,
} from "./schema";

/**
 * All model access lives here. With ANTHROPIC_API_KEY set, calls go to
 * claude-opus-5; without it, deterministic mock implementations keep the
 * whole product flow working locally (clearly labeled in their output).
 */

const MODEL = "claude-opus-5";
const DEEPSEEK_MODEL = "deepseek-chat";

/** Anthropic is preferred (structured outputs + live web research); DeepSeek
 *  is the OpenAI-compatible fallback; mock keeps the app usable keyless. */
export function provider(): "anthropic" | "deepseek" | "mock" {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.DEEPSEEK_API_KEY) return "deepseek";
  return "mock";
}

export const aiEnabled = () => provider() !== "mock";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

/* --------------------------------------------------------------- deepseek */

async function dsChat(opts: {
  system: string;
  user: string;
  json?: boolean;
}): Promise<string> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      max_tokens: 8000,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`DeepSeek API error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices: { message: { content: string }; finish_reason: string }[];
  };
  const choice = data.choices?.[0];
  if (!choice) throw new Error("DeepSeek returned no choices");
  if (choice.finish_reason === "length") {
    throw new Error("DeepSeek response was truncated — try shorter input");
  }
  return choice.message.content;
}

/** DeepSeek has no schema enforcement — parse defensively. */
function dsParse<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned) as T;
}

/** Fill any holes so a slightly-off DeepSeek response can't crash a page. */
function normalizeResume(r: Partial<Resume>, fallback?: Resume): Resume {
  const f = fallback;
  return {
    name: r.name ?? f?.name ?? "",
    headline: r.headline ?? f?.headline ?? "",
    contact: {
      email: r.contact?.email ?? f?.contact.email ?? "",
      phone: r.contact?.phone ?? f?.contact.phone ?? "",
      location: r.contact?.location ?? f?.contact.location ?? "",
      links: r.contact?.links ?? f?.contact.links ?? [],
    },
    summary: r.summary ?? "",
    experience: (r.experience ?? []).map((e) => ({
      title: e.title ?? "",
      org: e.org ?? "",
      location: e.location ?? "",
      dates: e.dates ?? "",
      bullets: e.bullets ?? [],
    })),
    projects: (r.projects ?? []).map((p) => ({
      name: p.name ?? "",
      description: p.description ?? "",
      dates: p.dates ?? "",
      bullets: p.bullets ?? [],
    })),
    education: (r.education ?? []).map((e) => ({
      degree: e.degree ?? "",
      school: e.school ?? "",
      dates: e.dates ?? "",
      notes: e.notes ?? "",
      bullets: e.bullets ?? [],
    })),
    activities: (r.activities ?? []).map((x) => ({
      title: x.title ?? "",
      detail: x.detail ?? "",
      dates: x.dates ?? "",
    })),
    skills: (r.skills ?? []).map((g) => ({
      category: g.category ?? "",
      items: g.items ?? [],
    })),
  };
}

function schemaInstruction(schema: unknown): string {
  return `\n\nRespond with a single JSON object (no markdown fences, no commentary) that validates against this JSON Schema:\n${JSON.stringify(schema)}`;
}

/**
 * The non-negotiable constraint carried by every content-writing call.
 * The Experience Library is the only source of facts.
 */
const NO_FABRICATION = `You are a professional resume writer. Hard constraint, no exceptions:
you may rewrite, reorganize, condense, and re-emphasize the facts the user
provided, but you may NEVER invent qualifications, employers, job titles,
dates, technologies, metrics, degrees, or accomplishments they did not state.
If the user said "made some database queries faster", you may write
"Optimized database query performance" — you may NOT write "reduced query
latency by 40%" unless they gave that number. When in doubt, use the weaker,
factual phrasing. Omissions are fine; additions are not. Skills lists may
only contain technologies and tools explicitly present in the user's facts —
never add a skill because the job asks for it.

Bullet style: every experience entry gets 3-5 bullet points. A printed line
fits about 90 characters, and every bullet must end at a line end, never in
the middle of one: write each bullet to 82-92 characters (one completely
full line), or, when the facts genuinely warrant it, 170-185 characters
(two completely full lines). A bullet of 100-140 characters is the worst
case — it wraps and strands a half-empty second line. Reach the target
length with the real specifics the user provided (technologies, scope,
context, outcomes) or by merging closely related facts, never with filler
or invented detail.`;

function firstText(content: Anthropic.ContentBlock[]): string {
  const block = content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("Model returned no text content");
  return block.text;
}

function guardRefusal(message: Anthropic.Message) {
  if (message.stop_reason === "refusal") {
    throw new Error("The model declined this request. Try rewording your input.");
  }
}

export interface ProfileBasics {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  links: { label: string; url: string }[];
}

export interface StructuredProfile {
  entries: LibraryEntryDraft[];
  resume: Resume;
}

/** Free-text background → Experience Library + Master Resume. */
export async function structureProfile(
  basics: ProfileBasics,
  intake: string
): Promise<StructuredProfile> {
  if (provider() === "mock") return mockStructureProfile(basics, intake);
  if (provider() === "deepseek") {
    const raw = await dsChat({
      json: true,
      system:
        NO_FABRICATION +
        `\n\nTask: the user describes their background in casual language. Produce JSON with "entries" (a lossless Experience Library of every job, project, education item and skill group they mentioned, as atomic facts) and "resume" (a polished Master Resume built only from those facts; use the contact details verbatim).` +
        schemaInstruction(LIBRARY_JSON_SCHEMA),
      user: `Contact details (use verbatim):\nName: ${basics.full_name}\nEmail: ${basics.email}\nPhone: ${basics.phone}\nLocation: ${basics.location}\nLinks: ${basics.links.map((l) => l.url).join(", ")}\n\nMy background, in my own words:\n\n${intake}`,
    });
    const parsed = dsParse<{ entries: LibraryEntryDraft[]; resume: Partial<Resume> }>(raw);
    return {
      entries: (parsed.entries ?? []).map((e) => ({
        kind: (["job", "project", "education", "activity", "skill"] as const).includes(e.kind) ? e.kind : "job",
        title: e.title ?? "",
        org: e.org ?? "",
        dates: e.dates ?? "",
        facts: e.facts ?? [],
        skills: e.skills ?? [],
      })),
      resume: normalizeResume(parsed.resume ?? {}),
    };
  }

  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system: `${NO_FABRICATION}

Task: the user describes their background in casual language. Produce:
1. "entries" — an Experience Library: every job, project, education item, and
   skill group they mentioned, each with atomic facts capturing EVERYTHING
   they said (the library must be lossless — it is the source of truth for
   all future resumes, so keep even facts too minor for the resume itself).
2. "resume" — a polished, concise Master Resume built only from those facts,
   in professional resume language. Use the contact details verbatim.`,
    messages: [
      {
        role: "user",
        content: `Contact details (use verbatim):
Name: ${basics.full_name}
Email: ${basics.email}
Phone: ${basics.phone || "(not provided — use empty string)"}
Location: ${basics.location || "(not provided — use empty string)"}
Links: ${basics.links.map((l) => `${l.label}: ${l.url}`).join(", ") || "(none)"}

My background, in my own words:

${intake}`,
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: LIBRARY_JSON_SCHEMA },
    },
  });
  const message = await stream.finalMessage();
  guardRefusal(message);
  return JSON.parse(firstText(message.content)) as StructuredProfile;
}

/**
 * Company + role → research notes on what the employer prioritizes.
 * Uses server-side web search; returns plain text (structured outputs and
 * search citations conflict, so the tailoring call does the JSON work).
 */
export async function researchJob(
  company: string,
  role: string
): Promise<string> {
  if (provider() === "mock") return mockResearchJob(company, role);
  if (provider() === "deepseek") {
    const notes = await dsChat({
      system:
        "You are a job-market analyst. You have NO web access, so do not pretend to have read a live posting. From general knowledge, describe what this employer most likely prioritizes for this role: responsibilities, required and preferred qualifications, technologies and tools, seniority signals, and anything distinctive about the company's stack or culture a resume should speak to. Plain prose and bullet lists, no JSON.",
      user: `Company: ${company}\nRole: ${role}`,
    });
    return `(Based on general knowledge of ${company} — not a live posting. Paste the job description for exact requirements.)\n\n${notes}`;
  }

  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: `You research job postings. Find the current posting (or closest
recent equivalent) and summarize what this employer prioritizes for this
role. Cover: responsibilities, required and preferred qualifications,
technologies and tools, seniority signals, and anything distinctive about
the company's stack or culture that a resume should speak to. If you cannot
find the specific posting, say so explicitly, then summarize what this
company is publicly known to look for in this kind of role. Output plain
prose and bullet lists — no JSON.`,
    messages: [
      {
        role: "user",
        content: `Company: ${company}\nRole: ${role}`,
      },
    ],
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
  });
  const message = await stream.finalMessage();
  guardRefusal(message);
  // Search responses interleave text and tool-result blocks; join the text.
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export interface LibraryExtension {
  additions: LibraryEntryDraft[];
  appends: { entry_id: number; facts: string[]; skills: string[] }[];
}

/**
 * Incremental library update: new free text → new entries and/or facts
 * appended to existing entries. Never touches the master resume.
 */
export async function extendLibrary(
  existingEntries: { id: number; kind: string; title: string; org: string; dates: string; facts: string[] }[],
  newText: string,
  kindHint?: string
): Promise<LibraryExtension> {
  if (provider() === "mock") return mockExtendLibrary(newText, kindHint);

  const existing = existingEntries
    .map(
      (e) =>
        `id=${e.id} [${e.kind}] ${e.title}${e.org ? ` @ ${e.org}` : ""}${e.dates ? ` (${e.dates})` : ""}\n${e.facts.map((f) => `  - ${f}`).join("\n")}`
    )
    .join("\n\n");

  if (provider() === "deepseek") {
    const raw = await dsChat({
      json: true,
      system:
        NO_FABRICATION +
        `\n\nTask: the user is adding to their Experience Library. Decide, for each new fact, whether it belongs to an EXISTING entry (return it in "appends" with that entry's id) or describes a NEW experience (return a complete entry in "additions"). Capture everything as atomic facts; never repeat, modify, or remove existing facts.${kindHint ? ` The user filed this under "${kindHint}": any new entries MUST use kind "${kindHint}", and appends may only target existing entries of that kind.` : ""}` +
        schemaInstruction(EXTEND_JSON_SCHEMA),
      user: `# Existing library\n${existing || "(empty)"}\n\n# New information, in my own words\n${newText}`,
    });
    const parsed = dsParse<Partial<LibraryExtension>>(raw);
    return {
      additions: (parsed.additions ?? []).map((e) => ({
        kind: (["job", "project", "education", "activity", "skill"] as const).includes(e.kind) ? e.kind : "job",
        title: e.title ?? "",
        org: e.org ?? "",
        dates: e.dates ?? "",
        facts: e.facts ?? [],
        skills: e.skills ?? [],
      })),
      appends: (parsed.appends ?? []).map((x) => ({
        entry_id: Number(x.entry_id),
        facts: x.facts ?? [],
        skills: x.skills ?? [],
      })),
    };
  }

  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: `${NO_FABRICATION}

Task: the user is adding to their Experience Library. Below is what the
library already contains (with entry ids), then the new information in their
own words. Decide, for each new fact, whether it belongs to an EXISTING
entry (return it in "appends" with that entry's id) or describes a NEW
experience (return a complete entry in "additions"). Capture everything they
said as atomic facts — the library must stay lossless. Never repeat a fact
that is already in the library, and never modify or remove existing facts.${kindHint ? `
The user filed this under "${kindHint}": any new entries MUST use kind "${kindHint}", and appends may only target existing entries of that kind.` : ""}`,
    messages: [
      {
        role: "user",
        content: `# Existing library
${existing || "(empty)"}

# New information, in my own words
${newText}`,
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: EXTEND_JSON_SCHEMA },
    },
  });
  const message = await stream.finalMessage();
  guardRefusal(message);
  return JSON.parse(firstText(message.content)) as LibraryExtension;
}

export interface TailoredResult {
  resume: Resume;
  changes: string[];
}

/** Library + master + job info → tailored resume + change summary. */
export async function tailorResume(opts: {
  libraryText: string;
  master: Resume;
  company: string;
  role: string;
  jobInfo: string; // pasted JD or research notes
}): Promise<TailoredResult> {
  if (provider() === "mock") return mockTailorResume(opts);
  if (provider() === "deepseek") {
    const raw = await dsChat({
      json: true,
      system:
        NO_FABRICATION +
        `\n\nTask: tailor the user's resume for a specific job. The Experience Library is the complete set of facts you may draw on — surface the facts this job cares about, reorder so the most relevant experience leads, reword only where the underlying fact supports it, and cut what this employer won't care about. Keep roughly one page. Return JSON with "resume" and "changes" (a plain-English list of what you emphasized, reordered, reworded, or dropped and why).` +
        schemaInstruction(TAILORED_JSON_SCHEMA),
      user: `# Target job\nCompany: ${opts.company}\nRole: ${opts.role}\n\n# What this employer is looking for\n${opts.jobInfo}\n\n# Experience Library (the ONLY source of facts)\n${opts.libraryText}\n\n# Current master resume (JSON)\n${JSON.stringify(opts.master)}`,
    });
    const parsed = dsParse<{ resume: Partial<Resume>; changes: string[] }>(raw);
    return {
      resume: normalizeResume(parsed.resume ?? {}, opts.master),
      changes: parsed.changes ?? [],
    };
  }

  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system: `${NO_FABRICATION}

Task: tailor the user's resume for a specific job. The Experience Library
below is the complete set of facts you may draw on — it includes facts that
did not make the master resume, and you should surface the ones this job
cares about. Reorder sections and bullets so the most relevant experience
leads. Reword bullets to speak the job's language ONLY where the underlying
fact supports it. Cut or compress what this employer won't care about. Keep
it to roughly one page of content. Also return "changes": a plain-English
list of what you emphasized, reordered, reworded, or dropped and why.`,
    messages: [
      {
        role: "user",
        content: `# Target job
Company: ${opts.company}
Role: ${opts.role}

# What this employer is looking for
${opts.jobInfo}

# Experience Library (the ONLY source of facts)
${opts.libraryText}

# Current master resume (JSON)
${JSON.stringify(opts.master, null, 2)}`,
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: TAILORED_JSON_SCHEMA },
    },
  });
  const message = await stream.finalMessage();
  guardRefusal(message);
  return JSON.parse(firstText(message.content)) as TailoredResult;
}

/* ------------------------------------------------------------------ mocks */
/* Deterministic stand-ins used when no API key is configured. They do a
   crude but honest transformation so every screen has real-looking data. */

function mockStructureProfile(
  basics: ProfileBasics,
  intake: string
): StructuredProfile {
  const paragraphs = intake
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const entries: LibraryEntryDraft[] = paragraphs.map((p, i) => {
    const firstLine = p.split("\n")[0].slice(0, 80);
    const sentences = p
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      kind: /universit|college|degree|b\.?s\.?|m\.?s\.?|school/i.test(p)
        ? "education"
        : /project|built|side/i.test(firstLine) && i > 0
          ? "project"
          : "job",
      title: firstLine,
      org: "",
      dates: "",
      facts: sentences,
      skills: [],
    };
  });

  const resume: Resume = {
    name: basics.full_name,
    headline: "Professional",
    contact: {
      email: basics.email,
      phone: basics.phone,
      location: basics.location,
      links: basics.links,
    },
    summary:
      "[MOCK MODE — set ANTHROPIC_API_KEY for real AI writing] Summary drawn from the background you provided.",
    experience: entries
      .filter((e) => e.kind === "job")
      .map((e) => ({
        title: e.title,
        org: e.org,
        location: "",
        dates: e.dates,
        bullets: e.facts.slice(0, 4),
      })),
    projects: entries
      .filter((e) => e.kind === "project")
      .map((e) => ({
        name: e.title,
        description: "",
        dates: e.dates,
        bullets: e.facts.slice(0, 3),
      })),
    education: entries
      .filter((e) => e.kind === "education")
      .map((e) => ({ degree: e.title, school: e.org, dates: e.dates, notes: "", bullets: [] })),
    activities: [],
    skills: [],
  };

  return { entries, resume };
}

function mockResearchJob(company: string, role: string): string {
  return `[MOCK MODE — set ANTHROPIC_API_KEY for live web research]

${company} — ${role}: typical priorities for this role include core technical
skills, ownership of production systems, cross-functional collaboration, and
measurable impact. The tailored resume will lead with the experience most
relevant to a ${role} position.`;
}

function mockTailorResume(opts: {
  master: Resume;
  company: string;
  role: string;
}): TailoredResult {
  const resume: Resume = {
    ...opts.master,
    headline: opts.role,
    summary: `[MOCK MODE] ${opts.master.summary}`,
  };
  return {
    resume,
    changes: [
      `Set headline to "${opts.role}" for the ${opts.company} application.`,
      "Mock mode: no real re-emphasis performed. Set ANTHROPIC_API_KEY to enable AI tailoring.",
    ],
  };
}

function mockExtendLibrary(newText: string, kindHint?: string): LibraryExtension {
  const sentences = newText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    additions: [
      {
        kind: (kindHint as LibraryEntryDraft["kind"]) || "job",
        title: newText.split("\n")[0].slice(0, 60) || "New experience",
        org: "",
        dates: "",
        facts: sentences,
        skills: [],
      },
    ],
    appends: [],
  };
}

export interface EntryFacts {
  facts: string[];
  skills: string[];
}

/**
 * New free text destined for ONE user-chosen entry: clean it into atomic
 * facts (no routing decision — the user already picked the entry).
 */
export async function factsForEntry(
  entryContext: string,
  newText: string
): Promise<EntryFacts> {
  if (provider() === "mock") {
    return {
      facts: newText
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim())
        .filter(Boolean),
      skills: [],
    };
  }

  const system = `${NO_FABRICATION}

Task: the user is adding information to one specific Experience Library
entry (shown below). Turn their new text into atomic facts — one fact per
string, capturing everything they said, nothing more. Also list any
technologies or tools they explicitly mentioned. Do not repeat facts the
entry already has.`;
  const user = `# The entry being extended
${entryContext}

# New information, in my own words
${newText}`;

  if (provider() === "deepseek") {
    const raw = await dsChat({
      json: true,
      system: system + schemaInstruction(FACTS_JSON_SCHEMA),
      user,
    });
    const parsed = dsParse<Partial<EntryFacts>>(raw);
    return { facts: parsed.facts ?? [], skills: parsed.skills ?? [] };
  }

  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: 8000,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: { type: "json_schema", schema: FACTS_JSON_SCHEMA } },
  });
  const message = await stream.finalMessage();
  guardRefusal(message);
  return JSON.parse(firstText(message.content)) as EntryFacts;
}

/**
 * Non-destructive master update: weave library facts that aren't yet on the
 * master resume into it, changing existing wording as little as possible.
 */
export async function updateMasterFromLibrary(
  master: Resume,
  libraryText: string
): Promise<TailoredResult> {
  if (provider() === "mock") {
    return {
      resume: master,
      changes: ["Mock mode: no update performed. Set an API key to enable this."],
    };
  }

  const system = `${NO_FABRICATION}

Task: update the user's master resume with facts from their Experience
Library that are NOT yet represented on it. This is a minimal update, not a
rewrite: keep every existing bullet, title, date, and section EXACTLY as it
is unless a new fact genuinely belongs there — the user has hand-edited this
resume and their wording must survive. Add new bullets (or extend skills
lists) only for unrepresented facts that earn their place on a one-page
resume; leave minor facts in the library. Return JSON with "resume" (the
updated resume) and "changes" (a plain-English list of exactly what you
added or adjusted — an empty list if nothing needed adding).`;
  const user = `# Experience Library (the ONLY source of facts)
${libraryText}

# Current master resume (JSON) — preserve its wording
${JSON.stringify(master)}`;

  if (provider() === "deepseek") {
    const raw = await dsChat({
      json: true,
      system: system + schemaInstruction(TAILORED_JSON_SCHEMA),
      user,
    });
    const parsed = dsParse<{ resume: Partial<Resume>; changes: string[] }>(raw);
    return {
      resume: normalizeResume(parsed.resume ?? {}, master),
      changes: parsed.changes ?? [],
    };
  }

  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: { type: "json_schema", schema: TAILORED_JSON_SCHEMA } },
  });
  const message = await stream.finalMessage();
  guardRefusal(message);
  return JSON.parse(firstText(message.content)) as TailoredResult;
}

export interface SuggestedOp {
  kind: "add_bullet" | "reword_bullet" | "add_skill" | "add_activity" | "note";
  section: "experience" | "projects" | "education" | "";
  index: number;
  bullet_index: number;
  old_text: string;
  new_text: string;
  skill_category: string;
  skill_item: string;
  activity_title: string;
  activity_detail: string;
  activity_dates: string;
  reason: string;
}

/**
 * New facts → a proposal diff against the master resume. Nothing is applied
 * here; the user accepts or skips each op, and application is deterministic.
 */
export async function suggestResumeUpdates(
  master: Resume,
  newFacts: string[]
): Promise<SuggestedOp[]> {
  if (provider() === "mock" || newFacts.length === 0) return [];

  const system = `${NO_FABRICATION}

Task: the user added new facts to their Experience Library. For EACH fact,
propose at most one update to their master resume — or a "note" explaining
why it should stay library-only. The resume below is one they like: never
propose wholesale changes.

Allowed suggestion kinds:
- "add_bullet": a new bullet in resume.experience[index] or
  resume.projects[index] (new_text = the bullet). Only for facts that earn a
  place on a one-page resume.
- "reword_bullet": strengthen ONE existing bullet by folding the new fact in.
  old_text must be the EXACT current bullet; new_text the replacement.
- "add_skill": skill_item into skill_category (existing category name where
  possible).
- "add_bullet" with section "education": school-tied items — TA-ships,
  research assistantships, deans list, academic awards and competitions
  (e.g. Putnam), and campus club participation worth showing — belong HERE
  as a bullet under the education entry. Not in Activities.
- "add_activity": the Leadership & Activities section has a HIGH bar — only
  extracurriculars demonstrating leadership, initiative, or significant
  impact: president/founder/officer of an organization, organized or taught
  something, led a team, built a community. "Member of X club" or "attended
  Y" NEVER qualifies — that is an education bullet (if school-tied and worth
  showing) or a library-only note. activity_dates must be left as an empty
  string unless the user explicitly stated dates; never infer dates.
- "note": no resume change. Write the reason as one gentle sentence of
  advice spoken directly to the user: explain kindly why this detail
  wouldn't strengthen the resume (recruiters skim for impact), and remind
  them it stays safely in their library in case a future role makes it
  relevant. Never sound dismissive of what they shared.

Most minor facts should be notes. Bullet texts follow the bullet style rule
(one full line, 82-92 characters).`;

  const user = `# Master resume (JSON — indices matter)
${JSON.stringify(master)}

# New facts just added
${newFacts.map((f) => `- ${f}`).join("\n")}`;

  let ops: SuggestedOp[];
  if (provider() === "deepseek") {
    const raw = await dsChat({
      json: true,
      system: system + schemaInstruction(SUGGEST_JSON_SCHEMA),
      user,
    });
    ops = (dsParse<{ suggestions: Partial<SuggestedOp>[] }>(raw).suggestions ?? []).map(
      (o) => ({
        kind: (["add_bullet", "reword_bullet", "add_skill", "add_activity", "note"] as const).includes(
          o.kind as SuggestedOp["kind"]
        )
          ? (o.kind as SuggestedOp["kind"])
          : "note",
        section:
          o.section === "experience" || o.section === "projects" || o.section === "education"
            ? o.section
            : "",
        index: Number.isInteger(o.index) ? (o.index as number) : -1,
        bullet_index: Number.isInteger(o.bullet_index) ? (o.bullet_index as number) : -1,
        old_text: o.old_text ?? "",
        new_text: o.new_text ?? "",
        skill_category: o.skill_category ?? "",
        skill_item: o.skill_item ?? "",
        activity_title: o.activity_title ?? "",
        activity_detail: o.activity_detail ?? "",
        activity_dates: o.activity_dates ?? "",
        reason: o.reason ?? "",
      })
    );
  } else {
    const stream = client().messages.stream({
      model: MODEL,
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema: SUGGEST_JSON_SCHEMA } },
    });
    const message = await stream.finalMessage();
    guardRefusal(message);
    ops = JSON.parse(firstText(message.content)).suggestions as SuggestedOp[];
  }
  return ops;
}
