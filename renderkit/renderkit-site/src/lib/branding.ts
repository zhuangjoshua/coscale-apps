import { siteConfig } from "./site-config";

export function businessDisplayName(): string {
  const raw = String(siteConfig.businessName || "").trim();
  const parts = raw.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!parts.length) return "Product";
  if (raw === raw.toLowerCase()) {
    return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
  return raw;
}

export function brandAccent(): string {
  return String(siteConfig.brandAccent || "#2563eb");
}

export function brandMarkSvg(): string {
  return String(siteConfig.brandMarkSvg || "");
}

/** "/brand-logo.png" once a real logo has been published into public/, else "". */
export function brandLogoUrl(): string {
  return String(siteConfig.brandLogoUrl || "");
}

export function brandMarkDataUri(): string {
  // Prefer a published logo file; the inline monogram is the deterministic fallback.
  const logo = brandLogoUrl();
  if (logo) return logo;
  const svg = brandMarkSvg();
  if (!svg) return "/favicon.svg";
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
