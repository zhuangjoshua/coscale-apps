/**
 * Adversarial length probe. Every case here is "the data was not the length the
 * designer assumed". Renders each and reports page count + whether any content
 * escaped the page box horizontally.
 */

import { chromium } from "playwright";
import { SEED_TEMPLATES } from "../seed/templates.js";
import { compileTemplate } from "../src/blocks.js";
import { render } from "../src/template-engine.js";
import { generate } from "../src/pipeline.js";
import { closeBrowser, lengthToPx, paperPx } from "../src/render.js";
import * as store from "../src/store.js";

const quote = SEED_TEMPLATES.find((t) => t.id === "tpl_quote")!;
const data = quote.sampleData as Record<string, unknown>;
const item = (over: Record<string, unknown>) => ({
  description: "Standard line",
  qty: 1,
  unit: "ea",
  rate: 100,
  amount: 100,
  ...over,
});

const LOREM =
  "Remove and replace all deteriorated fascia board along the north and east elevations, " +
  "including priming and painting to match existing trim colour, plus disposal of removed " +
  "material and touch-up of adjacent soffit vents where fasteners are visible after install. ";

const CASES: { name: string; data: Record<string, unknown> }[] = [
  { name: "empty array", data: { ...data, items: [] } },
  { name: "1 row", data: { ...data, items: [item({})] } },
  { name: "7 rows (as designed)", data },
  { name: "150 rows", data: { ...data, items: Array.from({ length: 150 }, (_, i) => item({ description: `Line ${i + 1}` })) } },
  {
    name: "one 600-char cell",
    data: { ...data, items: [item({ description: LOREM.repeat(2).slice(0, 600) })] },
  },
  {
    name: "unbroken 300-char token",
    data: { ...data, items: [item({ description: "A".repeat(300) })] },
  },
  {
    name: "long URL in a cell",
    data: {
      ...data,
      items: [item({ description: `https://example.com/${"segment-".repeat(30)}end` })],
    },
  },
  {
    name: "single row taller than a page",
    data: { ...data, items: [item({ description: LOREM.repeat(24) })] },
  },
  {
    name: "very long company name",
    data: {
      ...data,
      company: { ...(data.company as object), name: "Cedarline Roofing Gutters Siding Windows and Exterior Restoration Services of Central Texas LLC" },
    },
  },
  {
    name: "missing optional fields",
    data: { currency: "USD", quote_number: "Q-1", items: [item({})], doc: { footer: "" } },
  },
  {
    name: "huge scope paragraph",
    data: { ...data, scope: LOREM.repeat(30) },
  },
  {
    name: "60 optional upgrades",
    data: {
      ...data,
      optional_items: Array.from({ length: 60 }, (_, i) => ({ description: `Upgrade ${i + 1}`, amount: 100 })),
    },
  },
];

/** Re-lays out the merged HTML and reports anything wider than the content box. */
async function overflow(html: string): Promise<{ worst: number; culprit: string }> {
  const paper = paperPx(quote.page);
  const contentWidth =
    paper.width - lengthToPx(quote.page.margin.left) - lengthToPx(quote.page.margin.right);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: Math.round(contentWidth), height: 900 },
  });
  const tab = await context.newPage();
  await tab.setContent(html, { waitUntil: "networkidle" });
  await tab.emulateMedia({ media: "print" });

  const result = await tab.evaluate((limit) => {
    let worst = 0;
    let culprit = "";
    for (const node of document.querySelectorAll<HTMLElement>(".pw-doc *")) {
      const right = node.getBoundingClientRect().right;
      if (right > limit + 1 && right - limit > worst) {
        worst = right - limit;
        culprit = `${node.tagName.toLowerCase()}.${node.className || "-"}`;
      }
    }
    return { worst, culprit };
  }, contentWidth);

  await browser.close();
  return result;
}

async function main() {
  await store.init();
  const compiled = compileTemplate(quote);

  console.log("\ncase                              pages   overflow   notes");
  console.log("─".repeat(78));

  for (const testCase of CASES) {
    const html = render(compiled, testCase.data);
    const [pdf, over] = await Promise.all([
      generate({ template: quote, data: testCase.data, via: "editor", persist: false }),
      overflow(html),
    ]);

    const flag = over.worst > 1 ? `${over.worst.toFixed(0)}px !` : "none";
    console.log(
      `${testCase.name.padEnd(33)} ${String(pdf.pages).padStart(3)}   ${flag.padEnd(10)} ${
        over.worst > 1 ? over.culprit : ""
      }`,
    );
  }

  await closeBrowser();
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
