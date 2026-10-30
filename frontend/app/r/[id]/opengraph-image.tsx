import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { load, summary, API_IN } from "./data";
export const runtime = "nodejs";
const font = async () => { const d = path.join(process.cwd(), "assets");
  return [{ name: "DV", data: await readFile(path.join(d, "DejaVuSans.ttf")), weight: 400 as const, style: "normal" as const },
          { name: "DV", data: await readFile(path.join(d, "DejaVuSans-Bold.ttf")), weight: 700 as const, style: "normal" as const }]; };
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Gaadi Guru road report";
const SC: Record<string, [string, string]> = { CRITICAL: ["#f8e2e1", "#b23a36"], HIGH: ["#f9eada", "#a85d17"], MEDIUM: ["#f5eed2", "#7f6409"], LOW: ["#dcefe4", "#2d6e4c"] };
const ST: Record<string, string> = { reported: "Reported", filed: "Complaint filed", promised: "Waiting for repair", fixed: "Fixed" };
export default async function OG({ params }: { params: { id: string } }) {
  const r = await load(params.id);
  if (!r) return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#eef0f3", fontSize: 64, fontWeight: 700, color: "#1c2230" }}>Gaadi Guru</div>, size);
  const s = summary(r); const inr = "₹" + Math.round(s.total).toLocaleString("en-IN");
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#eef0f3", padding: 48, gap: 40, fontFamily: "DV", color: "#1c2230" }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 700 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "#3f6fd8", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>G</div>Gaadi Guru</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 28, color: "#566072", display: "flex" }}>{s.ward}</div>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.04, letterSpacing: -3, display: "flex" }}>{`${s.n} road hazards reported`}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{s.sev.map(([k, v]) => <div key={k} style={{ display: "flex", padding: "10px 20px", borderRadius: 999, background: SC[k][0], color: SC[k][1], fontSize: 26, fontWeight: 700 }}>{`${v} ${k.toLowerCase()}`}</div>)}</div>
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 22, flexWrap: "wrap", maxWidth: 560 }}>
          <div style={{ display: "flex", padding: "10px 18px", flexShrink: 0, borderRadius: 18, background: "#fff", fontWeight: 700 }}>{`Fix ≈ ${inr}`}</div>
          <div style={{ display: "flex", padding: "10px 18px", flexShrink: 0, borderRadius: 18, background: s.status === "fixed" ? "#dcefe4" : "#fff", fontWeight: 600, color: "#566072" }}>{ST[s.status] || s.status}</div>
          {s.verdict && <div style={{ display: "flex", padding: "10px 18px", flexShrink: 0, borderRadius: 18, background: "#fff", fontWeight: 600, color: "#566072" }}>{`Re-ride: ${s.verdict.split(" (")[0].toLowerCase()}`}</div>}
        </div>
      </div>
      {s.img && <div style={{ display: "flex", width: 420, borderRadius: 28, overflow: "hidden", background: "#fff", padding: 10 }}>
        <img src={API_IN + s.img} width={400} height={514} style={{ objectFit: "cover", borderRadius: 20 }} /></div>}
    </div>, { ...size, fonts: await font() });
}
