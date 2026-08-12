// Dev stub only. In real products this file is materialized by the platform:
// the platform overwrites the whole _takyon/ directory wholesale at seed/publish
// time with the business's real surface contract and the real runtime client.
// App code must import the kit ONLY through _takyon/ so that swap is invisible.
export const surfaceContext = {
  business: "sheetsmile",
  businessName: "Sheetsmile",
  brandAccent: "#0e7c6b",
  brandMarkSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#0e7c6b"/><text x="20" y="27" font-family="Helvetica,Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle">S</text></svg>',
  runtimeApiBase: "/api/takyon/apps/scaffold-dev",
  frontendApiMode: "prefixed_runtime_api",
  runtimeFeatures: ["auth", "account", "checkout", "generate", "records", "actions"],
  railState: {},
  auth: {
    provider: "supabase",
    configured: false,
    url: "",
    publishableKey: "",
    googleProvider: "google",
    redirectPath: "/app",
  },
  routes: [],
  plans: [],
  shopifyCatalog: [],
};
