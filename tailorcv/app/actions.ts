"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import db, {
  Application,
  Entry,
  ResumeRow,
  getLibrary,
  getMasterResume,
  libraryAsText,
  parseResume,
} from "@/lib/db";
import { headers } from "next/headers";
import {
  createLoginToken,
  loginRateLimitOk,
  createSession,
  destroySession,
  getSessionUser,
} from "@/lib/session";
import { baseUrl, sendEmail } from "@/lib/email";
import { researchJob, structureProfile, tailorResume } from "@/lib/ai";
import { Resume } from "@/lib/schema";

/* ------------------------------------------------------------------ auth */

export async function requestLogin(formData: FormData) {
  // Google is the only login method. The email link is a local-dev fallback
  // and is refused outright whenever Google is configured or in production.
  const { googleConfigured } = await import("@/lib/google");
  if (googleConfigured() || process.env.NODE_ENV === "production") redirect("/login");

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/login?error=email");

  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "";
  if (!loginRateLimitOk(email, ip)) redirect("/login?error=ratelimit");

  const token = createLoginToken(email, ip);
  const link = `${baseUrl()}/login/verify?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Your TailorCV login link",
    body: `Click to log in — the link works once and expires in 20 minutes.\n\n${link}`,
  });

  redirect(`/login?sent=${encodeURIComponent(email)}`);
}

export async function logout() {
  await destroySession();
  redirect("/");
}

async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/* ------------------------------------------------------------- onboarding */

/** Intake form → AI structuring → library + master resume. */
export async function buildProfile(formData: FormData) {
  const user = await requireUser();

  const basics = {
    full_name: String(formData.get("full_name") || "").trim(),
    email: String(formData.get("email") || user.email).trim(),
    phone: String(formData.get("phone") || "").trim(),
    location: String(formData.get("location") || "").trim(),
    links: String(formData.get("links") || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((url) => ({
        label: url.replace(/^https?:\/\//, "").split("/")[0],
        url: url.startsWith("http") ? url : `https://${url}`,
      })),
  };
  const intake = [
    labeled("Work experience", formData.get("work")),
    labeled("Projects", formData.get("projects")),
    labeled("Education", formData.get("education")),
    labeled("Skills", formData.get("skills")),
    labeled("Anything else", formData.get("extra")),
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!basics.full_name || !intake.trim()) redirect("/onboard?error=required");

  const structured = await structureProfile(basics, intake);

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO profiles (user_id, full_name, email, phone, location, links, intake, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
       ON CONFLICT(user_id) DO UPDATE SET
         full_name=excluded.full_name, email=excluded.email, phone=excluded.phone,
         location=excluded.location, links=excluded.links, intake=excluded.intake,
         updated_at=unixepoch()`
    ).run(
      user.id,
      basics.full_name,
      basics.email,
      basics.phone,
      basics.location,
      JSON.stringify(basics.links),
      intake
    );

    // Rebuilding the profile replaces the library and master resume.
    db.prepare("DELETE FROM entries WHERE user_id = ?").run(user.id);
    const insert = db.prepare(
      `INSERT INTO entries (user_id, kind, title, org, dates, facts, skills, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    structured.entries.forEach((e, i) => {
      insert.run(
        user.id,
        e.kind,
        e.title,
        e.org,
        e.dates,
        JSON.stringify(e.facts),
        JSON.stringify(e.skills),
        i
      );
    });

    db.prepare("DELETE FROM resumes WHERE user_id = ? AND kind = 'master'").run(user.id);
    db.prepare(
      "INSERT INTO resumes (user_id, kind, content) VALUES (?, 'master', ?)"
    ).run(user.id, JSON.stringify(structured.resume));
  });
  tx();

  redirect("/resume/master");
}

function labeled(label: string, v: FormDataEntryValue | null): string {
  const text = String(v || "").trim();
  return text ? `## ${label}\n${text}` : "";
}

/* ------------------------------------------------------- master resume edits */

export async function updateResumeSection(formData: FormData) {
  const user = await requireUser();
  const resumeId = Number(formData.get("resume_id"));
  const field = String(formData.get("field"));
  const value = String(formData.get("value") ?? "");

  const row = db
    .prepare("SELECT * FROM resumes WHERE id = ? AND user_id = ?")
    .get(resumeId, user.id) as ResumeRow | undefined;
  if (!row) return;

  const resume = parseResume(row);
  applyFieldEdit(resume, field, value);

  db.prepare("UPDATE resumes SET content = ?, updated_at = unixepoch() WHERE id = ?").run(
    JSON.stringify(resume),
    row.id
  );
  revalidatePath("/resume/master");
  if (row.application_id) revalidatePath(`/application/${row.application_id}`);
}

/**
 * Field paths: "summary", "headline", "experience.2.bullets" (textarea, one
 * bullet per line), "experience.2.title" etc. Keeps editing dead simple.
 */
function applyFieldEdit(resume: Resume, field: string, value: string) {
  const parts = field.split(".");
  if (parts.length === 1) {
    if (parts[0] === "summary") resume.summary = value;
    if (parts[0] === "headline") resume.headline = value;
    return;
  }
  const [section, idxStr, key] = parts;
  const idx = Number(idxStr);
  const lines = value
    .split("\n")
    .map((l) => l.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);

  if (section === "experience" && resume.experience[idx]) {
    const item = resume.experience[idx];
    if (key === "bullets") item.bullets = lines;
    else if (key === "title" || key === "org" || key === "location" || key === "dates")
      item[key] = value;
  } else if (section === "projects" && resume.projects[idx]) {
    const item = resume.projects[idx];
    if (key === "bullets") item.bullets = lines;
    else if (key === "name" || key === "description" || key === "dates")
      item[key] = value;
  } else if (section === "education" && resume.education[idx]) {
    if (key === "bullets") resume.education[idx].bullets = lines;
  } else if (section === "activities" && resume.activities?.[idx]) {
    const item = resume.activities[idx];
    if (key === "title" || key === "detail" || key === "dates") item[key] = value;
  }
}

/* ---------------------------------------------------------------- tailoring */

/** Company+role (researched) or pasted JD → application + tailored resume. */
export async function createApplication(formData: FormData) {
  const user = await requireUser();

  const company = String(formData.get("company") || "").trim();
  const role = String(formData.get("role") || "").trim();
  let jd = String(formData.get("jd") || "").trim();
  const jdUrl = String(formData.get("jd_url") || "").trim();
  if (!company || !role) redirect("/tailor?error=required");

  const masterRow = getMasterResume(user.id);
  if (!masterRow) redirect("/onboard");

  const res = db
    .prepare(
      `INSERT INTO applications (user_id, company, role, jd_text, jd_url, status)
       VALUES (?, ?, ?, ?, ?, 'generating')`
    )
    .run(user.id, company, role, jd || null, jdUrl || null);
  const appId = res.lastInsertRowid as number;

  try {
    // Pasted JD wins; else crawl the link; else research the role.
    if (!jd && jdUrl) {
      const { fetchJobPosting } = await import("@/lib/scrape");
      jd = await fetchJobPosting(jdUrl);
      db.prepare("UPDATE applications SET jd_text = ? WHERE id = ?").run(jd, appId);
    }
    const jobInfo = jd || (await researchJob(company, role));
    if (!jd) {
      db.prepare("UPDATE applications SET research = ? WHERE id = ?").run(jobInfo, appId);
    }

    const result = await tailorResume({
      libraryText: libraryAsText(getLibrary(user.id)),
      master: parseResume(masterRow),
      company,
      role,
      jobInfo,
    });

    db.prepare(
      "INSERT INTO resumes (user_id, kind, application_id, content) VALUES (?, 'tailored', ?, ?)"
    ).run(user.id, appId, JSON.stringify(result.resume));
    db.prepare(
      "UPDATE applications SET status = 'ready', changes = ? WHERE id = ?"
    ).run(JSON.stringify(result.changes), appId);
  } catch (e) {
    db.prepare("UPDATE applications SET status = 'error', error = ? WHERE id = ?").run(
      String(e instanceof Error ? e.message : e),
      appId
    );
  }

  redirect(`/application/${appId}`);
}

/** Re-run tailoring for an existing application (after edits or errors). */
export async function regenerateApplication(formData: FormData) {
  const user = await requireUser();
  const appId = Number(formData.get("application_id"));

  const app = db
    .prepare("SELECT * FROM applications WHERE id = ? AND user_id = ?")
    .get(appId, user.id) as Application | undefined;
  const masterRow = getMasterResume(user.id);
  if (!app || !masterRow) return;

  db.prepare("UPDATE applications SET status = 'generating', error = NULL WHERE id = ?").run(appId);

  try {
    let jd = app.jd_text;
    if (!jd && app.jd_url) {
      try {
        const { fetchJobPosting } = await import("@/lib/scrape");
        jd = await fetchJobPosting(app.jd_url);
        db.prepare("UPDATE applications SET jd_text = ? WHERE id = ?").run(jd, appId);
      } catch (e) {
        console.error("re-crawl failed, falling back:", e);
      }
    }
    const jobInfo = jd || app.research || (await researchJob(app.company, app.role));
    const result = await tailorResume({
      libraryText: libraryAsText(getLibrary(user.id)),
      master: parseResume(masterRow),
      company: app.company,
      role: app.role,
      jobInfo,
    });

    db.prepare("DELETE FROM resumes WHERE application_id = ?").run(appId);
    db.prepare(
      "INSERT INTO resumes (user_id, kind, application_id, content) VALUES (?, 'tailored', ?, ?)"
    ).run(user.id, appId, JSON.stringify(result.resume));
    db.prepare("UPDATE applications SET status = 'ready', changes = ? WHERE id = ?").run(
      JSON.stringify(result.changes),
      appId
    );
  } catch (e) {
    db.prepare("UPDATE applications SET status = 'error', error = ? WHERE id = ?").run(
      String(e instanceof Error ? e.message : e),
      appId
    );
  }

  revalidatePath(`/application/${appId}`);
}

export async function deleteApplication(formData: FormData) {
  const user = await requireUser();
  const appId = Number(formData.get("application_id"));
  const app = db
    .prepare("SELECT id FROM applications WHERE id = ? AND user_id = ?")
    .get(appId, user.id);
  if (!app) return;

  db.prepare("DELETE FROM resumes WHERE application_id = ?").run(appId);
  db.prepare("DELETE FROM applications WHERE id = ?").run(appId);
  redirect("/dashboard");
}

/* ------------------------------------------------------- library additions */

/**
 * Incrementally extend the Experience Library from free text. New entries are
 * appended and existing entries gain facts — the master resume, its edits,
 * and existing tailored resumes are untouched.
 */
export async function addToLibrary(formData: FormData) {
  const user = await requireUser();
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  const kindRaw = String(formData.get("kind") || "");
  const kindHint = ["job", "project", "education", "activity", "skill"].includes(kindRaw)
    ? kindRaw
    : undefined;

  const { extendLibrary } = await import("@/lib/ai");
  const entries = getLibrary(user.id).map((e) => ({
    id: e.id,
    kind: e.kind,
    title: e.title,
    org: e.org,
    dates: e.dates,
    facts: JSON.parse(e.facts) as string[],
  }));

  const result = await extendLibrary(entries, text, kindHint);
  const valid = new Set(entries.map((e) => e.id));

  const tx = db.transaction(() => {
    const max = db
      .prepare("SELECT COALESCE(MAX(position), -1) AS m FROM entries WHERE user_id = ?")
      .get(user.id) as { m: number };
    const insert = db.prepare(
      `INSERT INTO entries (user_id, kind, title, org, dates, facts, skills, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    result.additions.forEach((e, i) => {
      insert.run(
        user.id,
        e.kind,
        e.title,
        e.org,
        e.dates,
        JSON.stringify(e.facts),
        JSON.stringify(e.skills),
        max.m + 1 + i
      );
    });

    for (const a of result.appends) {
      if (!valid.has(a.entry_id)) continue; // never trust ids the model made up
      const row = db
        .prepare("SELECT facts, skills FROM entries WHERE id = ? AND user_id = ?")
        .get(a.entry_id, user.id) as { facts: string; skills: string } | undefined;
      if (!row) continue;
      const facts = [...(JSON.parse(row.facts) as string[]), ...a.facts];
      const skills = [
        ...new Set([...(JSON.parse(row.skills) as string[]), ...a.skills]),
      ];
      db.prepare("UPDATE entries SET facts = ?, skills = ? WHERE id = ?").run(
        JSON.stringify(facts),
        JSON.stringify(skills),
        a.entry_id
      );
    }
  });
  tx();

  await generateSuggestions(user.id, [
    ...result.additions.flatMap((e) => e.facts),
    ...result.appends.flatMap((x) => x.facts),
  ]);
  revalidatePath("/resume/master");
}

/** Append user-provided facts to one specific library entry (user-chosen). */
export async function addToEntry(formData: FormData) {
  const user = await requireUser();
  const entryId = Number(formData.get("entry_id"));
  const text = String(formData.get("text") || "").trim();
  if (!text) return;

  const row = db
    .prepare("SELECT * FROM entries WHERE id = ? AND user_id = ?")
    .get(entryId, user.id) as Entry | undefined;
  if (!row) return;

  const { factsForEntry } = await import("@/lib/ai");
  const existingFacts = JSON.parse(row.facts) as string[];
  const context = `[${row.kind}] ${row.title}${row.org ? ` @ ${row.org}` : ""}${row.dates ? ` (${row.dates})` : ""}\n${existingFacts.map((f) => `  - ${f}`).join("\n")}`;

  const result = await factsForEntry(context, text);
  const facts = [...existingFacts, ...result.facts];
  const skills = [
    ...new Set([...(JSON.parse(row.skills) as string[]), ...result.skills]),
  ];
  db.prepare("UPDATE entries SET facts = ?, skills = ? WHERE id = ?").run(
    JSON.stringify(facts),
    JSON.stringify(skills),
    row.id
  );
  await generateSuggestions(user.id, result.facts);
  revalidatePath("/resume/master");
}

/** Weave unrepresented library facts into the master resume, preserving edits. */
export async function updateMasterResume() {
  const user = await requireUser();
  const row = getMasterResume(user.id);
  if (!row) redirect("/onboard");

  const { updateMasterFromLibrary } = await import("@/lib/ai");
  const result = await updateMasterFromLibrary(
    parseResume(row),
    libraryAsText(getLibrary(user.id))
  );

  db.prepare(
    "UPDATE resumes SET content = ?, updated_at = unixepoch() WHERE id = ?"
  ).run(JSON.stringify(result.resume), row.id);
  revalidatePath("/resume/master");
}

/** Delete a library entry (and its facts) — resumes are untouched. */
export async function deleteEntry(formData: FormData) {
  const user = await requireUser();
  const entryId = Number(formData.get("entry_id"));
  db.prepare("DELETE FROM entries WHERE id = ? AND user_id = ?").run(entryId, user.id);
  revalidatePath("/resume/master");
}

/* ------------------------------------------------------------- suggestions */

/** Generate pending suggestions from freshly-added facts (fire-and-store). */
async function generateSuggestions(userId: number, newFacts: string[]) {
  if (newFacts.length === 0) return;
  const masterRow = getMasterResume(userId);
  if (!masterRow) return;
  try {
    const { suggestResumeUpdates } = await import("@/lib/ai");
    const ops = await suggestResumeUpdates(parseResume(masterRow), newFacts);
    const insert = db.prepare(
      "INSERT INTO suggestions (user_id, kind, payload, reason) VALUES (?, ?, ?, ?)"
    );
    for (const op of ops) {
      const { kind, reason, ...payload } = op;
      insert.run(userId, kind, JSON.stringify(payload), reason);
    }
  } catch (e) {
    console.error("suggestion generation failed:", e); // additive feature — never block the add
  }
}

/** Apply one accepted suggestion deterministically; the model isn't consulted. */
export async function acceptSuggestion(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("suggestion_id"));
  const sug = db
    .prepare("SELECT * FROM suggestions WHERE id = ? AND user_id = ? AND status = 'pending'")
    .get(id, user.id) as import("@/lib/db").Suggestion | undefined;
  const masterRow = getMasterResume(user.id);
  if (!sug || !masterRow) return;

  const payload = JSON.parse(sug.payload) as import("@/lib/db").SuggestionPayload;
  const resume = parseResume(masterRow);
  let status: "accepted" | "stale" = "accepted";

  if (sug.kind === "add_bullet") {
    if (payload.section === "education") {
      const item = resume.education[payload.index];
      if (item && payload.new_text) item.bullets = [...(item.bullets ?? []), payload.new_text];
      else status = "stale";
    } else {
      const list = payload.section === "projects" ? resume.projects : resume.experience;
      const item = list[payload.index];
      if (item && payload.new_text) item.bullets.push(payload.new_text);
      else status = "stale";
    }
  } else if (sug.kind === "add_activity") {
    if (payload.activity_title) {
      resume.activities = [
        ...(resume.activities ?? []),
        {
          title: payload.activity_title,
          detail: payload.activity_detail,
          dates: payload.activity_dates,
        },
      ];
    } else {
      status = "stale";
    }
  } else if (sug.kind === "reword_bullet") {
    const list =
      payload.section === "projects"
        ? resume.projects
        : payload.section === "education"
          ? resume.education
          : resume.experience;
    const item = list[payload.index];
    const current = item?.bullets?.[payload.bullet_index];
    if (item?.bullets && current !== undefined && current.trim() === payload.old_text.trim()) {
      item.bullets[payload.bullet_index] = payload.new_text;
    } else {
      status = "stale"; // the bullet changed since the suggestion was made
    }
  } else if (sug.kind === "add_skill") {
    const cat = resume.skills.find(
      (g) => g.category.toLowerCase() === payload.skill_category.toLowerCase()
    );
    if (cat) {
      if (!cat.items.some((i) => i.toLowerCase() === payload.skill_item.toLowerCase()))
        cat.items.push(payload.skill_item);
    } else if (payload.skill_item) {
      resume.skills.push({ category: payload.skill_category || "Other", items: [payload.skill_item] });
    } else {
      status = "stale";
    }
  } else {
    status = "stale"; // notes are not applicable
  }

  const tx = db.transaction(() => {
    if (status === "accepted") {
      db.prepare(
        "UPDATE resumes SET content = ?, updated_at = unixepoch() WHERE id = ?"
      ).run(JSON.stringify(resume), masterRow.id);
    }
    db.prepare("UPDATE suggestions SET status = ? WHERE id = ?").run(status, sug.id);
  });
  tx();
  revalidatePath("/resume/master");
}

export async function skipSuggestion(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("suggestion_id"));
  db.prepare(
    "UPDATE suggestions SET status = 'skipped' WHERE id = ? AND user_id = ? AND status = 'pending'"
  ).run(id, user.id);
  revalidatePath("/resume/master");
}
