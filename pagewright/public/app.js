/* Pagewright editor — vanilla ES modules, no build step. */

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, kids = []) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const kid of [].concat(kids)) if (kid) node.append(kid);
  return node;
};

const state = {
  templates: [],
  keys: [],
  jobs: [],
  current: null,
  dirty: false,
  open: new Set(),
  previewUrl: null,
};

// ---------------------------------------------------------------- block schema

const ALIGN = ["left", "center", "right"];

const SCHEMA = {
  heading: {
    label: "Heading",
    summary: (b) => b.text,
    fields: [
      { key: "text", type: "text", label: "Text" },
      { key: "level", type: "select", label: "Level", options: [1, 2, 3], cast: Number },
      { key: "align", type: "select", label: "Align", options: ALIGN },
    ],
  },
  text: {
    label: "Text",
    summary: (b) => b.text,
    fields: [
      { key: "text", type: "textarea", label: "Text (inline HTML allowed)" },
      { key: "align", type: "select", label: "Align", options: ALIGN },
      { key: "muted", type: "checkbox", label: "Muted" },
    ],
  },
  brandbar: {
    label: "Brand bar",
    summary: (b) => b.title,
    fields: [
      { key: "title", type: "text", label: "Title" },
      { key: "subtitle", type: "text", label: "Subtitle" },
      { key: "logo", type: "text", label: "Logo URL or data URI" },
      { key: "meta", type: "objects", label: "Meta rows", shape: [
        { key: "label", placeholder: "Label" },
        { key: "value", placeholder: "{{value}}" },
      ] },
    ],
  },
  parties: {
    label: "Parties",
    summary: (b) => `${b.left?.title ?? ""} / ${b.right?.title ?? ""}`,
    fields: [
      { key: "left.title", type: "text", label: "Left title" },
      { key: "left.lines", type: "strings", label: "Left lines" },
      { key: "right.title", type: "text", label: "Right title" },
      { key: "right.lines", type: "strings", label: "Right lines" },
    ],
  },
  keyvalue: {
    label: "Key / value",
    summary: (b) => b.title || `${b.rows?.length ?? 0} rows`,
    fields: [
      { key: "title", type: "text", label: "Title" },
      { key: "columns", type: "select", label: "Columns", options: [1, 2, 3], cast: Number },
      { key: "rows", type: "objects", label: "Rows", shape: [
        { key: "label", placeholder: "Label" },
        { key: "value", placeholder: "{{value}}" },
      ] },
    ],
  },
  table: {
    label: "Table",
    summary: (b) => `${b.source} · ${b.columns?.length ?? 0} cols`,
    fields: [
      { key: "source", type: "text", label: "Array path (e.g. items)" },
      { key: "zebra", type: "checkbox", label: "Zebra striping" },
      { key: "emptyText", type: "text", label: "Empty state text" },
      { key: "columns", type: "objects", label: "Columns", shape: [
        { key: "header", placeholder: "Header" },
        { key: "path", placeholder: "field" },
        { key: "align", type: "select", options: ALIGN },
        { key: "format", type: "select", options: ["text", "money", "number", "date"] },
        { key: "width", placeholder: "10%", size: "sm" },
      ] },
    ],
  },
  totals: {
    label: "Totals",
    summary: (b) => `${b.rows?.length ?? 0} rows`,
    fields: [
      { key: "align", type: "select", label: "Align", options: ["right", "left"] },
      { key: "rows", type: "objects", label: "Rows", shape: [
        { key: "label", placeholder: "Label" },
        { key: "value", placeholder: "{{money total currency}}" },
        { key: "strong", type: "checkbox" },
      ] },
    ],
  },
  image: {
    label: "Image",
    summary: (b) => b.src,
    fields: [
      { key: "src", type: "text", label: "Source URL / data URI" },
      { key: "width", type: "text", label: "Width (css)" },
      { key: "align", type: "select", label: "Align", options: ALIGN },
      { key: "alt", type: "text", label: "Alt text" },
    ],
  },
  note: {
    label: "Note",
    summary: (b) => b.title || b.body,
    fields: [
      { key: "title", type: "text", label: "Title" },
      { key: "body", type: "textarea", label: "Body" },
      { key: "tone", type: "select", label: "Tone", options: ["neutral", "accent", "warn"] },
    ],
  },
  signature: {
    label: "Signature",
    summary: (b) => `${b.entries?.length ?? 0} lines`,
    fields: [
      { key: "entries", type: "objects", label: "Lines", shape: [
        { key: "label", placeholder: "Label" },
        { key: "name", placeholder: "{{name}}" },
      ] },
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
    summary: (b) => b.name,
    fields: [
      { key: "name", type: "text", label: "Field name (AcroForm)" },
      { key: "label", type: "text", label: "Label" },
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

// ---------------------------------------------------------------- path utils

const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
const setPath = (obj, path, value) => {
  const keys = path.split(".");
  let cursor = obj;
  for (const key of keys.slice(0, -1)) {
    if (typeof cursor[key] !== "object" || cursor[key] === null) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[keys.at(-1)] = value;
};

const uid = () => `b${Math.random().toString(36).slice(2, 9)}`;

function markDirty() {
  state.dirty = true;
  const node = $("#save-state");
  node.textContent = "unsaved";
  node.className = "save-state is-dirty";
  schedulePreview();
}

// ---------------------------------------------------------------- rail

function renderRail() {
  const list = $("#template-list");
  list.replaceChildren(
    ...state.templates.map((t) => {
      const li = el("li", { className: t.id === state.current?.id ? "is-active" : "" });
      li.append(el("span", { className: "tpl-item-name", textContent: t.name }));
      const del = el("button", { className: "btn btn-icon", textContent: "×", title: "Delete" });
      del.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm(`Delete "${t.name}"?`)) return;
        await fetch(`/api/templates/${t.id}`, { method: "DELETE" });
        await bootstrap(t.id === state.current?.id ? null : state.current?.id);
      };
      li.append(del);
      li.onclick = () => selectTemplate(t.id);
      return li;
    }),
  );

  $("#key-list").replaceChildren(
    ...state.keys.map((k) => {
      const li = el("li");
      li.append(el("strong", { textContent: k.name }));
      li.append(el("code", { className: "key-value", textContent: k.key }));
      li.append(el("span", { className: "key-meta", textContent: `${k.calls} calls` }));
      const del = el("button", { className: "btn btn-icon", textContent: "×" });
      del.onclick = async () => {
        await fetch(`/api/keys/${k.id}`, { method: "DELETE" });
        await bootstrap(state.current?.id);
      };
      li.append(del);
      return li;
    }),
  );

  $("#job-list").replaceChildren(
    ...state.jobs.map((j) => {
      const li = el("li");
      li.append(el("div", { textContent: j.templateName }));
      li.append(
        el("div", { className: "job-meta" }, [
          el("span", { className: `job-status ${j.status}`, textContent: j.status }),
          el("span", {
            textContent: ` · ${j.format} · ${j.pages ?? "?"}p · ${j.ms ?? "?"}ms · ${j.via}`,
          }),
        ]),
      );
      if (j.error) li.append(el("div", { className: "job-meta", textContent: j.error }));
      if (j.file) li.append(el("a", { href: `/files/${j.file}`, target: "_blank", textContent: "open", className: "job-meta" }));
      return li;
    }),
  );
}

// ---------------------------------------------------------------- block editor

function fieldControl(block, field) {
  const value = getPath(block, field.key);

  if (field.type === "checkbox") {
    const input = el("input", { type: "checkbox", checked: Boolean(value) });
    input.onchange = () => { setPath(block, field.key, input.checked); markDirty(); renderBlocks(); };
    return el("label", { className: "check" }, [input, document.createTextNode(" " + field.label)]);
  }

  if (field.type === "select") {
    const select = el("select");
    for (const opt of field.options) {
      select.append(el("option", { value: String(opt), textContent: String(opt), selected: String(value) === String(opt) }));
    }
    select.onchange = () => {
      setPath(block, field.key, field.cast ? field.cast(select.value) : select.value);
      markDirty();
      renderBlocks();
    };
    return el("label", {}, [document.createTextNode(field.label), select]);
  }

  if (field.type === "strings") {
    const wrap = el("div", { className: "sub-list" });
    const lines = Array.isArray(value) ? value : [];
    lines.forEach((line, i) => {
      const input = el("input", { value: line });
      input.oninput = () => { lines[i] = input.value; markDirty(); };
      const del = el("button", { className: "btn btn-icon", textContent: "×" });
      del.onclick = () => { lines.splice(i, 1); markDirty(); renderBlocks(); };
      wrap.append(el("div", { className: "sub-row" }, [input, del]));
    });
    const add = el("button", { className: "btn", textContent: "+ line" });
    add.onclick = () => {
      setPath(block, field.key, [...lines, ""]);
      markDirty();
      renderBlocks();
    };
    wrap.append(add);
    return el("label", {}, [document.createTextNode(field.label), wrap]);
  }

  if (field.type === "objects") {
    const wrap = el("div", { className: "sub-list" });
    const rows = Array.isArray(value) ? value : [];
    rows.forEach((row, i) => {
      const line = el("div", { className: "sub-row" });
      for (const part of field.shape) {
        if (part.type === "select") {
          const select = el("select");
          for (const opt of part.options) {
            select.append(el("option", { value: opt, textContent: opt, selected: row[part.key] === opt }));
          }
          select.onchange = () => { row[part.key] = select.value; markDirty(); };
          line.append(select);
        } else if (part.type === "checkbox") {
          const input = el("input", { type: "checkbox", checked: Boolean(row[part.key]) });
          input.title = part.key;
          input.onchange = () => { row[part.key] = input.checked; markDirty(); };
          line.append(input);
        } else {
          const input = el("input", { value: row[part.key] ?? "", placeholder: part.placeholder ?? part.key });
          if (part.size === "sm") input.style.maxWidth = "70px";
          input.oninput = () => { row[part.key] = input.value; markDirty(); };
          line.append(input);
        }
      }
      const del = el("button", { className: "btn btn-icon", textContent: "×" });
      del.onclick = () => { rows.splice(i, 1); markDirty(); renderBlocks(); };
      line.append(del);
      wrap.append(line);
    });
    const add = el("button", { className: "btn", textContent: "+ row" });
    add.onclick = () => {
      const blank = Object.fromEntries(field.shape.map((p) => [p.key, p.type === "checkbox" ? false : ""]));
      setPath(block, field.key, [...rows, blank]);
      markDirty();
      renderBlocks();
    };
    wrap.append(add);
    return el("label", {}, [document.createTextNode(field.label), wrap]);
  }

  const input =
    field.type === "textarea"
      ? el("textarea", { value: value ?? "", spellcheck: false })
      : el("input", { value: value ?? "", type: field.type === "number" ? "number" : "text" });
  input.oninput = () => {
    const raw = field.type === "number" ? (input.value === "" ? undefined : Number(input.value)) : input.value;
    setPath(block, field.key, raw);
    markDirty();
  };
  return el("label", {}, [document.createTextNode(field.label), input]);
}

function renderBlocks() {
  const host = $("#block-list");
  const blocks = state.current?.blocks ?? [];
  host.replaceChildren(
    ...blocks.map((block, index) => {
      const schema = SCHEMA[block.type] ?? { label: block.type, summary: () => "", fields: [] };
      const card = el("div", { className: "block", draggable: false });
      card.dataset.index = String(index);

      const grip = el("span", { className: "block-grip", textContent: "⠿", draggable: true });
      grip.ondragstart = (e) => {
        e.dataTransfer.setData("text/plain", String(index));
        card.classList.add("is-drag");
      };
      grip.ondragend = () => card.classList.remove("is-drag");

      const head = el("div", { className: "block-head" }, [
        grip,
        el("span", { className: "block-type", textContent: schema.label }),
        el("span", { className: "block-summary", textContent: String(schema.summary(block) ?? "") }),
      ]);

      const dup = el("button", { className: "btn btn-icon", textContent: "⧉", title: "Duplicate" });
      dup.onclick = (e) => {
        e.stopPropagation();
        blocks.splice(index + 1, 0, { ...structuredClone(block), id: uid() });
        markDirty();
        renderBlocks();
      };
      const del = el("button", { className: "btn btn-icon", textContent: "×", title: "Remove" });
      del.onclick = (e) => {
        e.stopPropagation();
        blocks.splice(index, 1);
        markDirty();
        renderBlocks();
      };
      head.append(dup, del);
      head.onclick = () => {
        if (state.open.has(block.id)) state.open.delete(block.id);
        else state.open.add(block.id);
        renderBlocks();
      };
      card.append(head);

      if (state.open.has(block.id)) {
        // Every block type also gets the shared visibility condition.
        const controls = [
          ...schema.fields.map((f) => fieldControl(block, f)),
          fieldControl(block, { key: "when", type: "text", label: "Show only when (data path)" }),
        ];
        card.append(el("div", { className: "block-body" }, controls));
      }

      card.ondragover = (e) => { e.preventDefault(); card.classList.add("is-over"); };
      card.ondragleave = () => card.classList.remove("is-over");
      card.ondrop = (e) => {
        e.preventDefault();
        card.classList.remove("is-over");
        const from = Number(e.dataTransfer.getData("text/plain"));
        if (Number.isNaN(from) || from === index) return;
        const [moved] = blocks.splice(from, 1);
        blocks.splice(index, 0, moved);
        markDirty();
        renderBlocks();
      };

      return card;
    }),
  );
}

// ---------------------------------------------------------------- panes

function renderPage() {
  const page = state.current.page;
  $("#page-format").value = page.format;
  $("#page-orientation").value = page.orientation;
  $("#margin-top").value = page.margin.top;
  $("#margin-right").value = page.margin.right;
  $("#margin-bottom").value = page.margin.bottom;
  $("#margin-left").value = page.margin.left;
  $("#header-enabled").checked = Boolean(page.header?.enabled);
  $("#header-html").value = page.header?.html ?? "";
  $("#footer-enabled").checked = Boolean(page.footer?.enabled);
  $("#footer-html").value = page.footer?.html ?? "";
}

function renderTheme() {
  const theme = state.current.theme;
  $("#theme-accent").value = theme.accent;
  $("#theme-ink").value = theme.ink;
  $("#theme-muted").value = theme.muted;
  $("#theme-rule").value = theme.rule;
  $("#theme-size").value = theme.fontSize;
  $("#theme-font").value = theme.font;
  $("#theme-css").value = state.current.css ?? "";
}

function renderApiPane() {
  const key = state.keys[0]?.key ?? "YOUR_API_KEY";
  const sample = JSON.stringify(state.current.sampleData ?? {}, null, 2)
    .split("\n")
    .map((line, i) => (i === 0 ? line : "    " + line))
    .join("\n");
  $("#api-snippet").textContent = `curl -X POST ${location.origin}/v1/create \\
  -H "X-API-KEY: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "template_id": "${state.current.id}",
    "export_type": "json",
    "output_file": "${state.current.name.toLowerCase().replace(/\s+/g, "-")}.pdf",
    "data": ${sample}
  }'`;

  fetch(`/api/templates/${state.current.id}/inspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template: state.current }),
  })
    .then((r) => r.json())
    .then((info) => {
      $("#path-list").replaceChildren(...(info.paths ?? []).map((p) => el("li", { textContent: p })));
    })
    .catch(() => {});
}

// ---------------------------------------------------------------- preview

let previewTimer = null;
const schedulePreview = () => {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(runPreview, 550);
};

async function runPreview() {
  if (!state.current) return;
  const spinner = $("#preview-spinner");
  spinner.hidden = false;
  $("#preview-error").hidden = true;

  let data;
  try {
    data = JSON.parse($("#data-json").value || "{}");
  } catch (err) {
    spinner.hidden = true;
    showPreviewError(`Sample data is not valid JSON:\n${err.message}`);
    return;
  }

  const format = $("#preview-format").value;
  try {
    const resp = await fetch(`/api/templates/${state.current.id}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: state.current, data, format }),
    });
    if (!resp.ok) throw new Error((await resp.json()).message ?? resp.statusText);

    const blob = await resp.blob();
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = URL.createObjectURL(blob);

    const frame = $("#preview-frame");
    const image = $("#preview-image");
    if (format === "pdf") {
      image.hidden = true;
      frame.hidden = false;
      frame.src = state.previewUrl;
    } else {
      frame.hidden = true;
      image.hidden = false;
      image.src = state.previewUrl;
    }

    $("#preview-meta").textContent =
      `${resp.headers.get("X-Pagewright-Pages") ?? "?"} page(s) · ${resp.headers.get("X-Pagewright-Ms") ?? "?"}ms · ${(blob.size / 1024).toFixed(1)} KB`;
  } catch (err) {
    showPreviewError(String(err.message ?? err));
  } finally {
    spinner.hidden = true;
  }
}

function showPreviewError(message) {
  const node = $("#preview-error");
  node.textContent = message;
  node.hidden = false;
}

// ---------------------------------------------------------------- load / save

async function bootstrap(selectId) {
  const data = await (await fetch("/api/bootstrap")).json();
  state.templates = data.templates;
  state.keys = data.keys;
  state.jobs = data.jobs;
  renderRail();
  const next = selectId ?? state.current?.id ?? state.templates[0]?.id;
  if (next) await selectTemplate(next, true);
  else state.current = null;
}

async function selectTemplate(id, force = false) {
  if (!force && state.dirty && !confirm("Discard unsaved changes?")) return;
  const tpl = state.templates.find((t) => t.id === id);
  if (!tpl) return;
  state.current = structuredClone(tpl);
  state.dirty = false;
  state.open = new Set();
  $("#save-state").textContent = "";
  $("#tpl-name").value = state.current.name;
  $("#data-json").value = JSON.stringify(state.current.sampleData ?? {}, null, 2);
  renderRail();
  renderBlocks();
  renderPage();
  renderTheme();
  renderApiPane();
  runPreview();
}

async function save() {
  if (!state.current) return;
  try {
    state.current.sampleData = JSON.parse($("#data-json").value || "{}");
    $("#data-error").textContent = "";
  } catch (err) {
    $("#data-error").textContent = `Sample data not saved — ${err.message}`;
    return;
  }
  const resp = await fetch(`/api/templates/${state.current.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state.current),
  });
  if (!resp.ok) {
    $("#save-state").textContent = "save failed";
    return;
  }
  state.dirty = false;
  const node = $("#save-state");
  node.textContent = "saved";
  node.className = "save-state is-saved";
  await bootstrap(state.current.id);
}

// ---------------------------------------------------------------- wiring

function bindTabs(selector, attr, prefix) {
  document.querySelectorAll(selector).forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll(selector).forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      const target = tab.dataset[attr];
      document.querySelectorAll(`[id^="${prefix}"]`).forEach((panel) => {
        panel.hidden = panel.id !== `${prefix}${target}`;
      });
      if (target === "api") renderApiPane();
    };
  });
}

function bindField(id, apply) {
  const node = $(id);
  const handler = () => {
    if (!state.current) return;
    apply(node.type === "checkbox" ? node.checked : node.value);
    markDirty();
  };
  node.addEventListener("input", handler);
  node.addEventListener("change", handler);
}

function init() {
  bindTabs(".rail-tab", "rail", "rail-");
  bindTabs(".editor-tab", "pane", "pane-");

  const typeSelect = $("#add-block-type");
  for (const [type, schema] of Object.entries(SCHEMA)) {
    typeSelect.append(el("option", { value: type, textContent: schema.label }));
  }

  $("#btn-add-block").onclick = () => {
    const type = typeSelect.value;
    const defaults = {
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
    }[type] ?? {};
    state.current.blocks.push({ id: uid(), type, ...defaults });
    markDirty();
    renderBlocks();
  };

  $("#btn-new").onclick = async () => {
    const name = prompt("Template name", "Untitled template");
    if (name === null) return;
    const tpl = await (
      await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
    ).json();
    state.dirty = false;
    await bootstrap(tpl.id);
  };

  $("#btn-new-key").onclick = async () => {
    const name = prompt("Key name", "Production");
    if (name === null) return;
    await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await bootstrap(state.current?.id);
  };

  $("#btn-save").onclick = save;
  $("#btn-refresh").onclick = runPreview;
  $("#preview-format").onchange = runPreview;

  $("#btn-download").onclick = () => {
    if (!state.previewUrl) return;
    const a = el("a", {
      href: state.previewUrl,
      download: `${state.current.name.replace(/\s+/g, "-").toLowerCase()}.${$("#preview-format").value}`,
    });
    document.body.append(a);
    a.click();
    a.remove();
  };

  $("#tpl-name").oninput = () => {
    state.current.name = $("#tpl-name").value;
    markDirty();
  };

  $("#data-json").oninput = () => {
    try {
      JSON.parse($("#data-json").value || "{}");
      $("#data-error").textContent = "";
      markDirty();
    } catch (err) {
      $("#data-error").textContent = err.message;
    }
  };

  $("#btn-stress").onclick = () => {
    let data;
    try {
      data = JSON.parse($("#data-json").value || "{}");
    } catch {
      return;
    }
    const arrayKey = Object.keys(data).find((k) => Array.isArray(data[k]) && data[k].length);
    if (!arrayKey) {
      $("#data-error").textContent = "No array field found to expand.";
      return;
    }
    const seed = data[arrayKey];
    data[arrayKey] = Array.from({ length: 200 }, (_, i) => ({
      ...structuredClone(seed[i % seed.length]),
      description: `${seed[i % seed.length].description ?? seed[i % seed.length].name ?? "Row"} ${i + 1}`,
    }));
    $("#data-json").value = JSON.stringify(data, null, 2);
    markDirty();
  };

  bindField("#page-format", (v) => (state.current.page.format = v));
  bindField("#page-orientation", (v) => (state.current.page.orientation = v));
  bindField("#margin-top", (v) => (state.current.page.margin.top = v));
  bindField("#margin-right", (v) => (state.current.page.margin.right = v));
  bindField("#margin-bottom", (v) => (state.current.page.margin.bottom = v));
  bindField("#margin-left", (v) => (state.current.page.margin.left = v));
  bindField("#header-enabled", (v) => {
    state.current.page.header = { ...(state.current.page.header ?? { html: "" }), enabled: v };
  });
  bindField("#header-html", (v) => {
    state.current.page.header = { ...(state.current.page.header ?? { enabled: false }), html: v };
  });
  bindField("#footer-enabled", (v) => {
    state.current.page.footer = { ...(state.current.page.footer ?? { html: "" }), enabled: v };
  });
  bindField("#footer-html", (v) => {
    state.current.page.footer = { ...(state.current.page.footer ?? { enabled: false }), html: v };
  });
  bindField("#theme-accent", (v) => (state.current.theme.accent = v));
  bindField("#theme-ink", (v) => (state.current.theme.ink = v));
  bindField("#theme-muted", (v) => (state.current.theme.muted = v));
  bindField("#theme-rule", (v) => (state.current.theme.rule = v));
  bindField("#theme-size", (v) => (state.current.theme.fontSize = v));
  bindField("#theme-font", (v) => (state.current.theme.font = v));
  bindField("#theme-css", (v) => (state.current.css = v));

  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      save();
    }
  });

  bootstrap();
}

init();
