/**
 * Block list + schema-driven property forms.
 *
 * Blocks are mutated in place on a working copy owned by the editor screen; every
 * change calls `onChange` so the screen can mark dirty and re-render the preview.
 */

import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import type { Block } from "../../lib/pagewright";
import {
  BLOCK_DEFAULTS,
  SCHEMA,
  WHEN_FIELD,
  getPath,
  newBlockId,
  setPath,
  type FieldSpec,
  type ShapePart,
} from "./block-schema";

const labelClass = "grid gap-1 text-xs text-muted-foreground";
const selectClass =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground";

interface FieldProps {
  block: Block;
  field: FieldSpec;
  onChange: () => void;
}

function ObjectRows({ block, field, onChange }: FieldProps) {
  const rows = (getPath(block, field.key) as Record<string, unknown>[]) ?? [];
  const shape = field.shape ?? [];

  const setCell = (row: Record<string, unknown>, part: ShapePart, value: unknown) => {
    row[part.key] = value;
    onChange();
  };

  return (
    <div className={labelClass}>
      <span>{field.label}</span>
      <div className="grid gap-1.5">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-1.5">
            {shape.map((part) =>
              part.type === "select" ? (
                <select
                  key={part.key}
                  className={`${selectClass} flex-1`}
                  value={String(row[part.key] ?? "")}
                  onChange={(e) => setCell(row, part, e.target.value)}
                >
                  <option value="" />
                  {(part.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : part.type === "checkbox" ? (
                <input
                  key={part.key}
                  type="checkbox"
                  title={part.key}
                  className="h-4 w-4"
                  checked={Boolean(row[part.key])}
                  onChange={(e) => setCell(row, part, e.target.checked)}
                />
              ) : (
                <Input
                  key={part.key}
                  className={part.narrow ? "h-9 w-20" : "h-9 flex-1"}
                  placeholder={part.placeholder ?? part.key}
                  defaultValue={String(row[part.key] ?? "")}
                  onChange={(e) => setCell(row, part, e.target.value)}
                />
              ),
            )}
            <Button
              variant="ghost"
              size="sm"
              aria-label="Remove row"
              onClick={() => {
                rows.splice(index, 1);
                onChange();
              }}
            >
              ×
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => {
            const blank = Object.fromEntries(
              shape.map((part) => [part.key, part.type === "checkbox" ? false : ""]),
            );
            setPath(block, field.key, [...rows, blank]);
            onChange();
          }}
        >
          + row
        </Button>
      </div>
    </div>
  );
}

function StringRows({ block, field, onChange }: FieldProps) {
  const lines = (getPath(block, field.key) as string[]) ?? [];
  return (
    <div className={labelClass}>
      <span>{field.label}</span>
      <div className="grid gap-1.5">
        {lines.map((line, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <Input
              className="h-9 flex-1"
              defaultValue={line}
              onChange={(e) => {
                lines[index] = e.target.value;
                onChange();
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label="Remove line"
              onClick={() => {
                lines.splice(index, 1);
                onChange();
              }}
            >
              ×
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => {
            setPath(block, field.key, [...lines, ""]);
            onChange();
          }}
        >
          + line
        </Button>
      </div>
    </div>
  );
}

function Field({ block, field, onChange }: FieldProps) {
  const value = getPath(block, field.key);

  if (field.type === "objects") return <ObjectRows block={block} field={field} onChange={onChange} />;
  if (field.type === "strings") return <StringRows block={block} field={field} onChange={onChange} />;

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={Boolean(value)}
          onChange={(e) => {
            setPath(block, field.key, e.target.checked);
            onChange();
          }}
        />
        {field.label}
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className={labelClass}>
        <span>{field.label}</span>
        <select
          className={selectClass}
          value={String(value ?? "")}
          onChange={(e) => {
            setPath(block, field.key, field.cast ? field.cast(e.target.value) : e.target.value);
            onChange();
          }}
        >
          <option value="" />
          {(field.options ?? []).map((option) => (
            <option key={String(option)} value={String(option)}>
              {String(option)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className={labelClass}>
        <span>{field.label}</span>
        <Textarea
          rows={3}
          className="font-mono text-xs"
          defaultValue={String(value ?? "")}
          onChange={(e) => {
            setPath(block, field.key, e.target.value);
            onChange();
          }}
        />
      </label>
    );
  }

  return (
    <label className={labelClass}>
      <span>{field.label}</span>
      <Input
        className="h-9"
        type={field.type === "number" ? "number" : "text"}
        defaultValue={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => {
          const raw =
            field.type === "number"
              ? e.target.value === ""
                ? undefined
                : Number(e.target.value)
              : e.target.value;
          setPath(block, field.key, raw);
          onChange();
        }}
      />
    </label>
  );
}

export interface BlockEditorProps {
  blocks: Block[];
  onChange: () => void;
}

export function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<number | null>(null);
  const [type, setType] = useState("heading");

  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        {blocks.map((block, index) => {
          const spec = SCHEMA[block.type] ?? {
            label: block.type,
            summary: () => "",
            fields: [],
          };
          return (
            <div
              key={block.id}
              className={`rounded-xl border bg-card ${
                dragging === index ? "opacity-40" : "border-border"
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = Number(e.dataTransfer.getData("text/plain"));
                if (Number.isNaN(from) || from === index) return;
                const [moved] = blocks.splice(from, 1);
                blocks.splice(index, 0, moved);
                setDragging(null);
                onChange();
              }}
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <span
                  draggable
                  className="cursor-grab text-muted-foreground"
                  aria-label="Drag to reorder"
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", String(index));
                    setDragging(index);
                  }}
                  onDragEnd={() => setDragging(null)}
                >
                  ⠿
                </span>
                <button
                  type="button"
                  className="flex flex-1 items-center gap-2 text-left"
                  onClick={() => toggle(block.id)}
                >
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                    {spec.label}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {spec.summary(block)}
                  </span>
                  {block.when ? (
                    <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
                      when {block.when}
                    </span>
                  ) : null}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Duplicate block"
                  onClick={() => {
                    blocks.splice(index + 1, 0, {
                      ...structuredClone(block),
                      id: newBlockId(),
                    });
                    onChange();
                  }}
                >
                  ⧉
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Remove block"
                  onClick={() => {
                    blocks.splice(index, 1);
                    onChange();
                  }}
                >
                  ×
                </Button>
              </div>

              {open.has(block.id) ? (
                <div className="grid gap-3 border-t border-border bg-muted/40 p-3">
                  {[...spec.fields, WHEN_FIELD].map((field) => (
                    <Field key={field.key} block={block} field={field} onChange={onChange} />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <select
          className={selectClass}
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Block type"
        >
          {Object.entries(SCHEMA).map(([key, spec]) => (
            <option key={key} value={key}>
              {spec.label}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          onClick={() => {
            blocks.push({ id: newBlockId(), type, ...(BLOCK_DEFAULTS[type] ?? {}) });
            onChange();
          }}
        >
          Add block
        </Button>
      </div>
    </div>
  );
}
