"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API, get } from "../api";
import { useT, Stepper, mine } from "../i18n";
import VoiceNote from "./VoiceNote";
import Icon from "../Icon";
import Where, { Loc } from "./Where";
const ORDER = ["prepare", "plan", "scan", "upload", "sam", "privacy", "render", "write"];
const LABEL: Record<string, [string, string]> = { prepare: ["Preparing your ride", "आपकी राइड तैयार हो रही है"], plan: ["Muse Spark is reading the road", "Muse Spark सड़क देख रहा है"],
  scan: ["Searching for other hazards", "दूसरे खतरे ढूंढ रहे हैं"], upload: ["Sending frames to SAM", "फ्रेम SAM को भेज रहे हैं"], sam: ["Measuring each pothole", "हर गड्ढे का साइज़ नाप रहे हैं"],
  privacy: ["Blurring faces and number plates", "चेहरे और नंबर प्लेट धुंधले कर रहे हैं"], render: ["Drawing the marked-up video", "निशान वाला वीडियो बना रहे हैं"], write: ["Writing your complaint in Hindi and English", "हिंदी और अंग्रेज़ी में शिकायत लिख रहे हैं"] };
export default function New() {
  const r = useRouter(); const { t, lang } = useT();
  const [file, setFile] = useState<File | null>(null); const [voice, setVoice] = useState<File | null>(null);
  const [loc, setLoc] = useState<Loc>({ src: null });
  const [ward, setWard] = useState(""); const [wards, setWards] = useState<string[]>([]); const [near, setNear] = useState<any[]>([]); const [voted, setVoted] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [job, setJob] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => { if (loc.locality) setWard(w => w || loc.locality!);
    if (loc.src === "browser" && loc.lat != null) get(`/nearby?lat=${loc.lat}&lng=${loc.lng}`).then(setNear).catch(() => {}); }, [loc.lat, loc.lng, loc.locality, loc.src]);
  useEffect(() => { get("/wards").then(setWards).catch(() => {}); }, []);
  async function go() {
    if (!file) return; setBusy(true); setJob(null); setErr("");
    const fd = new FormData(); fd.append("video", file); fd.append("ward", ward); if (voice) fd.append("voice_note", voice);
    if (loc.lat != null && loc.lng != null) { fd.append("lat", String(loc.lat)); fd.append("lng", String(loc.lng)); }
    if (loc.src) fd.append("loc_source", loc.src); if (loc.src === "manual" && loc.city) fd.append("city", loc.city);
    try { const x = await fetch(API + "/jobs", { method: "POST", body: fd }); if (!x.ok) throw new Error(await x.text()); const { job_id } = await x.json();
      for (;;) { await new Promise(z => setTimeout(z, 1000)); const j = await get(`/jobs/${job_id}`); setJob(j);
        if (j.state === "done") { mine.add(j.report_id); r.push(`/report?id=${j.report_id}`); return; }
        if (j.state === "error") throw new Error(j.error); } }
    catch (e: any) { setErr(lang === "hi" ? "कुछ गड़बड़ हुई, फिर कोशिश करें।" : "Something went wrong. Please try again."); console.error(e); setBusy(false); }
  }
  const up = (id: string) => fetch(`${API}/reports/${id}/upvote`, { method: "POST" }).then(() => setVoted(v => [...v, id]));
  const isPhoto = file?.type.startsWith("image/"); const H = lang === "hi";
  const st = job?.stage || "prepare"; const at = Math.max(0, ORDER.indexOf(st)); const last = job?.events?.[job.events.length - 1];
  return <main className="wrap narrow page">
    <Stepper at={1} />
    {busy ? <div className="card stack center gap-4" style={{ padding: "var(--s5) var(--s4)" }} role="status" aria-live="polite" data-testid="progress">
      <div className="spinner" aria-hidden />
      <div className="stack gap-1 center"><h2>{LABEL[ORDER[at]]?.[H ? 1 : 0]}</h2>
        {last?.n ? <p className="mut small">{last.text} ({last.i + 1}/{last.n})</p> : job?.cache_hit ? <p className="mut small">{H ? "यह राइड पहले देखी है — सेव नतीजा" : "Seen this ride before — using the saved result"}</p> : null}</div>
      <div className="progress" style={{ width: "100%" }}><i style={{ width: `${((at + 1) / ORDER.length) * 100}%` }} /></div>
      <ol className="stages">{ORDER.map((s, i) => <li key={s} className={i < at ? "done" : i === at ? "on" : ""}><span className="d">{i < at && <Icon n="check" s={12} />}</span>{LABEL[s][H ? 1 : 0]}</li>)}</ol>
      <p className="tiny num">{job ? `${job.elapsed_s?.toFixed?.(0) ?? 0}s · Meta API $${(job.spend_usd ?? 0).toFixed(3)}` : (H ? "अपलोड हो रहा है…" : "Uploading…")}</p></div>
    : <div className="card stack gap-4">
      <div className="stack gap-1"><h2>{H ? "सड़क दिखाइए" : "Show us the road"}</h2><p className="mut small">{H ? "लगभग 1 मिनट लगेगा। चेहरे और नंबर प्लेट अपने-आप धुंधले होते हैं।" : "Takes about a minute. Faces and number plates are blurred automatically."}</p></div>
      {near.length > 0 && <div className="glass stack gap-2" style={{ padding: "var(--s3)" }}><b className="small">{t("same")}</b>
        {near.slice(0, 2).map(n => <div key={n.id} className="row between"><span className="mut small row gap-2"><Icon n="pin" s={14} />{n.count} {t("found")} · {n.distance_m} m · <Icon n="thumb" s={14} />{n.upvotes + (voted.includes(n.id) ? 1 : 0)}</span>
          <button className="btn" disabled={voted.includes(n.id)} onClick={() => up(n.id)}>{voted.includes(n.id) ? t("upvoted") : t("upvote")}</button></div>)}
        <span className="tiny">{t("orNew")}</span></div>}
      <label className="field">{t("upVideo")}
        <span className={"drop" + (file ? " has" : "")}><input type="file" accept="video/*,image/*" capture="environment" aria-label={t("upVideo")} data-testid="video-input" onChange={e => setFile(e.target.files?.[0] || null)} />
          <span className={"ico-tile" + (file ? " ok" : "")}><Icon n={file ? (isPhoto ? "camera" : "video") : "upload"} /></span>
          <b>{file ? file.name : (H ? "टैप करें या फ़ाइल यहां छोड़ें" : "Tap to choose, or drop a file here")}</b>
          <span className="tiny">{file ? `${(file.size / 1e6).toFixed(1)} MB` : t("upHint")}</span></span></label>
      <div className="field"><span>{t("voice")}</span><VoiceNote value={voice} onChange={setVoice} H={lang === "hi"} /></div>
      <Where H={H} onChange={setLoc} />
      <label className="field">{t("ward")}<input value={ward} list="wards" placeholder={H ? "वार्ड / इलाका" : "Ward / locality"} onChange={e => setWard(e.target.value)} data-testid="ward-input" />
        <datalist id="wards">{wards.map(w => <option key={w} value={w} />)}</datalist></label>
      <button className="btn primary lg block" disabled={!file} onClick={go} data-testid="check-road">{t("check")}<Icon n="arrow" s={18} /></button>
      {err && <p role="alert" style={{ color: "var(--crit)" }}>{err}</p>}
    </div>}
  </main>;
}
