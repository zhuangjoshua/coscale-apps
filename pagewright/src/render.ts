/**
 * Rendering: merged HTML → PDF (or PNG/JPEG) via a long-lived Chromium.
 *
 * Pagination, repeating table headers and page numbers are all done by the print
 * engine rather than by hand: `thead { display: table-header-group }` repeats headers,
 * `break-inside: avoid` keeps rows intact, and Chromium's displayHeaderFooter draws
 * the running header/footer with real page numbers.
 */

import { chromium, type Browser } from "playwright";
import { PDFDocument } from "pdf-lib";
import type { PageSetup, Theme } from "./blocks.js";
import { chromeCss } from "./blocks.js";

let browserPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ args: ["--font-render-hinting=none"] });
  }
  const browser = await browserPromise;
  if (!browser.isConnected()) {
    browserPromise = chromium.launch({ args: ["--font-render-hinting=none"] });
    return browserPromise;
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const b = await browserPromise;
  browserPromise = null;
  await b.close().catch(() => {});
}

// ---------------------------------------------------------------- units

const PAPER_IN: Record<PageSetup["format"], [number, number]> = {
  A4: [8.268, 11.693],
  Letter: [8.5, 11],
  Legal: [8.5, 14],
  A3: [11.693, 16.535],
  A5: [5.827, 8.268],
};

/** CSS px at the 96dpi the print engine uses. */
export function paperPx(page: PageSetup): { width: number; height: number } {
  const [w, h] = PAPER_IN[page.format] ?? PAPER_IN.A4;
  const [a, b] = page.orientation === "landscape" ? [h, w] : [w, h];
  return { width: a * 96, height: b * 96 };
}

export function lengthToPx(value: string | undefined, fallback = 0): number {
  if (!value) return fallback;
  const m = /^([\d.]+)\s*(mm|cm|in|px|pt)?$/.exec(String(value).trim());
  if (!m) return fallback;
  const n = Number(m[1]);
  switch (m[2]) {
    case "mm": return (n / 25.4) * 96;
    case "cm": return (n / 2.54) * 96;
    case "in": return n * 96;
    case "pt": return (n / 72) * 96;
    default: return n;
  }
}

export const pxToPt = (px: number) => px * 0.75;

export interface FieldBox {
  name: string;
  multiline: boolean;
  /** Document-flow coordinates in CSS px, relative to the content box origin. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderResult {
  buffer: Buffer;
  pages: number;
  ms: number;
  fields: FieldBox[];
}

// ---------------------------------------------------------------- pdf

export async function renderPdf(
  html: string,
  page: PageSetup,
  theme: Theme,
): Promise<RenderResult> {
  const started = Date.now();
  const browser = await getBrowser();
  const paper = paperPx(page);
  const context = await browser.newContext({
    viewport: { width: Math.round(paper.width), height: Math.round(paper.height) },
    deviceScaleFactor: 1,
  });
  const tab = await context.newPage();

  try {
    await tab.setContent(html, { waitUntil: "networkidle" });
    await tab.emulateMedia({ media: "print" });
    await tab.evaluate(() => document.fonts?.ready);

    // Capture placeholder geometry before printing so AcroForm widgets can be stamped.
    const fields = (await tab.evaluate(() => {
      const doc = document.querySelector(".pw-doc");
      const origin = doc ? doc.getBoundingClientRect() : { left: 0, top: 0 };
      return [...document.querySelectorAll("[data-pw-field]")].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          name: el.getAttribute("data-pw-field") || "",
          multiline: el.getAttribute("data-pw-multiline") === "1",
          x: r.left - origin.left + window.scrollX,
          y: r.top - origin.top + window.scrollY,
          width: r.width,
          height: r.height,
        };
      });
    })) as FieldBox[];

    const wantsChrome = Boolean(page.header?.enabled || page.footer?.enabled);
    const wrap = (inner: string) => `<div style="${chromeCss(theme)}">${inner}</div>`;

    const buffer = await tab.pdf({
      format: page.format,
      landscape: page.orientation === "landscape",
      printBackground: true,
      preferCSSPageSize: false,
      margin: page.margin,
      displayHeaderFooter: wantsChrome,
      headerTemplate: wrap(page.header?.enabled ? page.header.html : ""),
      footerTemplate: wrap(page.footer?.enabled ? page.footer.html : ""),
    });

    const pdf = await PDFDocument.load(buffer);
    return {
      buffer: Buffer.from(buffer),
      pages: pdf.getPageCount(),
      ms: Date.now() - started,
      fields,
    };
  } finally {
    await context.close().catch(() => {});
  }
}

// ---------------------------------------------------------------- image

export async function renderImage(
  html: string,
  page: PageSetup,
  format: "png" | "jpeg",
  scale = 2,
): Promise<RenderResult> {
  const started = Date.now();
  const browser = await getBrowser();
  const paper = paperPx(page);
  const context = await browser.newContext({
    viewport: { width: Math.round(paper.width), height: Math.round(paper.height) },
    deviceScaleFactor: scale,
  });
  const tab = await context.newPage();

  try {
    // Reproduce the print margin box so the image matches the PDF's first page.
    const padded = html.replace(
      "<body>",
      `<body style="padding:${page.margin.top} ${page.margin.right} ${page.margin.bottom} ${page.margin.left};background:#fff">`,
    );
    await tab.setContent(padded, { waitUntil: "networkidle" });
    await tab.evaluate(() => document.fonts?.ready);

    const buffer = await tab.screenshot({
      type: format,
      fullPage: true,
      ...(format === "jpeg" ? { quality: 90 } : {}),
    });

    return { buffer: Buffer.from(buffer), pages: 1, ms: Date.now() - started, fields: [] };
  } finally {
    await context.close().catch(() => {});
  }
}
