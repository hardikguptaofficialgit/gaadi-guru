"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { API, get, inr } from "../api";
import { useT, Stepper, Share, HOWBAD } from "../i18n";
import Timeline from "../Timeline";
const HUMAN: Record<string, [string, string]> = { analyze_video: ["Looking at your ride", "राइड देख रहे हैं"], check_duplicates: ["Checking if someone already reported it", "देख रहे हैं कि पहले किसी ने रिपोर्ट किया या नहीं"],
  estimate_repair_cost: ["Working out the repair cost", "मरम्मत खर्च निकाल रहे हैं"], draft_complaint: ["Writing the complaint", "शिकायत लिख रहे हैं"],
  file_complaint: ["Filling the city portal form for you", "आपके लिए पोर्टल फॉर्म भर रहे हैं"], schedule_followup: ["Setting a 7-day reminder", "7 दिन का रिमाइंडर लगा रहे हैं"], verify_repair: ["Checking if it got fixed", "देख रहे हैं कि ठीक हुआ या नहीं"] };
function R() {
  const id = useSearchParams().get("id"); const { t, lang } = useT(); const L = lang === "hi" ? 1 : 0;
  const [r, setR] = useState<any>(null); const [steps, setSteps] = useState<any[]>([]); const [all, setAll] = useState<any[]>([]); const [missing, setMissing] = useState(false);
  const load = () => id && get(`/reports/${id}`).then(x => x.id ? setR(x) : setMissing(true)).catch(() => setMissing(true));
  useEffect(() => { load(); get("/reports").then(setAll).catch(() => {}); }, [id]);
  const running = steps.length > 0 && !steps.some(s => s.kind === "done" || s.kind === "error");
  useEffect(() => { if (!id) return; const f = () => get(`/reports/${id}/agent`).then(setSteps).catch(() => {}); f(); const i = setInterval(f, 1500); return () => clearInterval(i); }, [id]);
  useEffect(() => { if (!running && steps.length) load(); }, [running]);
  if (missing) return <main className="wrap narrow"><div className="card center stack" style={{ padding: 40, gap: 14 }}><p className="mut">{lang === "hi" ? "रिपोर्ट नहीं मिली।" : "We couldn't find that report."}</p><Link className="btn primary" href="/new">{t("cta")}</Link></div></main>;
  if (!r) return <main className="wrap narrow"><div className="card center" style={{ padding: 40 }} role="status"><div className="spinner" /></div></main>;
  const total = r.potholes.reduce((a: number, p: any) => a + (p.repair?.inr_est || 0), 0);
  const counts = ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(s => [s, r.potholes.filter((p: any) => p.severity === s).length] as [string, number]).filter(x => x[1]);
  const sent = ["filed", "promised", "fixed"].includes(r.status) || !!r.followup_due;
  const send = () => fetch(`${API}/reports/${r.id}/agent`, { method: "POST" }).then(() => setSteps([{ kind: "start" }]));
  const lastCall = [...steps].reverse().find(s => s.kind === "tool_call");
  const shareText = lang === "hi" ? `मैंने ${r.ward || "मेरे इलाके"} में ${r.potholes.length} गड्ढे रिपोर्ट किए। समर्थन करें:` : `I reported ${r.potholes.length} potholes in ${r.ward || "my area"}. Back it up:`;
  return <main className="wrap stack" style={{ gap: 22, paddingTop: 12 }}>
    <div className="narrow-c"><Stepper at={sent ? 3 : 2} /></div>
    <section className="g2">
      <div className="card" style={{ padding: 12 }}>{r.overlay ? <video className="media" src={API + r.overlay} controls autoPlay muted loop playsInline /> : <p className="mut">—</p>}</div>
      <div className="card stack" style={{ gap: 16 }}>
        <span className="eyebrow">{r.ward || ""}</span>
        <h2>{r.potholes.length} {t("found")}</h2>
        <div><span className="tiny">{t("howbad")}</span><div className="row" style={{ marginTop: 6 }}>{counts.map(([s, n]) => <span key={s} className={"pill " + s}>{n} {HOWBAD[s][L]}</span>)}</div></div>
        <div className="well stat"><b>{inr(total)}</b><span>{t("fix")}</span></div>
        {r.voice?.transcript && <div className="well"><span className="tiny">🎙 {lang === "hi" ? "आपने कहा" : "You said"}</span><p>{r.voice.transcript}</p></div>}
        {r.upvotes > 0 && <span className="tiny">👍 {r.upvotes} {lang === "hi" ? "लोगों ने समर्थन किया" : "neighbours backed this"}</span>}
        {!sent && !running && <button className="btn primary xl" onClick={send}>{t("send")} →</button>}
        {running && <div className="glass stack" style={{ padding: 16, gap: 6 }} role="status" aria-live="polite"><div className="row"><div className="spinner sm" /><b>{lastCall ? HUMAN[lastCall.tool]?.[L] || "…" : t("sending")}</b></div>
          <span className="tiny">{steps.filter(s => s.kind === "tool_result").length} / 6</span></div>}
      </div>
    </section>
    {sent && !running && <section className="card stack success" style={{ gap: 14 }}>
      <div className="row"><span className="ok-dot" aria-hidden>✓</span><h2>{t("sent")}</h2></div>
      <p className="mut">{t("remind")} {r.followup_due && <b>({r.followup_due})</b>}</p>
      {r.wonder?.screenshot || r.filed_screenshot ? null : null}
      <div><span className="tiny">{t("share")}</span><Share id={r.id} text={shareText} /></div></section>}
    {r.report?.subject && <section className="card stack" style={{ gap: 12 }}><span className="eyebrow">{lang === "hi" ? "आपकी शिकायत" : "Your complaint"}</span><h3>{r.report.subject}</h3>
      <div className="well"><pre>{(lang === "hi" ? r.report.body_hi : r.report.body_en || "").split("\n").filter((l: string) => !/^(Details|विवरण)\s*:/.test(l.trim())).join("\n")}</pre></div>
      <div className="row"><button className="btn" onClick={() => navigator.clipboard?.writeText(`${r.report.subject}\n\n${lang === "hi" ? r.report.body_hi : r.report.body_en}`)}>{lang === "hi" ? "शिकायत कॉपी करें" : "Copy complaint"}</button>{!sent && <Share id={r.id} text={shareText} />}</div></section>}
    <details className="card"><summary><b>{t("details")}</b></summary>
      <div className="stack" style={{ gap: 18, marginTop: 16 }}>
        <div className="grid">{r.potholes.map((p: any) => <div className="card sm stack" style={{ gap: 8 }} key={p.id}>
          {p.image && <img className="media" src={API + p.image} alt="" />}
          <div className="row between"><b>#{p.id} {p.hazard || "Pothole"}</b><span className={"pill " + p.severity}>{HOWBAD[p.severity]?.[L]}</span></div>
          <span className="tiny">{p.repair?.area_m2_est ?? "—"} m² · {inr(p.repair?.inr_est)} · score {p.score}</span></div>)}</div>
        <div className="row"><a className="btn" href={`${API}/reports/${r.id}/coco`}>COCO dataset (.zip)</a><span className="tiny">SAM 3.1 prompts: {r.plan?.prompts?.join(", ")}</span></div>
        <Timeline rid={r.id} rerides={all.filter(x => x.id !== r.id)} />
      </div></details>
  </main>;
}
export default function Page() { return <Suspense><R /></Suspense>; }
