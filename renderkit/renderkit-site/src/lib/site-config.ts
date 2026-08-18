// Local, self-contained site configuration for the RenderKit public site.
// Auth is owned by the express server (/api/auth/login, /api/auth/logout); this
// module only carries the branding + routing values the marketing pages read.

export interface SitePlan {
  planKey?: string;
  priceCents?: number;
  billingInterval?: string;
  includedActionQuota?: number;
  includedAiBudgetMicrousd?: number;
}

export interface SiteRoute {
  path: string;
  label?: string;
}

export interface SiteAuthConfig {
  provider: string;
  configured: boolean;
  redirectPath: string;
}

export interface SiteConfig {
  business: string;
  businessName: string;
  brandAccent: string;
  brandMarkSvg: string;
  brandLogoUrl: string;
  routes: SiteRoute[];
  plans: SitePlan[];
  auth: SiteAuthConfig;
}

export const siteConfig: SiteConfig = {
  business: "renderkit",
  businessName: "RenderKit",
  brandAccent: "#F5A524",
  brandMarkSvg:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#F5A524"/><text x="20" y="27" font-family="Helvetica,Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle">R</text></svg>',
  brandLogoUrl: "",
  routes: [],
  plans: [],
  auth: {
    provider: "renderkit",
    configured: true,
    redirectPath: "/app",
  },
};

/** Server-owned auth endpoints. Full page loads, not client-side routes. */
export const AUTH_LOGIN_URL = "/api/auth/login";
export const AUTH_LOGOUT_URL = "/api/auth/logout";

/** Human-readable "$N/month" label for the default plan. "" when no plan is published. */
export function defaultPlanPriceLabel(): string {
  const plan = siteConfig.plans[0];
  if (!plan) return "";
  const cents = Number(plan.priceCents ?? Number.NaN);
  if (!Number.isFinite(cents)) return "";
  const dollars = cents / 100;
  const amount = Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
  const interval = String(plan.billingInterval ?? "month").trim() || "month";
  return `$${amount}/${interval}`;
}

/** Customer-facing limits derived only from the published plan. Never invents an offer. */
export function defaultPlanLimitLabels(): string[] {
  const plan = siteConfig.plans[0];
  if (!plan) return [];
  const labels: string[] = [];
  const actionQuota = Number(plan.includedActionQuota ?? 0);
  if (Number.isFinite(actionQuota) && actionQuota > 0) {
    labels.push(`${actionQuota.toLocaleString()} product actions per billing period`);
  }
  const aiBudgetMicrousd = Number(plan.includedAiBudgetMicrousd ?? 0);
  if (Number.isFinite(aiBudgetMicrousd) && aiBudgetMicrousd > 0) {
    const dollars = aiBudgetMicrousd / 1_000_000;
    labels.push(
      `${dollars.toLocaleString(undefined, { style: "currency", currency: "USD" })} AI usage allowance per billing period`,
    );
  }
  return labels;
}
