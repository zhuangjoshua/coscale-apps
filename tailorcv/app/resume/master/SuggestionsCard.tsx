import { Suggestion, SuggestionPayload } from "@/lib/db";
import { acceptSuggestion, skipSuggestion } from "@/app/actions";

/** Pending resume-update proposals from newly added facts: accept or skip. */
export default function SuggestionsCard({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="no-print mb-4 card border-primary/20 bg-primary/5 p-4">
      <h3 className="text-sm font-semibold text-primary-dark">
        Your new facts — {suggestions.length} suggested resume update
        {suggestions.length === 1 ? "" : "s"}
      </h3>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Nothing changes unless you accept it. Skipped facts stay safely in
        your library.
      </p>
      <ul className="mt-3 space-y-2">
        {suggestions.map((s) => (
          <SuggestionRow key={s.id} suggestion={s} />
        ))}
      </ul>
    </div>
  );
}

function describe(s: Suggestion, p: SuggestionPayload): React.ReactNode {
  if (s.kind === "add_bullet") {
    const where =
      p.section === "projects"
        ? "project"
        : p.section === "education"
          ? "education"
          : "experience";
    return (
      <>
        <span className="font-medium">Add bullet</span> to {where} #{p.index + 1}:{" "}
        <em>&ldquo;{p.new_text}&rdquo;</em>
      </>
    );
  }
  if (s.kind === "add_activity") {
    return (
      <>
        <span className="font-medium">Add activity</span>:{" "}
        <em>
          {p.activity_title}
          {p.activity_detail ? ` | ${p.activity_detail}` : ""}
          {p.activity_dates ? ` (${p.activity_dates})` : ""}
        </em>
      </>
    );
  }
  if (s.kind === "reword_bullet") {
    return (
      <>
        <span className="font-medium">Reword bullet</span>:{" "}
        <span className="line-through opacity-60">{p.old_text}</span>{" "}
        <span aria-hidden="true">→</span> <em>&ldquo;{p.new_text}&rdquo;</em>
      </>
    );
  }
  if (s.kind === "add_skill") {
    return (
      <>
        <span className="font-medium">Add skill</span>{" "}
        <em>{p.skill_item}</em> to {p.skill_category || "Skills"}
      </>
    );
  }
  return (
    <>
      <span className="font-medium">Our advice: leave this one off</span> — saved
      to your library
    </>
  );
}

function SuggestionRow({ suggestion }: { suggestion: Suggestion }) {
  const p = JSON.parse(suggestion.payload) as SuggestionPayload;
  const isNote = suggestion.kind === "note";

  return (
    <li className="rounded-brand border border-primary/20 bg-background p-3 text-sm">
      <div>{describe(suggestion, p)}</div>
      {suggestion.reason && (
        <p className="mt-1 text-xs text-muted-foreground">{suggestion.reason}</p>
      )}
      <div className="mt-2 flex gap-2">
        {!isNote && (
          <form action={acceptSuggestion}>
            <input type="hidden" name="suggestion_id" value={suggestion.id} />
            <button className="btn btn-primary px-3 py-1 text-xs">
              Accept
            </button>
          </form>
        )}
        <form action={skipSuggestion}>
          <input type="hidden" name="suggestion_id" value={suggestion.id} />
          <button className="btn btn-outline px-3 py-1 text-xs">
            {isNote ? "Dismiss" : "Skip"}
          </button>
        </form>
      </div>
    </li>
  );
}
