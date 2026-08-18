/**
 * Block model → HTML.
 *
 * The editor manipulates blocks; this compiles them to an HTML document that still
 * contains {{ }} tokens. Data merge happens afterwards in template-engine.ts, so a
 * template is compiled once and reused for every render.
 *
 * Layout is deliberately flow-based (normal document flow, `table-header-group`,
 * `break-inside: avoid`) rather than absolutely positioned — that is what lets a
 * table with 3 rows and a table with 300 rows both come out right.
 */

export type Align = "left" | "center" | "right";
export type ColumnFormat = "text" | "money" | "number" | "date";

export interface Column {
  header: string;
  path: string;
  align?: Align;
  width?: string;
  format?: ColumnFormat;
}

/**
 * `when` is a data path; the block renders only if that path is truthy. Compiled
 * to an {{#if}} wrapper rather than evaluated here, so one compiled template still
 * serves every data payload.
 */
type BlockVariant =
  | { id: string; type: "heading"; text: string; level?: 1 | 2 | 3; align?: Align }
  | { id: string; type: "text"; text: string; align?: Align; muted?: boolean }
  | { id: string; type: "brandbar"; title: string; subtitle?: string; logo?: string; meta?: { label: string; value: string }[] }
  | { id: string; type: "parties"; left: { title: string; lines: string[] }; right: { title: string; lines: string[] } }
  | { id: string; type: "keyvalue"; title?: string; rows: { label: string; value: string }[]; columns?: 1 | 2 | 3 }
  | {
      id: string;
      type: "table";
      source: string;
      columns: Column[];
      zebra?: boolean;
      emptyText?: string;
    }
  | { id: string; type: "totals"; rows: { label: string; value: string; strong?: boolean }[]; align?: Align }
  | { id: string; type: "image"; src: string; width?: string; align?: Align; alt?: string }
  | { id: string; type: "note"; title?: string; body: string; tone?: "neutral" | "warn" | "accent" }
  | { id: string; type: "signature"; entries: { label: string; name?: string }[] }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; height?: number }
  | { id: string; type: "pagebreak" }
  | { id: string; type: "field"; name: string; label?: string; width?: number; height?: number; multiline?: boolean }
  | { id: string; type: "html"; html: string };

export type Block = BlockVariant & { when?: string };

export interface PageSetup {
  format: "A4" | "Letter" | "Legal" | "A3" | "A5";
  orientation: "portrait" | "landscape";
  margin: { top: string; right: string; bottom: string; left: string };
  header?: { enabled: boolean; html: string };
  footer?: { enabled: boolean; html: string };
}

export interface Theme {
  font: string;
  accent: string;
  ink: string;
  muted: string;
  rule: string;
  fontSize: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  blocks: Block[];
  page: PageSetup;
  theme: Theme;
  css?: string;
  sampleData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_THEME: Theme = {
  font: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  accent: "#1f6feb",
  ink: "#111418",
  muted: "#6b7480",
  rule: "#e3e6ea",
  fontSize: "10.5pt",
};

export const DEFAULT_PAGE: PageSetup = {
  format: "A4",
  orientation: "portrait",
  margin: { top: "18mm", right: "16mm", bottom: "20mm", left: "16mm" },
  header: { enabled: false, html: "" },
  footer: {
    enabled: true,
    html: '<span class="pw-foot-left">{{doc.footer}}</span><span class="pw-foot-right">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>',
  },
};

// ---------------------------------------------------------------- rendering

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Column value expression, wrapped in the right formatting helper. */
function cellExpr(col: Column): string {
  const path = col.path.trim();
  switch (col.format) {
    case "money":
      return `{{money ${path} currency}}`;
    case "number":
      return `{{number ${path}}}`;
    case "date":
      return `{{date ${path} "short"}}`;
    default:
      return `{{${path}}}`;
  }
}

function blockHtml(block: Block): string {
  switch (block.type) {
    case "heading": {
      const level = block.level ?? 1;
      return `<h${level} class="pw-h pw-h${level}" style="text-align:${block.align ?? "left"}">${block.text}</h${level}>`;
    }

    case "text":
      return `<p class="pw-p${block.muted ? " pw-muted" : ""}" style="text-align:${block.align ?? "left"}">${block.text}</p>`;

    case "brandbar": {
      const meta = (block.meta ?? [])
        .map((m) => `<div class="pw-brand-meta-row"><span>${m.label}</span><b>${m.value}</b></div>`)
        .join("");
      const logo = block.logo
        ? `<img class="pw-brand-logo" src="${block.logo}" alt="" />`
        : "";
      return `<header class="pw-brand">
  <div class="pw-brand-id">${logo}<div><div class="pw-brand-title">${block.title}</div>${
        block.subtitle ? `<div class="pw-brand-sub">${block.subtitle}</div>` : ""
      }</div></div>
  <div class="pw-brand-meta">${meta}</div>
</header>`;
    }

    case "parties": {
      const col = (c: { title: string; lines: string[] }) =>
        `<div class="pw-party"><div class="pw-party-title">${c.title}</div>${c.lines
          .map((l) => `<div class="pw-party-line">${l}</div>`)
          .join("")}</div>`;
      return `<section class="pw-parties">${col(block.left)}${col(block.right)}</section>`;
    }

    case "keyvalue": {
      const cols = block.columns ?? 2;
      const rows = block.rows
        .map(
          (r) =>
            `<div class="pw-kv-row"><span class="pw-kv-label">${r.label}</span><span class="pw-kv-value">${r.value}</span></div>`,
        )
        .join("");
      return `<section class="pw-kv" style="--pw-kv-cols:${cols}">${
        block.title ? `<div class="pw-section-title">${block.title}</div>` : ""
      }<div class="pw-kv-grid">${rows}</div></section>`;
    }

    case "table": {
      const head = block.columns
        .map(
          (c) =>
            `<th style="text-align:${c.align ?? "left"}${c.width ? `;width:${c.width}` : ""}">${esc(c.header)}</th>`,
        )
        .join("");
      const body = block.columns
        .map((c) => `<td style="text-align:${c.align ?? "left"}">${cellExpr(c)}</td>`)
        .join("");
      const empty = block.emptyText
        ? `{{#unless ${block.source}}}<tr class="pw-empty"><td colspan="${block.columns.length}">${esc(
            block.emptyText,
          )}</td></tr>{{/unless}}`
        : "";
      // thead as table-header-group is what repeats the header on every page.
      return `<table class="pw-table${block.zebra ? " pw-zebra" : ""}">
  <thead><tr>${head}</tr></thead>
  <tbody>{{#each ${block.source}}}<tr>${body}</tr>{{/each}}${empty}</tbody>
</table>`;
    }

    case "totals": {
      const rows = block.rows
        .map(
          (r) =>
            `<div class="pw-total-row${r.strong ? " pw-total-strong" : ""}"><span>${r.label}</span><span>${r.value}</span></div>`,
        )
        .join("");
      return `<section class="pw-totals" style="justify-content:${
        block.align === "left" ? "flex-start" : "flex-end"
      }"><div class="pw-totals-inner">${rows}</div></section>`;
    }

    case "image":
      return `<figure class="pw-figure" style="text-align:${block.align ?? "left"}"><img src="${
        block.src
      }" alt="${esc(block.alt ?? "")}" style="${block.width ? `width:${block.width}` : "max-width:100%"}" /></figure>`;

    case "note":
      return `<aside class="pw-note pw-note-${block.tone ?? "neutral"}">${
        block.title ? `<div class="pw-note-title">${block.title}</div>` : ""
      }<div class="pw-note-body">${block.body}</div></aside>`;

    case "signature": {
      const entries = block.entries
        .map(
          (e) =>
            `<div class="pw-sign"><div class="pw-sign-rule"></div><div class="pw-sign-label">${e.label}</div>${
              e.name ? `<div class="pw-sign-name">${e.name}</div>` : ""
            }</div>`,
        )
        .join("");
      return `<section class="pw-signs">${entries}</section>`;
    }

    case "divider":
      return `<hr class="pw-hr" />`;

    case "spacer":
      return `<div style="height:${block.height ?? 16}px"></div>`;

    case "pagebreak":
      return `<div class="pw-pagebreak"></div>`;

    case "field": {
      // Rendered as a visible box carrying a data attribute; forms.ts finds these
      // boxes in the laid-out page and stamps real AcroForm widgets over them.
      const h = block.height ?? (block.multiline ? 64 : 26);
      return `<div class="pw-field-wrap">${
        block.label ? `<label class="pw-field-label">${block.label}</label>` : ""
      }<div class="pw-field" data-pw-field="${esc(block.name)}" data-pw-multiline="${
        block.multiline ? "1" : "0"
      }" style="height:${h}px;${block.width ? `width:${block.width}px` : ""}"></div></div>`;
    }

    case "html":
      return block.html;

    default:
      return "";
  }
}

function baseCss(theme: Theme, page: PageSetup): string {
  const landscape = page.orientation === "landscape";
  return `
@page { size: ${page.format}${landscape ? " landscape" : ""}; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: ${theme.font};
  font-size: ${theme.fontSize};
  color: ${theme.ink};
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  /* Data is not typeset copy: an unbroken 300-char token (a hash, a file path, a
     concatenated SKU) must wrap rather than blow the layout out sideways.
     "anywhere" rather than "break-word" because it also shrinks min-content width,
     which is what keeps table columns inside the page box. */
  overflow-wrap: anywhere;
}
.pw-doc { width: 100%; }

.pw-h { margin: 0 0 8px; font-weight: 650; letter-spacing: -0.01em; }
.pw-h1 { font-size: 1.9em; }
.pw-h2 { font-size: 1.35em; margin-top: 18px; }
.pw-h3 { font-size: 1.1em; margin-top: 14px; }
.pw-p { margin: 0 0 10px; }
.pw-muted { color: ${theme.muted}; }
.pw-hr { border: 0; border-top: 1px solid ${theme.rule}; margin: 16px 0; }
.pw-section-title {
  font-size: 0.78em; text-transform: uppercase; letter-spacing: 0.08em;
  color: ${theme.muted}; margin-bottom: 6px; font-weight: 600;
}

/* brand bar */
.pw-brand { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 22px; }
.pw-brand-id { display: flex; gap: 12px; align-items: center; }
.pw-brand-logo { height: 38px; width: auto; }
.pw-brand-title { font-size: 1.5em; font-weight: 680; letter-spacing: -0.01em; }
.pw-brand-sub { color: ${theme.muted}; font-size: 0.92em; }
.pw-brand-meta { text-align: right; font-size: 0.92em; min-width: 180px; }
.pw-brand-meta-row { display: flex; justify-content: space-between; gap: 16px; padding: 1px 0; }
.pw-brand-meta-row span { color: ${theme.muted}; }

/* parties */
.pw-parties { display: flex; gap: 28px; margin: 18px 0; break-inside: avoid; }
.pw-party { flex: 1; }
.pw-party-title {
  font-size: 0.78em; text-transform: uppercase; letter-spacing: 0.08em;
  color: ${theme.muted}; margin-bottom: 4px; font-weight: 600;
}
.pw-party-line { line-height: 1.45; }

/* key/value */
.pw-kv { margin: 14px 0; break-inside: avoid; }
.pw-kv-grid { display: grid; grid-template-columns: repeat(var(--pw-kv-cols, 2), minmax(0, 1fr)); gap: 2px 24px; }
.pw-kv-row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; border-bottom: 1px solid ${theme.rule}; }
.pw-kv-label { color: ${theme.muted}; }
.pw-kv-value { font-weight: 550; text-align: right; }

/* tables — the flow engine */
.pw-table { width: 100%; border-collapse: collapse; margin: 14px 0; }
.pw-table thead { display: table-header-group; }   /* repeats on every page */
.pw-table tfoot { display: table-footer-group; }
.pw-table tr { break-inside: avoid; page-break-inside: avoid; }
.pw-table th {
  text-align: left; font-size: 0.76em; text-transform: uppercase; letter-spacing: 0.07em;
  color: ${theme.muted}; font-weight: 600;
  padding: 7px 8px; border-bottom: 1.5px solid ${theme.ink};
}
.pw-table td { padding: 7px 8px; border-bottom: 1px solid ${theme.rule}; vertical-align: top; }
.pw-zebra tbody tr:nth-child(even) td { background: #fafbfc; }
.pw-empty td { color: ${theme.muted}; font-style: italic; text-align: center; padding: 16px; }

/* totals */
.pw-totals { display: flex; margin: 10px 0 4px; break-inside: avoid; }
.pw-totals-inner { min-width: 46%; }
.pw-total-row { display: flex; justify-content: space-between; gap: 24px; padding: 5px 8px; border-bottom: 1px solid ${theme.rule}; }
.pw-total-strong {
  font-weight: 700; font-size: 1.12em; border-bottom: none;
  border-top: 1.5px solid ${theme.ink}; margin-top: 2px; color: ${theme.accent};
}

/* misc */
.pw-figure { margin: 12px 0; break-inside: avoid; }
.pw-figure img { max-width: 100%; }
.pw-note { padding: 11px 13px; border-radius: 6px; margin: 14px 0; break-inside: avoid; background: #f6f8fa; border-left: 3px solid ${theme.rule}; }
.pw-note-accent { border-left-color: ${theme.accent}; background: ${theme.accent}0f; }
.pw-note-warn { border-left-color: #d29922; background: #fff8e6; }
.pw-note-title { font-weight: 650; margin-bottom: 3px; }
.pw-signs { display: flex; gap: 36px; margin-top: 36px; break-inside: avoid; }
.pw-sign { flex: 1; }
.pw-sign-rule { border-top: 1px solid ${theme.ink}; margin-bottom: 5px; }
.pw-sign-label { font-size: 0.82em; color: ${theme.muted}; }
.pw-sign-name { font-weight: 600; }
.pw-pagebreak { break-after: page; page-break-after: always; height: 0; }

/* fillable field placeholders */
.pw-field-wrap { margin: 8px 0; break-inside: avoid; }
.pw-field-label { display: block; font-size: 0.78em; color: ${theme.muted}; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.06em; }
.pw-field { border: 1px solid ${theme.rule}; border-radius: 4px; background: #fcfdfe; width: 100%; }
`;
}

/** Header/footer templates handed to Chromium's displayHeaderFooter. */
export function chromeCss(theme: Theme): string {
  return `font-family:${theme.font};font-size:8pt;color:${theme.muted};width:100%;padding:0 16mm;display:flex;justify-content:space-between;align-items:center;`;
}

export function compileTemplate(tpl: Template): string {
  const body = tpl.blocks
    .map((block) => {
      const html = blockHtml(block);
      return block.when ? `{{#if ${block.when}}}${html}{{/if}}` : html;
    })
    .join("\n");
  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>${baseCss(tpl.theme, tpl.page)}
${tpl.css ?? ""}</style>
</head>
<body><div class="pw-doc">
${body}
</div></body></html>`;
}
