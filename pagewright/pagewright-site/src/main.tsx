import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { ActionErrorAnnouncer } from "./components/action-error-announcer";
import { SubscriptionCancellation } from "./components/subscription-cancellation";
import { installInteractionSounds } from "./lib/interaction-sounds";
import { ProductAuthProvider } from "./lib/product-auth";
import { SessionProvider } from "./lib/session";
import { LandingScreen } from "./screens/landing";
// Not lazy: the store lives on the landing chunk already (StoreSection is rendered inline on the
// landing page), so a separate lazy chunk for /store would never be split out anyway.
import { StoreScreen } from "./screens/store";

// Signing in lands on the editor — it is the product. The old app-home overview stays
// reachable at /app/overview rather than sitting between the user and their documents.
const EditorScreen = lazy(() =>
  import("./screens/editor").then((m) => ({ default: m.EditorScreen })),
);
const AppHomeScreen = lazy(() =>
  import("./screens/app-home").then((m) => ({ default: m.AppHomeScreen })),
);
const AppLayout = lazy(() =>
  import("./screens/app-layout").then((m) => ({ default: m.AppLayout })),
);
const ProductScreen = lazy(() =>
  import("./screens/support").then((m) => ({ default: m.ProductScreen })),
);
const BlogScreen = lazy(() =>
  import("./screens/support").then((m) => ({ default: m.BlogScreen })),
);
const ArticlesScreen = lazy(() =>
  import("./screens/support").then((m) => ({ default: m.ArticlesScreen })),
);
const FaqScreen = lazy(() =>
  import("./screens/support").then((m) => ({ default: m.FaqScreen })),
);
const PrivacyScreen = lazy(() =>
  import("./screens/support").then((m) => ({ default: m.PrivacyScreen })),
);
const PricingScreen = lazy(() =>
  import("./screens/support").then((m) => ({ default: m.PricingScreen })),
);
const TermsScreen = lazy(() =>
  import("./screens/support").then((m) => ({ default: m.TermsScreen })),
);
const ProfileScreen = lazy(() =>
  import("./screens/profile").then((m) => ({ default: m.ProfileScreen })),
);

function AccountRoute() {
  return (
    <div className="grid gap-6">
      <ProfileScreen />
      <SubscriptionCancellation />
    </div>
  );
}

const container = document.getElementById("root");
if (!container) throw new Error("root element missing");

installInteractionSounds();

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
      <ProductAuthProvider>
        <ActionErrorAnnouncer />
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<LandingScreen />} />
            <Route path="/store" element={<StoreScreen />} />
            <Route path="/faq" element={<FaqScreen />} />
            <Route path="/pricing" element={<PricingScreen />} />
            <Route path="/privacy" element={<PrivacyScreen />} />
            <Route path="/terms" element={<TermsScreen />} />
            <Route path="/product" element={<ProductScreen />} />
            <Route path="/blog" element={<BlogScreen />} />
            <Route path="/articles" element={<ArticlesScreen />} />
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<EditorScreen />} />
              <Route path="overview" element={<AppHomeScreen />} />
              <Route path="profile" element={<AccountRoute />} />
            </Route>
            {/* Ungated editor for local work when Supabase auth isn't configured.
                `import.meta.env.DEV` is statically false in a production build, so
                Rollup drops this branch — it cannot ship. */}
            {import.meta.env.DEV ? (
              <Route
                path="/dev/editor"
                element={
                  <div className="mx-auto max-w-[1600px] p-4">
                    <EditorScreen />
                  </div>
                }
              />
            ) : null}
          </Routes>
        </Suspense>
      </ProductAuthProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
