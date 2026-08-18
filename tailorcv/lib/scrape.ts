import dns from "dns/promises";
import net from "net";

/**
 * Fetch a job posting URL with headless Chromium (handles JS-rendered
 * boards) and return its visible text, trimmed for prompting.
 */
export async function fetchJobPosting(rawUrl: string): Promise<string> {
  const url = new URL(rawUrl.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) links are supported");
  }
  await assertPublicHost(url.hostname);

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    });

    // SSRF guard, part 2: the initial check above covers the URL the user
    // typed, but the page can redirect or load subresources anywhere. Vet
    // every request Chromium is about to make (resolving at request time
    // also defeats DNS rebinding). Chromium follows redirects on its own —
    // both after route.continue() and after fulfilling a 3xx — without
    // re-invoking this handler, so we follow the chain ourselves, checking
    // each hop, and hand the browser only the final response.
    const hostCache = new Map<string, Promise<boolean>>();
    const hostOk = (hostname: string) => {
      let p = hostCache.get(hostname);
      if (!p) {
        p = assertPublicHost(hostname).then(() => true, () => false);
        hostCache.set(hostname, p);
      }
      return p;
    };
    const publicUrl = async (raw: string): Promise<URL | null> => {
      try {
        const u = new URL(raw);
        if (u.protocol !== "http:" && u.protocol !== "https:") return null;
        return (await hostOk(u.hostname)) ? u : null;
      } catch {
        return null;
      }
    };
    await context.route("**/*", async (route) => {
      let u = await publicUrl(route.request().url());
      if (!u) return route.abort();
      try {
        for (let hop = 0; hop < 10; hop++) {
          const response = await route.fetch({ url: u.href, maxRedirects: 0 });
          const status = response.status();
          const location = response.headers()["location"];
          if (status < 300 || status >= 400 || !location) {
            return route.fulfill({ response });
          }
          u = await publicUrl(new URL(location, u).href);
          if (!u) return route.abort();
        }
        return route.abort(); // redirect loop
      } catch {
        return route.abort();
      }
    });

    const page = await context.newPage();
    // Bound the whole crawl so a slow board can't pin the request.
    page.setDefaultTimeout(20000);
    const resp = await page
      .goto(url.href, { waitUntil: "domcontentloaded", timeout: 20000 })
      .catch((e: Error) => {
        if (/ERR_FAILED|ERR_ABORTED/.test(e.message)) {
          throw new Error("That link couldn't be crawled (it redirects somewhere we don't allow)");
        }
        if (/Timeout/i.test(e.message)) {
          throw new Error("That page took too long to load — paste the job description instead");
        }
        throw e;
      });
    if (!resp) throw new Error("That page couldn't be loaded");
    // Give client-rendered boards a beat to paint the description.
    await page.waitForTimeout(2500);
    const text = await page.evaluate(() => {
      // Prefer the main content region when the page marks one.
      const root =
        document.querySelector("main") ||
        document.querySelector("article") ||
        document.body;
      return (root as HTMLElement).innerText;
    });
    const cleaned = text
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 20000);
    if (cleaned.length < 200) {
      throw new Error(
        "Couldn't read a job description from that page (it may require sign-in)"
      );
    }
    return cleaned;
  } finally {
    await browser.close();
  }
}

/** True for loopback, private, link-local, CGNAT, multicast, or unspecified. */
export function isPrivateAddress(ip: string): boolean {
  let v4 = ip;
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === "::" || low === "::1") return true;
    if (low.startsWith("fe8") || low.startsWith("fe9") || low.startsWith("fea") || low.startsWith("feb")) return true; // link-local
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // ULA
    if (low.startsWith("ff")) return true; // multicast
    // IPv4-mapped (::ffff:a.b.c.d) — fall through to the v4 rules.
    const m = low.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (!m) return false;
    v4 = m[1];
  }
  const parts = v4.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true; // malformed → refuse
  const [a, b] = parts;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast + reserved
  );
}

/** SSRF guard: refuse localhost/private/link-local targets. */
export async function assertPublicHost(hostname: string) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost")) {
    throw new Error("That address can't be crawled");
  }
  if (net.isIP(h)) {
    if (isPrivateAddress(h)) throw new Error("That address can't be crawled");
    return;
  }
  const addrs = await dns.lookup(h, { all: true }).catch(() => []);
  if (addrs.length === 0) throw new Error("Couldn't resolve that link");
  if (addrs.some((a) => isPrivateAddress(a.address))) {
    throw new Error("That address can't be crawled");
  }
}
