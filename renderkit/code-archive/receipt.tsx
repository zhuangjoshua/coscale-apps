// The thesis demo: layout that ADAPTS to the data.
// N items => N rows. discount present => badge appears. No variants needed.
import React from "react";

export const sample = {
  customer: "John Appleseed",
  items: [
    { name: "Espresso Machine", price: "$429.00" },
    { name: "Grinder", price: "$189.00" },
    { name: "Filter Pack", price: "$12.50" },
  ],
  total: "$630.50",
  discount: 15,
};

type Item = { name: string; price: string };
type Props = {
  customer?: string;
  items?: Item[];
  total?: string;
  discount?: number; // percent, optional
};

export default function Receipt({ customer = "Customer", items = [], total = "", discount }: Props) {
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      background: "#f6f4ef", padding: 56, color: "#1a1a1a",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em" }}>ACME SUPPLY CO.</div>
          <div style={{ fontSize: 18, color: "#666", marginTop: 6 }}>Receipt for {customer}</div>
        </div>
        {discount ? (
          <div style={{
            background: "#c8442c", color: "#fff", borderRadius: 999,
            padding: "10px 22px", fontSize: 20, fontWeight: 700,
          }}>−{discount}% applied</div>
        ) : null}
      </div>

      <div style={{ marginTop: 40, borderTop: "2px solid #1a1a1a", flex: 1 }}>
        {items.map((it, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between",
            padding: "16px 0", borderBottom: "1px solid #d9d5cc", fontSize: 22,
          }}>
            <span>{it.name}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{it.price}</span>
          </div>
        ))}
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between",
        paddingTop: 24, fontSize: 30, fontWeight: 700,
      }}>
        <span>Total</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{total}</span>
      </div>
    </div>
  );
}
