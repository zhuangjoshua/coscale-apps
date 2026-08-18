import { brandMarkDataUri, businessDisplayName } from "./branding";
import type { ViewerAccessResult } from "./hooks";
import { useProductAuth } from "./product-auth";

export type PublicSiteHeaderAccess = Pick<ViewerAccessResult, "authenticated" | "loading">;

export interface PublicNavigationItem {
  href: string;
  label: string;
}

export function usePublicSiteNavigation(access: PublicSiteHeaderAccess) {
  const auth = useProductAuth();

  return {
    access,
    productName: businessDisplayName(),
    brandMarkSrc: brandMarkDataUri(),
    homeHref: "/",
    publicItems: [
      { href: "/", label: "Home" },
      { href: "/pricing", label: "Pricing" },
      { href: "/faq", label: "FAQ" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ] satisfies PublicNavigationItem[],
    // Server-owned (/app): rendered as plain anchors so they leave the SPA.
    accountItems: [{ href: "/app", label: "App" }] satisfies PublicNavigationItem[],
    authBusy: auth.busy,
    authDisabled: !auth.available || !auth.configured || auth.busy,
    logIn: auth.signInWithGoogle,
    signUp: auth.signUpWithGoogle,
    signOut: auth.logout,
  };
}
