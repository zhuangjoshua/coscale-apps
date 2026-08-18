"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full btn btn-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending
        ? "Researching the role and tailoring your resume… (1–2 minutes)"
        : "Tailor my resume"}
    </button>
  );
}
