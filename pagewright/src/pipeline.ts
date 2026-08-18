/**
 * template + data → bytes. One path shared by the API and the editor preview so
 * what you see while designing is what the API returns.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { compileTemplate, type Template } from "./blocks.js";
import { render } from "./template-engine.js";
import { renderImage, renderPdf } from "./render.js";
import { applyFormFields } from "./forms.js";
import { LOCAL_ACCOUNT, OUTPUT, newId, recordJob, type Job } from "./store.js";

export type OutputFormat = "pdf" | "png" | "jpeg";

export interface GenerateOptions {
  template: Template;
  data: Record<string, unknown>;
  format?: OutputFormat;
  /** Prefill values for fillable fields, keyed by field name. */
  fieldValues?: Record<string, unknown>;
  via?: "api" | "editor";
  persist?: boolean;
  outputFile?: string;
  /** Owner of the resulting job record; CLI scripts fall back to the local account. */
  accountId?: string;
}

export interface GenerateResult {
  buffer: Buffer;
  pages: number;
  ms: number;
  format: OutputFormat;
  job?: Job;
  file?: string;
  url?: string;
}

const safeName = (name: string | undefined, fallback: string) => {
  const base = (name || fallback).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length > 80 ? base.slice(-80) : base;
};

export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const { template, data } = opts;
  const format = opts.format ?? "pdf";
  const via = opts.via ?? "api";
  const accountId = opts.accountId ?? LOCAL_ACCOUNT;

  const jobId = newId("job");
  const startedAt = new Date().toISOString();

  try {
    const merged = render(compileTemplate(template), data);

    // Running header/footer are Chromium templates, not part of the body — merge
    // them separately so {{ }} tokens work there too.
    const page = {
      ...template.page,
      header: template.page.header && {
        ...template.page.header,
        html: render(template.page.header.html, data),
      },
      footer: template.page.footer && {
        ...template.page.footer,
        html: render(template.page.footer.html, data),
      },
    };

    let buffer: Buffer;
    let pages: number;
    let ms: number;

    if (format === "pdf") {
      const result = await renderPdf(merged, page, template.theme);
      buffer = await applyFormFields(
        result.buffer,
        result.fields,
        page,
        opts.fieldValues ?? {},
      );
      pages = result.pages;
      ms = result.ms;
    } else {
      const result = await renderImage(merged, page, format);
      buffer = result.buffer;
      pages = result.pages;
      ms = result.ms;
    }

    let file: string | undefined;
    let url: string | undefined;
    if (opts.persist !== false) {
      file = `${jobId}_${safeName(opts.outputFile, `output.${format}`)}`;
      if (!file.endsWith(`.${format}`)) file = `${file}.${format}`;
      await fs.writeFile(path.join(OUTPUT, file), buffer);
      url = `/files/${file}`;
    }

    const job = await recordJob({
      id: jobId,
      accountId,
      templateId: template.id,
      templateName: template.name,
      status: "success",
      format,
      pages,
      bytes: buffer.length,
      ms,
      file,
      via,
      createdAt: startedAt,
    });

    return { buffer, pages, ms, format, job, file, url };
  } catch (err) {
    await recordJob({
      id: jobId,
      accountId,
      templateId: template.id,
      templateName: template.name,
      status: "error",
      format,
      error: err instanceof Error ? err.message : String(err),
      via,
      createdAt: startedAt,
    });
    throw err;
  }
}
