"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API, get, inr } from "../api";
import { useT, mine } from "../i18n";
export default function Mine() {
  const { t, lang } = useT(); const [rows, setRows] = useState<any[] | null>(null); const [fu, setFu] = useState<any[]>([]);
  useEffect(() => { const ids = mine.get(); get("/repairs").then((all: any[]) => setRows(ids.length ? all.filter(x => ids.includes(x.id)) : all)); get("/followups").then(setFu).catch(() => {}); }, []);
  const st: Record<string, string> = lang === "hi" ? { reported: "रिपोर्ट हुआ", filed: "शिकायत भरी", promised: "जवाब का इंतज़ार", fixed: "ठीक हो गया" } : { reported: "Reported", filed: "Complaint filled", promised: "Waiting for repair", fixed: "Fixed" };
  return <main className="wrap narrow stack" style={{ gap: 22, paddingTop: 12 }}>
    <h1 className="h-page">{t("mine")}</h1>
    {fu.length > 0 && <div className="glass stack" style={{ padding: 18, gap: 10 }}><b>🔔 {t("reminders")}</b>
      {fu.map(f => <Link key={f.id} href={`/report?id=${f.id}`} className="row between"><span>{f.ward}</span><span className="mut">{t("due")} {f.due}</span></Link>)}</div>}
    {rows === null ? <p className="mut">…</p> : rows.length === 0 ? <div className="card stack center" style={{ padding: 40, gap: 14 }}><img src="/logo.svg" width={56} height={56} alt="" /><p className="mut">{t("empty")}</p><Link className="btn primary" href="/new">{t("cta")}</Link></div>
      : rows.map(r => <Link key={r.id} href={`/report?id=${r.id}`} className="card sm row" style={{ gap: 16, flexWrap: "nowrap" }}>
        {r.thumb && <img src={API + r.thumb} alt="" style={{ width: 88, height: 66, objectFit: "cover", borderRadius: 12 }} />}
        <div className="stack" style={{ gap: 4, flex: 1 }}><b>{r.ward || "—"}</b><span className="tiny">{r.count} {t("found")} · {inr(r.repair_total_inr)}</span></div>
        <span className={"pill " + (r.status === "fixed" ? "LOW" : "")}>{st[r.status] || r.status}</span></Link>)}
  </main>;
}
