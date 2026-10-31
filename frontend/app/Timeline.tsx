"use client";
import { useEffect, useState } from "react";
import { API, get, inr } from "./api";
const label: Record<string, string> = { analyze_video: "Analyse video", check_duplicates: "Check duplicates", estimate_repair_cost: "Estimate repair cost",
  draft_complaint: "Draft complaint", file_complaint: "File on portal (Muse Wonder)", schedule_followup: "Schedule follow-up", verify_repair: "Verify repair" };
function summary(t: string, r: any) {
  if (!r || r.error) return r?.error || "";
  if (t === "analyze_video") return `${r.count} hazards · ${Object.entries(r.severity || {}).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(", ")}`;
  if (t === "check_duplicates") return r.duplicates.length ? `${r.duplicates.length} nearby report(s)${r.open_duplicate ? " · one still open" : " · none open"}` : "No duplicates within radius";
  if (t === "estimate_repair_cost") return `${inr(r.total_inr)} across ${r.items.length} sites`;
  if (t === "draft_complaint") return r.subject;
  if (t === "file_complaint") return `${r.fields_filled} fields filled · ${r.stop_reason === "model_done" ? "stopped before Submit" : r.stop_reason}${r.cached ? " (cached)" : ""}`;
  if (t === "schedule_followup") return `Follow-up on ${r.followup_due}`;
  if (t === "verify_repair") return r.before ? `${r.verdict}: ${r.before.count} hazards before, ${r.after.count} after` : `${r.verdict} · ${r.note}`;
  return "";
}
export default function Timeline({ rid, rerides }: { rid: string; rerides: any[] }) {
  const [steps, setSteps] = useState<any[]>([]); const [reride, setReride] = useState("");
  const running = steps.length > 0 && !steps.some(s => s.kind === "done" || s.kind === "error");
  useEffect(() => { const f = () => get(`/reports/${rid}/agent`).then(setSteps).catch(() => {}); f(); const t = setInterval(f, 1500); return () => clearInterval(t); }, [rid]);
  const start = () => fetch(`${API}/reports/${rid}/agent${reride ? `?reride=${reride}` : ""}`, { method: "POST" }).then(() => setSteps([{ kind: "start", text: "Starting…" }]));
  const items: any[] = [];
  steps.forEach(s => { if (s.kind === "tool_result") { const c = [...items].reverse().find(i => i.kind === "tool_call" && i.tool === s.tool && !i.result); if (c) { c.result = s.result; c.t2 = s.t; return; } } items.push({ ...s }); });
  return <div className="card flat stack gap-4">
    <div className="row between"><div><span className="eyebrow">Agent · Muse Spark tool loop</span><h3 style={{ marginTop: 4 }}>Civic agent timeline</h3></div>
      <div className="row"><select value={reride} onChange={e => setReride(e.target.value)}><option value="">No re-ride</option>{rerides.map(x => <option key={x.id} value={x.id}>Re-ride {x.id}</option>)}</select>
        <button className="btn primary" disabled={running} onClick={start}>{running ? "Agent working…" : "Run agent"}</button></div></div>
    <div className="tl">{items.filter(i => i.kind !== "done").map((s, i) => {
      const isCall = s.kind === "tool_call";
      return <div key={i} className={"tl-item" + (s.result ? " res" : "") + (s.kind === "error" || s.result?.error ? " err" : "")}><span className="node" />
        <div className="card sm">
          {isCall ? <><div className="row between"><b>{label[s.tool] || s.tool}</b><span className="tiny">{s.result ? `${((s.t2 - s.t)).toFixed(1)} s` : "running…"}</span></div>
            <p className="mut small" style={{ marginTop: 4 }}>{summary(s.tool, s.result)}</p>
            {s.tool === "file_complaint" && s.result?.screenshot && <img className="media" style={{ marginTop: 10, maxHeight: 260, objectFit: "cover", objectPosition: "top" }} src={API + s.result.screenshot} alt="pre-filled portal" />}</>
            : <><b>{s.kind === "final" ? "Summary" : s.kind === "error" ? "Error" : "Started"}</b><pre className="small" style={{ marginTop: 4 }}>{s.text}</pre></>}
        </div></div>;
    })}{!items.length && <p className="mut">Press Run agent: it analyses, dedups, prices, drafts, pre-fills the portal, and books a 7-day follow-up.</p>}</div>
  </div>;
}
