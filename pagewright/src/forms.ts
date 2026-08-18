/**
 * Fillable PDF support.
 *
 * Chromium's print pipeline emits flat vector output — it has no concept of an
 * AcroForm. So `field` blocks render as visible boxes, we capture their geometry
 * during layout, and here we stamp real interactive widgets on top with pdf-lib.
 *
 * Mapping caveat: placeholder geometry is measured in continuous document flow and
 * mapped onto pages arithmetically. That is exact while content flows uniformly; a
 * field sitting across a natural page break can land a page off. Templates that mix
 * fields with long flowing tables should use an explicit `pagebreak` block.
 */

import { PDFDocument, rgb } from "pdf-lib";
import type { PageSetup } from "./blocks.js";
import { type FieldBox, lengthToPx, paperPx, pxToPt } from "./render.js";

export async function applyFormFields(
  pdfBytes: Buffer,
  fields: FieldBox[],
  page: PageSetup,
  values: Record<string, unknown> = {},
): Promise<Buffer> {
  if (!fields.length) return pdfBytes;

  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();
  const pages = doc.getPages();
  if (!pages.length) return pdfBytes;

  const paper = paperPx(page);
  const marginTop = lengthToPx(page.margin.top);
  const marginLeft = lengthToPx(page.margin.left);
  const marginBottom = lengthToPx(page.margin.bottom);
  const contentHeight = Math.max(1, paper.height - marginTop - marginBottom);

  const used = new Set<string>();

  for (const box of fields) {
    if (!box.name) continue;

    // Deduplicate names: AcroForm fields sharing a name share a value.
    let name = box.name;
    let n = 2;
    while (used.has(name)) name = `${box.name}_${n++}`;
    used.add(name);

    const pageIndex = Math.min(pages.length - 1, Math.floor(box.y / contentHeight));
    const target = pages[pageIndex];
    const yInPage = box.y - pageIndex * contentHeight + marginTop;

    const widthPt = pxToPt(box.width);
    const heightPt = pxToPt(box.height);
    const xPt = pxToPt(box.x + marginLeft);
    const yPt = target.getHeight() - pxToPt(yInPage) - heightPt;

    const field = form.createTextField(name);
    if (box.multiline) field.enableMultiline();

    const preset = values[box.name];
    if (preset !== undefined && preset !== null) field.setText(String(preset));

    field.addToPage(target, {
      x: xPt,
      y: yPt,
      width: widthPt,
      height: heightPt,
      borderWidth: 0,
      backgroundColor: undefined,
      textColor: rgb(0.07, 0.08, 0.09),
    });
  }

  return Buffer.from(await doc.save());
}

/** Parity with CraftMyPDF/Bannerbear's join utility. */
export async function mergePdfs(buffers: Buffer[]): Promise<Buffer> {
  const out = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf);
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach((p) => out.addPage(p));
  }
  return Buffer.from(await out.save());
}
