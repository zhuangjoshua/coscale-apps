// Block template renderer — turns a block JSON doc + data into a React element.
// Block docs are the GUI-editable template kind; they render through the exact
// same pipeline as code templates (htmlShell -> Chrome).
import React from "react";

export type BlockStyle = {
  size?: number;          // font size px
  color?: string;         // theme key ("accent") or literal ("#ff0000")
  weight?: number;        // font weight
  align?: "left" | "center" | "right";
  letterSpacing?: string;
  marginBottom?: number;
  italic?: boolean;
  offsetX?: number;       // visual nudge px (transform) — does not affect flow
  offsetY?: number;
  x?: number;             // floating blocks only: position as % of canvas (sliding anchor)
  y?: number;
  w?: number;             // floating blocks only: explicit box width in px (text wraps inside);
                          // absent = size to content
};

export type Block = {
  id: string;
  type: "text" | "image" | "stars" | "badge" | "divider" | "spacer" | "list";
  bind?: string;          // field name to pull from data
  value?: any;            // static value when not bound (or fallback)
  visible?: boolean;      // default true
  fit?: boolean;          // auto-shrink text to fit
  style?: BlockStyle;
  // list-specific: two-column label/value rows
  listColumns?: { labelKey: string; valueKey: string };
};

export type BlockDoc = {
  name: string;
  kind: "block";
  canvas: { width: number; height: number };
  preset: "stacked" | "split-left" | "split-right" | "background";
  theme: { bg: string; accent: string; text: string; muted: string; font: string };
  media?: { bind?: string; value?: string };   // image slot used by split/background presets
  fields: Record<string, { type: "text" | "number" | "image" | "list"; label: string; default?: any }>;
  regions: { top: Block[]; middle: Block[]; bottom: Block[]; floating?: Block[] };
};

export function sampleOf(doc: BlockDoc): Record<string, any> {
  const s: Record<string, any> = {};
  for (const [k, f] of Object.entries(doc.fields ?? {})) s[k] = f.default ?? "";
  return s;
}

function resolveColor(c: string | undefined, theme: BlockDoc["theme"], fallback: string): string {
  if (!c) return fallback;
  return (theme as any)[c] ?? c;
}

function blockValue(b: Block, doc: BlockDoc, data: Record<string, any>) {
  if (b.bind) {
    if (data[b.bind] !== undefined && data[b.bind] !== null) return data[b.bind];
    const def = doc.fields?.[b.bind]?.default;
    if (def !== undefined) return def;
  }
  return b.value;
}

function renderBlock(b: Block, doc: BlockDoc, data: Record<string, any>): React.ReactNode {
  if (b.visible === false) return null;
  const inner = renderBlockInner(b, doc, data);
  if (!inner) return null;
  const dx = b.style?.offsetX ?? 0, dy = b.style?.offsetY ?? 0;
  if (!dx && !dy) return inner;
  // visual nudge: shifts rendering without affecting flow/spacing of siblings.
  // data-nudge lets the shell script clamp the shift so blocks never leave the canvas.
  return <div key={`${b.id}-nudge`} data-nudge={`${dx},${dy}`}
    style={{ transform: `translate(${dx}px, ${dy}px)` }}>{inner}</div>;
}

function renderBlockInner(b: Block, doc: BlockDoc, data: Record<string, any>): React.ReactNode {
  const t = doc.theme;
  const st = b.style ?? {};
  const base: React.CSSProperties = {
    fontSize: st.size ?? 24,
    color: resolveColor(st.color, t, t.text),
    fontWeight: st.weight ?? 400,
    textAlign: st.align ?? "left",
    letterSpacing: st.letterSpacing,
    marginBottom: st.marginBottom ?? 0,
    fontStyle: st.italic ? "italic" : undefined,
    fontFamily: t.font ? `'${t.font}', -apple-system, sans-serif` : undefined,
  };
  const v = blockValue(b, doc, data);
  const tag = { "data-bid": b.id, "data-btype": b.type } as any;

  switch (b.type) {
    case "text": {
      const fitProps = b.fit ? { "data-fit": "", "data-fit-min": "12" } : {};
      return (
        <div key={b.id} {...tag} {...fitProps} style={{
          ...base,
          lineHeight: 1.25,
          ...(b.fit ? { maxHeight: "100%", overflow: "hidden" } : {}),
        }}>{String(v ?? "")}</div>
      );
    }
    case "image": {
      if (!v) return null;
      return (
        <div key={b.id} {...tag} style={{ marginBottom: base.marginBottom, display: "flex",
          justifyContent: st.align === "center" ? "center" : st.align === "right" ? "flex-end" : "flex-start" }}>
          <img src={String(v)} style={{
            width: st.size ? st.size * 4 : 200, height: st.size ? st.size * 4 : 200,
            objectFit: "cover", borderRadius: 12,
          }} />
        </div>
      );
    }
    case "stars": {
      const n = Math.max(0, Math.min(5, Number(v ?? 0)));
      if (!n) return null;
      return (
        <div key={b.id} {...tag} style={{ ...base, color: resolveColor(st.color, t, "#f5b83d"),
          letterSpacing: st.letterSpacing ?? "0.1em" }}>
          {"★".repeat(n)}
        </div>
      );
    }
    case "badge": {
      if (!v) return null;
      return (
        <div key={b.id} {...tag} style={{ marginBottom: base.marginBottom, display: "flex",
          justifyContent: st.align === "center" ? "center" : st.align === "right" ? "flex-end" : "flex-start" }}>
          <div style={{
            background: resolveColor(st.color, t, t.accent), color: "#fff",
            borderRadius: 999, padding: `${Math.round((st.size ?? 18) * 0.45)}px ${Math.round((st.size ?? 18) * 1.1)}px`,
            fontSize: st.size ?? 18, fontWeight: st.weight ?? 800,
            fontFamily: base.fontFamily,
          }}>{String(v)}</div>
        </div>
      );
    }
    case "divider":
      return <div key={b.id} {...tag} style={{ borderTop: `2px solid ${resolveColor(st.color, t, t.muted)}`,
        opacity: 0.5, marginBottom: base.marginBottom, width: "100%" }} />;
    case "spacer":
      return <div key={b.id} {...tag} style={{ height: st.size ?? 24 }} />;
    case "list": {
      const items: any[] = Array.isArray(v) ? v : [];
      const cols = b.listColumns ?? { labelKey: "name", valueKey: "price" };
      return (
        <div key={b.id} {...tag} style={{ marginBottom: base.marginBottom, width: "100%" }}>
          {items.map((it, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", width: "100%",
              padding: `${Math.round((st.size ?? 22) * 0.6)}px 0`,
              borderBottom: `1px solid ${resolveColor(st.color, t, t.muted)}33`,
              fontSize: st.size ?? 22, color: base.color, fontWeight: st.weight ?? 400,
              fontFamily: base.fontFamily,
            }}>
              <span>{String(it?.[cols.labelKey] ?? "")}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{String(it?.[cols.valueKey] ?? "")}</span>
            </div>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

function regionEl(name: string, blocks: Block[], doc: BlockDoc, data: Record<string, any>, grow = false): React.ReactNode {
  return (
    <div data-region={name} style={{ display: "flex", flexDirection: "column", ...(grow ? { flex: 1, minHeight: 0 } : {}) }}>
      {blocks.map((b) => renderBlock(b, doc, data))}
    </div>
  );
}

export function renderBlockTemplate(doc: BlockDoc, data: Record<string, any>): React.ReactElement {
  const t = doc.theme;
  const pad = 56;
  const mediaUrl = doc.media
    ? (doc.media.bind
        ? data[doc.media.bind] ?? doc.fields?.[doc.media.bind]?.default ?? doc.media.value
        : doc.media.value)
    : undefined;
  const columns = (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between",
      flex: 1, minWidth: 0, minHeight: 0 }}>
      {regionEl("top", doc.regions.top ?? [], doc, data)}
      {regionEl("middle", doc.regions.middle ?? [], doc, data, true)}
      {regionEl("bottom", doc.regions.bottom ?? [], doc, data)}
    </div>
  );

  const shell: React.CSSProperties = {
    width: "100%", height: "100%", display: "flex", background: resolveColor(t.bg, t, "#111"),
    color: t.text, padding: pad, boxSizing: "border-box", position: "relative",
    fontFamily: t.font ? `'${t.font}', -apple-system, sans-serif` : undefined,
  };

  // floating blocks: absolutely positioned by % of canvas, anchored at their center
  const floating = (doc.regions.floating ?? []).map((b) => {
    if (b.visible === false) return null;
    const x = b.style?.x ?? 50, y = b.style?.y ?? 50;
    // sliding anchor: 0 => left/top edge flush, 50 => centered, 100 => right/bottom edge flush.
    // The block therefore always sits fully inside the canvas across the whole 0-100 range.
    return (
      <div key={`float-${b.id}`} data-bid={b.id} data-float="1" style={{
        position: "absolute", left: `${x}%`, top: `${y}%`,
        transform: `translate(-${x}%, -${y}%)`, zIndex: 10,
        // explicit box width when set (text wraps inside); otherwise size to
        // content — never to the space left of the anchor, which collapsed
        // right-edge text into one-word-per-line stacking
        width: b.style?.w ? b.style.w : "max-content", maxWidth: "92%",
      }}>{renderBlock(b, doc, data)}</div>
    );
  });

  switch (doc.preset) {
    case "split-left":
      return (
        <div style={{ ...shell, padding: 0 }}>
          {mediaUrl ? <div style={{ width: "42%", flexShrink: 0 }}>
            <img src={String(mediaUrl)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div> : null}
          <div style={{ display: "flex", flex: 1, padding: pad, minWidth: 0 }}>{columns}</div>
          {floating}
        </div>
      );
    case "split-right":
      return (
        <div style={{ ...shell, padding: 0 }}>
          <div style={{ display: "flex", flex: 1, padding: pad, minWidth: 0 }}>{columns}</div>
          {mediaUrl ? <div style={{ width: "42%", flexShrink: 0 }}>
            <img src={String(mediaUrl)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div> : null}
          {floating}
        </div>
      );
    case "background":
      return (
        <div style={{ ...shell, padding: 0, position: "relative" }}>
          {mediaUrl ? <img src={String(mediaUrl)} style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
          <div style={{ position: "relative", display: "flex", flex: 1, padding: pad }}>{columns}</div>
          {floating}
        </div>
      );
    case "stacked":
    default:
      return <div style={shell}>{columns}{floating}</div>;
  }
}
