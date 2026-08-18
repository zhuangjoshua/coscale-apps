import { redirect } from "next/navigation";
import { buildProfile } from "@/app/actions";
import AppHeader from "@/app/AppHeader";
import SubmitButton from "./SubmitButton";
import db, { Profile } from "@/lib/db";
import { aiEnabled } from "@/lib/ai";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The five intake textareas, in the order `buildProfile` concatenates them. */
const SECTIONS = [
  {
    name: "work",
    label: "Work experience",
    hint: "Jobs, internships, contracts, freelance — anything you got paid for.",
    placeholder:
      "Just talk. “I worked at Acme for 3 years on the backend team, built the APIs our customers use, got our database queries way faster during the Black Friday crunch…”",
    rows: 10,
  },
  {
    name: "projects",
    label: "Projects",
    hint: "Side projects, open source, coursework, anything you built or ran.",
    placeholder:
      "“I built a little tool for my running club that pulls everyone’s Strava times into one leaderboard. About 200 people use it. Also helped rewrite the docs for an open source library I like.”",
    rows: 7,
  },
  {
    name: "education",
    label: "Education",
    hint: "Degrees, bootcamps, certifications, courses that mattered.",
    placeholder:
      "“BS in economics from State, graduated 2019. Did a data science bootcamp in 2021 — the final project was a churn model.”",
    rows: 5,
  },
  {
    name: "skills",
    label: "Skills",
    hint: "Tools, languages, systems. Rough lists are fine.",
    placeholder:
      "“Python and SQL mostly, some TypeScript. Postgres, a bit of AWS. I’m the person people ask when a dashboard breaks. Conversational Spanish.”",
    rows: 5,
  },
  {
    name: "extra",
    label: "Anything else",
    hint: "Awards, volunteering, publications, a gap you want explained, the kind of role you’re after.",
    placeholder:
      "“I took a year off in 2022 to care for a family member. I’m looking for backend or platform roles, ideally remote. Won an internal award for the migration project.”",
    rows: 5,
  },
] as const;

type SectionName = (typeof SECTIONS)[number]["name"];

const HEADERS: Record<SectionName, string> = {
  work: "Work experience",
  projects: "Projects",
  education: "Education",
  skills: "Skills",
  extra: "Anything else",
};

/**
 * `buildProfile` stores intake as one markdown string with "## Section" heads.
 * Split it back apart for prefill; if no headers are found at all, the whole
 * blob goes into the work textarea so nothing is silently lost.
 */
function splitIntake(intake: string): Record<SectionName, string> {
  const out: Record<SectionName, string> = {
    work: "",
    projects: "",
    education: "",
    skills: "",
    extra: "",
  };
  if (!intake.trim()) return out;

  const byHeader = new Map<string, SectionName>(
    (Object.entries(HEADERS) as [SectionName, string][]).map(([name, h]) => [
      h.toLowerCase(),
      name,
    ])
  );

  let current: SectionName | null = null;
  let found = false;
  const buffers: Record<string, string[]> = {};

  for (const line of intake.split("\n")) {
    const head = line.match(/^##\s+(.+?)\s*$/);
    if (head) {
      const name = byHeader.get(head[1].toLowerCase());
      if (name) {
        found = true;
        current = name;
        buffers[name] ??= [];
        continue;
      }
    }
    if (current) buffers[current].push(line);
  }

  if (!found) {
    out.work = intake.trim();
    return out;
  }
  for (const [name, lines] of Object.entries(buffers)) {
    out[name as SectionName] = lines.join("\n").trim();
  }
  return out;
}

export default async function OnboardPage(props: PageProps<"/onboard">) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await props.searchParams;
  const error = typeof params.error === "string" ? params.error : "";

  const profile = db
    .prepare("SELECT * FROM profiles WHERE user_id = ?")
    .get(user.id) as Profile | undefined;

  const links = profile
    ? (JSON.parse(profile.links || "[]") as { label: string; url: string }[])
        .map((l) => l.url)
        .join("\n")
    : "";
  const intake = splitIntake(profile?.intake ?? "");

  const field =
    "field";

  return (
    <>
      <AppHeader email={user.email} />

      <main className="flex-1 bg-paper">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <h1 className="text-3xl font-bold tracking-tight">
            Create your master resume
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Don&apos;t write resume language. That&apos;s our job. Describe what
            you actually did, like you&apos;d tell a friend.
          </p>

          {!aiEnabled() && (
            <div className="mt-6 rounded-brand border border-warn/40 bg-background p-4 text-sm text-warn">
              No <code>ANTHROPIC_API_KEY</code> set — running in mock mode;
              structure will be rough but the flow works.
            </div>
          )}

          {error === "required" && (
            <div className="mt-6 rounded-brand border border-warn/40 bg-background p-4 text-sm text-warn">
              We need at least your name and something about your background.
            </div>
          )}

          {profile && (
            <div className="mt-6 card p-4 text-sm text-muted-foreground">
              We&apos;ve prefilled this from your last intake. Submitting again{" "}
              <span className="font-medium text-foreground">replaces</span> your
              current Experience Library and master resume.
            </div>
          )}

          <form action={buildProfile} className="mt-10 space-y-10">
            {/* Basics */}
            <section className="card p-6">
              <h2 className="text-lg font-semibold tracking-tight">
                The basics
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Straight onto the top of the resume.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium">
                    Full name <span className="text-warn">*</span>
                  </label>
                  <input
                    id="full_name"
                    name="full_name"
                    required
                    defaultValue={profile?.full_name ?? ""}
                    placeholder="Jordan Rivera"
                    className={`mt-2 ${field}`}
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={profile?.email || user.email}
                    className={`mt-2 ${field}`}
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium">
                    Phone
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    defaultValue={profile?.phone ?? ""}
                    placeholder="(555) 010-2938"
                    className={`mt-2 ${field}`}
                  />
                </div>
                <div>
                  <label htmlFor="location" className="block text-sm font-medium">
                    Location
                  </label>
                  <input
                    id="location"
                    name="location"
                    defaultValue={profile?.location ?? ""}
                    placeholder="Austin, TX"
                    className={`mt-2 ${field}`}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="links" className="block text-sm font-medium">
                  Links
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  One URL per line — portfolio, GitHub, LinkedIn.
                </p>
                <textarea
                  id="links"
                  name="links"
                  rows={3}
                  defaultValue={links}
                  placeholder={"github.com/you\nlinkedin.com/in/you"}
                  className={`mt-2 ${field}`}
                />
              </div>
            </section>

            {/* Intake */}
            <section className="space-y-6">
              {SECTIONS.map((s) => (
                <div key={s.name} className="card p-6">
                  <label htmlFor={s.name} className="block text-lg font-semibold tracking-tight">
                    {s.label}
                  </label>
                  <p className="mt-1 text-sm text-muted-foreground">{s.hint}</p>
                  <textarea
                    id={s.name}
                    name={s.name}
                    rows={s.rows}
                    defaultValue={intake[s.name]}
                    placeholder={s.placeholder}
                    className={`mt-4 leading-relaxed ${field}`}
                  />
                </div>
              ))}
            </section>

            <div className="card p-6">
              <SubmitButton />
              <p className="mt-4 text-sm text-muted-foreground">
                We&apos;ll turn this into your Experience Library and a polished
                master resume — using only the facts you gave us. Submitting
                replaces any library and master resume you already have.
              </p>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
