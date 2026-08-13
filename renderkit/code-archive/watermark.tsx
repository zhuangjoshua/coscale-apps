// Watermark / lower-third overlay — renders TRANSPARENT, made for /video/overlay.
import React from "react";

export const sample = {
  brand: "renderkit",
  handle: "@renderkit",
  label: "DEMO",
};

type Props = { brand?: string; handle?: string; label?: string };

export default function Watermark({ brand = "", handle = "", label }: Props) {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {label ? (
        <div style={{
          position: "absolute", top: 28, right: 28, background: "rgba(229,72,77,0.92)",
          color: "#fff", borderRadius: 8, padding: "8px 18px", fontSize: 22, fontWeight: 800,
          letterSpacing: "0.08em",
        }}>{label}</div>
      ) : null}
      <div style={{
        position: "absolute", left: 28, bottom: 28, display: "flex", alignItems: "center",
        gap: 14, background: "rgba(10,12,16,0.72)", borderRadius: 12, padding: "12px 22px",
      }}>
        <div style={{ width: 12, height: 12, borderRadius: 999, background: "#4da3ff" }} />
        <div style={{ color: "#fff", fontSize: 24, fontWeight: 800 }}>{brand}</div>
        <div style={{ color: "#9fb3cc", fontSize: 20 }}>{handle}</div>
      </div>
    </div>
  );
}
