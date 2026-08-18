/**
 * Starter templates. Seeded on first boot so the app is useful immediately and so
 * the flow engine has something real to prove itself against.
 */

import { DEFAULT_PAGE, DEFAULT_THEME, type Template } from "../src/blocks.js";

const now = new Date().toISOString();

const base = (id: string, name: string, description: string) => ({
  id,
  name,
  description,
  page: structuredClone(DEFAULT_PAGE),
  theme: structuredClone(DEFAULT_THEME),
  createdAt: now,
  updatedAt: now,
});

const invoice: Template = {
  ...base("tpl_invoice", "Invoice", "Line items that flow across pages with a repeating header."),
  blocks: [
    {
      id: "b1",
      type: "brandbar",
      title: "{{company.name}}",
      subtitle: "{{company.tagline}}",
      meta: [
        { label: "Invoice", value: "{{invoice_number}}" },
        { label: "Issued", value: '{{date issued "short"}}' },
        { label: "Due", value: '{{date due "short"}}' },
      ],
    },
    {
      id: "b2",
      type: "parties",
      left: {
        title: "From",
        lines: ["{{company.name}}", "{{company.address}}", "{{company.email}}"],
      },
      right: {
        title: "Bill to",
        lines: ["{{customer.name}}", "{{customer.address}}", "{{customer.email}}"],
      },
    },
    {
      id: "b3",
      type: "table",
      source: "items",
      zebra: true,
      emptyText: "No line items on this invoice.",
      columns: [
        { header: "#", path: "@number", width: "6%" },
        { header: "Description", path: "description" },
        { header: "Qty", path: "qty", align: "right", width: "10%", format: "number" },
        { header: "Unit price", path: "price", align: "right", width: "16%", format: "money" },
        { header: "Amount", path: "total", align: "right", width: "16%", format: "money" },
      ],
    },
    {
      id: "b4",
      type: "totals",
      rows: [
        { label: "Subtotal", value: '{{money (sum items "total") currency}}' },
        { label: "Tax ({{tax_rate}}%)", value: "{{money tax currency}}" },
        { label: "Total due", value: "{{money total currency}}", strong: true },
      ],
    },
    {
      id: "b5",
      type: "note",
      tone: "accent",
      title: "Payment terms",
      body: "{{terms}}",
    },
  ],
  sampleData: {
    currency: "USD",
    invoice_number: "INV-38379",
    issued: "2026-08-01",
    due: "2026-08-31",
    tax_rate: 8.5,
    tax: 402.9,
    total: 5142.9,
    terms: "Net 30. Late payments accrue 1.5% monthly interest.",
    doc: { footer: "Invoice INV-38379 — Northwind Studio" },
    company: {
      name: "Northwind Studio",
      tagline: "Design & engineering",
      address: "417 Mission St, San Francisco, CA 94105",
      email: "billing@northwind.studio",
    },
    customer: {
      name: "Acme Corporation",
      address: "88 Industrial Way, Austin, TX 78701",
      email: "ap@acme.com",
    },
    items: [
      { description: "Discovery workshop", qty: 1, price: 2400, total: 2400 },
      { description: "Design system build", qty: 12, price: 150, total: 1800 },
      { description: "Front-end implementation", qty: 4, price: 130, total: 520 },
      { description: "Managed hosting (August)", qty: 1, price: 40, total: 40 },
    ],
  },
};

const certificate: Template = {
  ...base("tpl_certificate", "Certificate", "Single-page landscape award with signature lines."),
  page: {
    ...structuredClone(DEFAULT_PAGE),
    orientation: "landscape",
    margin: { top: "22mm", right: "24mm", bottom: "22mm", left: "24mm" },
    footer: { enabled: false, html: "" },
  },
  theme: { ...structuredClone(DEFAULT_THEME), accent: "#8a6d3b" },
  blocks: [
    { id: "c1", type: "text", align: "center", muted: true, text: "{{issuer}}" },
    { id: "c2", type: "heading", level: 1, align: "center", text: "Certificate of Completion" },
    { id: "c3", type: "spacer", height: 8 },
    { id: "c4", type: "text", align: "center", muted: true, text: "This certifies that" },
    { id: "c5", type: "heading", level: 2, align: "center", text: "{{recipient.name}}" },
    {
      id: "c6",
      type: "text",
      align: "center",
      text: "has successfully completed <b>{{course.title}}</b>, comprising {{course.hours}} hours of instruction, on {{date course.completed}}.",
    },
    { id: "c7", type: "spacer", height: 24 },
    {
      id: "c8",
      type: "signature",
      entries: [
        { label: "Instructor", name: "{{instructor}}" },
        { label: "Credential ID", name: "{{credential_id}}" },
      ],
    },
  ],
  sampleData: {
    issuer: "Meridian Training Institute",
    recipient: { name: "Dana Whitfield" },
    course: { title: "Advanced Fire Safety Systems", hours: 32, completed: "2026-07-18" },
    instructor: "R. Okonkwo",
    credential_id: "MTI-2026-04417",
    doc: { footer: "" },
  },
};

const report: Template = {
  ...base("tpl_report", "Monthly report", "Multi-section client report with metrics and a long table."),
  blocks: [
    {
      id: "r1",
      type: "brandbar",
      title: "{{client.name}}",
      subtitle: "Performance report — {{period}}",
      meta: [
        { label: "Prepared by", value: "{{agency}}" },
        { label: "Generated", value: '{{date generated "long"}}' },
      ],
    },
    { id: "r2", type: "heading", level: 2, text: "Summary" },
    { id: "r3", type: "text", text: "{{summary}}" },
    {
      id: "r4",
      type: "keyvalue",
      title: "Headline metrics",
      columns: 3,
      rows: [
        { label: "Spend", value: "{{money metrics.spend currency}}" },
        { label: "Conversions", value: "{{number metrics.conversions 0}}" },
        { label: "CPA", value: "{{money metrics.cpa currency}}" },
        { label: "Impressions", value: "{{number metrics.impressions 0}}" },
        { label: "Clicks", value: "{{number metrics.clicks 0}}" },
        { label: "CTR", value: "{{metrics.ctr}}%" },
      ],
    },
    { id: "r5", type: "heading", level: 2, text: "Campaign detail" },
    {
      id: "r6",
      type: "table",
      source: "campaigns",
      zebra: true,
      columns: [
        { header: "Campaign", path: "name" },
        { header: "Spend", path: "spend", align: "right", format: "money" },
        { header: "Conv.", path: "conversions", align: "right" },
        { header: "CPA", path: "cpa", align: "right", format: "money" },
      ],
    },
    { id: "r7", type: "divider" },
    { id: "r8", type: "note", title: "Next month", body: "{{next_steps}}" },
  ],
  sampleData: {
    currency: "USD",
    client: { name: "Harbourline Outfitters" },
    agency: "Fieldwork Media",
    period: "July 2026",
    generated: "2026-08-01",
    summary:
      "Spend held flat while conversions rose 18%, driven by the reworked prospecting creative. CPA improved for the third consecutive month.",
    metrics: {
      spend: 48200,
      conversions: 1043,
      cpa: 46.21,
      impressions: 2841022,
      clicks: 51894,
      ctr: 1.83,
    },
    campaigns: [
      { name: "Prospecting — Video", spend: 18400, conversions: 402, cpa: 45.77 },
      { name: "Prospecting — Static", spend: 12100, conversions: 240, cpa: 50.42 },
      { name: "Retargeting — DPA", spend: 9300, conversions: 289, cpa: 32.18 },
      { name: "Brand — Search", spend: 8400, conversions: 112, cpa: 75.0 },
    ],
    next_steps: "Shift 15% of static budget into video and test three new hooks.",
    doc: { footer: "Harbourline Outfitters — July 2026" },
  },
};

const intake: Template = {
  ...base("tpl_intake", "Fillable intake form", "Demonstrates interactive AcroForm fields."),
  blocks: [
    { id: "f1", type: "heading", level: 1, text: "{{org}} — Client intake" },
    { id: "f2", type: "text", muted: true, text: "Reference {{reference}} · {{date created}}" },
    { id: "f3", type: "divider" },
    { id: "f4", type: "field", name: "full_name", label: "Full name" },
    { id: "f5", type: "field", name: "email", label: "Email address" },
    { id: "f6", type: "field", name: "company", label: "Company" },
    { id: "f7", type: "field", name: "notes", label: "Project notes", multiline: true, height: 110 },
    { id: "f8", type: "spacer", height: 12 },
    { id: "f9", type: "signature", entries: [{ label: "Signature" }, { label: "Date" }] },
  ],
  sampleData: {
    org: "Northwind Studio",
    reference: "INTAKE-2291",
    created: "2026-08-14",
    doc: { footer: "Client intake — Northwind Studio" },
  },
};

/**
 * Contractor quote. The one template that exercises everything at once: flowing
 * line items, a conditional section (`when`), computed totals with a deposit split,
 * and an acceptance block with real fillable fields so the customer signs the PDF
 * instead of printing it.
 */
const quote: Template = {
  ...base("tpl_quote", "Quote / estimate", "Trade quote with optional upgrades, deposit split and e-signable acceptance."),
  theme: { ...structuredClone(DEFAULT_THEME), accent: "#0f7b5f" },
  page: {
    ...structuredClone(DEFAULT_PAGE),
    footer: {
      enabled: true,
      html: '<span>{{doc.footer}}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>',
    },
  },
  blocks: [
    {
      id: "q1",
      type: "brandbar",
      title: "{{company.name}}",
      subtitle: "{{company.tagline}} · Lic. {{company.license}}",
      meta: [
        { label: "Quote", value: "{{quote_number}}" },
        { label: "Issued", value: '{{date issued "short"}}' },
        { label: "Valid until", value: '{{date valid_until "short"}}' },
      ],
    },
    {
      id: "q2",
      type: "parties",
      left: {
        title: "Prepared by",
        lines: ["{{company.name}}", "{{company.address}}", "{{company.phone}}", "{{company.email}}"],
      },
      right: {
        title: "Prepared for",
        lines: ["{{customer.name}}", "{{customer.address}}", "{{customer.phone}}"],
      },
    },
    {
      id: "q3",
      type: "keyvalue",
      title: "Job details",
      columns: 3,
      rows: [
        { label: "Job site", value: "{{job.site}}" },
        { label: "Type of work", value: "{{job.type}}" },
        { label: "Estimated start", value: '{{date job.start "short"}}' },
        { label: "Duration", value: "{{job.duration}}" },
        { label: "Crew size", value: "{{job.crew}}" },
        { label: "Site contact", value: "{{job.contact}}" },
      ],
    },
    { id: "q4", type: "heading", level: 2, text: "Scope of work" },
    { id: "q5", type: "text", text: "{{scope}}" },
    { id: "q6", type: "heading", level: 2, text: "Pricing" },
    {
      id: "q7",
      type: "table",
      source: "items",
      zebra: true,
      emptyText: "No line items on this quote.",
      columns: [
        { header: "#", path: "@number", width: "5%" },
        { header: "Description", path: "description" },
        { header: "Qty", path: "qty", align: "right", width: "8%", format: "number" },
        { header: "Unit", path: "unit", align: "left", width: "9%" },
        { header: "Rate", path: "rate", align: "right", width: "14%", format: "money" },
        { header: "Amount", path: "amount", align: "right", width: "15%", format: "money" },
      ],
    },
    {
      id: "q8",
      type: "totals",
      rows: [
        { label: "Subtotal", value: '{{money (sum items "amount") currency}}' },
        { label: "Tax ({{tax_rate}}%)", value: "{{money tax currency}}" },
        { label: "Total", value: "{{money total currency}}", strong: true },
      ],
    },
    {
      id: "q9",
      type: "totals",
      when: "deposit",
      rows: [
        { label: "Deposit due to schedule", value: "{{money deposit currency}}" },
        { label: "Balance on completion", value: "{{money balance currency}}" },
      ],
    },
    // Priced separately so alternates never inflate the headline number.
    { id: "q10", type: "heading", level: 2, text: "Optional upgrades", when: "optional_items" },
    {
      id: "q11",
      type: "table",
      source: "optional_items",
      when: "optional_items",
      columns: [
        { header: "Description", path: "description" },
        { header: "Amount", path: "amount", align: "right", width: "18%", format: "money" },
      ],
    },
    {
      id: "q12",
      type: "text",
      when: "optional_items",
      muted: true,
      text: "Optional items are not included in the total above. Initial any you would like added.",
    },
    {
      id: "q13",
      type: "note",
      tone: "accent",
      title: "Terms",
      body: "{{terms}}",
    },
    { id: "q14", type: "note", tone: "warn", title: "Exclusions", body: "{{exclusions}}", when: "exclusions" },
    { id: "q15", type: "heading", level: 2, text: "Acceptance" },
    {
      id: "q16",
      type: "text",
      muted: true,
      text: "Signing below authorises {{company.name}} to perform the work described at the price quoted. This quote expires on {{date valid_until \"long\"}}.",
    },
    { id: "q17", type: "field", name: "accepted_by", label: "Printed name" },
    { id: "q18", type: "field", name: "accepted_date", label: "Date" },
    { id: "q19", type: "signature", entries: [{ label: "Customer signature" }, { label: "{{company.name}}", name: "{{company.rep}}" }] },
  ],
  sampleData: {
    currency: "USD",
    quote_number: "Q-2026-0412",
    issued: "2026-08-14",
    valid_until: "2026-09-13",
    tax_rate: 8.25,
    tax: 1099.73,
    total: 14429.73,
    deposit: 7214.87,
    balance: 7214.86,
    doc: { footer: "Quote Q-2026-0412 · Cedarline Roofing & Exteriors" },
    company: {
      name: "Cedarline Roofing & Exteriors",
      tagline: "Roofing, gutters, siding",
      license: "TX-RC-88421",
      address: "2210 Braker Ln, Austin, TX 78758",
      phone: "(512) 555-0188",
      email: "quotes@cedarline.co",
      rep: "Marcus Vega",
    },
    customer: {
      name: "Priya Raghunathan",
      address: "1408 Willow Bend Dr, Round Rock, TX 78664",
      phone: "(512) 555-0142",
    },
    job: {
      site: "1408 Willow Bend Dr",
      type: "Full roof replacement",
      start: "2026-09-02",
      duration: "3–4 days",
      crew: "6",
      contact: "Priya (owner)",
    },
    scope:
      "Tear off existing three-tab shingles down to the deck and haul away all debris. Inspect and replace damaged decking as needed (billed per sheet, see exclusions). Install synthetic underlayment, ice-and-water shield at all valleys and penetrations, new drip edge, and architectural shingles in the selected colour. Replace all pipe boots and reseal flashing. Magnetic sweep of the property on completion.",
    terms:
      "50% deposit due to schedule; balance due on completion. Workmanship warranted for 10 years; manufacturer warranty on materials is 30 years. Price held for 30 days from issue.",
    exclusions:
      "Decking replacement beyond 4 sheets is billed at $78/sheet. Structural repairs, solar panel detach-and-reset, and permit fees are not included.",
    items: [
      { description: "Tear-off and disposal — 28 squares", qty: 28, unit: "sq", rate: 95, amount: 2660 },
      { description: "Architectural shingles, installed", qty: 28, unit: "sq", rate: 265, amount: 7420 },
      { description: "Synthetic underlayment", qty: 28, unit: "sq", rate: 22, amount: 616 },
      { description: "Ice-and-water shield at valleys", qty: 120, unit: "lf", rate: 6.5, amount: 780 },
      { description: "Drip edge, painted aluminium", qty: 210, unit: "lf", rate: 3.4, amount: 714 },
      { description: "Pipe boots and flashing reseal", qty: 7, unit: "ea", rate: 65, amount: 455 },
      { description: "Dumpster, permits and magnetic sweep", qty: 1, unit: "ea", rate: 685, amount: 685 },
    ],
    optional_items: [
      { description: "Upgrade to Class 4 impact-resistant shingles", amount: 1840 },
      { description: "Replace gutters with 6\" seamless, 140 lf", amount: 2100 },
      { description: "Ridge vent upgrade", amount: 620 },
    ],
  },
};

export const SEED_TEMPLATES: Template[] = [invoice, quote, certificate, report, intake];
