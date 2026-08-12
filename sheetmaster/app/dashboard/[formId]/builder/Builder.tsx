"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FormSchema,
  FormField,
  FieldType,
  FIELD_TYPE_LABELS,
} from "@/lib/formschema";

const PALETTE: FieldType[] = [
  "text",
  "paragraph",
  "email",
  "phone",
  "number",
  "dropdown",
  "multiple_choice",
  "checkbox",
  "date",
  "file",
  "hidden",
];

function newField(type: FieldType): FormField {
  const base: FormField = {
    id: crypto.randomUUID(),
    type,
    label: FIELD_TYPE_LABELS[type],
    required: false,
  };
  if (type === "dropdown" || type === "multiple_choice")
    base.options = ["Option 1", "Option 2"];
  return base;
}

function SortableFieldCard({
  field,
  selected,
  onSelect,
  onRemove,
}: {
  field: FormField;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: field.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-brand border bg-white px-3 py-2 text-sm ${
        selected ? "border-primary ring-1 ring-primary/30" : "border-line"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-gray-400 hover:text-muted-foreground"
        title="Drag to reorder"
        type="button"
      >
        ⠿
      </button>
      <button type="button" onClick={onSelect} className="flex-1 text-left">
        <span className="font-medium text-foreground">{field.label}</span>{" "}
        <span className="text-xs text-gray-400">
          {FIELD_TYPE_LABELS[field.type]}
          {field.required ? " · required" : ""}
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="text-gray-300 hover:text-red-500"
        title="Remove field"
      >
        ✕
      </button>
    </div>
  );
}

export default function Builder({
  formId,
  initialSchema,
}: {
  formId: string;
  initialSchema: FormSchema;
}) {
  const [schema, setSchema] = useState<FormSchema>(initialSchema);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const selected = schema.fields.find((f) => f.id === selectedId) ?? null;

  function updateField(id: string, patch: Partial<FormField>) {
    setSchema((s) => ({
      ...s,
      fields: s.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
    setSaveState("idle");
  }

  function addField(type: FieldType) {
    const f = newField(type);
    setSchema((s) => ({ ...s, fields: [...s.fields, f] }));
    setSelectedId(f.id);
    setSaveState("idle");
  }

  function removeField(id: string) {
    setSchema((s) => ({ ...s, fields: s.fields.filter((f) => f.id !== id) }));
    if (selectedId === id) setSelectedId(null);
    setSaveState("idle");
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSchema((s) => {
      const oldIndex = s.fields.findIndex((f) => f.id === active.id);
      const newIndex = s.fields.findIndex((f) => f.id === over.id);
      return { ...s, fields: arrayMove(s.fields, oldIndex, newIndex) };
    });
    setSaveState("idle");
  }

  async function save() {
    setSaveState("saving");
    const res = await fetch(`/api/forms/${formId}/schema`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schema),
    });
    setSaveState(res.ok ? "saved" : "error");
  }

  const inputClass =
    "mt-1 w-full rounded-brand border border-line px-3 py-2 text-sm";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left: palette + field list */}
      <div className="space-y-4">
        <section className="rounded-brand border bg-white p-4">
          <h2 className="text-sm font-semibold text-foreground">Add a field</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PALETTE.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addField(t)}
                className="rounded-brand border border-line bg-[#faf9f7] px-2 py-1 text-xs text-[#3d3a35] hover:border-primary hover:text-primary"
              >
                + {FIELD_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-brand border bg-white p-4">
          <h2 className="text-sm font-semibold text-foreground">Fields</h2>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={schema.fields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="mt-2 space-y-1.5">
                {schema.fields.map((f) => (
                  <SortableFieldCard
                    key={f.id}
                    field={f}
                    selected={f.id === selectedId}
                    onSelect={() => setSelectedId(f.id)}
                    onRemove={() => removeField(f.id)}
                  />
                ))}
                {schema.fields.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No fields yet — add one above.
                  </p>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </section>

        {/* Field settings */}
        {selected && (
          <section className="rounded-brand border bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              Field settings
            </h2>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Label{" "}
                <span className="font-normal text-gray-400">
                  (becomes the sheet column name)
                </span>
              </label>
              <input
                value={selected.label}
                onChange={(e) =>
                  updateField(selected.id, { label: e.target.value })
                }
                className={inputClass}
              />
            </div>
            {selected.type === "hidden" ? (
              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Value
                </label>
                <input
                  value={selected.value ?? ""}
                  onChange={(e) =>
                    updateField(selected.id, { value: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">
                    Placeholder
                  </label>
                  <input
                    value={selected.placeholder ?? ""}
                    onChange={(e) =>
                      updateField(selected.id, { placeholder: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">
                    Instructions for visitors
                  </label>
                  <input
                    value={selected.instructions ?? ""}
                    onChange={(e) =>
                      updateField(selected.id, {
                        instructions: e.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-[#3d3a35]">
                  <input
                    type="checkbox"
                    checked={selected.required ?? false}
                    onChange={(e) =>
                      updateField(selected.id, { required: e.target.checked })
                    }
                  />
                  Required
                </label>
                {(selected.type === "dropdown" ||
                  selected.type === "multiple_choice") && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      Options (one per line)
                    </label>
                    <textarea
                      value={(selected.options ?? []).join("\n")}
                      onChange={(e) =>
                        updateField(selected.id, {
                          options: e.target.value.split("\n"),
                        })
                      }
                      rows={4}
                      className={inputClass}
                    />
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>

      {/* Right: form settings + live preview */}
      <div className="space-y-4 lg:col-span-2">
        <section className="rounded-brand border bg-white p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Form title
              </label>
              <input
                value={schema.title}
                onChange={(e) => {
                  setSchema((s) => ({ ...s, title: e.target.value }));
                  setSaveState("idle");
                }}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Submit button text
              </label>
              <input
                value={schema.submitLabel ?? ""}
                onChange={(e) => {
                  setSchema((s) => ({ ...s, submitLabel: e.target.value }));
                  setSaveState("idle");
                }}
                placeholder="Submit"
                className={inputClass}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground">
                Description
              </label>
              <input
                value={schema.description ?? ""}
                onChange={(e) => {
                  setSchema((s) => ({ ...s, description: e.target.value }));
                  setSaveState("idle");
                }}
                className={inputClass}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saveState === "saving"}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {saveState === "saving" ? "Saving…" : "Save form"}
            </button>
            {saveState === "saved" && (
              <span className="text-sm text-green-600">
                Saved — your hosted page and embeds are live.
              </span>
            )}
            {saveState === "error" && (
              <span className="text-sm text-red-600">
                Save failed — try again.
              </span>
            )}
          </div>
        </section>

        <section className="rounded-brand border bg-muted p-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Live preview
          </h2>
          <div className="mx-auto max-w-lg rounded-xl border bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-foreground">
              {schema.title || "Untitled form"}
            </h1>
            {schema.description && (
              <p className="mt-2 text-sm text-muted-foreground">{schema.description}</p>
            )}
            <div className="mt-6 space-y-5">
              {schema.fields
                .filter((f) => f.type !== "hidden")
                .map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedId(f.id)}
                    className={`cursor-pointer rounded-brand p-1 -m-1 ${
                      f.id === selectedId ? "ring-1 ring-primary/40" : ""
                    }`}
                  >
                    <label className="block text-sm font-medium text-foreground">
                      {f.label}
                      {f.required && <span className="text-red-500"> *</span>}
                    </label>
                    {f.instructions && (
                      <p className="text-xs text-muted-foreground">{f.instructions}</p>
                    )}
                    {f.type === "paragraph" ? (
                      <textarea
                        placeholder={f.placeholder}
                        rows={3}
                        disabled
                        className={inputClass}
                      />
                    ) : f.type === "dropdown" ? (
                      <select disabled className={inputClass}>
                        <option>Choose…</option>
                        {(f.options ?? []).map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    ) : f.type === "multiple_choice" ? (
                      <div className="mt-1 space-y-1">
                        {(f.options ?? []).map((o) => (
                          <label
                            key={o}
                            className="flex items-center gap-2 text-sm text-[#3d3a35]"
                          >
                            <input type="radio" disabled /> {o}
                          </label>
                        ))}
                      </div>
                    ) : f.type === "checkbox" ? (
                      <input type="checkbox" disabled className="mt-1" />
                    ) : f.type === "file" ? (
                      <input type="file" disabled className="mt-1 w-full text-sm" />
                    ) : (
                      <input
                        type="text"
                        placeholder={f.placeholder}
                        disabled
                        className={inputClass}
                      />
                    )}
                  </div>
                ))}
            </div>
            <button
              type="button"
              disabled
              className="mt-8 w-full rounded-full bg-primary px-4 py-2.5 font-medium text-white opacity-90"
            >
              {schema.submitLabel || "Submit"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
