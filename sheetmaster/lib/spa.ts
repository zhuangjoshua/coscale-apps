import fs from "fs";
import path from "path";

/**
 * Marketing site: the Takyon-built SheetSmile SPA, hosted entirely by this
 * app. The shell lives in lib/spa-index.html and its bundles/images in
 * public/assets and public/proto-assets — no external server needed.
 *
 * To pick up a new Takyon site build, re-copy from the site project's dist/:
 *   cp dist/index.html lib/spa-index.html
 *   cp -r dist/assets/. public/assets/  &&  cp -r dist/proto-assets/. public/proto-assets/
 *
 * The bundle renders a few links we can't fix statically (they're inside the
 * compiled JS), so we inject a click interceptor: legacy .html links become
 * app routes, and dead "#" CTAs (Sign in / Get Started) go to Google sign-in.
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

export function spaResponse(): Response {
  if (!cached) {
    cached = fs
      .readFileSync(SHELL_PATH, "utf8")
      .replace("</body>", `${LINK_FIX_SCRIPT}</body>`);
  }
  return new Response(cached, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
