// Classic OG/social card — the @vercel/og use case, running on our engine.
import React from "react";

export const sample = {
  title: "Renderkit ships its first render",
  author: "Josh",
  tag: "changelog",
};

type Props = { title?: string; author?: string; tag?: string };

export default function OgCard({ title = "Untitled", author = "", tag = "" }: Props) {
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      justifyContent: "space-between", padding: 64,
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%)",
      color: "#f8fafc",
    }}>
      {tag ? (
        <div style={{
          alignSelf: "flex-start", border: "1px solid #64748b", borderRadius: 999,
          padding: "8px 20px", fontSize: 20, color: "#cbd5e1", letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}>{tag}</div>
      ) : <div />}
      <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
        {title}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 24, color: "#94a3b8" }}>{author}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#38bdf8" }}>renderkit</div>
      </div>
    </div>
  );
}
