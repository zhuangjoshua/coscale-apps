import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { installInteractionSounds } from "./lib/interaction-sounds";
import { ProductAuthProvider } from "./lib/product-auth";
import { LandingScreen } from "./screens/landing";

// /app is served by the express server, not by this SPA. Links to it are plain
// anchors so the browser does a full page load and the server takes over.

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

const container = document.getElementById("root");
if (!container) throw new Error("root element missing");

installInteractionSounds();

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <ProductAuthProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<LandingScreen />} />
            <Route path="/faq" element={<FaqScreen />} />
            <Route path="/pricing" element={<PricingScreen />} />
            <Route path="/privacy" element={<PrivacyScreen />} />
            <Route path="/terms" element={<TermsScreen />} />
            <Route path="/product" element={<ProductScreen />} />
            <Route path="/blog" element={<BlogScreen />} />
            <Route path="/articles" element={<ArticlesScreen />} />
          </Routes>
        </Suspense>
      </ProductAuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
