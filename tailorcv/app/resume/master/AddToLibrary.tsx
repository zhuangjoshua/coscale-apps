"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { addToLibrary } from "@/app/actions";

/** Free-text "add to library" form with pending state; clears on submit. */
export default function AddToLibrary() {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (data) => {
        await addToLibrary(data);
        formRef.current?.reset();
      }}
      className="card p-4"
    >
      <h3 className="text-sm font-semibold">Add to your library</h3>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Did something new — shipped a project, changed roles, picked up a
        skill? Describe it like you&rsquo;d tell a friend. It gets filed into
        the right entry (or a new one) without touching your master resume or
        any tailored resume.
      </p>
      <textarea
        name="text"
        required
        rows={3}
        placeholder="e.g. Last month I led the launch of our new billing service — Python, running on Kubernetes now. Cut invoice processing time in half."
        className="mt-3 field"
      />
      <div className="mt-2 flex items-center gap-2 text-sm">
        <label htmlFor="add-kind" className="text-muted-foreground">
          File as
        </label>
        <select
          id="add-kind"
          name="kind"
          defaultValue=""
          className="field w-auto py-1.5"
        >
          <option value="">Auto-detect</option>
          <option value="job">Job</option>
          <option value="project">Project</option>
          <option value="education">Education</option>
          <option value="activity">Activity</option>
          <option value="skill">Skill</option>
        </select>
        <span className="text-xs text-muted-foreground">
          — pick one if it&rsquo;s not obvious where this belongs
        </span>
      </div>
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <div className="mt-2 flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary px-4 py-2 text-sm disabled:opacity-60"
      >
        {pending ? "Filing it away…" : "Add to library"}
      </button>
      {pending && (
        <span className="text-sm text-muted-foreground">
          Sorting your new facts into the library…
        </span>
      )}
    </div>
  );
}
