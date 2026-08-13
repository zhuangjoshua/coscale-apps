// Quote / testimonial card — square-friendly, long quotes auto-fit.
import React from "react";

export const sample = {
  quote: "We replaced four hours of manual banner work a week with one API call.",
  author: "Sam Ortiz",
  role: "Head of Growth, Nightjar",
  stars: 5,
};

type Props = { quote?: string; author?: string; role?: string; stars?: number };

export default function QuoteCard({ quote = "", author = "", role = "", stars = 0 }: Props) {
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      justifyContent: "space-between", padding: 64,
      background: "linear-gradient(160deg, #101418 0%, #1a2129 100%)", color: "#eef2f7",
    }}>
      <div style={{ fontSize: 120, lineHeight: 0.6, color: "#4da3ff", fontFamily: "Georgia, serif" }}>“</div>
      <div data-fit data-fit-min="20" style={{
        fontSize: 44, fontWeight: 600, lineHeight: 1.25, letterSpacing: "-0.01em",
        maxHeight: "55%", overflow: "hidden",
      }}>{quote}</div>
      <div>
        {stars ? (
          <div style={{ color: "#f5b83d", fontSize: 28, letterSpacing: "0.1em", marginBottom: 14 }}>
            {"★".repeat(Math.max(0, Math.min(5, stars)))}
          </div>
        ) : null}
        <div style={{ fontSize: 24, fontWeight: 700 }}>{author}</div>
        <div style={{ fontSize: 19, color: "#8b93a5", marginTop: 4 }}>{role}</div>
      </div>
    </div>
  );
}
