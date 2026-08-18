"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { updateResumeSection } from "@/app/actions";
import { Resume } from "@/lib/schema";
import { ContactLine, contactLine } from "@/components/ResumeView";

/**
 * The master resume, rendered exactly like <ResumeView> but click-to-edit.
 * Every editable piece swaps in place for an input/textarea that matches the
 * document's typography; saves go through the updateResumeSection action.
 *
 * Contact details and education are intentionally read-only in this pass.
 */

/* ------------------------------------------------------------- edit context */

interface EditCtx {
  editing: string | null;
  draft: string;
  pending: boolean;
  begin: (field: string, value: string) => void;
  setDraft: (v: string) => void;
  cancel: () => void;
  save: () => void;
}

const Ctx = createContext<EditCtx | null>(null);

/** Must match ResumeView's font stack — the two renderers stay pixel-matched. */
const SERIF =
  "'CMU Serif', 'Computer Modern', Georgia, 'Times New Roman', serif";

function useEdit(): EditCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Editable used outside EditableResume");
  return ctx;
}

/* ------------------------------------------------------------------- helpers */

/** Mirrors applyFieldEdit in app/actions.ts so the UI can update optimistically. */
function applyEdit(resume: Resume, field: string, value: string): Resume {
  const next: Resume = JSON.parse(JSON.stringify(resume)) as Resume;
  const parts = field.split(".");

  if (parts.length === 1) {
    if (parts[0] === "summary") next.summary = value;
    if (parts[0] === "headline") next.headline = value;
    return next;
  }

  const [section, idxStr, key] = parts;
  const idx = Number(idxStr);
  const lines = value
    .split("\n")
    .map((l) => l.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);

  if (section === "experience" && next.experience[idx]) {
    const item = next.experience[idx];
    if (key === "bullets") item.bullets = lines;
    else if (key === "title" || key === "org" || key === "location" || key === "dates")
      item[key] = value;
  } else if (section === "projects" && next.projects[idx]) {
    const item = next.projects[idx];
    if (key === "bullets") item.bullets = lines;
    else if (key === "name" || key === "description" || key === "dates")
      item[key] = value;
  } else if (section === "education" && next.education[idx]) {
    if (key === "bullets") next.education[idx].bullets = lines;
  } else if (section === "activities" && next.activities?.[idx]) {
    const item = next.activities[idx];
    if (key === "title" || key === "detail" || key === "dates") item[key] = value;
  }
  return next;
}

/* ------------------------------------------------------------------ the view */

export default function EditableResume({
  resume,
  resumeId,
}: {
  resume: Resume;
  resumeId: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState<Resume>(resume);
  const [fromServer, setFromServer] = useState<Resume>(resume);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  // Fresh server data (after router.refresh) wins over optimistic state.
  if (resume !== fromServer) {
    setFromServer(resume);
    setLocal(resume);
  }

  const ctx: EditCtx = {
    editing,
    draft,
    pending,
    begin(field, value) {
      if (pending) return;
      setEditing(field);
      setDraft(value);
    },
    setDraft,
    cancel() {
      setEditing(null);
      setDraft("");
    },
    save() {
      const field = editing;
      if (!field) return;
      const value = draft;
      setLocal((prev) => applyEdit(prev, field, value));

      const data = new FormData();
      data.set("resume_id", String(resumeId));
      data.set("field", field);
      data.set("value", value);

      startTransition(async () => {
        await updateResumeSection(data);
        setEditing(null);
        setDraft("");
        router.refresh();
      });
    },
  };

  const contactBits = contactLine(local);

  return (
    <Ctx.Provider value={ctx}>
      <div
        className="resume mx-auto w-[8.5in] min-h-[11in] bg-white px-[0.55in] py-[0.5in] text-[0.92rem] leading-[1.25] text-black"
        style={{ fontFamily: SERIF }}
      >
        <header className="text-center">
          <h1 className="text-[2.2rem] font-bold leading-tight">{local.name}</h1>
          {contactBits.length > 0 && <ContactLine bits={contactBits} />}
        </header>

        {local.education.length > 0 && (
          <Section title="Education">
            {local.education.map((e, i) => (
              <div key={i} className={i > 0 ? "mt-2" : ""}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-bold">{e.school}</span>
                  <span className="shrink-0 text-[0.85rem]">{e.dates}</span>
                </div>
                <div className="flex items-baseline justify-between gap-4 italic">
                  <span>{e.degree}</span>
                  {e.notes && <span className="shrink-0">{e.notes}</span>}
                </div>
                <Editable
                  field={`education.${i}.bullets`}
                  value={(e.bullets ?? []).join("\n")}
                  placeholder="Add school activities (TA-ships, honors)"
                  multiline
                  block
                  bullets
                >
                  <Bullets items={e.bullets ?? []} />
                </Editable>
              </div>
            ))}
          </Section>
        )}

        {local.experience.length > 0 && (
          <Section title="Experience">
            {local.experience.map((job, i) => (
              <div key={i} className={i > 0 ? "mt-2" : ""}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-bold">
                    <Editable
                      field={`experience.${i}.org`}
                      value={job.org}
                      placeholder="Organization"
                    />
                  </span>
                  <span className="shrink-0 text-[0.85rem]">
                    <Editable
                      field={`experience.${i}.dates`}
                      value={job.dates}
                      placeholder="Dates"
                    />
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-4 italic">
                  <span>
                    <Editable
                      field={`experience.${i}.title`}
                      value={job.title}
                      placeholder="Title"
                    />
                  </span>
                  <span className="shrink-0">
                    <Editable
                      field={`experience.${i}.location`}
                      value={job.location}
                      placeholder="Location"
                    />
                  </span>
                </div>
                <Editable
                  field={`experience.${i}.bullets`}
                  value={job.bullets.join("\n")}
                  placeholder="Add bullets"
                  multiline
                  block
                  bullets
                >
                  <Bullets items={job.bullets} />
                </Editable>
              </div>
            ))}
          </Section>
        )}

        {local.projects.length > 0 && (
          <Section title="Projects">
            {local.projects.map((p, i) => (
              <div key={i} className={i > 0 ? "mt-2" : ""}>
                <div className="flex items-baseline justify-between gap-4">
                  <span>
                    <span className="font-bold">
                      <Editable
                        field={`projects.${i}.name`}
                        value={p.name}
                        placeholder="Project name"
                      />
                    </span>
                    {" | "}
                    <span className="italic">
                      <Editable
                        field={`projects.${i}.description`}
                        value={p.description}
                        placeholder="Description"
                      />
                    </span>
                  </span>
                  <span className="shrink-0 text-[0.85rem]">
                    <Editable
                      field={`projects.${i}.dates`}
                      value={p.dates ?? ""}
                      placeholder="Dates"
                    />
                  </span>
                </div>
                <Editable
                  field={`projects.${i}.bullets`}
                  value={p.bullets.join("\n")}
                  placeholder="Add bullets"
                  multiline
                  block
                  bullets
                >
                  <Bullets items={p.bullets} />
                </Editable>
              </div>
            ))}
          </Section>
        )}

        {(local.activities ?? []).length > 0 && (
          <Section title="Leadership & Activities">
            {(local.activities ?? []).map((x, i) => (
              <div key={i} className={`flex items-baseline justify-between gap-4 ${i > 0 ? "mt-1" : ""}`}>
                <span>
                  <span className="font-bold">
                    <Editable field={`activities.${i}.title`} value={x.title} placeholder="Activity" />
                  </span>
                  {" | "}
                  <span className="italic">
                    <Editable field={`activities.${i}.detail`} value={x.detail} placeholder="Detail" />
                  </span>
                </span>
                <span className="shrink-0 text-[0.85rem]">
                  <Editable field={`activities.${i}.dates`} value={x.dates} placeholder="Dates" />
                </span>
              </div>
            ))}
          </Section>
        )}

        {local.skills.length > 0 && (
          <Section title="Technical Skills">
            {local.skills.map((g, i) => (
              <p key={i} className={i > 0 ? "mt-0.5" : ""}>
                {g.category && <span className="font-bold">{g.category}: </span>}
                {g.items.join(", ")}
              </p>
            ))}
          </Section>
        )}
      </div>
    </Ctx.Provider>
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

/* --------------------------------------------------------------- editable bit */

function Editable({
  field,
  value,
  placeholder,
  multiline,
  block,
  bullets,
  children,
}: {
  field: string;
  value: string;
  placeholder: string;
  multiline?: boolean;
  block?: boolean;
  bullets?: boolean;
  children?: React.ReactNode;
}) {
  const ctx = useEdit();

  if (ctx.editing === field) {
    return <Editor multiline={multiline} block={block} bullets={bullets} />;
  }

  const hoverable =
    "group/edit relative cursor-text rounded-[4px] transition-colors hover:bg-primary/5 hover:ring-1 hover:ring-primary/30";
  const hint = (
    <span className="no-print pointer-events-none absolute -top-2.5 right-0 hidden select-none rounded-[3px] bg-primary px-1 font-sans text-[0.6rem] font-medium uppercase tracking-wide text-white group-hover/edit:block">
      edit
    </span>
  );
  const body =
    children !== undefined ? (
      value ? (
        children
      ) : (
        <Placeholder text={placeholder} />
      )
    ) : value ? (
      value
    ) : (
      <Placeholder text={placeholder} />
    );

  const open = () => ctx.begin(field, value);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };

  if (block) {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={onKeyDown}
        className={`${hoverable} -mx-1.5 -my-0.5 block px-1.5 py-0.5`}
      >
        {body}
        {hint}
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKeyDown}
      className={`${hoverable} -mx-1 px-1`}
    >
      {body}
      {hint}
    </span>
  );
}

function Placeholder({ text }: { text: string }) {
  return <span className="italic text-neutral-400">{text}</span>;
}

function Editor({
  multiline,
  block,
  bullets,
}: {
  multiline?: boolean;
  block?: boolean;
  bullets?: boolean;
}) {
  const ctx = useEdit();
  const control =
    "w-full rounded-[4px] border border-primary/40 bg-white px-1 py-0.5 [font:inherit] text-neutral-900 outline-none focus:border-primary";

  const autosize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <span
      className={
        block ? "-mx-1.5 block px-1.5" : "block min-w-[7rem]"
      }
    >
      {multiline ? (
        <textarea
          autoFocus
          ref={(el) => {
            taRef.current = el;
            autosize(el);
          }}
          value={ctx.draft}
          rows={2}
          onChange={(e) => {
            ctx.setDraft(e.target.value);
            autosize(e.currentTarget);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              ctx.cancel();
            } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              ctx.save();
            }
          }}
          className={`${control} resize-none overflow-hidden`}
        />
      ) : (
        <input
          autoFocus
          value={ctx.draft}
          onChange={(e) => ctx.setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              ctx.cancel();
            } else if (e.key === "Enter") {
              e.preventDefault();
              ctx.save();
            }
          }}
          className={control}
        />
      )}

      <span className="no-print mt-1 flex flex-wrap items-center gap-2 font-sans">
        <button
          type="button"
          onClick={ctx.save}
          disabled={ctx.pending}
          className="btn btn-primary px-2.5 py-1 text-xs disabled:opacity-50"
        >
          {ctx.pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={ctx.cancel}
          className="btn btn-outline px-2.5 py-1 text-xs"
        >
          Cancel
        </button>
        <span className="text-[0.68rem] text-muted-foreground">
          {multiline ? "⌘↵ to save · Esc to cancel" : "↵ to save · Esc to cancel"}
          {bullets ? " · one bullet per line" : ""}
        </span>
      </span>
    </span>
  );
}
