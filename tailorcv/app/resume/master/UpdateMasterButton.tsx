"use client";

import { useFormStatus } from "react-dom";
import { updateMasterResume } from "@/app/actions";

/** Non-destructive "weave new library facts into the master" button. */
export default function UpdateMasterButton() {
  return (
    <form action={updateMasterResume}>
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title="Adds library facts that aren't on the resume yet. Keeps your existing wording and edits."
      className="btn btn-outline px-3 py-2 text-sm disabled:opacity-60"
    >
      {pending ? "Updating from library…" : "Update from library"}
    </button>
  );
}
