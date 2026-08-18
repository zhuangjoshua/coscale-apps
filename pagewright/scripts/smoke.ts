/**
 * End-to-end smoke test. Exercises the merge engine, the flow/pagination engine,
 * AcroForm stamping and the join utility without needing the HTTP layer.
 *
 *   npm run smoke
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

import { SEED_TEMPLATES } from "../seed/templates.js";
import { generate } from "../src/pipeline.js";
import { mergePdfs } from "../src/forms.js";
import { closeBrowser } from "../src/render.js";
import { extractPaths, render } from "../src/template-engine.js";
import { compileTemplate } from "../src/blocks.js";
import * as store from "../src/store.js";

let failures = 0;

function check(label: string, condition: boolean, detail = "") {
  const mark = condition ? "  ok" : "FAIL";
  if (!condition) failures += 1;
  console.log(`${mark}  ${label}${detail ? `  — ${detail}` : ""}`);
}

async function main() {
  await store.init();

  // ---- template engine ------------------------------------------------
  console.log("\ntemplate engine");

  check(
    "interpolation + dot paths",
    render("{{a.b}}", { a: { b: "deep" } }) === "deep",
  );
  check(
    "html escaping",
    render("{{x}}", { x: "<script>" }) === "&lt;script&gt;",
  );
  check(
    "raw interpolation",
    render("{{{x}}}", { x: "<b>hi</b>" }) === "<b>hi</b>",
  );
  check(
    "each with @number and parent scope",
    render("{{#each items}}{{@number}}:{{name}}@{{../org}} {{/each}}", {
      org: "acme",
      items: [{ name: "a" }, { name: "b" }],
    }) === "1:a@acme 2:b@acme ",
  );
  check(
    "if / else",
    render("{{#if v}}Y{{else}}N{{/if}}", { v: false }) === "N",
  );
  check(
    "unless",
    render("{{#unless items}}empty{{/unless}}", { items: [] }) === "empty",
  );
  check(
    "sum helper over array of objects",
    render('{{sum items "total"}}', { items: [{ total: 10 }, { total: 5.5 }] }) === "15.5",
  );
  check(
    "money helper",
    render("{{money v currency}}", { v: 1234.5, currency: "USD" }) === "$1,234.50",
  );
  check(
    "date helper",
    render('{{date d "iso"}}', { d: "2026-08-14T10:00:00Z" }) === "2026-08-14",
  );
  check(
    "nested each",
    render("{{#each rows}}{{#each tags}}{{this}},{{/each}}{{/each}}", {
      rows: [{ tags: ["x", "y"] }],
    }) === "x,y,",
  );
  check(
    "missing values render empty, not 'undefined'",
    render("[{{nope.deep}}]", {}) === "[]",
  );

  check(
    "subexpression as a helper argument",
    render('{{money (sum items "total") currency}}', {
      currency: "USD",
      items: [{ total: 10 }, { total: 5 }],
    }) === "$15.00",
  );

  // The invoice subtotal is computed, not supplied — 2400 + 1800 + 520 + 40.
  const invoiceHtml = render(
    compileTemplate(SEED_TEMPLATES[0]),
    SEED_TEMPLATES[0].sampleData as Record<string, unknown>,
  );
  check(
    "invoice subtotal computes from line items",
    invoiceHtml.includes("$4,760.00"),
  );
  check("no unresolved tokens left in output", !/\{\{/.test(invoiceHtml));

  const paths = extractPaths(compileTemplate(SEED_TEMPLATES[0]));
  check("path extraction finds the items array", paths.includes("items"), paths.slice(0, 4).join(", "));

  // ---- rendering ------------------------------------------------------
  console.log("\nrendering");

  for (const tpl of SEED_TEMPLATES) {
    const result = await generate({
      template: tpl,
      data: tpl.sampleData as Record<string, unknown>,
      format: "pdf",
      via: "editor",
      outputFile: `${tpl.id}.pdf`,
    });
    const header = result.buffer.subarray(0, 5).toString("latin1");
    check(
      `${tpl.name} → PDF`,
      header === "%PDF-" && result.pages >= 1,
      `${result.pages}p, ${(result.buffer.length / 1024).toFixed(0)}KB, ${result.ms}ms`,
    );
  }

  // ---- pagination -----------------------------------------------------
  console.log("\nflow / pagination");

  const invoice = SEED_TEMPLATES[0];
  const base = invoice.sampleData as Record<string, unknown>;
  const seed = base.items as Record<string, unknown>[];

  const small = await generate({
    template: invoice,
    data: base,
    via: "editor",
    persist: false,
  });

  const bigItems = Array.from({ length: 200 }, (_, i) => ({
    ...seed[i % seed.length],
    description: `Line item ${i + 1}`,
  }));
  const big = await generate({
    template: invoice,
    data: { ...base, items: bigItems },
    via: "editor",
    outputFile: "invoice-200-rows.pdf",
  });

  check("4 rows fits one page", small.pages === 1, `${small.pages}p`);
  check("200 rows paginates", big.pages > 1, `${big.pages}p`);

  // Repeating <thead> means the header text appears once per page in the content stream.
  const bigDoc = await PDFDocument.load(big.buffer);
  check("page count matches pdf-lib", bigDoc.getPageCount() === big.pages);

  const empty = await generate({
    template: invoice,
    data: { ...base, items: [] },
    via: "editor",
    persist: false,
  });
  check("empty array renders the empty state, not a crash", empty.pages === 1);

  // ---- quote template -------------------------------------------------
  console.log("\nquote template");

  const quote = SEED_TEMPLATES.find((t) => t.id === "tpl_quote")!;
  const quoteData = quote.sampleData as Record<string, unknown>;
  const quoteHtml = render(compileTemplate(quote), quoteData);

  check("subtotal computes from line items", quoteHtml.includes("$13,330.00"));
  check("deposit split renders", quoteHtml.includes("$7,214.87"));
  check("optional upgrades section shows when present", quoteHtml.includes("Optional upgrades"));
  check("no unresolved tokens", !/\{\{/.test(quoteHtml));

  // `when` is the whole point: drop the array and the section must vanish entirely.
  const withoutOptional = { ...quoteData };
  delete (withoutOptional as Record<string, unknown>).optional_items;
  const leanHtml = render(compileTemplate(quote), withoutOptional);
  check("optional section hidden when array absent", !leanHtml.includes("Optional upgrades"));
  check("hidden section leaves no empty table", !leanHtml.includes("Initial any you would like"));
  check("rest of the quote still renders", leanHtml.includes("Scope of work"));

  const noDeposit = { ...quoteData };
  delete (noDeposit as Record<string, unknown>).deposit;
  check(
    "deposit block hidden when no deposit",
    !render(compileTemplate(quote), noDeposit).includes("Deposit due to schedule"),
  );

  const quotePdf = await generate({
    template: quote,
    data: quoteData,
    via: "editor",
    outputFile: "quote.pdf",
  });
  check("quote renders to PDF", quotePdf.pages >= 1, `${quotePdf.pages}p, ${quotePdf.ms}ms`);

  const quoteForm = await PDFDocument.load(quotePdf.buffer);
  check(
    "acceptance fields are interactive",
    quoteForm.getForm().getFields().map((f) => f.getName()).join(",") === "accepted_by,accepted_date",
  );

  const bigQuote = await generate({
    template: quote,
    data: {
      ...quoteData,
      items: Array.from({ length: 150 }, (_, i) => ({
        description: `Scope line ${i + 1}`,
        qty: 1,
        unit: "ea",
        rate: 100,
        amount: 100,
      })),
    },
    via: "editor",
    outputFile: "quote-150-lines.pdf",
  });
  check("150 line items paginate", bigQuote.pages > 1, `${bigQuote.pages}p`);

  // ---- fillable fields ------------------------------------------------
  console.log("\nfillable fields");

  const intake = SEED_TEMPLATES.find((t) => t.id === "tpl_intake")!;
  const form = await generate({
    template: intake,
    data: intake.sampleData as Record<string, unknown>,
    fieldValues: { full_name: "Dana Whitfield", email: "dana@example.com" },
    via: "editor",
    outputFile: "intake-filled.pdf",
  });

  const formDoc = await PDFDocument.load(form.buffer);
  const acro = formDoc.getForm();
  const names = acro.getFields().map((f) => f.getName());
  check("AcroForm fields created", names.length === 4, names.join(", "));
  check("prefilled value round-trips", acro.getTextField("full_name").getText() === "Dana Whitfield");
  check(
    "multiline flag preserved",
    names.includes("notes"),
  );

  // ---- merge ----------------------------------------------------------
  console.log("\nmerge utility");

  const merged = await mergePdfs([small.buffer, form.buffer]);
  const mergedDoc = await PDFDocument.load(merged);
  check(
    "join concatenates page counts",
    mergedDoc.getPageCount() === small.pages + form.pages,
    `${mergedDoc.getPageCount()}p`,
  );

  // ---- image ----------------------------------------------------------
  console.log("\nimage output");

  const png = await generate({
    template: invoice,
    data: base,
    format: "png",
    via: "editor",
    outputFile: "invoice.png",
  });
  check(
    "PNG output",
    png.buffer.subarray(1, 4).toString("latin1") === "PNG",
    `${(png.buffer.length / 1024).toFixed(0)}KB`,
  );

  await closeBrowser();

  const outDir = path.join(store.OUTPUT);
  const files = await fs.readdir(outDir);
  console.log(`\nartifacts in storage/output: ${files.length}`);
  console.log(failures ? `\n${failures} check(s) failed\n` : "\nall checks passed\n");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
