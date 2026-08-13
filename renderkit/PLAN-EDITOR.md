# Plan — Block Editor (Option B)

Goal: a non-technical user can pick a template, drag its parts into a new
arrangement, restyle it, and publish it — never seeing code. Output stays
adaptive (reflows with real data) and renders through the existing engine.

---

## 1. Core architecture decision

**Block templates are JSON documents rendered by one generic renderer — NOT
generated .tsx files.**

Two template kinds coexist:

| Kind | Stored as | Authored by | Editable in GUI |
|---|---|---|---|
| Code template (existing) | `templates/x.tsx` | developer / AI | no (property panel only) |
| Block template (new) | `templates/x.json` | GUI / gallery / AI | yes, fully |

Why JSON-not-codegen: editing JSON is lossless and trivial; parsing hand-edited
TSX back into a block tree is fragile and would break the moment a user's code
diverges. One-way "eject to code" (JSON → .tsx export) gives power users an
escape hatch without needing round-trip fidelity.

Both kinds render through the *same* pipeline: React element → `htmlShell()` →
Chrome → PNG/PDF/frame. Every existing endpoint (gif, movie, overlay,
collections, sets, signed URLs) works with block templates for free, because
they all call `renderAsset`/`renderFrame`, which only needs a React element.

## 2. Data model

```jsonc
{
  "name": "quote-card",
  "kind": "block",
  "canvas":  { "width": 1200, "height": 630 },
  "preset":  "stacked",              // stacked | split-left | split-right | background
  "theme":   { "bg": "#101418", "accent": "#4da3ff", "text": "#eef2f7",
               "muted": "#8b93a5", "font": "Inter" },
  "fields":  {                        // the data schema = API contract
    "quote":  { "type": "text",   "label": "Quote",  "default": "…" },
    "author": { "type": "text",   "label": "Author", "default": "Sam Ortiz" },
    "stars":  { "type": "number", "label": "Stars",  "default": 5 }
  },
  "regions": {
    "top":    [ { "id":"b1", "type":"text", "value":"“", "style":{"size":120,"color":"accent"} } ],
    "middle": [ { "id":"b2", "type":"text", "bind":"quote", "fit":true,
                  "style":{"size":44,"weight":600} } ],
    "bottom": [ { "id":"b3", "type":"stars",  "bind":"stars" },
                { "id":"b4", "type":"text",   "bind":"author", "style":{"size":24,"weight":700} },
                { "id":"b5", "type":"text",   "bind":"role",   "style":{"size":19,"color":"muted"} } ]
  }
}
```

**Block types (v1):** `text`, `image`, `stars`, `badge`, `divider`, `spacer`,
`list` (repeating rows — this is what makes receipts/invoices work).

**Block common props:** `id`, `type`, `bind` (field name), `value` (static
fallback), `visible`, `fit` (auto-shrink), `style` { size, color, weight, align,
letterSpacing, marginBottom }.

Colors reference theme keys (`"accent"`) or literals (`"#ff0000"`) so a theme
change restyles everything at once.

## 3. Rendering path

New file `blocks.tsx`:
- `renderBlockTemplate(doc, data) → React element`
- Preset determines the flex container structure; regions map to flex children
- Each block type maps to a small JSX fragment
- `list` blocks map over `data[bind]` and render a sub-block per item

Hook into `loadTemplate()`: if `x.json` exists, return a module-shaped object
`{ default: (data) => renderBlockTemplate(doc, data), sample, controls }`.
Everything downstream is unchanged.

## 4. Editor UI

Server-rendered page at `/edit/:name`, plain HTML+JS (no build step, matching
the existing dashboard).

```
┌ Layout ────────┬ Preview ─────────────┬ Properties ──────┐
│ preset  [▾]    │                      │  (selected block) │
│                │   ┌──────────────┐   │  Text  [______]   │
│ TOP            │   │              │   │  Bind  [quote ▾]  │
│  ⣿ Quote mark  │   │  live iframe │   │  Size  ──●──  44  │
│ MIDDLE         │   │              │   │  Color [■ accent] │
│  ⣿ Quote text  │   │              │   │  Align [L][C][R]  │
│ BOTTOM         │   └──────────────┘   │  Weight[▾]        │
│  ⣿ Stars    ↕  │                      │  ☑ visible        │
│  ⣿ Author      │   [Theme] [Fields]   │  [Delete]         │
│  ⣿ Role        │                      │                   │
│ + Add block    │                      │                   │
└────────────────┴──────────────────────┴───────────────────┘
```

- **Preview:** `POST /blockpreview` returns the HTML string; editor sets it as
  `iframe.srcdoc`. Same HTML the server screenshots ⇒ WYSIWYG by construction.
  Debounced ~150ms on edits.
- **Drag:** HTML5 drag-and-drop on the layout tree; reorder within a region and
  move between regions. Reordering = array splice on the JSON.
- **State:** the whole doc lives in one JS object; every edit mutates it and
  re-previews. Save = `PUT /api/templates/:name` with the JSON.

## 5. Phases

| # | Deliverable | Verify by | Est. |
|---|---|---|---|
| 1 | Block model + `blocks.tsx` renderer + JSON templates load & render via existing `/render` | Port quote-card to JSON; output matches the .tsx version | 2 days |
| 2 | `/blockpreview` endpoint + editor shell: load doc, show layout tree, live iframe preview, select block | Click a block, see it highlighted; preview matches render | 2 days |
| 3 | Properties panel: edit text/bind/size/color/align/weight/visible; theme panel; fields panel | Change accent color, whole card restyles | 2 days |
| 4 | Drag reorder within + between regions; add/delete blocks from palette | Drag Stars above Author, render, confirm | 2–3 days |
| 5 | Presets (stacked / split-left / split-right / background) | Switch preset, layout reflows correctly | 2 days |
| 6 | Save/publish, duplicate-as-new, eject-to-tsx export; port 3 gallery templates to blocks | Non-dev creates a template start to finish | 2 days |

**Total ≈ 12–13 working days.** Phases 1–3 alone (≈6 days) already give the
Level-1 no-code editor; drag arrives in phase 4.

## 6. Risks / decisions to make

- **`list` blocks are the hard part.** Receipts need "one row per item" with
  per-column styling. v1: a `list` block binds to an array field and has a fixed
  two-column (label/value) sub-layout. Richer row templates = later.
- **Preview performance.** Server round-trip per keystroke; mitigate with
  debounce. If it feels slow, move preview rendering client-side (the HTML is
  pure string generation — could run in the browser).
- **Fonts in preview iframe** must load the same way as the render shell, or
  WYSIWYG breaks. Reuse `fontFaces()` in the preview HTML.
- **Existing .tsx templates aren't GUI-editable.** They get the property panel
  only (via an optional `controls` export). Accepted.
- **Not doing:** free pixel positioning, overlap, rotation, multi-page,
  arbitrary nesting depth (regions are one level deep in v1).

## 7. Out of scope for this build

Accounts/API keys/billing/deploy (separate platform work), AI template
generation (natural follow-on once the block schema exists — an LLM emitting
this JSON is easier and safer than emitting TSX), gallery content/design.
