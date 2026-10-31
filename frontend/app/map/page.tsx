"use client";
import { useEffect, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { API, get, inr } from "../api";
import { useT, HOWBAD } from "../i18n";
import Icon from "../Icon";
import { Tabs, Sk, VerdictBadge, VERDICT } from "../ui";
const HotMap = dynamic(() => import("../HotMap"), { ssr: false, loading: () => <Sk h={520} r={16} /> });
type Tab = "map" | "board" | "lb";
function M() {
  const { t, lang } = useT(); const H = lang === "hi"; const q = useSearchParams(); const [tab, setTabS] = useState<Tab>((q.get("tab") as Tab) || "map");
  const setTab = (k: Tab) => { setTabS(k); history.replaceState(null, "", k === "map" ? "/map" : `/map?tab=${k}`); };
  const [pts, setPts] = useState<any[]>([]); const [rows, setRows] = useState<any[] | null>(null); const [lb, setLb] = useState<any[] | null>(null);
  useEffect(() => { get("/reports").then(setPts); get("/repairs").then(setRows); get("/leaderboard").then(setLb); }, []);
  const vmap = Object.fromEntries(pts.map(p => [p.id, p.verdict]));
  const COLS: [string, string][] = H ? [["reported", "रिपोर्ट हुआ"], ["filed", "शिकायत भरी"], ["promised", "मरम्मत का इंतज़ार"], ["fixed", "ठीक हुआ"]] : [["reported", "Reported"], ["filed", "Complaint filled"], ["promised", "Waiting for repair"], ["fixed", "Fixed (checked)"]];
  return <main className="wrap page">
    <div className="page-head"><div><span className="eyebrow mono-t">{pts.length} {H ? "रिपोर्ट" : "reports"} · {pts.reduce((a, p) => a + (p.count || 0), 0)} {H ? "गड्ढे" : "potholes"}</span><h1>{t("map")}</h1><p className="mut">{H ? "हर रिपोर्ट, उसकी मरम्मत की स्थिति और वार्ड का रिकॉर्ड।" : "Every report, where its repair stands, and how each ward is doing."}</p></div>
      <Tabs id="map" value={tab} onChange={setTab} items={[["map", t("tabMap")], ["board", t("tabBoard")], ["lb", t("tabLb")]]} /></div>
    {tab === "map" && <div className="tool">
      <div className="tool-map"><HotMap points={pts} height={600} />
        <div className="tool-legend"><ul className="sev-list row-l">{["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(s => <li key={s} className={"sv " + s}><i /><span>{HOWBAD[s][H ? 1 : 0]}</span></li>)}</ul>
          <span className="tiny">{H ? "डैश वाला घेरा = री-राइड जांच" : "Dashed ring = re-ride check"}</span></div></div>
      <aside className="tool-list" aria-label={H ? "रिपोर्ट सूची" : "Report list"}>
        <div className="tool-lh"><span>{H ? "रिपोर्ट" : "Reports"}</span><span className="mono-t">{pts.length}</span></div>
        <ol>{pts.map(p => <li key={p.id}><Link href={`/report?id=${p.id}`} className="tl-row">
          <span className={"tl-dot sv " + (p.worst >= 75 ? "CRITICAL" : p.worst >= 50 ? "HIGH" : p.worst >= 25 ? "MEDIUM" : "LOW")}><i /></span>
          <span className="tl-main"><b>{p.ward || (H ? "अज्ञात वार्ड" : "Unmapped ward")}</b><span className="mono-t tiny">PW-{p.id} · {(+p.lat).toFixed(3)}, {(+p.lng).toFixed(3)}</span></span>
          <span className="tl-side"><b className="mono-t">{p.count}</b><span className="tiny">{({ reported: H ? "रिपोर्ट" : "open", filed: H ? "दर्ज" : "filed", promised: H ? "वादा" : "promised", fixed: H ? "ठीक" : "fixed" } as any)[p.status] || p.status}</span></span></Link></li>)}
          {pts.length === 0 && <li className="kempty">{H ? "अभी कोई रिपोर्ट नहीं" : "No reports yet"}</li>}</ol>
      </aside></div>}
    {tab === "board" && (rows === null ? <div className="kanban">{[0, 1, 2, 3].map(i => <Sk key={i} h={200} r={24} />)}</div> : <div className="kanban" data-testid="board">{COLS.map(([k, ttl]) => { const list = rows.filter(r => r.status === k);
      return <div key={k} className="kcol"><div className="kcol-h"><span>{ttl}</span><span className="mono-t">{list.length}</span></div>
        {list.map(r => <Link key={r.id} href={`/report?id=${r.id}`} className="kcard">
          {r.thumb && <img src={API + r.thumb} alt="" />}
          <b>{r.ward}</b><span className="tiny">{r.count} {t("found")} · {inr(r.repair_total_inr)}{r.upvotes ? ` · ${r.upvotes} +1` : ""}</span>
          <div className="row gap-1">{r.followup_due && <span className="badge"><Icon n="clock" s={12} />{r.followup_due}</span>}<VerdictBadge v={vmap[r.id] || r.verification?.verdict} hi={H} /></div></Link>)}
        {list.length === 0 && <div className="kempty">{H ? "अभी कुछ नहीं" : "Nothing here yet"}</div>}</div>; })}</div>)}
    {tab === "lb" && <div className="card stack gap-3"><div><h2>{H ? "कौन सा वार्ड वादा निभाता है?" : "Which ward keeps its promises?"}</h2><p className="mut small">{H ? "वार्ड पर टैप करें: वादे बनाम मरम्मत, देरी वाले फॉलो-अप, शेयर लिंक।" : "Tap a ward for promised vs fixed, overdue follow-ups and a shareable link."}</p></div>
      {lb === null ? <Sk h={180} r={16} /> : <div style={{ overflowX: "auto" }}><table data-testid="leaderboard"><thead><tr><th>#</th><th>{t("ward")}</th><th>{H ? "रिपोर्ट" : "Reports"}</th><th>{H ? "गड्ढे" : "Potholes"}</th><th>{H ? "बाकी खर्च" : "Pending cost"}</th><th>{H ? "ठीक हुए" : "Fixed"}</th><th /></tr></thead>
        <tbody>{lb.map((w, i) => <tr className="r" key={w.ward}><td><b>{i + 1}</b></td><td><Link href={`/map/ward?w=${encodeURIComponent(w.ward)}`}>{w.ward}</Link></td><td className="num">{w.reports}</td><td className="num">{w.hazards}</td><td className="num">{inr(w.inr)}</td>
          <td><div className="row gap-2" style={{ flexWrap: "nowrap" }}><div className="bar-track" style={{ width: 64 }}><div className="bar-fill" style={{ width: `${w.fix_rate}%` }} /></div><span className="num small">{w.fix_rate}%</span></div></td>
          <td><Link className="btn ghost" aria-label={`Open ${w.ward}`} href={`/map/ward?w=${encodeURIComponent(w.ward)}`}><Icon n="arrow" s={16} /></Link></td></tr>)}</tbody></table></div>}</div>}
  </main>;
}
export default function Page() { return <Suspense><M /></Suspense>; }
