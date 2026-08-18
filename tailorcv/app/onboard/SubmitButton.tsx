"use client";

import { useFormStatus } from "react-dom";

/**
 * The structuring call takes 30–60s, so the button has to say so — otherwise
 * people assume it hung and submit again.
 */
export default function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary px-6 py-3 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Writing your resume…" : "Create my master resume"}
      </button>
      {pending && (
        <span className="text-sm text-muted-foreground">
          Writing your resume… (this takes about a minute)
        </span>
      )}
    </div>
  );
}
