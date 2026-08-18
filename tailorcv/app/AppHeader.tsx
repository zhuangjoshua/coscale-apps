import Link from "next/link";
import { logout } from "@/app/actions";
import { siteUrl } from "@/lib/email";

/** Signed-in header, styled after the marketing site's nav bar. */
export default function AppHeader({
  email,
  active,
}: {
  email: string;
  active?: "dashboard" | "resume";
}) {
  const tab = (href: string, label: string, key: string) => (
    <Link
      href={href}
      className={
        active === key
          ? "font-medium text-foreground"
          : "text-muted-foreground transition-colors hover:text-foreground"
      }
    >
      {label}
    </Link>
  );
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-8">
          <a
            href={siteUrl()}
            className="flex items-center gap-2 text-[0.95rem] font-medium tracking-[0.08em]"
          >
            <img src="/brand-logo.png" alt="" className="h-8 w-auto" />
            TailorCV
          </a>
          <nav className="flex gap-5 text-sm">
            {tab("/dashboard", "Applications", "dashboard")}
            {tab("/resume/master", "Master resume", "resume")}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-muted-foreground sm:inline">{email}</span>
          <form action={logout}>
            <button className="btn btn-outline px-3.5 py-1.5 text-sm">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
