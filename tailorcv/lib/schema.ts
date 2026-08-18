/**
 * The one Resume shape used everywhere: master and tailored resumes, the
 * renderer, the PDF view, and the JSON schema the model is constrained to.
 */

export interface ResumeLink {
  label: string;
  url: string;
}

export interface ResumeExperience {
  title: string;
  org: string;
  location: string;
  dates: string;
  bullets: string[];
}

export interface ResumeProject {
  name: string;
  description: string;
  dates: string;
  bullets: string[];
}

export interface ResumeEducation {
  degree: string;
  school: string;
  dates: string;
  notes: string;
  bullets: string[];
}

export interface ResumeActivity {
  title: string;
  detail: string;
  dates: string;
}

export interface ResumeSkillGroup {
  category: string;
  items: string[];
}

export interface Resume {
  name: string;
  headline: string;
  contact: {
    email: string;
    phone: string;
    location: string;
    links: ResumeLink[];
  };
  summary: string;
  experience: ResumeExperience[];
  projects: ResumeProject[];
  education: ResumeEducation[];
  activities: ResumeActivity[];
  skills: ResumeSkillGroup[];
}

export interface LibraryEntryDraft {
  kind: "job" | "project" | "education" | "skill";
  title: string;
  org: string;
  dates: string;
  facts: string[];
  skills: string[];
}

/** JSON Schema for `Resume`, passed to output_config.format. */
export const RESUME_JSON_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    headline: {
      type: "string",
      description: "One-line professional headline, e.g. 'Backend Engineer'",
    },
    contact: {
      type: "object",
      properties: {
        email: { type: "string" },
        phone: { type: "string" },
        location: { type: "string" },
        links: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              url: { type: "string" },
            },
            required: ["label", "url"],
            additionalProperties: false,
          },
        },
      },
      required: ["email", "phone", "location", "links"],
      additionalProperties: false,
    },
    summary: {
      type: "string",
      description: "2-3 sentence professional summary. Empty string if the user provided too little to write one honestly.",
    },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          org: { type: "string" },
          location: { type: "string" },
          dates: { type: "string" },
          bullets: {
            type: "array",
            items: { type: "string" },
            description:
              "3 to 5 bullets. Each must fill complete printed lines: 82-92 characters (one full line) or 170-185 (two full lines) — never in between. Built only from facts the user provided.",
          },
        },
        required: ["title", "org", "location", "dates", "bullets"],
        additionalProperties: false,
      },
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          dates: {
            type: "string",
            description: "Empty string if the user gave no dates",
          },
          bullets: { type: "array", items: { type: "string" } },
        },
        required: ["name", "description", "dates", "bullets"],
        additionalProperties: false,
      },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          degree: { type: "string" },
          school: { type: "string" },
          dates: { type: "string" },
          notes: { type: "string" },
          bullets: {
            type: "array",
            items: { type: "string" },
            description:
              "School-tied lines: TA/RA roles, honors, dean's list, academic competitions (e.g. 'Top 500, Putnam Mathematical Competition'), and campus club participation worth showing. Empty array if none.",
          },
        },
        required: ["degree", "school", "dates", "notes", "bullets"],
        additionalProperties: false,
      },
    },
    activities: {
      type: "array",
      description:
        "Leadership & Activities: ONLY extracurriculars showing leadership, initiative, or significant impact — president/founder/officer of an organization, organized or taught something, sustained substantial commitment. Mere participation (member of a club, attended events) NEVER belongs here — it goes in an education bullet or stays off the resume. Empty array if none.",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "e.g. 'Putnam Mathematical Competition'" },
          detail: { type: "string", description: "Short phrase, e.g. 'Top 500 nationally'. Empty string if none." },
          dates: { type: "string", description: "Empty string if unknown." },
        },
        required: ["title", "detail", "dates"],
        additionalProperties: false,
      },
    },
    skills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          items: { type: "array", items: { type: "string" } },
        },
        required: ["category", "items"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "name",
    "headline",
    "contact",
    "summary",
    "experience",
    "projects",
    "education",
    "activities",
    "skills",
  ],
  additionalProperties: false,
} as const;

export const LIBRARY_JSON_SCHEMA = {
  type: "object",
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["job", "project", "education", "activity", "skill"] },
          title: { type: "string" },
          org: { type: "string" },
          dates: { type: "string" },
          facts: {
            type: "array",
            items: { type: "string" },
            description:
              "Atomic facts in the user's own substance: what they did, with what, and any outcomes they stated. One fact per string.",
          },
          skills: { type: "array", items: { type: "string" } },
        },
        required: ["kind", "title", "org", "dates", "facts", "skills"],
        additionalProperties: false,
      },
    },
    resume: RESUME_JSON_SCHEMA,
  },
  required: ["entries", "resume"],
  additionalProperties: false,
} as const;

export const TAILORED_JSON_SCHEMA = {
  type: "object",
  properties: {
    resume: RESUME_JSON_SCHEMA,
    changes: {
      type: "array",
      items: { type: "string" },
      description:
        "Plain-English list of what was emphasized, reordered, reworded, or omitted relative to the master resume, and why it fits this job.",
    },
  },
  required: ["resume", "changes"],
  additionalProperties: false,
} as const;

/** Schema for incremental library additions (extendLibrary). */
export const EXTEND_JSON_SCHEMA = {
  type: "object",
  properties: {
    additions: {
      type: "array",
      description: "Brand-new library entries for experiences not already in the library.",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["job", "project", "education", "activity", "skill"] },
          title: { type: "string" },
          org: { type: "string" },
          dates: { type: "string" },
          facts: { type: "array", items: { type: "string" } },
          skills: { type: "array", items: { type: "string" } },
        },
        required: ["kind", "title", "org", "dates", "facts", "skills"],
        additionalProperties: false,
      },
    },
    appends: {
      type: "array",
      description: "New facts that belong to an EXISTING entry, referenced by its id.",
      items: {
        type: "object",
        properties: {
          entry_id: { type: "integer" },
          facts: { type: "array", items: { type: "string" } },
          skills: { type: "array", items: { type: "string" } },
        },
        required: ["entry_id", "facts", "skills"],
        additionalProperties: false,
      },
    },
  },
  required: ["additions", "appends"],
  additionalProperties: false,
} as const;

/** Schema for facts appended directly to one chosen entry. */
export const FACTS_JSON_SCHEMA = {
  type: "object",
  properties: {
    facts: {
      type: "array",
      items: { type: "string" },
      description: "The new information as atomic facts, one per string, lossless.",
    },
    skills: {
      type: "array",
      items: { type: "string" },
      description: "Technologies/tools explicitly mentioned in the new text.",
    },
  },
  required: ["facts", "skills"],
  additionalProperties: false,
} as const;

/** Schema for suggested resume updates (suggest-and-review flow). */
export const SUGGEST_JSON_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["add_bullet", "reword_bullet", "add_skill", "add_activity", "note"],
          },
          section: { type: "string", enum: ["experience", "projects", "education", ""] },
          index: {
            type: "integer",
            description: "Index into resume.experience or resume.projects. -1 when unused.",
          },
          bullet_index: {
            type: "integer",
            description: "For reword_bullet: which bullet to replace. -1 when unused.",
          },
          old_text: {
            type: "string",
            description: "For reword_bullet: the EXACT current bullet text. Empty otherwise.",
          },
          new_text: {
            type: "string",
            description: "The new or reworded bullet text. Empty for add_skill/note.",
          },
          skill_category: { type: "string" },
          skill_item: { type: "string" },
          activity_title: { type: "string", description: "For add_activity. Empty otherwise." },
          activity_detail: { type: "string", description: "For add_activity. Empty otherwise." },
          activity_dates: { type: "string", description: "For add_activity. Empty otherwise." },
          reason: {
            type: "string",
            description: "One plain-English sentence: why this change (or why library-only for notes).",
          },
        },
        required: [
          "kind",
          "section",
          "index",
          "bullet_index",
          "old_text",
          "new_text",
          "skill_category",
          "skill_item",
          "activity_title",
          "activity_detail",
          "activity_dates",
          "reason",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
} as const;
