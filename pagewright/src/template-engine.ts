/**
 * Mustache-flavoured template engine.
 *
 * Supports the subset a document product actually needs:
 *   {{ path.to.value }}        escaped interpolation
 *   {{{ path.to.value }}}      raw interpolation
 *   {{#each items}} … {{/each}}   with {{this}}, {{@index}}, {{@number}}, {{@first}}, {{@last}}
 *   {{#if path}} … {{else}} … {{/if}}
 *   {{#unless path}} … {{/unless}}
 *   {{helper arg "literal" arg}}
 *
 * Written by hand rather than pulled from npm because the merge semantics are the
 * product — the pagination engine in render.ts is useless if `items` can't repeat.
 */

export type Scope = Record<string, unknown>;

type Frame = { data: unknown; locals: Scope; parent: Frame | null };

// ---------------------------------------------------------------- helpers

export type Helper = (...args: unknown[]) => unknown;

const num = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const cleaned = Number(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(cleaned) ? cleaned : 0;
  }
  return 0;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const HELPERS: Record<string, Helper> = {
  money(value, currency) {
    const code = typeof currency === "string" && currency ? currency : "USD";
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        minimumFractionDigits: 2,
      }).format(num(value));
    } catch {
      return `${code} ${num(value).toFixed(2)}`;
    }
  },

  number(value, places) {
    const digits = places === undefined ? 2 : num(places);
    return num(value).toFixed(digits);
  },

  /** {{sum items "total"}} — the helper every invoice template needs. */
  sum(list, field) {
    if (!Array.isArray(list)) return 0;
    if (typeof field !== "string") return list.reduce((acc: number, v) => acc + num(v), 0);
    return list.reduce((acc: number, row) => acc + num((row as Scope)?.[field]), 0);
  },

  multiply(a, b) {
    return num(a) * num(b);
  },

  /** {{date d "long"|"short"|"iso"}} — accepts ISO strings or epoch millis. */
  date(value, format) {
    if (value === undefined || value === null || value === "") return "";
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return String(value);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    switch (format) {
      case "iso":
        return `${yyyy}-${mm}-${dd}`;
      case "short":
        return `${mm}/${dd}/${yyyy}`;
      default:
        return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${yyyy}`;
    }
  },

  upper: (v) => String(v ?? "").toUpperCase(),
  lower: (v) => String(v ?? "").toLowerCase(),
  default: (v, fallback) => (v === undefined || v === null || v === "" ? fallback : v),
  eq: (a, b) => a === b,
  gt: (a, b) => num(a) > num(b),
  length: (v) => (Array.isArray(v) ? v.length : String(v ?? "").length),
};

// ---------------------------------------------------------------- lexer

type Node =
  | { kind: "text"; value: string }
  | { kind: "interp"; expr: string; raw: boolean }
  | { kind: "each"; expr: string; body: Node[] }
  | { kind: "if"; expr: string; body: Node[]; alt: Node[]; negate: boolean };

const TAG = /\{\{\{?\s*([^}]+?)\s*\}?\}\}/g;

function parse(source: string): Node[] {
  const stack: { nodes: Node[]; open?: Node; branch: "body" | "alt" }[] = [
    { nodes: [], branch: "body" },
  ];
  const push = (node: Node) => {
    const top = stack[stack.length - 1];
    if (top.open && top.branch === "alt" && top.open.kind === "if") top.open.alt.push(node);
    else top.nodes.push(node);
  };

  let last = 0;
  let m: RegExpExecArray | null;
  TAG.lastIndex = 0;

  while ((m = TAG.exec(source))) {
    if (m.index > last) push({ kind: "text", value: source.slice(last, m.index) });
    last = m.index + m[0].length;

    const raw = m[0].startsWith("{{{");
    const body = m[1].trim();

    if (body.startsWith("#each ")) {
      const node: Node = { kind: "each", expr: body.slice(6).trim(), body: [] };
      push(node);
      stack.push({ nodes: node.body, open: node, branch: "body" });
    } else if (body.startsWith("#if ") || body.startsWith("#unless ")) {
      const negate = body.startsWith("#unless ");
      const node: Node = {
        kind: "if",
        expr: body.slice(negate ? 8 : 4).trim(),
        body: [],
        alt: [],
        negate,
      };
      push(node);
      stack.push({ nodes: node.body, open: node, branch: "body" });
    } else if (body === "else") {
      const top = stack[stack.length - 1];
      if (top.open?.kind === "if") top.branch = "alt";
    } else if (body === "/each" || body === "/if" || body === "/unless") {
      if (stack.length > 1) stack.pop();
    } else if (body.startsWith("!")) {
      // comment — emit nothing
    } else {
      push({ kind: "interp", expr: body, raw });
    }
  }

  if (last < source.length) push({ kind: "text", value: source.slice(last) });
  return stack[0].nodes;
}

// ---------------------------------------------------------------- resolution

function lookup(frame: Frame, path: string): unknown {
  if (path === "this" || path === ".") return frame.data;

  // ../ walks up one loop frame per prefix
  let scope: Frame | null = frame;
  let rest = path;
  while (rest.startsWith("../")) {
    scope = scope?.parent ?? null;
    rest = rest.slice(3);
  }
  if (!scope) return undefined;

  if (rest.startsWith("@")) {
    let f: Frame | null = scope;
    while (f) {
      if (rest in f.locals) return f.locals[rest];
      f = f.parent;
    }
    return undefined;
  }

  const segments = rest.split(".").filter(Boolean);
  let f: Frame | null = scope;
  while (f) {
    let cursor: unknown = f.data;
    let ok = true;
    for (const seg of segments) {
      if (cursor && typeof cursor === "object" && seg in (cursor as Scope)) {
        cursor = (cursor as Scope)[seg];
      } else {
        ok = false;
        break;
      }
    }
    if (ok) return cursor;
    f = f.parent; // fall back to enclosing scope, like Handlebars
  }
  return undefined;
}

/**
 * Splits `helper a "b c" (nested x)` respecting quoted literals and keeping
 * parenthesised subexpressions together as one token.
 */
function tokenize(expr: string): string[] {
  const out: string[] = [];
  let buf = "";
  let quoted = false;
  let depth = 0;
  for (const ch of expr) {
    if (ch === '"') {
      quoted = !quoted;
      buf += ch;
    } else if (ch === "(" && !quoted) {
      depth += 1;
      buf += ch;
    } else if (ch === ")" && !quoted) {
      depth -= 1;
      buf += ch;
    } else if (/\s/.test(ch) && !quoted && depth === 0) {
      if (buf) out.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}

const isSubexpr = (token: string) => token.startsWith("(") && token.endsWith(")");

function resolveArg(arg: string, frame: Frame): unknown {
  if (isSubexpr(arg)) return evaluate(arg.slice(1, -1).trim(), frame);
  if (arg.startsWith('"') && arg.endsWith('"')) return arg.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(arg)) return Number(arg);
  if (arg === "true") return true;
  if (arg === "false") return false;
  return lookup(frame, arg);
}

function evaluate(expr: string, frame: Frame): unknown {
  const parts = tokenize(expr);
  const head = parts[0];
  if (head === undefined) return undefined;

  if (isSubexpr(head) && parts.length === 1) return resolveArg(head, frame);

  if (parts.length > 1 && head in HELPERS) {
    return HELPERS[head](...parts.slice(1).map((arg) => resolveArg(arg, frame)));
  }

  if (parts.length === 1 && head.startsWith('"') && head.endsWith('"')) return head.slice(1, -1);
  return lookup(frame, head);
}

const truthy = (v: unknown): boolean => {
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === "object") return Object.keys(v as Scope).length > 0;
  return Boolean(v);
};

export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emit(nodes: Node[], frame: Frame): string {
  let out = "";
  for (const node of nodes) {
    switch (node.kind) {
      case "text":
        out += node.value;
        break;

      case "interp": {
        const value = evaluate(node.expr, frame);
        if (value === undefined || value === null) break;
        out += node.raw ? String(value) : escapeHtml(value);
        break;
      }

      case "each": {
        const list = evaluate(node.expr, frame);
        if (!Array.isArray(list)) break;
        list.forEach((item, i) => {
          out += emit(node.body, {
            data: item,
            locals: {
              "@index": i,
              "@number": i + 1,
              "@first": i === 0,
              "@last": i === list.length - 1,
              "@count": list.length,
            },
            parent: frame,
          });
        });
        break;
      }

      case "if": {
        const value = truthy(evaluate(node.expr, frame));
        const take = node.negate ? !value : value;
        out += emit(take ? node.body : node.alt, frame);
        break;
      }
    }
  }
  return out;
}

const cache = new Map<string, Node[]>();

export function render(source: string, data: Scope): string {
  let ast = cache.get(source);
  if (!ast) {
    ast = parse(source);
    if (cache.size > 200) cache.clear();
    cache.set(source, ast);
  }
  return emit(ast, { data, locals: {}, parent: null });
}

/** Data paths referenced by one expression, descending through subexpressions. */
function leafPaths(expr: string): string[] {
  const parts = tokenize(expr);
  const head = parts[0];
  if (head === undefined) return [];

  const candidates = parts.length > 1 && head in HELPERS ? parts.slice(1) : parts;
  const out: string[] = [];
  for (const token of candidates) {
    if (isSubexpr(token)) {
      out.push(...leafPaths(token.slice(1, -1).trim()));
      continue;
    }
    if (!token || token.startsWith('"') || token.startsWith("@") || /^-?\d/.test(token)) continue;
    if (token === "this" || token === "." || token in HELPERS) continue;
    out.push(token);
  }
  return out;
}

/** Field paths referenced by a template — powers the editor's data-mapping panel. */
export function extractPaths(source: string): string[] {
  const found = new Set<string>();
  const walk = (nodes: Node[], prefix: string) => {
    for (const node of nodes) {
      if (node.kind === "interp") {
        for (const c of leafPaths(node.expr)) {
          found.add(prefix ? `${prefix}[].${c}` : c);
        }
      } else if (node.kind === "each") {
        found.add(prefix ? `${prefix}[].${node.expr}` : node.expr);
        walk(node.body, prefix ? `${prefix}[].${node.expr}` : node.expr);
      } else if (node.kind === "if") {
        walk(node.body, prefix);
        walk(node.alt, prefix);
      }
    }
  };
  walk(parse(source), "");
  return [...found].sort();
}
