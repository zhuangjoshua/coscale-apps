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
  else if (href === "#" && /how it works/i.test(text)) {
    e.preventDefault(); location.href = "/how-it-works";
  }
  else if (href === "#" && /sign in|get started/i.test(text)) {
    e.preventDefault(); location.href = "/api/auth/login";
  }
}, true);

// Put the logo next to the brand wordmark in the site's header and footer.
// React re-renders can wipe injected nodes, so re-apply on DOM changes.
function smAddLogo() {
  document.querySelectorAll(".brand, .footer-brand").forEach(function (el) {
    if (el.querySelector("[data-sm-logo]")) return;
    var img = document.createElement("img");
    img.src = "/logo.png";
    img.alt = "";
    img.setAttribute("data-sm-logo", "1");
    img.style.cssText =
      "height:1.5em;width:auto;vertical-align:-0.35em;margin-right:0.5em;display:inline-block";
    el.prepend(img);
  });
}
new MutationObserver(smAddLogo).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
smAddLogo();
</script>`;

let cached: string | null = null;

export function spaResponse(): Response {
  if (!cached) {
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    cached = fs
      .readFileSync(SHELL_PATH, "utf8")
      // The shell was built with the site preview's origin baked into its SEO
      // tags (canonical, og:url, og:image, JSON-LD). Point them at this
      // deployment instead so they are correct on any domain.
      .replaceAll("http://localhost:8833brand-logo.png", `${appUrl}/logo.png`)
      .replaceAll("http://localhost:8833", appUrl)
      // The Takyon shell points at a favicon.svg we don't ship. Swap in the
      // real icons — Safari needs a genuine .ico and honours explicit tags.
      // Icon URL is versioned: Safari caches favicons by URL and will not
      // re-request a path it already has, so bump the filename to force it.
      .replace(
        '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
        '<link rel="icon" type="image/png" sizes="256x256" href="/sheetsmile-icon-v3.png" />'
      )
      .replace(
        '<link rel="apple-touch-icon" href="/favicon.svg" />',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />'
      )
      .replaceAll('href="/favicon.svg"', 'href="/favicon.ico"')
      .replaceAll("Sheetsmile", "SheetSmile")
      .replace("</body>", `${LINK_FIX_SCRIPT}</body>`);
  }
  return new Response(cached, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
