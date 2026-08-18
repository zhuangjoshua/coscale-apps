/**
 * Describes each block type's editable fields. The editor renders forms from this
 * rather than hand-writing one panel per block, so adding a block type is a data change.
 */

import type { Block } from "../../lib/pagewright";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "strings"
  | "objects";

export interface ShapePart {
  key: string;
  type?: "select" | "checkbox";
  options?: string[];
  placeholder?: string;
  narrow?: boolean;
}

export interface FieldSpec {
  key: string;
  type: FieldType;
  label: string;
  options?: (string | number)[];
  cast?: (value: string) => unknown;
  shape?: ShapePart[];
}

export interface BlockSpec {
  label: string;
  summary: (block: Block) => string;
  fields: FieldSpec[];
}

const ALIGN = ["left", "center", "right"];
const text = (key: string, label: string): FieldSpec => ({ key, type: "text", label });

export const SCHEMA: Record<string, BlockSpec> = {
  heading: {
    label: "Heading",
    summary: (b) => String(b.text ?? ""),
    fields: [
      text("text", "Text"),
      { key: "level", type: "select", label: "Level", options: [1, 2, 3], cast: Number },
      { key: "align", type: "select", label: "Align", options: ALIGN },
    ],
  },
  text: {
    label: "Text",
    summary: (b) => String(b.text ?? ""),
    fields: [
      { key: "text", type: "textarea", label: "Text (inline HTML allowed)" },
      { key: "align", type: "select", label: "Align", options: ALIGN },
      { key: "muted", type: "checkbox", label: "Muted" },
    ],
  },
  brandbar: {
    label: "Brand bar",
    summary: (b) => String(b.title ?? ""),
    fields: [
      text("title", "Title"),
      text("subtitle", "Subtitle"),
      text("logo", "Logo URL or data URI"),
      {
        key: "meta",
        type: "objects",
        label: "Meta rows",
        shape: [
          { key: "label", placeholder: "Label" },
          { key: "value", placeholder: "{{value}}" },
        ],
      },
    ],
  },
  parties: {
    label: "Parties",
    summary: (b) => {
      const left = b.left as { title?: string } | undefined;
      const right = b.right as { title?: string } | undefined;
      return `${left?.title ?? ""} / ${right?.title ?? ""}`;
    },
    fields: [
      text("left.title", "Left title"),
      { key: "left.lines", type: "strings", label: "Left lines" },
      text("right.title", "Right title"),
      { key: "right.lines", type: "strings", label: "Right lines" },
    ],
  },
  keyvalue: {
    label: "Key / value",
    summary: (b) => String(b.title ?? `${(b.rows as unknown[])?.length ?? 0} rows`),
    fields: [
      text("title", "Title"),
      { key: "columns", type: "select", label: "Columns", options: [1, 2, 3], cast: Number },
      {
        key: "rows",
        type: "objects",
        label: "Rows",
        shape: [
          { key: "label", placeholder: "Label" },
          { key: "value", placeholder: "{{value}}" },
        ],
      },
    ],
  },
  table: {
    label: "Table",
    summary: (b) => `${b.source} · ${(b.columns as unknown[])?.length ?? 0} cols`,
    fields: [
      text("source", "Array path (e.g. items)"),
      { key: "zebra", type: "checkbox", label: "Zebra striping" },
      text("emptyText", "Empty state text"),
      {
        key: "columns",
        type: "objects",
        label: "Columns",
        shape: [
          { key: "header", placeholder: "Header" },
          { key: "path", placeholder: "field" },
          { key: "align", type: "select", options: ALIGN },
          { key: "format", type: "select", options: ["text", "money", "number", "date"] },
          { key: "width", placeholder: "10%", narrow: true },
        ],
      },
    ],
  },
  totals: {
    label: "Totals",
    summary: (b) => `${(b.rows as unknown[])?.length ?? 0} rows`,
    fields: [
      { key: "align", type: "select", label: "Align", options: ["right", "left"] },
      {
        key: "rows",
        type: "objects",
        label: "Rows",
        shape: [
          { key: "label", placeholder: "Label" },
          { key: "value", placeholder: '{{money total currency}}' },
          { key: "strong", type: "checkbox" },
        ],
      },
    ],
  },
  image: {
    label: "Image",
    summary: (b) => String(b.src ?? ""),
    fields: [
      text("src", "Source URL / data URI"),
      text("width", "Width (css)"),
      { key: "align", type: "select", label: "Align", options: ALIGN },
      text("alt", "Alt text"),
    ],
  },
  note: {
    label: "Note",
    summary: (b) => String(b.title ?? b.body ?? ""),
    fields: [
      text("title", "Title"),
      { key: "body", type: "textarea", label: "Body" },
      { key: "tone", type: "select", label: "Tone", options: ["neutral", "accent", "warn"] },
    ],
  },
  signature: {
    label: "Signature",
    summary: (b) => `${(b.entries as unknown[])?.length ?? 0} lines`,
    fields: [
      {
        key: "entries",
        type: "objects",
        label: "Lines",
        shape: [
          { key: "label", placeholder: "Label" },
          { key: "name", placeholder: "{{name}}" },
        ],
      },
    ],
  },
  divider: { label: "Divider", summary: () => "—", fields: [] },
  spacer: {
    label: "Spacer",
    summary: (b) => `${b.height ?? 16}px`,
    fields: [{ key: "height", type: "number", label: "Height (px)" }],
  },
  pagebreak: { label: "Page break", summary: () => "forces a new page", fields: [] },
  field: {
    label: "Fillable field",
    summary: (b) => String(b.name ?? ""),
    fields: [
      text("name", "Field name (AcroForm)"),
      text("label", "Label"),
      { key: "width", type: "number", label: "Width (px, blank = full)" },
      { key: "height", type: "number", label: "Height (px)" },
      { key: "multiline", type: "checkbox", label: "Multiline" },
    ],
  },
  html: {
    label: "Raw HTML",
    summary: () => "custom markup",
    fields: [{ key: "html", type: "textarea", label: "HTML" }],
  },
};

/** Shared by every block type — drives conditional sections. */
export const WHEN_FIELD: FieldSpec = {
  key: "when",
  type: "text",
  label: "Show only when (data path)",
};

export const BLOCK_DEFAULTS: Record<string, Record<string, unknown>> = {
  heading: { text: "Heading", level: 2 },
  text: { text: "Body copy with a {{token}}." },
  brandbar: { title: "{{company.name}}", meta: [] },
  parties: { left: { title: "From", lines: [""] }, right: { title: "To", lines: [""] } },
  keyvalue: { title: "Details", rows: [{ label: "Label", value: "{{value}}" }], columns: 2 },
  table: { source: "items", zebra: true, columns: [{ header: "Description", path: "description" }] },
  totals: { rows: [{ label: "Total", value: "{{money total currency}}", strong: true }], align: "right" },
  image: { src: "", align: "left" },
  note: { title: "Note", body: "…", tone: "neutral" },
  signature: { entries: [{ label: "Signature" }] },
  spacer: { height: 16 },
  field: { name: "field_1", label: "Field", height: 26 },
  html: { html: "<div></div>" },
};

// ---------------------------------------------------------------- path access

export function getPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((cursor, key) => (cursor == null ? cursor : (cursor as Record<string, unknown>)[key]), obj);
}

export function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let cursor: Record<string, unknown> = obj;
  for (const key of keys.slice(0, -1)) {
    if (typeof cursor[key] !== "object" || cursor[key] === null) cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
}

export const newBlockId = () => `b${Math.random().toString(36).slice(2, 9)}`;
