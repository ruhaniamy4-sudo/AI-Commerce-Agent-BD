import { ImageResponse } from "next/og";

export const alt = "SellPilot — AI Sales Agent for Bangladesh Commerce";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "#07101f", color: "white", fontFamily: "Arial, sans-serif", padding: 72 }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", backgroundImage: "linear-gradient(rgba(96,165,250,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(96,165,250,.08) 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
      <div style={{ position: "absolute", width: 520, height: 520, borderRadius: 999, background: "#2563eb", filter: "blur(120px)", opacity: .28, right: -100, top: -140 }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", zIndex: 2, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, fontWeight: 700 }}><span style={{ width: 58, height: 58, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 18, background: "linear-gradient(145deg,#3b82f6,#2563eb 65%,#7c3aed)", fontSize: 18 }}>SP</span>SellPilot</div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 900 }}><span style={{ color: "#67e8f9", fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>AI SALES AGENT FOR BANGLADESH COMMERCE</span><h1 style={{ margin: "24px 0 18px", fontSize: 72, lineHeight: 1.02, letterSpacing: -4 }}>Turn customer conversations into organized sales workflows.</h1><p style={{ margin: 0, color: "#a7b4c7", fontSize: 28 }}>Messenger · Website Chat · Human control</p></div>
      </div>
    </div>,
    size,
  );
}
