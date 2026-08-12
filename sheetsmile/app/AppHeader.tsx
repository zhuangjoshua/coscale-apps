import Link from "next/link";

/** Header for signed-in pages: brand, app tabs, account controls. */
export default function AppHeader({
  email,
  active,
}: {
  email: string;
  active: "dashboard" | "how-it-works";
}) {
  const tab = (isActive: boolean) =>
    `rounded-full px-4 py-1.5 text-sm ${
      isActive
        ? "bg-primary font-medium text-white"
        : "text-[#3d3a35] hover:text-primary"
    }`;

  return (
    <header className="flex items-center justify-between border-b border-line bg-white px-6 py-3">
      <div className="flex items-center gap-6">
        <Link
          href="/dashboard"
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
        <nav className="flex items-center gap-1">
          <Link href="/dashboard" className={tab(active === "dashboard")}>
            Dashboard
          </Link>
          <Link href="/how-it-works" className={tab(active === "how-it-works")}>
            How It Works
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        {email}
        <a
          href="/api/auth/logout"
          className="rounded-full border border-line px-4 py-1.5 text-[#3d3a35] hover:border-primary hover:text-primary"
        >
          Sign out
        </a>
      </div>
    </header>
  );
}
