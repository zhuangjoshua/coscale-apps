import fs from "fs";
import path from "path";

/**
 * Serves the Takyon-built SheetSmile marketing SPA (React, client-routed).
 * The shell HTML is a snapshot copied from the Takyon site's dist/; assets
 * live under public/assets and public/proto-assets.
 *
 * The bundle renders a few links we can't rewrite statically (they're inside
 * the compiled JS), so we inject a click interceptor that fixes them at
 * runtime: legacy .html links become app routes, and dead "#" CTAs (Sign in /
 * Get Started) go to the real Google sign-in.
 */

const SHELL_PATH = path.join(process.cwd(), "lib", "spa-index.html");

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

let cached: string | null = null;

export function loadSpaShell(): string {
  if (cached) return cached;
  let html = fs.readFileSync(SHELL_PATH, "utf8");
  html = html.replace("</body>", `${LINK_FIX_SCRIPT}</body>`);
  cached = html;
  return html;
}

export function spaResponse(): Response {
  return new Response(loadSpaShell(), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
