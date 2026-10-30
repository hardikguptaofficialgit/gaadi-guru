"use client";
import { useEffect, useState } from "react";
import { API, get, inr } from "../api";
const COLS = [["reported", "Reported"], ["filed", "Filed"], ["promised", "Promised · follow-up due"], ["fixed", "Fixed · verified"]];
export default function Page() {
  const [rows, setRows] = useState<any[]>([]); const [lb, setLb] = useState<any[]>([]);
  useEffect(() => { get("/repairs").then(setRows); get("/leaderboard").then(setLb); }, []);
  const promised = rows.filter(r => ["filed", "promised", "fixed"].includes(r.status)).length, fixed = rows.filter(r => r.status === "fixed").length;
  return <main className="wrap stack" style={{ gap: 28, paddingTop: 16 }}>
    <div className="row between"><div><span className="eyebrow">Accountability</span><h1 style={{ fontSize: 40, marginTop: 6 }}>Promised vs fixed</h1></div>
      <div className="row" style={{ gap: 16 }}><div className="card sm stat"><b>{promised}</b><span>complaints filed</span></div><div className="card sm stat"><b>{fixed}</b><span>verified fixed</span></div>
        <div className="card sm stat"><b>{inr(rows.reduce((a, r) => a + r.repair_total_inr, 0))}</b><span>repair backlog</span></div></div></div>
    <div className="g4">{COLS.map(([k, t]) => <div key={k} className="well stack" style={{ gap: 14, minHeight: 220 }}>
      <div className="row between"><b>{t}</b><span className="pill">{rows.filter(r => r.status === k).length}</span></div>
      {rows.filter(r => r.status === k).map(r => <a key={r.id} href={`/report?id=${r.id}`} className="card sm stack" style={{ gap: 8, padding: 14 }}>
        {r.thumb && <img className="media" style={{ height: 90, objectFit: "cover" }} src={API + r.thumb} alt="" />}
        <b style={{ fontSize: 14 }}>{r.ward}</b><span className="tiny">{r.count} hazards · {inr(r.repair_total_inr)}</span>
        {r.followup_due && <span className="tiny">Follow-up {r.followup_due}</span>}
        {r.verification && <span className={"pill " + (r.verification.verdict === "FIXED" ? "LOW" : "CRITICAL")}>{r.verification.verdict} · {r.verification.before.count}→{r.verification.after.count}</span>}
      </a>)}</div>)}</div>
    <div className="card stack" style={{ gap: 12 }}><span className="eyebrow">Ward leaderboard</span><h2>Which ward keeps its promises?</h2>
      <table><thead><tr><th>#</th><th>Ward</th><th>Reports</th><th>Hazards</th><th>Backlog</th><th style={{ width: "28%" }}>Fix rate</th></tr></thead>
        <tbody>{lb.map((w, i) => <tr className="r" key={w.ward}><td><b>{i + 1}</b></td><td><b>{w.ward}</b></td><td>{w.reports}</td><td>{w.hazards}</td><td>{inr(w.inr)}</td>
          <td><div className="row" style={{ flexWrap: "nowrap" }}><div className="bar-track" style={{ flex: 1 }}><div className="bar-fill" style={{ width: `${w.fix_rate}%` }} /></div><b style={{ width: 44, textAlign: "right" }}>{w.fix_rate}%</b></div></td></tr>)}</tbody></table></div>
  </main>;
}
