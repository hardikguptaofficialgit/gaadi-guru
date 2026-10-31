"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API, get, inr } from "../api";
import { useT, mine } from "../i18n";
import Icon from "../Icon";
import { SkList, Empty, StatusBadge, VerdictBadge, useToast } from "../ui";
import { useAuth, unclaimed } from "../auth";
export default function Mine() {
  const { t, lang } = useT(); const H = lang === "hi"; const [rows, setRows] = useState<any[] | null>(null); const [fu, setFu] = useState<any[]>([]); const [mineOnly, setMineOnly] = useState(false);
  const a = useAuth(); const toast = useToast(); const [claiming, setClaiming] = useState(false);
  const acct = a.user && a.ids ? a.ids : null; const extra = unclaimed(acct);
  useEffect(() => { if (!a.ready) return; const ids = acct ? Array.from(new Set([...acct, ...mine.get()])) : mine.get(); setMineOnly(ids.length > 0);
    get("/repairs").then((all: any[]) => setRows(ids.length ? all.filter(x => ids.includes(x.id)) : all)).catch(() => setRows([])); }, [a.ready, acct?.join()]);
  useEffect(() => { get("/followups").then(setFu).catch(() => {}); }, []);
  const [, bump] = useState(0);
  useEffect(() => { const h = () => bump(x => x + 1); window.addEventListener("mine:change", h); return () => window.removeEventListener("mine:change", h); }, []);
  async function claim() { setClaiming(true); const c = await a.claim(extra); setClaiming(false);
    const E: Record<string, [string, string]> = { "signed-out": ["You're signed out. Sign in again, then add them.", "आप साइन आउट हैं। फिर से साइन इन करें।"],
      session: ["Your sign-in expired. Sign in again, then add them.", "साइन-इन की अवधि खत्म। फिर से साइन इन करें।"],
      server: [`Can't reach the Patchwise server (${API}). Is the backend running?`, `Patchwise सर्वर (${API}) से संपर्क नहीं हो रहा।`],
      account: ["Can't reach your account right now. Try again in a minute.", "अभी अकाउंट से संपर्क नहीं हो रहा।"],
      schema: ["Accounts aren't set up on this server yet (reports table missing).", "इस सर्वर पर अकाउंट सेट नहीं हैं।"] };
    const parts: string[] = [];
    if (c.added) parts.push(H ? `${c.added} रिपोर्ट अकाउंट में जुड़ीं` : `Added ${c.added} report${c.added > 1 ? "s" : ""} to your account`);
    if (c.missing.length) parts.push(H ? `${c.missing.length} रिपोर्ट इस सर्वर पर नहीं मिली, सूची से हटाई` : `${c.missing.length} no longer exist${c.missing.length > 1 ? "" : "s"} on this server, so ${c.missing.length > 1 ? "they were" : "it was"} removed from this phone's list`);
    if (c.taken.length) parts.push(H ? `${c.taken.length} पहले से किसी और अकाउंट में है` : `${c.taken.length} ${c.taken.length > 1 ? "are" : "is"} already in another account`);
    if (c.error) parts.push(E[c.error] ? E[c.error][H ? 1 : 0] : (H ? "नहीं जुड़ पाईं: " : "Couldn't add them: ") + c.error);
    toast(parts.join(". ") || (H ? "जोड़ने को कुछ नहीं" : "Nothing to add"), c.added && !c.error ? "ok" : c.error ? "err" : "ok"); }
  return <main className="wrap narrow page">
    <div className="page-head"><div><h1>{t("mine")}</h1><p className="mut">{mineOnly ? (acct ? (H ? "आपके अकाउंट और इस फ़ोन की रिपोर्ट।" : "Reports in your account and on this phone.") : H ? "इस फ़ोन से भेजी गई रिपोर्ट।" : "Reports sent from this phone.") : (H ? "अभी इस फ़ोन से कोई नहीं — सभी रिपोर्ट दिख रही हैं।" : "None from this phone yet, so here is everyone's.")}</p></div>
      <Link className="btn primary" href="/new"><Icon n="camera" s={16} />{t("cta")}</Link></div>
    {a.enabled && a.ready && !a.user && <div className="glass row between" style={{ padding: "var(--s2) var(--s3)" }} data-testid="signin-hint">
      <span className="small">{H ? "दूसरे फ़ोन पर भी देखने के लिए साइन इन करें।" : "Sign in to see these on any phone."}</span><Link className="btn ghost" href="/login"><Icon n="user" s={16} />{H ? "साइन इन" : "Sign in"}</Link></div>}
    {acct && extra.length > 0 && <div className="card row between" data-testid="claim">
      <span className="small">{H ? `इस फ़ोन की ${extra.length} रिपोर्ट अभी अकाउंट में नहीं हैं।` : `${extra.length} report${extra.length > 1 ? "s" : ""} from this phone ${extra.length > 1 ? "aren't" : "isn't"} in your account yet.`}</span>
      <button className="btn primary" disabled={claiming} onClick={claim}>{claiming ? "…" : H ? "अकाउंट में जोड़ें" : "Add to my account"}</button></div>}
    {a.user && a.down && <p className="tiny" role="status">{H ? "अकाउंट सर्वर से संपर्क नहीं हो रहा, इस फ़ोन की रिपोर्ट दिख रही हैं।" : "Can't reach your account right now, so this shows reports from this phone."}</p>}
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
