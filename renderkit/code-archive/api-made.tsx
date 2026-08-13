import React from "react";
export const sample = { msg: "Created via API" };
export default function T({ msg }: { msg?: string }) {
  return <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#123", color: "#fff", fontSize: 56, fontWeight: 800 }}>{msg}</div>;
}