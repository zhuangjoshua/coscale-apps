import { Resume } from "@/lib/schema";

/**
 * The one resume renderer: used on screen, in the print view, and by the
 * PDF pipeline. Pure server component; styled after "Jake's Resume", the
 * de-facto standard LaTeX template for software engineering resumes.
 */

const SERIF =
  "'CMU Serif', 'Computer Modern', Georgia, 'Times New Roman', serif";

export default function ResumeView({ resume }: { resume: Resume }) {
  const contactBits = contactLine(resume);

  return (
    <div
      className="resume mx-auto w-[8.5in] min-h-[11in] bg-white px-[0.55in] py-[0.5in] text-[0.92rem] leading-[1.25] text-black"
      style={{ fontFamily: SERIF }}
    >
      <header className="text-center">
        <h1 className="text-[2.2rem] font-bold leading-tight">{resume.name}</h1>
        {contactBits.length > 0 && <ContactLine bits={contactBits} />}
      </header>

      {resume.education.length > 0 && (
        <Section title="Education">
          {resume.education.map((e, i) => (
            <div key={i} className={i > 0 ? "mt-2" : ""}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-bold">{e.school}</span>
                <span className="shrink-0 text-[0.85rem]">{e.dates}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4 italic">
                <span>{e.degree}</span>
                {e.notes && <span className="shrink-0">{e.notes}</span>}
              </div>
              <Bullets items={e.bullets ?? []} />
            </div>
          ))}
        </Section>
      )}

      {resume.experience.length > 0 && (
        <Section title="Experience">
          {resume.experience.map((job, i) => (
            <div key={i} className={i > 0 ? "mt-2" : ""}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-bold">{job.org}</span>
                <span className="shrink-0 text-[0.85rem]">{job.dates}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4 italic">
                <span>{job.title}</span>
                {job.location && <span className="shrink-0">{job.location}</span>}
              </div>
              <Bullets items={job.bullets} />
            </div>
          ))}
        </Section>
      )}

      {resume.projects.length > 0 && (
        <Section title="Projects">
          {resume.projects.map((p, i) => (
            <div key={i} className={i > 0 ? "mt-2" : ""}>
              <div className="flex items-baseline justify-between gap-4">
                <span>
                  <span className="font-bold">{p.name}</span>
                  {p.description && (
                    <>
                      {" | "}
                      <span className="italic">{p.description}</span>
                    </>
                  )}
                </span>
                {(p.dates ?? "") && (
                  <span className="shrink-0 text-[0.85rem]">{p.dates}</span>
                )}
              </div>
              <Bullets items={p.bullets} />
            </div>
          ))}
        </Section>
      )}

      {(resume.activities ?? []).filter((x) => x.title).length > 0 && (
        <Section title="Leadership & Activities">
          {(resume.activities ?? []).filter((x) => x.title).map((x, i) => (
            <div key={i} className={`flex items-baseline justify-between gap-4 ${i > 0 ? "mt-1" : ""}`}>
              <span>
                <span className="font-bold">{x.title}</span>
                {x.detail && (
                  <>
                    {" | "}
                    <span className="italic">{x.detail}</span>
                  </>
                )}
              </span>
              {x.dates && <span className="shrink-0 text-[0.85rem]">{x.dates}</span>}
            </div>
          ))}
        </Section>
      )}

      {resume.skills.length > 0 && (
        <Section title="Technical Skills">
          {resume.skills.map((g, i) => (
            <p key={i} className={i > 0 ? "mt-0.5" : ""}>
              {g.category && <span className="font-bold">{g.category}: </span>}
              {g.items.join(", ")}
            </p>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3">
      <h2 className="border-b border-black pb-[1px] text-[0.95rem] font-medium [font-variant:small-caps]">
        {title}
      </h2>
      <div className="mt-1 pl-4">{children}</div>
    </section>
  );
}

/** phone | email | links — email and links underlined, phone plain. */
export function contactLine(resume: Resume): { text: string; link: boolean }[] {
  const c = resume.contact;
  return [
    { text: c.phone, link: false },
    { text: c.email, link: true },
    ...c.links.map((l) => ({
      text: l.url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      link: true,
    })),
  ].filter((b) => Boolean(b.text));
}

export function ContactLine({ bits }: { bits: { text: string; link: boolean }[] }) {
  return (
    <p className="mt-1 text-[0.78rem]">
      {bits.map((b, i) => (
        <span key={i}>
          {i > 0 && " | "}
          <span
            className={
              b.link ? "underline decoration-[0.4px] underline-offset-2" : undefined
            }
          >
            {b.text}
          </span>
        </span>
      ))}
    </p>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-0.5 list-disc space-y-0 pl-5 text-[0.9rem]">
      {items.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );
}
