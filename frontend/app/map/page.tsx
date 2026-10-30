"use client";
import { useEffect, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { API, get, inr } from "../api";
import { useT, HOWBAD } from "../i18n";
const HotMap = dynamic(() => import("../HotMap"), { ssr: false });
function M() {
  const { t, lang } = useT(); const q = useSearchParams(); const [tab, setTab] = useState(q.get("tab") || "map");
  const [pts, setPts] = useState<any[]>([]); const [rows, setRows] = useState<any[]>([]); const [lb, setLb] = useState<any[]>([]);
  useEffect(() => { get("/reports").then(setPts); get("/repairs").then(setRows); get("/leaderboard").then(setLb); }, []);
  const COLS: [string, string][] = lang === "hi" ? [["reported", "रिपोर्ट हुआ"], ["filed", "शिकायत भरी"], ["promised", "मरम्मत का इंतज़ार"], ["fixed", "ठीक हुआ"]] : [["reported", "Reported"], ["filed", "Complaint filled"], ["promised", "Waiting for repair"], ["fixed", "Fixed (checked)"]];
  return <main className="wrap stack" style={{ gap: 20, paddingTop: 12 }}>
    <h1 className="h-page">{t("map")}</h1>
    <div className="tabs" role="tablist">{([["map", "tabMap"], ["board", "tabBoard"], ["lb", "tabLb"]] as const).map(([k, l]) =>
      <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t(l)}</button>)}</div>
    {tab === "map" && <><div className="card" style={{ padding: 12 }}><HotMap points={pts} height={520} /></div>
      <div className="row">{["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(s => <span key={s} className={"pill " + s}>{HOWBAD[s][lang === "hi" ? 1 : 0]}</span>)}</div></>}
    {tab === "board" && <div className="g4">{COLS.map(([k, ttl]) => <div key={k} className="well stack" style={{ gap: 12, minHeight: 160 }}>
      <div className="row between"><b>{ttl}</b><span className="pill">{rows.filter(r => r.status === k).length}</span></div>
      {rows.filter(r => r.status === k).map(r => <a key={r.id} href={`/report?id=${r.id}`} className="card sm stack" style={{ gap: 6, padding: 12 }}>
        {r.thumb && <img className="media" style={{ height: 84, objectFit: "cover" }} src={API + r.thumb} alt="" />}
        <b style={{ fontSize: 14 }}>{r.ward}</b><span className="tiny">{r.count} {t("found")} · {inr(r.repair_total_inr)}{r.upvotes ? ` · 👍 ${r.upvotes}` : ""}</span>
        {r.followup_due && <span className="tiny">🔔 {r.followup_due}</span>}</a>)}
      {rows.filter(r => r.status === k).length === 0 && <span className="tiny">{lang === "hi" ? "अभी कुछ नहीं" : "Nothing here yet"}</span>}</div>)}</div>}
    {tab === "lb" && <div className="card stack" style={{ gap: 12 }}><h2>{lang === "hi" ? "कौन सा वार्ड वादा निभाता है?" : "Which ward keeps its promises?"}</h2>
      <div style={{ overflowX: "auto" }}><table><thead><tr><th>#</th><th>{t("ward")}</th><th>{lang === "hi" ? "रिपोर्ट" : "Reports"}</th><th>{lang === "hi" ? "गड्ढे" : "Potholes"}</th><th>{lang === "hi" ? "बाकी खर्च" : "Pending cost"}</th><th>{lang === "hi" ? "ठीक हुए" : "Fixed"}</th></tr></thead>
        <tbody>{lb.map((w, i) => <tr className="r" key={w.ward}><td><b>{i + 1}</b></td><td><b>{w.ward}</b></td><td>{w.reports}</td><td>{w.hazards}</td><td>{inr(w.inr)}</td><td>{w.fix_rate}%</td></tr>)}</tbody></table></div></div>}
  </main>;
}
export default function Page() { return <Suspense><M /></Suspense>; }
