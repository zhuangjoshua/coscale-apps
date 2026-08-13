// Certificate — the classic B2B2C use case (courses, events, training).
// Uses data-fit: very long names shrink to fit instead of overflowing.
import React from "react";

export const sample = {
  name: "Alexandra Konstantinopoulos-Vandenberg",
  course: "Advanced TypeScript Architecture",
  date: "August 12, 2026",
  signer: "J. Zhuang, Lead Instructor",
};

type Props = { name?: string; course?: string; date?: string; signer?: string };

export default function Certificate({ name = "", course = "", date = "", signer = "" }: Props) {
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#fffdf7",
      border: "18px double #b08d2f", padding: 48, textAlign: "center", color: "#2a2417",
    }}>
      <div style={{ fontSize: 16, letterSpacing: "0.35em", textTransform: "uppercase", color: "#b08d2f" }}>
        Certificate of Completion
      </div>
      <div style={{ fontSize: 20, marginTop: 28, color: "#6b6353" }}>This certifies that</div>
      <div data-fit data-fit-min="24" style={{
        fontSize: 64, fontWeight: 700, marginTop: 12, fontFamily: "Georgia, 'Times New Roman', serif",
        fontStyle: "italic", maxWidth: "90%", maxHeight: 90, overflow: "hidden", whiteSpace: "nowrap",
      }}>{name}</div>
      <div style={{ width: 320, borderBottom: "1px solid #b08d2f", marginTop: 8 }} />
      <div style={{ fontSize: 20, marginTop: 24, color: "#6b6353" }}>has successfully completed</div>
      <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>{course}</div>
      <div style={{ display: "flex", gap: 120, marginTop: 44, fontSize: 16, color: "#6b6353" }}>
        <div>
          <div style={{ borderTop: "1px solid #2a2417", paddingTop: 8, minWidth: 200 }}>{date}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>DATE</div>
        </div>
        <div>
          <div style={{ borderTop: "1px solid #2a2417", paddingTop: 8, minWidth: 200 }}>{signer}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>SIGNATURE</div>
        </div>
      </div>
    </div>
  );
}
