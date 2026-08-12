import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import AppHeader from "@/app/AppHeader";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "How It Works — SheetSmile",
  description:
    "Connect a Google Sheet, point your form at your endpoint, and watch submissions land as rows. Setup guides and use cases.",
};

const STEPS = [
  {
    n: "1",
    title: "Connect your Google account",
    body: "Sign in with Google — one consent screen, no passwords. Your spreadsheets stay in your account; you can revoke access anytime.",
  },
  {
    n: "2",
    title: "Create a form",
    body: "Name it and paste the URL of a sheet you already use — or leave it blank and SheetSmile creates a fresh spreadsheet in your Drive.",
  },
  {
    n: "3",
    title: "Share it your way",
    body: "Point an existing form at your endpoint URL, build one in the drag-and-drop builder, embed it in your site, or share the hosted link and QR code.",
  },
];

const DOORS = [
  {
    title: "I already have a form",
    body: "Change one attribute — your form's action URL — and every submission becomes a row. Works with plain HTML, React, and any site builder that lets you set a form action.",
    code: '<form action="https://sheetsmile.app/f/abc123" method="POST">',
  },
  {
    title: "I need to build one",
    body: "Use the visual builder: 11 field types, drag to reorder, live preview. Share the hosted page link — no website required — or paste the iframe embed into Squarespace, Webflow, Wix, Carrd, or Notion.",
    code: null,
  },
  {
    title: "I want it in my code",
    body: "Copy the generated HTML (validation and spam protection included) and style it with your own CSS, or POST JSON to the endpoint from any app or script.",
    code: 'fetch("/f/abc123", { method: "POST", body: data })',
  },
];

const USE_CASES = [
  ["Contact forms", "Messages land in a sheet, notifications hit your inbox or Slack."],
  ["Waitlists & signups", "Collect emails from a landing page or link in bio."],
  ["Event registration", "Cap submissions and show a live “spots taken” bar."],
  ["Job applications", "File uploads go straight to your Drive — no login needed."],
  ["Feedback forms", "Print the QR code on receipts, posters, or table tents."],
  ["Giveaways", "Entry limit closes the form automatically when full."],
  ["Quote requests", "Route hot leads to your team's channel via webhooks."],
  ["Internal tools", "Any script or device that can POST can fill a sheet."],
];

function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-line bg-white px-6 py-4">
      <Link
        href="/"
        className="flex items-center gap-2 font-semibold tracking-[0.14em] text-foreground"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          style={{ height: 28, width: "auto" }}
        />
        SheetSmile
      </Link>
      <nav className="flex items-center gap-5 text-sm text-[#3d3a35]">
        <Link href="/" className="hover:text-primary">Home</Link>
        <Link href="/product" className="hover:text-primary">Product</Link>
        <Link href="/pricing" className="hover:text-primary">Pricing</Link>
        <Link href="/faq" className="hover:text-primary">FAQ</Link>
        <Link href="/how-it-works" className="font-medium text-primary">How It Works</Link>
        <a
          href="/api/auth/login"
          className="rounded-full border border-line px-4 py-1.5 hover:border-primary"
        >
          Sign in
        </a>
        <a
          href="/app"
          className="rounded-full bg-primary px-4 py-1.5 font-medium text-white hover:bg-primary-dark"
        >
          Get Started Free
        </a>
      </nav>
    </header>
  );
}

export default async function HowItWorks() {
  const user = await getSessionUser();
  return (
    <main className="min-h-screen bg-[#faf9f7]">
      {user ? (
        <AppHeader email={user.email} active="how-it-works" />
      ) : (
        <SiteHeader />
      )}

      <div className="mx-auto max-w-4xl px-4 py-14">
        <h1 className="text-4xl font-bold text-foreground">How it works</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          SheetSmile is the backend your form is missing: submissions go to
          your unique endpoint, and we write them into your Google Sheet.
          Set up takes about two minutes.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-brand border border-line bg-white p-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {s.n}
              </div>
              <h2 className="mt-4 font-semibold text-foreground">{s.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-16 text-2xl font-bold text-foreground">
          Three ways to connect
        </h2>
        <div className="mt-6 space-y-4">
          {DOORS.map((d) => (
            <div key={d.title} className="rounded-brand border border-line bg-white p-6">
              <h3 className="font-semibold text-foreground">{d.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d.body}</p>
              {d.code && (
                <pre className="mt-3 overflow-x-auto rounded-brand bg-[#1a1815] p-3 text-xs text-[#7fd6c7]">
                  {d.code}
                </pre>
              )}
            </div>
          ))}
        </div>

        <h2 className="mt-16 text-2xl font-bold text-foreground">
          What people use it for
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {USE_CASES.map(([title, body]) => (
            <div key={title} className="rounded-brand border border-line bg-white p-5">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        {!user && (
          <div className="mt-16 rounded-brand border border-line bg-white p-8 text-center">
            <h2 className="text-2xl font-bold text-foreground">
              See a row appear in your sheet in the next two minutes
            </h2>
            <a
              href="/app"
              className="mt-5 inline-block rounded-full bg-primary px-6 py-2.5 font-medium text-white hover:bg-primary-dark"
            >
              Get Started Free
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
