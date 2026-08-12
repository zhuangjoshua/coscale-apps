# SheetSmile — Product & Business Brief

## One-liner
SheetSmile turns Google Sheets into a backend for any website form: point a form at your unique SheetSmile endpoint, and every submission becomes a row in your own spreadsheet — no server, no database, no code changes beyond one URL.

## Business description
SheetSmile is a lightweight form backend and data-collection platform. Websites send form submissions directly into Google Sheets (Notion support on the roadmap) without the site owner building, hosting, or maintaining any server infrastructure. Users connect their Google account once, create a form, and receive a unique endpoint URL. Any form that posts to that URL — hand-written HTML, a React app, a Webflow site, or a form built in SheetSmile's own visual builder — has its submissions validated, spam-filtered, and appended to the connected spreadsheet automatically, with notifications fanning out to email and team chat.

## The problem
A working website form needs far more than the form itself: a server endpoint to receive submissions, a database to store them, validation, spam defense, notification plumbing, and deployment to keep it all running. That's days of engineering for what the user experiences as "a contact form." Meanwhile, the place most small teams actually *want* their data — a spreadsheet they can sort, filter, share, and chart — is disconnected from all of it. SheetSmile deletes the middle: the form talks to SheetSmile, SheetSmile talks to the sheet, and the sheet the customer already understands becomes the database, the admin panel, and the export tool all at once.

## How it works (customer journey)
1. **Connect** — Sign in with Google. One consent screen grants SheetSmile permission to write spreadsheets on your behalf. No passwords stored; revocable anytime from your Google account settings.
2. **Create a form** — Name it and either paste the URL of a sheet you already use, or leave it blank and SheetSmile creates a fresh spreadsheet in your Drive, owned by you.
3. **Wire it up** — three paths:
   - **Have a form already?** Change its `action` attribute to your endpoint URL. Done.
   - **Building from scratch?** Use the drag-and-drop Form Builder and share the hosted page link — no website required.
   - **Somewhere in between?** Paste the iframe embed into your site builder's Embed block, or copy the generated HTML into your codebase and style it with your own CSS.
4. **Collect** — Every submission lands as a spreadsheet row within seconds: headers auto-created, new fields auto-added as columns, timestamp on every row. Notifications hit your inbox and your Slack/Discord channel as they happen.

## Core capabilities (live today)

### Endpoints & data pipeline
- Unique, unguessable endpoint URL per form
- Accepts standard HTML form posts, multipart (file) uploads, and JSON from JavaScript apps — with CORS handled, so it works from any domain
- Smart column mapping: the sheet's header row is created on first submission and matched by field name thereafter; add a field to your form next month and a new column simply appears
- Automatic "Submitted At" timestamp on every row
- Writes to any tab of any sheet you own — or auto-creates the sheet for you
- Submission history in the dashboard with per-submission success/error detail

### Form Builder & distribution
- Visual drag-and-drop builder: 11 field types (short text, paragraph, email, phone, number, dropdown, multiple choice, checkbox, date, file upload, hidden), per-field labels, placeholders, required flags, help text, and options; live preview; drag to reorder
- Four ways to share every built form:
  - **Hosted page** — a clean, mobile-friendly form page on a shareable link; no website needed
  - **iframe embed** — one line for any site builder's Embed block (Squarespace, Webflow, Wix, Carrd, Notion, WordPress); always shows the latest version of the form
  - **HTML export** — generated markup with native validation attributes and spam protection built in; inherits your site's styling
  - **QR code** — downloadable PNG/SVG for flyers, posters, table tents, and event signage; scanning opens the hosted form
- The classic endpoint workflow and the builder coexist: one form can feed a sheet from both a custom on-site form and a hosted link simultaneously

### Notifications & integrations
- Email notification to the form owner on each submission
- Slack and Discord channel notifications via incoming webhooks — formatted messages, set up with a single pasted URL
- Generic webhook support: the same setting posts raw JSON to any URL, making SheetSmile composable with Zapier, Make, n8n, or custom systems
- Custom redirect after submission — send visitors to your own thank-you page, booking link, or offer; per-submission override supported via a hidden `_redirect` field

### Spam & abuse protection
- Honeypot field traps bots silently (they think they succeeded; nothing is written)
- Rate limiting per visitor and per form
- Unsafe redirect blocking, field-count caps, 10 MB file-size cap

### Submission caps & scarcity
- Optional maximum-submission limit per form: the form closes itself automatically — a polite "form closed" page for visitors, a clean API error for programmatic submitters
- Optional public counter on the hosted page ("14 of 20 spots taken", with a progress bar) — built-in urgency for events, giveaways, and limited offers

### File uploads
- Visitors attach files with no account and no login; files are stored in a dedicated folder in the *form owner's* Google Drive with a link placed in the sheet cell

### Data ownership & trust
- Your spreadsheet stays yours: it lives in your Google account, under your sharing settings; SheetSmile stores only a pointer to it plus a submission log
- Access is granted through Google's official OAuth consent and can be revoked at any moment from your Google account's security settings; the dashboard detects revoked access and prompts a one-click reconnect rather than failing silently
- Form visitors get zero access to the sheet — data flows one way

## Roadmap (near-term, honest tense for the website: "coming soon")
- **Autoresponders / confirmation emails** — automatic reply to the person who submitted
- **Notion databases as a destination** alongside Google Sheets
- **Richer special fields** — submitter IP capture, date-only formatting, insert-at-top, per-submission tab routing
- **Composite builder fields** — first/last name, international address, validated phone
- **AI-organized submissions** — auto-categorization, content-based spam scoring, and structured extraction from free-text answers
- **Hosted-page analytics** — views, starts, and completion rate per form
- Teams, templates gallery, payment fields

## Target customers
Developers, freelancers, small businesses, agencies, marketers, creators, and website owners who need to collect and organize form data without building server infrastructure.

**Primary segments and their entry doors:**
- **Developers & indie hackers** → the endpoint. Landing pages, prototypes, static sites (GitHub Pages, Vercel), side projects. They keep their own frontend and skip writing API routes, databases, and auth.
- **No-code site owners** (Webflow, Squarespace, Carrd, Wix) → the embed. Their builder's form either doesn't save data where they want it or charges extra for it.
- **Agencies & freelancers** → both. Ship client sites whose forms feed client-owned sheets — clean handoff, no infrastructure to maintain after the contract.
- **People with no website at all** → the hosted link and QR code. Event signups from a poster, a waitlist from an Instagram bio.

## Typical use cases
Contact forms, lead capture, waitlists, newsletter signups, surveys, job applications (file uploads), event registrations (submission caps + QR), feedback forms (QR on receipts/tables), quote requests, customer onboarding, giveaway entries (caps + counter), and simple internal tools.

## Differentiators
- **Extremely fast setup** — an existing form is live in under a minute; a built form in five
- **The sheet is a first-class citizen** — write into the spreadsheet you already use, with your columns and formulas intact, rather than a rigid auto-generated response sheet
- **Every frontend works** — plain HTML, React/Vue, any site builder, any script or device that can send an HTTP request
- **Distribution built in** — hosted pages, embeds, code export, and QR codes from a single form definition
- **Team-native notifications** — Slack/Discord out of the box, plus open webhooks
- **Scarcity mechanics** — submission caps with public "spots taken" bars, unique in this category
- **No respondent friction** — file uploads and submissions never require the visitor to log into anything

## Competitive positioning
SheetSmile sits between hosted form builders and full backend platforms:
- **vs Google Forms** — Google's form must *be* a Google Form on Google's page with Google's branding, feeding a rigid auto-generated sheet, and file uploads force respondents to log into Google. SheetSmile works with *your* form on *your* site, writes into *your* existing sheet, redirects wherever you want, and never makes visitors log in. (Google Forms remains the right tool for long branching surveys and quizzes — that is deliberately not the fight.)
- **vs form builders (Typeform, Tally)** — they host the form experience and your data lives in their platform, exported on request. SheetSmile inverts it: your frontend, your spreadsheet, and the service is just the pipe.
- **vs building it yourself** — no API routes, database, validation, spam defense, notification plumbing, or deployment. One URL replaces all of it.
- **vs SheetMonkey/Formspree (direct competitors)** — feature parity on the core, plus rate limiting, generic webhooks, QR codes, and scarcity counters they lack; a dashboard-based builder rather than a Chrome-extension dependency.

## Brand positioning
Friendly, simple, lightweight, developer-friendly, approachable, reliable. The name "SheetSmile" reinforces that forms and spreadsheets should feel easy rather than technical. Voice: plain language, short sentences, honest about what things do; show the one-line integration early and often — the `action="…"` swap *is* the brand demo.

## Website structure suggestions
- **Hero:** the before/after form snippet (one attribute changes, highlighted), a "row appears in sheet" animation, and the primary CTA
- **Live demo:** an actual working form on the homepage feeding a public read-only sheet visitors can watch update
- **Three-door section:** "Have a form? / Build one / No website at all" — each audience routed to its integration in one click
- **Integration logos:** Webflow, Squarespace, Carrd, Wix, WordPress, React, plain HTML
- **Trust section:** "Your sheet stays yours" — the ownership/revocation story, prominently
- **Use-case pages** (SEO): one page per use case above, each with a template and platform-specific embed instructions
- **Docs:** quickstart per platform, special-fields reference, webhook payload reference

## Conversion goals
- **Primary:** connect a Google account and create a first form endpoint
- **Secondary:** fire a test submission (the "row appears" moment is the activation event — design onboarding to reach it in under two minutes), integrate an existing site form, explore the builder and share options, upgrade as volume or workflow needs grow

## Pricing shape (suggested, mirrors category norms)
- **Free:** 1–2 forms, ~100 submissions/month, spam protection, Slack/Discord + webhooks, QR codes
- **Pro (~$7–9/mo):** unlimited forms and submissions, file uploads, email notifications at volume, autoresponders when shipped, submission caps/counters
- **Team (later, ~$15–20/mo):** shared workspaces, higher email volume
- Meter *submissions* on free and *notification emails* on paid — sheet writes cost nearly nothing to serve; emails are the real marginal cost

## Current deployment status (internal note — not website copy)
The product is feature-complete per the "live today" list and fully tested locally. Before public launch it still requires: production hosting + domain, a hosted-database swap (SQLite → Postgres/Turso), privacy policy + terms pages, Resend domain verification for email, Google OAuth app verification (removes the unverified-app warning and the 100-user cap; takes days–weeks after filing), and Stripe if pricing ships at launch.
