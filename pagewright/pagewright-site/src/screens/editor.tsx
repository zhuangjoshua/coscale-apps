/**
 * The signed-in editor: template list, block/data/page/theme panes, and a live preview
 * rendered by the document service through the same pipeline the public API uses.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { API_BASE, pagewright, type ApiKey, type Job, type Template } from "../lib/pagewright";
import { BlockEditor } from "./editor/block-editor";

type PreviewFormat = "pdf" | "png";

const labelClass = "grid gap-1 text-xs text-muted-foreground";
/** Same treatment as the landing page's .card-surface, so app and site read as one product. */
const surfaceClass =
  "rounded-xl border border-border/70 bg-card p-4 shadow-[0_14px_34px_rgba(27,39,51,0.08)]";
const selectClass =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground";

function useDebounced(fn: () => void, delay: number) {
  const timer = useRef<number | null>(null);
  return useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, delay);
  }, [fn, delay]);
}

export function EditorScreen() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [current, setCurrent] = useState<Template | null>(null);
  const [dataText, setDataText] = useState("{}");
  const [dataError, setDataError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [format, setFormat] = useState<PreviewFormat>("pdf");
  const [preview, setPreview] = useState<{ url: string; meta: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [paths, setPaths] = useState<string[]>([]);
  const [, forceRender] = useState(0);

  const previewUrl = useRef<string | null>(null);
  const bump = () => forceRender((n) => n + 1);

  // ------------------------------------------------------------ loading

  const load = useCallback(async (selectId?: string) => {
    try {
      const data = await pagewright.bootstrap();
      setTemplates(data.templates);
      setKeys(data.keys);
      setJobs(data.jobs);
      setLoadError(null);
      const next =
        data.templates.find((t) => t.id === selectId) ?? data.templates[0] ?? null;
      if (next) {
        setCurrent(structuredClone(next));
        setDataText(JSON.stringify(next.sampleData ?? {}, null, 2));
        setDirty(false);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ------------------------------------------------------------ preview

  const runPreview = useCallback(async () => {
    if (!current) return;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(dataText || "{}");
    } catch (err) {
      setPreviewError(`Sample data is not valid JSON: ${(err as Error).message}`);
      return;
    }

    setRendering(true);
    try {
      const result = await pagewright.preview(current.id, current, data, format);
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = URL.createObjectURL(result.blob);
      setPreview({
        url: previewUrl.current,
        meta: `${result.pages} page(s) · ${result.ms}ms · ${(result.blob.size / 1024).toFixed(1)} KB`,
      });
      setPreviewError(null);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setRendering(false);
    }
  }, [current, dataText, format]);

  const schedulePreview = useDebounced(() => void runPreview(), 550);

  useEffect(() => {
    if (current) void runPreview();
    // Re-render when the selected template or output format changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, format]);

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  const touch = useCallback(() => {
    setDirty(true);
    bump();
    schedulePreview();
  }, [schedulePreview]);

  // ------------------------------------------------------------ actions

  const save = async () => {
    if (!current) return;
    let sampleData: Record<string, unknown>;
    try {
      sampleData = JSON.parse(dataText || "{}");
      setDataError("");
    } catch (err) {
      setDataError(`Not saved — ${(err as Error).message}`);
      return;
    }
    const saved = await pagewright.saveTemplate({ ...current, sampleData });
    setDirty(false);
    setTemplates((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
  };

  const selectTemplate = (id: string) => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setCurrent(structuredClone(tpl));
    setDataText(JSON.stringify(tpl.sampleData ?? {}, null, 2));
    setDirty(false);
  };

  const stressTest = () => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(dataText || "{}");
    } catch {
      return;
    }
    const key = Object.keys(data).find(
      (k) => Array.isArray(data[k]) && (data[k] as unknown[]).length,
    );
    if (!key) {
      setDataError("No array field found to expand.");
      return;
    }
    const seed = data[key] as Record<string, unknown>[];
    data[key] = Array.from({ length: 200 }, (_, i) => ({
      ...structuredClone(seed[i % seed.length]),
      description: `Row ${i + 1}`,
    }));
    setDataText(JSON.stringify(data, null, 2));
    setDirty(true);
    schedulePreview();
  };

  const snippet = useMemo(() => {
    if (!current) return "";
    const key = keys[0]?.key ?? "YOUR_API_KEY";
    return `curl -X POST ${API_BASE}/v1/create \\
  -H "X-API-KEY: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "template_id": "${current.id}",
    "export_type": "json",
    "data": ${JSON.stringify(current.sampleData ?? {}, null, 2).split("\n").join("\n    ")}
  }'`;
  }, [current, keys]);

  // ------------------------------------------------------------ render

  if (loading) {
    return (
      <div className="grid gap-4" aria-busy="true">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
        <h2 className="text-lg font-semibold">Can't reach the document service</h2>
        <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Expected at <code className="font-mono">{API_BASE}</code>. Start it with{" "}
          <code className="font-mono">npm start</code> in the <code className="font-mono">pagewright/</code> folder.
        </p>
        <Button className="mt-4" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">No templates yet.</p>
        <Button
          className="justify-self-start"
          onClick={async () => {
            const tpl = await pagewright.createTemplate("Untitled template");
            await load(tpl.id);
          }}
        >
          Create your first template
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <Input
          className="h-10 max-w-xs border-transparent bg-transparent px-2 font-heading text-lg font-medium tracking-tight text-foreground hover:border-border focus:border-border"
          value={current.name}
          onChange={(e) => {
            current.name = e.target.value;
            touch();
          }}
        />
        <span className="text-xs text-muted-foreground">
          {dirty ? "unsaved changes" : "saved"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <select
            className={`${selectClass} w-24`}
            value={format}
            onChange={(e) => setFormat(e.target.value as PreviewFormat)}
            aria-label="Preview format"
          >
            <option value="pdf">PDF</option>
            <option value="png">PNG</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => void runPreview()}>
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!preview}
            onClick={() => {
              if (!preview) return;
              const a = document.createElement("a");
              a.href = preview.url;
              a.download = `${current.name.replace(/\s+/g, "-").toLowerCase()}.${format}`;
              document.body.append(a);
              a.click();
              a.remove();
            }}
          >
            Download
          </Button>
          <Button size="sm" onClick={() => void save()}>
            Save
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[248px_minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* rail */}
        <aside className={`grid min-w-0 content-start gap-3 ${surfaceClass}`}>
          <Tabs defaultValue="templates">
            <TabsList className="max-w-full overflow-x-auto">
              <TabsTrigger value="templates">Docs</TabsTrigger>
              <TabsTrigger value="keys">Keys</TabsTrigger>
              <TabsTrigger value="jobs">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="templates">
              <div className="grid gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const name = window.prompt("Template name", "Untitled template");
                    if (name === null) return;
                    const tpl = await pagewright.createTemplate(name);
                    await load(tpl.id);
                  }}
                >
                  + New
                </Button>
                {templates.map((tpl) => (
                  <div key={tpl.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => selectTemplate(tpl.id)}
                      className={`flex-1 truncate rounded px-2 py-1.5 text-left text-sm ${
                        tpl.id === current.id
                          ? "bg-accent font-medium text-accent-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      {tpl.name}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${tpl.name}`}
                      onClick={async () => {
                        if (!window.confirm(`Delete "${tpl.name}"?`)) return;
                        await pagewright.deleteTemplate(tpl.id);
                        await load();
                      }}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="keys">
              <div className="grid gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const name = window.prompt("Key name", "Production");
                    if (name === null) return;
                    await pagewright.createKey(name);
                    await load(current.id);
                  }}
                >
                  + Create key
                </Button>
                {keys.map((key) => (
                  <div key={key.id} className="rounded border border-border p-2">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm font-medium">{key.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Delete key"
                        onClick={async () => {
                          await pagewright.deleteKey(key.id);
                          await load(current.id);
                        }}
                      >
                        ×
                      </Button>
                    </div>
                    <code className="mt-1 block break-all font-mono text-[10px] text-muted-foreground">
                      {key.key}
                    </code>
                    <span className="text-[11px] text-muted-foreground">{key.calls} calls</span>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="jobs">
              <div className="grid gap-2">
                {jobs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No documents generated yet.</p>
                ) : null}
                {jobs.map((job) => (
                  <div key={job.id} className="rounded border border-border p-2 text-xs">
                    <div className="truncate font-medium">{job.templateName}</div>
                    <div className="text-muted-foreground">
                      <span className={job.status === "error" ? "text-destructive" : ""}>
                        {job.status}
                      </span>{" "}
                      · {job.format} · {job.pages ?? "?"}p · {job.ms ?? "?"}ms
                    </div>
                    {job.file ? (
                      <a
                        className="text-primary underline"
                        href={`${API_BASE}/files/${job.file}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        open
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        {/* panes */}
        <section className={`min-w-0 ${surfaceClass}`}>
          <Tabs
            defaultValue="blocks"
            onValueChange={(value) => {
              if (value !== "api" || !current) return;
              void pagewright
                .inspect(current.id, current)
                .then((info) => setPaths(info.paths))
                .catch(() => setPaths([]));
            }}
          >
            <TabsList className="max-w-full overflow-x-auto">
              <TabsTrigger value="blocks">Blocks</TabsTrigger>
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="page">Page</TabsTrigger>
              <TabsTrigger value="theme">Theme</TabsTrigger>
              <TabsTrigger value="api">API</TabsTrigger>
            </TabsList>

            <TabsContent value="blocks">
              <BlockEditor blocks={current.blocks} onChange={touch} />
            </TabsContent>

            <TabsContent value="data">
              <div className="grid gap-2">
                <p className="text-xs text-muted-foreground">
                  Sample JSON. The API merges this same shape into the template.
                </p>
                <Textarea
                  rows={22}
                  className="font-mono text-xs"
                  value={dataText}
                  spellCheck={false}
                  onChange={(e) => {
                    setDataText(e.target.value);
                    try {
                      JSON.parse(e.target.value || "{}");
                      setDataError("");
                      setDirty(true);
                      schedulePreview();
                    } catch (err) {
                      setDataError((err as Error).message);
                    }
                  }}
                />
                {dataError ? (
                  <p className="font-mono text-xs text-destructive">{dataError}</p>
                ) : null}
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={stressTest}>
                    Stress test: 200 rows
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Proves pagination and repeating headers.
                  </span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="page">
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelClass}>
                    <span>Paper</span>
                    <select
                      className={selectClass}
                      value={current.page.format}
                      onChange={(e) => {
                        current.page.format = e.target.value as Template["page"]["format"];
                        touch();
                      }}
                    >
                      {["A4", "Letter", "Legal", "A3", "A5"].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    <span>Orientation</span>
                    <select
                      className={selectClass}
                      value={current.page.orientation}
                      onChange={(e) => {
                        current.page.orientation = e.target
                          .value as Template["page"]["orientation"];
                        touch();
                      }}
                    >
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </label>
                  {(["top", "right", "bottom", "left"] as const).map((side) => (
                    <label key={side} className={labelClass}>
                      <span>Margin {side}</span>
                      <Input
                        className="h-9"
                        defaultValue={current.page.margin[side]}
                        onChange={(e) => {
                          current.page.margin[side] = e.target.value;
                          touch();
                        }}
                      />
                    </label>
                  ))}
                </div>

                {(["header", "footer"] as const).map((slot) => (
                  <div key={slot} className="grid gap-1">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={Boolean(current.page[slot]?.enabled)}
                        onChange={(e) => {
                          current.page[slot] = {
                            html: current.page[slot]?.html ?? "",
                            enabled: e.target.checked,
                          };
                          touch();
                        }}
                      />
                      Running {slot}
                    </label>
                    <Textarea
                      rows={2}
                      className="font-mono text-xs"
                      defaultValue={current.page[slot]?.html ?? ""}
                      onChange={(e) => {
                        current.page[slot] = {
                          enabled: Boolean(current.page[slot]?.enabled),
                          html: e.target.value,
                        };
                        touch();
                      }}
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  <code className="font-mono">{'<span class="pageNumber"></span>'}</code> and{" "}
                  <code className="font-mono">{'<span class="totalPages"></span>'}</code> are filled
                  by the print engine.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="theme">
              <div className="grid grid-cols-2 gap-3">
                {(["accent", "ink", "muted", "rule"] as const).map((token) => (
                  <label key={token} className={labelClass}>
                    <span>{token}</span>
                    <input
                      type="color"
                      className="h-9 w-full rounded border border-border bg-background"
                      value={current.theme[token]}
                      onChange={(e) => {
                        current.theme[token] = e.target.value;
                        touch();
                      }}
                    />
                  </label>
                ))}
                <label className={labelClass}>
                  <span>Base size</span>
                  <Input
                    className="h-9"
                    defaultValue={current.theme.fontSize}
                    onChange={(e) => {
                      current.theme.fontSize = e.target.value;
                      touch();
                    }}
                  />
                </label>
                <label className={labelClass}>
                  <span>Font stack</span>
                  <Input
                    className="h-9"
                    defaultValue={current.theme.font}
                    onChange={(e) => {
                      current.theme.font = e.target.value;
                      touch();
                    }}
                  />
                </label>
              </div>
            </TabsContent>

            <TabsContent value="api">
              <div className="grid gap-3">
                <p className="text-xs text-muted-foreground">
                  Generate this document from your own software.
                </p>
                <pre className="overflow-x-auto rounded-xl bg-foreground p-3 font-mono text-[11px] leading-relaxed text-background">
                  {snippet}
                </pre>
                {paths.length ? (
                  <>
                    <p className="text-xs text-muted-foreground">Data paths in this template</p>
                    <ul className="flex flex-wrap gap-1">
                      {paths.map((path) => (
                        <li
                          key={path}
                          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                        >
                          {path}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
        </section>

        {/* preview */}
        <section className={`grid min-w-0 content-start gap-2 ${surfaceClass}`}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {preview?.meta ?? "—"}
            </span>
            {rendering ? <span className="text-xs text-primary">rendering…</span> : null}
          </div>
          <div className="min-h-[70vh] overflow-auto rounded-xl border border-border/70 bg-muted">
            {previewError ? (
              <p className="m-3 rounded border border-destructive/40 bg-destructive/5 p-3 font-mono text-xs text-destructive">
                {previewError}
              </p>
            ) : preview && format === "pdf" ? (
              <iframe src={preview.url} title="Document preview" className="h-[70vh] w-full" />
            ) : preview ? (
              <img src={preview.url} alt="Document preview" className="w-full" />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
