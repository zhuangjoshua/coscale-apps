"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { addToEntry } from "@/app/actions";

/** Per-entry "add facts" form — appends directly to this entry, no routing. */
export default function AddToEntry({ entryId }: { entryId: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <details ref={detailsRef} className="mt-2">
      <summary className="cursor-pointer text-sm font-medium text-primary hover:text-primary-dark">
        + Add facts to this entry
      </summary>
      <form
        ref={formRef}
        action={async (data) => {
          await addToEntry(data);
          formRef.current?.reset();
          if (detailsRef.current) detailsRef.current.open = false;
        }}
        className="mt-2"
      >
        <input type="hidden" name="entry_id" value={entryId} />
        <textarea
          name="text"
          required
          rows={2}
          placeholder="Describe it plainly — it gets cleaned into facts and added right here."
          className="field"
        />
        <Submit />
      </form>
    </details>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 btn btn-primary px-3 py-1.5 text-sm disabled:opacity-60"
    >
      {pending ? "Adding…" : "Add facts"}
    </button>
  );
}
