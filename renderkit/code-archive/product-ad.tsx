// Product ad banner — remote product image, price, optional sale flash.
// The ecommerce use case: regenerate every banner when prices change.
import React from "react";

export const sample = {
  product: "Aeron Task Chair",
  price: "$1,195",
  was: "$1,395",
  image: "https://picsum.photos/seed/chair/800/800",
  cta: "Free shipping this week",
};

type Props = { product?: string; price?: string; was?: string; image?: string; cta?: string };

export default function ProductAd({ product = "", price = "", was, image, cta }: Props) {
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", background: "#0f0f10", color: "#fff",
    }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: 56 }}>
        {was ? (
          <div style={{
            alignSelf: "flex-start", background: "#e5484d", borderRadius: 6,
            padding: "6px 14px", fontSize: 18, fontWeight: 800, letterSpacing: "0.04em",
          }}>SALE</div>
        ) : null}
        <div data-fit data-fit-min="28" style={{
          fontSize: 54, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 18,
          maxHeight: 130, overflow: "hidden",
        }}>{product}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 18 }}>
          <div style={{ fontSize: 46, fontWeight: 800, color: "#4da3ff" }}>{price}</div>
          {was ? <div style={{ fontSize: 26, color: "#8b93a5", textDecoration: "line-through" }}>{was}</div> : null}
        </div>
        {cta ? <div style={{ fontSize: 20, color: "#c2c8d4", marginTop: 22 }}>{cta}</div> : null}
      </div>
      {image ? (
        <div style={{ width: "42%", overflow: "hidden" }}>
          <img src={image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ) : null}
    </div>
  );
}
