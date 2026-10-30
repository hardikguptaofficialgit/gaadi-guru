"use client";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { API, get, inr } from "../../api";
import { useT } from "../../i18n";
import Icon from "../../Icon";
import { Sk, StatusBadge, VerdictBadge, useToast, Empty } from "../../ui";
function W() {
  const q = useSearchParams(); const ward = q.get("w") || ""; const asOf = q.get("as_of"); const { lang } = useT(); const H = lang === "hi"; const T = (en: string, hi: string) => H ? hi : en; const toast = useToast();
  const [d, setD] = useState<any>(null); const [missing, setMissing] = useState(false);
  useEffect(() => { fetch(`${API}/wards/${encodeURIComponent(ward)}/accountability${asOf ? `?as_of=${asOf}` : ""}`).then(r => r.ok ? r.json() : Promise.reject()).then(setD).catch(() => setMissing(true)); }, [ward]);
  if (missing) return <main className="wrap narrow page"><Empty icon="map" title={T("Ward not found", "वार्ड नहीं मिला")} body={ward}><Link className="btn primary" href="/map?tab=lb">{T("All wards", "सभी वार्ड")}</Link></Empty></main>;
  if (!d) return <main className="wrap page" role="status"><Sk h={56} w="50%" /><div className="stats"><Sk h={96} r={16} /><Sk h={96} r={16} /><Sk h={96} r={16} /><Sk h={96} r={16} /></div><Sk h={240} r={24} /></main>;
  const url = typeof window !== "undefined" ? location.href : "";
  const msg = encodeURIComponent(T(`${d.ward}: ${d.promised} road repairs promised, ${d.fixed} fixed, ${d.overdue.length} overdue. `, `${d.ward}: ${d.promised} मरम्मत का वादा, ${d.fixed} ठीक, ${d.overdue.length} देरी में। `) + url);
  const pct = d.promised + d.fixed ? Math.round((d.fixed / (d.promised + d.fixed)) * 100) : 0;
  return <main className="wrap page" data-testid="ward-page">
    <div className="page-head"><div><Link href="/map?tab=lb" className="tiny row gap-1"><Icon n="arrow" s={14} className="flip" />{T("Ward ranking", "वार्ड रैंकिंग")}</Link>
      <h1 style={{ marginTop: "var(--s1)" }}>{d.ward}</h1><p className="mut">{T(`Rank ${d.rank} of ${d.of} wards · as of ${d.today}`, `${d.of} में से ${d.rank} रैंक · ${d.today} तक`)}</p></div>
      <div className="row"><a className="btn" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${msg}`}><Icon n="share" s={16} />WhatsApp</a><a className="btn" target="_blank" rel="noreferrer" href={`https://x.com/intent/post?text=${msg}`}><Icon n="share" s={16} />X</a>
        <button className="btn primary" data-testid="ward-copy" onClick={() => { navigator.clipboard?.writeText(url).catch(() => {}); toast(T("Ward link copied", "वार्ड लिंक कॉपी हुआ")); }}><Icon n="copy" s={16} />{T("Copy link", "लिंक कॉपी")}</button></div></div>
    <div className="stats">
      <div className="card sm stat"><b>{d.promised + d.fixed}</b><span>{T("Repairs promised", "मरम्मत का वादा")}</span></div>
      <div className="card sm stat"><b style={{ color: "var(--low)" }}>{d.fixed}</b><span>{T("Fixed (verified)", "ठीक हुए (जांचे)")}</span></div>
      <div className="card sm stat"><b style={{ color: d.overdue.length ? "var(--crit)" : undefined }}>{d.overdue.length}</b><span>{T("Overdue follow-ups", "देरी वाले फॉलो-अप")}</span></div>
      <div className="card sm stat"><b>{inr(d.pending_inr)}</b><span>{T("Pending repair cost", "बाकी मरम्मत खर्च")}</span></div></div>
    <div className="card stack gap-2"><div className="row between"><b>{T("Promised vs fixed", "वादा बनाम ठीक")}</b><span className="num small">{pct}%</span></div>
      <div className="bar-track" style={{ height: 12 }}><div className="bar-fill" style={{ width: `${pct}%` }} /></div><span className="tiny">{d.hazards} {T("hazards reported in this ward", "खतरे इस वार्ड में रिपोर्ट हुए")}</span></div>
    {d.overdue.length > 0 && <section className="card stack gap-3" data-testid="overdue"><h3>{T("Overdue follow-ups", "देरी वाले फॉलो-अप")}</h3>
      <div className="list">{d.overdue.map((o: any) => <Link key={o.id} href={`/report?id=${o.id}`} className="li"><span className="ico-tile bad"><Icon n="clock" /></span>
        <div className="grow"><b className="small">{T(`${o.ward} · due ${o.followup_due}`, `तय तारीख ${o.followup_due}`)}</b><div className="tiny">{o.days_overdue} {T("days overdue", "दिन देरी")}{o.escalation ? T(" · escalation drafted", " · एस्केलेशन ड्राफ्ट") : ""}</div></div><Icon n="arrow" s={16} /></Link>)}</div></section>}
    <section className="stack gap-3"><h3>{T("Reports in this ward", "इस वार्ड की रिपोर्ट")}</h3>
      {d.reports.length === 0 ? <Empty title={T("No reports yet", "अभी कोई रिपोर्ट नहीं")} /> : <div className="list">{d.reports.map((r: any) => <Link key={r.id} href={`/report?id=${r.id}`} className="li">
        {r.thumb ? <img src={API + r.thumb} alt="" /> : <span className="ph"><Icon n="video" /></span>}
        <div className="grow stack gap-1"><b className="small">{r.count} {T("hazards", "खतरे")} · {inr(r.repair_total_inr)}</b><span className="tiny">{r.followup_due ? T(`Check again on ${r.followup_due}`, `फिर जांचें ${r.followup_due}`) : r.id}</span></div>
        <div className="row gap-1" style={{ justifyContent: "flex-end" }}><StatusBadge s={r.status} hi={H} /><VerdictBadge v={r.verification?.verdict} hi={H} />{r.escalation && <span className="badge b-warn">{T("Escalation draft", "एस्केलेशन ड्राफ्ट")}</span>}</div></Link>)}</div>}</section>
  </main>;
}
export default function Page() { return <Suspense><W /></Suspense>; }
