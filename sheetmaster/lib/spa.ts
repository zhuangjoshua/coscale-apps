import fs from "fs";
import path from "path";

/**
 * Marketing site: live-proxied from the Takyon preview server (port 8833).
 * Every request fetches the current shell from 8833, so Takyon rebuilds show
 * up immediately — no snapshot re-sync. If 8833 is down, we fall back to the
 * last snapshot in lib/spa-index.html.
 *
 * The bundle renders a few links we can't fix statically (they're inside the
 * compiled JS), so we inject a click interceptor: legacy .html links become
 * app routes, and dead "#" CTAs (Sign in / Get Started) go to Google sign-in.
 */

const MARKETING_ORIGIN =
  process.env.MARKETING_ORIGIN || "http://localhost:8833";

const FALLBACK_SHELL = path.join(process.cwd(), "lib", "spa-index.html");

const LINK_FIX_SCRIPT = `<script>
document.addEventListener("click", function (e) {
  var a = e.target && e.target.closest ? e.target.closest("a") : null;
  if (!a) return;
  var href = a.getAttribute("href") || "";
  var text = (a.textContent || "").trim();
  if (href === "product.html") { e.preventDefault(); location.href = "/product"; }
  else if (href === "blog.html") { e.preventDefault(); location.href = "/blog"; }
  else if (href === "#" && /sign in|get started/i.test(text)) {
    e.preventDefault(); location.href = "/api/auth/login";
  }
}, true);
</script>`;

async function loadShell(): Promise<string> {
  try {
    const res = await fetch(`${MARKETING_ORIGIN}/`, { cache: "no-store" });
    if (res.ok) return await res.text();
  } catch {
    /* preview server down — use snapshot */
  }
  return fs.readFileSync(FALLBACK_SHELL, "utf8");
}

export async function spaResponse(): Promise<Response> {
  const html = (await loadShell()).replace(
    "</body>",
    `${LINK_FIX_SCRIPT}</body>`
  );
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
