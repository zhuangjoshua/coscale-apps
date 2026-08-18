import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

// The marketing site sets body copy in Avenir Next → Montserrat → Segoe UI.
// Avenir Next ships with macOS/iOS; Montserrat is the cross-platform fallback.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TailorCV — one resume, tailored for every job",
  description:
    "Tell us what you've done once. We build your professional resume and tailor it for every job you apply to — without ever inventing a word.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
