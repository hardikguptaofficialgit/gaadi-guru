"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { API, get, inr } from "../api";
import { useT, Stepper, Share, HOWBAD, mine } from "../i18n";
import Timeline from "../Timeline";
import Authorities from "./Authorities";
import Icon from "../Icon";
import { Modal, Sk, StatusBadge, VerdictBadge, Tabs, useToast } from "../ui";
const HUMAN: Record<string, [string, string]> = { analyze_video: ["Looking at your ride", "राइड देख रहे हैं"], check_duplicates: ["Checking if someone already reported it", "देख रहे हैं कि पहले किसी ने रिपोर्ट किया या नहीं"],
  estimate_repair_cost: ["Working out the repair cost", "मरम्मत खर्च निकाल रहे हैं"], draft_complaint: ["Writing the complaint", "शिकायत लिख रहे हैं"],
  file_complaint: ["Filling the city portal form for you", "आपके लिए पोर्टल फॉर्म भर रहे हैं"], schedule_followup: ["Setting a 7-day reminder", "7 दिन का रिमाइंडर लगा रहे हैं"], verify_repair: ["Checking if it got fixed", "देख रहे हैं कि ठीक हुआ या नहीं"] };

function Reride({ r, H, onDone }: { r: any; H: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false); const [file, setFile] = useState<File | null>(null); const [job, setJob] = useState<any>(null); const [err, setErr] = useState(""); const toast = useToast();
  const T = (en: string, hi: string) => H ? hi : en;
  async function go() {
    if (!file) return; setErr(""); setJob({ state: "queued" });
    const fd = new FormData(); fd.append("video", file); fd.append("reride_of", r.id);
    try { const x = await fetch(API + "/jobs", { method: "POST", body: fd }); if (!x.ok) throw new Error(await x.text()); const { job_id } = await x.json();
      for (;;) { await new Promise(z => setTimeout(z, 1000)); const j = await get(`/jobs/${job_id}`); setJob(j);
        if (j.state === "done") { mine.add(j.report_id); onDone(); toast(T("Re-ride checked", "री-राइड जांची गई")); return; } if (j.state === "error") throw new Error(j.error); } }
    catch (e: any) { setErr(String(e.message || e)); setJob(null); }
  }
  const v = job?.verification; const busy = job && job.state !== "done";
  return <>
    <button className="btn" data-testid="reride-btn" onClick={() => { setOpen(true); setJob(null); setFile(null); }}><Icon n="refresh" s={16} />{T("Re-ride this road", "यह सड़क फिर से चलाएं")}</button>
    <Modal open={open} onClose={() => !busy && setOpen(false)} title={T("Re-ride this road", "यह सड़क फिर से चलाएं")}>
      <p className="mut small">{T("Record the same stretch again. SAM 3.1 compares the pothole count with the original, within 150 m, and updates the status.", "वही रास्ता फिर रिकॉर्ड करें। SAM 3.1 पुराने वीडियो से गड्ढों की तुलना करेगा (150 मी के अंदर) और स्टेटस अपडेट करेगा।")}</p>
      {!job && <><label className={"drop" + (file ? " has" : "")}><input type="file" accept="video/*" capture="environment" data-testid="reride-input" aria-label="Re-ride video" onChange={e => setFile(e.target.files?.[0] || null)} />
        <span className={"ico-tile" + (file ? " ok" : "")}><Icon n={file ? "video" : "upload"} /></span><b>{file ? file.name : T("Choose the re-ride video", "री-राइड वीडियो चुनें")}</b></label>
        <button className="btn primary lg block" disabled={!file} onClick={go} data-testid="reride-go">{T("Compare with original", "पुराने से तुलना करें")}</button></>}
      {busy && <div className="stack center gap-2" role="status"><div className="spinner" /><b>{job.stage ? `${job.stage}…` : T("Uploading…", "अपलोड…")}</b>{job.cache_hit && <span className="tiny">{T("Saved result reused", "सेव नतीजा")}</span>}</div>}
      {job?.state === "done" && <div className="stack gap-3" data-testid="reride-result">
        {v ? <><div className="row"><VerdictBadge v={v.verdict} hi={H} /><span className="tiny num">{v.before?.count ?? "—"} → {v.after?.count ?? "—"} {T("hazards", "खतरे")}{v.distance_m != null ? ` · ${Math.round(v.distance_m)} m` : ""}</span></div>
          {v.note && <p className="mut small">{v.note}</p>}</> : <p className="mut small">{T("No comparison returned.", "तुलना नहीं मिली।")}</p>}
        <div className="row"><button className="btn primary" onClick={() => setOpen(false)}>{T("Done", "ठीक है")}</button><Link className="btn ghost" href={`/report?id=${job.report_id}`}>{T("Open re-ride report", "री-राइड रिपोर्ट")}</Link></div></div>}
      {err && <p role="alert" style={{ color: "var(--crit)" }}>{err}</p>}
    </Modal></>;
}

function R() {
  const id = useSearchParams().get("id"); const { t, lang } = useT(); const L = lang === "hi" ? 1 : 0; const H = lang === "hi"; const toast = useToast();
  const [r, setR] = useState<any>(null); const [steps, setSteps] = useState<any[]>([]); const [all, setAll] = useState<any[]>([]); const [missing, setMissing] = useState(false);
  const [name, setName] = useState(""); const [mob, setMob] = useState(""); const [esc, setEsc] = useState<any>(null); const [cl, setCl] = useState<"en" | "hi">("en");
  useEffect(() => setCl(lang), [lang]);
  const load = () => { if (!id) return; get(`/reports/${id}`).then(x => x.id ? setR(x) : setMissing(true)).catch(() => setMissing(true));
    fetch(`${API}/reports/${id}/escalation`).then(x => x.ok ? x.json() : null).then(setEsc).catch(() => {}); };
  useEffect(() => { load(); get("/reports").then(setAll).catch(() => {}); }, [id]);
  const running = steps.length > 0 && !steps.some(s => s.kind === "done" || s.kind === "error");
  useEffect(() => { if (!id) return; const f = () => get(`/reports/${id}/agent`).then(setSteps).catch(() => {}); f(); const i = setInterval(f, 1500); return () => clearInterval(i); }, [id]);
  useEffect(() => { if (!running && steps.length) load(); }, [running]);
  if (missing) return <main className="wrap narrow page"><div className="card empty"><span className="ico-tile"><Icon n="alert" s={28} /></span><h3>{H ? "रिपोर्ट नहीं मिली" : "We couldn't find that report"}</h3><Link className="btn primary" href="/new">{t("cta")}</Link></div></main>;
  if (!r) return <main className="wrap page" role="status" aria-label="Loading"><Sk h={48} r={999} /><div className="split"><Sk h={360} r={24} /><div className="stack"><Sk h={32} w="60%" /><Sk h={80} r={16} /><Sk h={80} r={16} /></div></div></main>;
  const total = r.potholes.reduce((a: number, p: any) => a + (p.repair?.inr_est || 0), 0);
  const counts = ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(s => [s, r.potholes.filter((p: any) => p.severity === s).length] as [string, number]).filter(x => x[1]);
  const sent = ["filed", "promised", "fixed"].includes(r.status) || !!r.followup_due;
  const send = async () => { if (name || mob) await fetch(`${API}/reports/${r.id}/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mobile: mob }) });
    await fetch(`${API}/reports/${r.id}/agent`, { method: "POST" }); setSteps([{ kind: "start" }]); };
  const lastCall = [...steps].reverse().find(s => s.kind === "tool_call");
  const shareText = H ? `मैंने ${r.ward || "मेरे इलाके"} में ${r.potholes.length} गड्ढे रिपोर्ट किए। समर्थन करें:` : `I reported ${r.potholes.length} potholes in ${r.ward || "my area"}. Back it up:`;
  const body = cl === "hi" ? r.report?.body_hi : r.report?.body_en;
  return <main className="wrap page">
    <div className="narrow-c"><Stepper at={sent ? 3 : 2} /></div>
    <section className="split">
      <div className="card sticky" style={{ padding: "var(--s2)" }}>{r.overlay ? <video className="media" style={{ aspectRatio: "16/10", objectFit: "cover" }} src={API + r.overlay} controls autoPlay muted loop playsInline />
        : r.potholes[0]?.image ? <img className="media" src={API + r.potholes[0].image} alt="" /> : <div className="media" style={{ aspectRatio: "16/10" }} />}</div>
      <div className="card stack gap-4">
        <div className="stack gap-2"><div className="row between"><span className="eyebrow">{r.ward || ""}</span><div className="row gap-1"><StatusBadge s={r.status} hi={H} /><VerdictBadge v={r.verification?.verdict} hi={H} /></div></div>
          <h2 data-testid="found">{r.potholes.length} {t("found")}</h2></div>
        <div className="stats">
          <div className="well stack gap-2"><span className="tiny">{t("howbad")}</span><div className="sev-row">{counts.length ? counts.map(([s, n]) => <span key={s} className={"pill " + s}>{n} {HOWBAD[s][L]}</span>) : <span className="mut small">—</span>}</div></div>
          <div className="well stat"><b>{inr(total)}</b><span>{t("fix")}</span></div></div>
        {r.voice?.transcript && <div className="well stack gap-1"><span className="tiny row gap-1"><Icon n="mic" s={14} />{H ? "आपने कहा" : "You said"}</span><p className="small">{r.voice.transcript}</p></div>}
        {r.upvotes > 0 && <span className="tiny row gap-1"><Icon n="thumb" s={14} />{r.upvotes} {H ? "लोगों ने समर्थन किया" : "neighbours backed this"}</span>}
        {!sent && !running && <><div className="g2"><label className="field">{H ? "आपका नाम (वैकल्पिक)" : "Your name (optional)"}<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
          <label className="field">{H ? "मोबाइल (वैकल्पिक)" : "Mobile (optional)"}<input value={mob} onChange={e => setMob(e.target.value.replace(/[^0-9+ ]/g, ""))} inputMode="tel" autoComplete="tel" /></label></div>
          <span className="tiny">{H ? "खाली छोड़ें तो पोर्टल पर ये फ़ील्ड आप खुद भरेंगे।" : "Leave blank and you fill these on the portal yourself."}</span>
          <button className="btn primary lg block" onClick={send} data-testid="send">{t("send")}<Icon n="arrow" s={18} /></button></>}
        {running && <div className="glass stack gap-2" style={{ padding: "var(--s3)" }} role="status" aria-live="polite" data-testid="agent-running"><div className="row"><div className="spinner sm" /><b className="small">{lastCall ? HUMAN[lastCall.tool]?.[L] || "…" : t("sending")}</b></div>
          <span className="tiny">{steps.filter(s => s.kind === "tool_result").length} {H ? "कदम पूरे" : "steps done"}</span></div>}
        {sent && <div className="row"><Reride r={r} H={H} onDone={load} />{r.ward && <Link className="btn ghost" href={`/map/ward?w=${encodeURIComponent(r.ward)}`}><Icon n="trend" s={16} />{H ? "वार्ड का रिकॉर्ड" : "Ward record"}</Link>}</div>}
      </div>
    </section>
    {sent && !running && <section className="card stack gap-4 success" data-testid="success">
      <div className="row gap-3"><span className="ico-tile ok"><Icon n="check" /></span><div className="stack gap-1"><h2>{t("sent")}</h2><p className="mut small">{t("remind")} {r.followup_due && <b className="num">({r.followup_due})</b>}</p></div></div>
      <div className="g2" style={{ alignItems: "start" }}>
        {r.wonder?.screenshot && <figure className="stack gap-2" style={{ margin: 0 }}><img className="media" style={{ border: "1px solid var(--line)" }} src={API + r.wonder.screenshot} alt={H ? "भरा हुआ पोर्टल फॉर्म" : "Filled portal form"} />
          <figcaption className="tiny">{H ? "Muse Wonder ने भरा फॉर्म (डेमो पोर्टल) — सबमिट आप करेंगे" : "Form filled by Muse Wonder (demo portal). You press Submit."}</figcaption></figure>}
        <div className="stack gap-3">
          {r.verification && <div className="well stack gap-1" data-testid="verification"><div className="row between"><b className="small">{H ? "री-राइड जांच" : "Re-ride check"}</b><VerdictBadge v={r.verification.verdict} hi={H} /></div>
            <span className="tiny num">{r.verification.before?.count ?? "—"} → {r.verification.after?.count ?? "—"} {H ? "खतरे" : "hazards"}{r.verification.distance_m != null ? ` · ${Math.round(r.verification.distance_m)} m` : ""}</span>{r.verification.note && <p className="small mut">{r.verification.note}</p>}</div>}
          <span className="tiny">{t("share")}</span><Share id={r.id} text={shareText} />
          <a className="og-prev" href={`/r/${r.id}`} target="_blank" rel="noreferrer"><img src={`/r/${r.id}/opengraph-image`} alt="Share card preview" /><div className="tiny">{H ? "शेयर कार्ड प्रीव्यू" : "Share card preview (WhatsApp / X)"}</div></a>
        </div></div></section>}
    {esc && <section className="card stack gap-3" data-testid="escalation" style={{ border: "1px solid rgba(217,130,47,.35)" }}>
      <div className="row between"><div className="row gap-2"><span className="ico-tile warn"><Icon n="alert" /></span><div><span className="eyebrow" style={{ color: "#a85d17" }}>{H ? "एस्केलेशन ड्राफ्ट" : "Escalation draft"}</span><h3>{esc.subject}</h3></div></div>
        <span className="badge b-warn">{H ? "सिर्फ ड्राफ्ट · भेजा नहीं" : "Draft only · not sent"}</span></div>
      <p className="tiny">{H ? `${esc.days_overdue} दिन देरी` : `${esc.days_overdue} days overdue`} · {esc.source === "muse-spark" ? "Muse Spark" : "template"} · as of {esc.as_of}{esc.simulated_date ? " (simulated date)" : ""}</p>
      <div className="well"><pre className="small">{H ? esc.body_hi || esc.body_en : esc.body_en}</pre></div>
      <div className="row"><button className="btn" onClick={() => { navigator.clipboard?.writeText(`${esc.subject}\n\n${H ? esc.body_hi : esc.body_en}`).catch(() => {}); toast(H ? "कॉपी हो गया" : "Escalation copied"); }}><Icon n="copy" s={16} />{H ? "कॉपी करें" : "Copy draft"}</button>
        <span className="tiny">{H ? "आप खुद भेजें — हम कुछ नहीं भेजते।" : "You send it yourself. Nothing is sent automatically."}</span></div></section>}
    {r.report?.subject && <section className="card stack gap-3" data-testid="complaint">
      <div className="row between"><span className="eyebrow">{H ? "आपकी शिकायत" : "Your complaint"}</span><Tabs id="cl" value={cl} onChange={v => setCl(v as "en" | "hi")} items={[["en", "English"], ["hi", "हिंदी"]] as ["en" | "hi", string][]} /></div>
      <h3>{r.report.subject}</h3>
      <div className="well"><pre className="small">{body || ""}</pre></div>
      <div className="row"><button className="btn" onClick={() => { navigator.clipboard?.writeText(`${r.report.subject}\n\n${body}`).catch(() => {}); toast(H ? "शिकायत कॉपी हुई" : "Complaint copied"); }}><Icon n="copy" s={16} />{H ? "शिकायत कॉपी करें" : "Copy complaint"}</button>{!sent && <Share id={r.id} text={shareText} />}</div></section>}
    <Authorities r={r} H={H} />
    <details className="card"><summary><b>{t("details")}</b></summary>
      <div className="stack gap-4" style={{ marginTop: "var(--s3)" }}>
        <div className="grid">{r.potholes.map((p: any) => <div className="card sm stack gap-2" key={p.id}>
          {p.image && <img className="media" style={{ aspectRatio: "4/3", objectFit: "cover" }} src={API + p.image} alt="" />}
          <div className="row between"><b className="small">#{p.id} {p.hazard || "Pothole"}</b><span className={"pill " + p.severity}>{HOWBAD[p.severity]?.[L]}</span></div>
          <span className="tiny">{p.repair?.area_m2_est ?? "—"} m² · {inr(p.repair?.inr_est)}</span></div>)}</div>
        <div className="row"><a className="btn" href={`${API}/reports/${r.id}/coco`}><Icon n="doc" s={16} />COCO dataset (.zip)</a><span className="tiny">SAM 3.1 prompts: {r.plan?.prompts?.join(", ")}</span></div>
        <Timeline rid={r.id} rerides={all.filter(x => x.id !== r.id)} />
      </div></details>
  </main>;
}
export default function Page() { return <Suspense><R /></Suspense>; }
