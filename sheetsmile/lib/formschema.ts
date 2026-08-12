export type FieldType =
  | "text"
  | "paragraph"
  | "email"
  | "phone"
  | "number"
  | "dropdown"
  | "multiple_choice"
  | "checkbox"
  | "date"
  | "file"
  | "hidden";

export interface FormField {
  id: string; // stable key for React/dnd
  type: FieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  instructions?: string;
  options?: string[]; // dropdown / multiple_choice
  value?: string; // hidden fields
}

export interface FormSchema {
  title: string;
  description?: string;
  submitLabel?: string;
  fields: FormField[];
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Short text",
  paragraph: "Paragraph",
  email: "Email",
  phone: "Phone",
  number: "Number",
  dropdown: "Dropdown",
  multiple_choice: "Multiple choice",
  checkbox: "Checkbox",
  date: "Date",
  file: "File upload",
  hidden: "Hidden field",
};

export function parseSchema(raw: string | null): FormSchema | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.fields)) return null;
    return parsed as FormSchema;
  } catch {
    return null;
  }
}

/** Sheet column name for a field (labels are the field names customers see in the sheet). */
export function fieldName(field: FormField): string {
  return field.label.trim() || field.type;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Generates the standalone HTML export for a schema — semantic markup with
 * native validation attributes and the honeypot, no styling. Customers paste
 * this into their own site where their CSS applies.
 */
export function generateHtmlExport(
  schema: FormSchema,
  endpoint: string
): string {
  const hasFile = schema.fields.some((f) => f.type === "file");
  const lines: string[] = [];
  lines.push(
    `<form action="${escapeAttr(endpoint)}" method="POST"${
      hasFile ? ' enctype="multipart/form-data"' : ""
    }>`
  );

  for (const f of schema.fields) {
    const name = escapeAttr(fieldName(f));
    const req = f.required ? " required" : "";
    const ph = f.placeholder ? ` placeholder="${escapeAttr(f.placeholder)}"` : "";

    if (f.type === "hidden") {
      lines.push(
        `  <input type="hidden" name="${name}" value="${escapeAttr(f.value ?? "")}" />`
      );
      continue;
    }

    lines.push(`  <label>`);
    lines.push(`    ${escapeAttr(f.label)}`);
    if (f.instructions) lines.push(`    <small>${escapeAttr(f.instructions)}</small>`);

    switch (f.type) {
      case "paragraph":
        lines.push(`    <textarea name="${name}"${ph}${req}></textarea>`);
        break;
      case "dropdown":
        lines.push(`    <select name="${name}"${req}>`);
        lines.push(`      <option value="">Choose…</option>`);
        for (const opt of f.options ?? [])
          lines.push(
            `      <option value="${escapeAttr(opt)}">${escapeAttr(opt)}</option>`
          );
        lines.push(`    </select>`);
        break;
      case "multiple_choice":
        for (const opt of f.options ?? [])
          lines.push(
            `    <label><input type="radio" name="${name}" value="${escapeAttr(opt)}"${req} /> ${escapeAttr(opt)}</label>`
          );
        break;
      case "checkbox":
        lines.push(`    <input type="checkbox" name="${name}" value="yes"${req} />`);
        break;
      case "file":
        lines.push(`    <input type="file" name="${name}"${req} />`);
        break;
      default: {
        const inputType =
          f.type === "phone" ? "tel" : f.type === "text" ? "text" : f.type;
        lines.push(`    <input type="${inputType}" name="${name}"${ph}${req} />`);
      }
    }
    lines.push(`  </label>`);
  }

  lines.push(
    `  <input type="text" name="_gotcha" style="display:none" tabindex="-1" autocomplete="off" />`
  );
  lines.push(
    `  <button type="submit">${escapeAttr(schema.submitLabel || "Submit")}</button>`
  );
  lines.push(`</form>`);
  return lines.join("\n");
}
