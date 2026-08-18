import { useViewerAccess } from "../lib/hooks";
import { prototypeLandingHtml } from "../prototype-landing-html";
import "../prototype-landing.css";

export function LandingScreen() {
  const access = useViewerAccess();
  return (
    <main className="min-h-screen" aria-busy={access.loading || undefined}>
      <div dangerouslySetInnerHTML={{ __html: prototypeLandingHtml }} />
    </main>
  );
}
