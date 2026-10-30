"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API, get, inr } from "../api";
import { useT, mine } from "../i18n";
import Icon from "../Icon";
import { SkList, Empty, StatusBadge, VerdictBadge } from "../ui";
export default function Mine() {
  const { t, lang } = useT(); const H = lang === "hi"; const [rows, setRows] = useState<any[] | null>(null); const [fu, setFu] = useState<any[]>([]); const [mineOnly, setMineOnly] = useState(false);
  useEffect(() => { const ids = mine.get(); setMineOnly(ids.length > 0); get("/repairs").then((all: any[]) => setRows(ids.length ? all.filter(x => ids.includes(x.id)) : all)); get("/followups").then(setFu).catch(() => {}); }, []);
  return <main className="wrap narrow page">
    <div className="page-head"><div><h1>{t("mine")}</h1><p className="mut">{mineOnly ? (H ? "इस फ़ोन से भेजी गई रिपोर्ट।" : "Reports sent from this phone.") : (H ? "अभी इस फ़ोन से कोई नहीं — सभी रिपोर्ट दिख रही हैं।" : "None from this phone yet, so here is everyone's.")}</p></div>
      <Link className="btn primary" href="/new"><Icon n="camera" s={16} />{t("cta")}</Link></div>
    {fu.length > 0 && <section className="card stack gap-3" data-testid="reminders"><div className="row gap-2"><span className="ico-tile"><Icon n="bell" /></span><h3>{t("reminders")}</h3></div>
      <div className="list">{fu.map(f => <Link key={f.id} href={`/report?id=${f.id}`} className="row between" style={{ minHeight: 44, borderTop: "1px solid var(--line)", paddingTop: "var(--s1)" }}>
        <span className="small"><b>{f.ward}</b></span>
        <span className="row gap-2">{f.state === "escalated" ? <span className="badge b-warn">{H ? "एस्केलेशन ड्राफ्ट तैयार" : "Escalation drafted"}</span> : f.state === "closed" ? <span className="badge b-ok">{H ? "बंद" : "Closed"}</span> : null}
          <span className="tiny num">{t("due")} {f.due}</span></span></Link>)}</div></section>}
    {rows === null ? <SkList n={3} /> : rows.length === 0 ? <Empty icon="camera" title={t("empty")}><Link className="btn primary" href="/new">{t("cta")}</Link></Empty>
      : <div className="list" data-testid="mine-list">{rows.map(r => <Link key={r.id} href={`/report?id=${r.id}`} className="li">
        {r.thumb ? <img src={API + r.thumb} alt="" /> : <span className="ph"><Icon n="video" /></span>}
        <div className="stack gap-1 grow"><b className="small">{r.ward || "—"}</b><span className="tiny num">{r.count} {t("found")} · {inr(r.repair_total_inr)}</span></div>
        <div className="stack gap-1" style={{ alignItems: "flex-end" }}><StatusBadge s={r.status} hi={H} /><VerdictBadge v={r.verification?.verdict} hi={H} /></div></Link>)}</div>}
  </main>;
}
