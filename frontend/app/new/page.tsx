"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API, get } from "../api";
import { useT, Stepper, mine } from "../i18n";
const ORDER = ["prepare", "plan", "scan", "upload", "sam", "privacy", "render", "write"];
const LABEL: Record<string, [string, string]> = { prepare: ["Preparing your ride", "आपकी राइड तैयार हो रही है"], plan: ["Muse Spark is reading the road", "Muse Spark सड़क देख रहा है"],
  scan: ["Searching for other hazards", "दूसरे खतरे ढूंढ रहे हैं"], upload: ["Sending frames to SAM", "फ्रेम SAM को भेज रहे हैं"], sam: ["Measuring each pothole", "हर गड्ढे का साइज़ नाप रहे हैं"],
  privacy: ["Blurring faces and number plates", "चेहरे और नंबर प्लेट धुंधले कर रहे हैं"], render: ["Drawing the marked-up video", "निशान वाला वीडियो बना रहे हैं"], write: ["Writing your complaint in Hindi and English", "हिंदी और अंग्रेज़ी में शिकायत लिख रहे हैं"] };
export default function New() {
  const r = useRouter(); const { t, lang } = useT();
  const [file, setFile] = useState<File | null>(null); const [voice, setVoice] = useState<File | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null); const [locState, setLocState] = useState<"wait" | "ok" | "no">("wait");
  const [ward, setWard] = useState(""); const [wards, setWards] = useState<string[]>([]); const [near, setNear] = useState<any[]>([]); const [voted, setVoted] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [job, setJob] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => {
    if (!navigator.geolocation) { setLocState("no"); return; }
    navigator.geolocation.getCurrentPosition(p => { const c = { lat: p.coords.latitude, lng: p.coords.longitude }; setPos(c); setLocState("ok"); get(`/geo/reverse?lat=${c.lat}&lng=${c.lng}`).then(g => g?.locality && setWard(w => w || g.locality)).catch(() => {});
      get(`/nearby?lat=${c.lat}&lng=${c.lng}`).then(setNear).catch(() => {}); }, () => setLocState("no"), { timeout: 6000 });
  }, []);
  useEffect(() => { get("/wards").then(setWards).catch(() => {}); }, []);
  async function go() {
    if (!file) return; setBusy(true); setJob(null); setErr("");
    const fd = new FormData(); fd.append("video", file); fd.append("ward", ward); if (voice) fd.append("voice_note", voice);
    if (pos) { fd.append("lat", String(pos.lat)); fd.append("lng", String(pos.lng)); }
    try { const x = await fetch(API + "/jobs", { method: "POST", body: fd }); if (!x.ok) throw new Error(await x.text()); const { job_id } = await x.json();
      for (;;) { await new Promise(z => setTimeout(z, 1000)); const j = await get(`/jobs/${job_id}`); setJob(j);
        if (j.state === "done") { mine.add(j.report_id); r.push(`/report?id=${j.report_id}`); return; }
        if (j.state === "error") throw new Error(j.error); } }
    catch (e: any) { setErr(lang === "hi" ? "कुछ गड़बड़ हुई, फिर कोशिश करें।" : "Something went wrong. Please try again."); console.error(e); setBusy(false); }
  }
  const up = (id: string) => fetch(`${API}/reports/${id}/upvote`, { method: "POST" }).then(() => setVoted(v => [...v, id]));
  const isPhoto = file?.type.startsWith("image/");
  return <main className="wrap narrow stack" style={{ gap: 22, paddingTop: 12 }}>
    <Stepper at={1} />
    {busy ? <div className="card stack center" style={{ gap: 18, padding: 40 }} role="status" aria-live="polite">
      <div className="spinner" aria-hidden />{(() => { const st = job?.stage || "prepare"; const at = Math.max(0, ORDER.indexOf(st)); const last = job?.events?.[job.events.length - 1];
        return <><h2>{LABEL[ORDER[at]]?.[lang === "hi" ? 1 : 0]}</h2>
        {last?.n ? <p className="mut">{last.text} ({last.i + 1}/{last.n})</p> : job?.cache_hit ? <p className="mut">{lang === "hi" ? "यह राइड पहले देखी है — सेव नतीजा" : "Seen this ride before — using the saved result"}</p> : null}
        <ol className="stages">{ORDER.map((s, i) => <li key={s} className={i < at ? "done" : i === at ? "on" : ""}>{LABEL[s][lang === "hi" ? 1 : 0]}</li>)}</ol>
        <p className="tiny">{job ? `${job.elapsed_s?.toFixed?.(0) ?? 0}s · API $${(job.spend_usd ?? 0).toFixed(3)}` : (lang === "hi" ? "अपलोड हो रहा है…" : "Uploading…")}</p></>; })()}</div>
    : <div className="card stack" style={{ gap: 20 }}>
      <h2>{lang === "hi" ? "सड़क दिखाइए" : "Show us the road"}</h2>
      {near.length > 0 && <div className="glass stack" style={{ padding: 16, gap: 10 }}><b>{t("same")}</b>
        {near.slice(0, 2).map(n => <div key={n.id} className="row between"><span className="mut" style={{ fontSize: 14 }}>{n.count} {t("found")} · {n.distance_m} m · 👍 {n.upvotes + (voted.includes(n.id) ? 1 : 0)}</span>
          <button className="btn" disabled={voted.includes(n.id)} onClick={() => up(n.id)}>{voted.includes(n.id) ? t("upvoted") : t("upvote")}</button></div>)}
        <span className="tiny">{t("orNew")}</span></div>}
      <label className="field">{t("upVideo")}
        <span className={"drop" + (file ? " has" : "")}><input type="file" accept="video/*,image/*" capture="environment" aria-label={t("upVideo")} onChange={e => setFile(e.target.files?.[0] || null)} />
          <b>{file ? `${isPhoto ? "📷" : "🎥"} ${file.name}` : (lang === "hi" ? "टैप करें या फ़ाइल यहां छोड़ें" : "Tap to choose, or drop a file here")}</b>
          <span className="tiny">{file ? `${(file.size / 1e6).toFixed(1)} MB` : t("upHint")}</span></span></label>
      <label className="field">{t("voice")}
        <span className={"drop sm" + (voice ? " has" : "")}><input type="file" accept="audio/*" aria-label={t("voice")} onChange={e => setVoice(e.target.files?.[0] || null)} />
          <b>{voice ? `🎙 ${voice.name}` : "🎙 " + t("voiceHint")}</b></span></label>
      <div className="g2" style={{ gap: 14 }}>
        <div className="field">{t("loc")}<div className="glass chip-line">{locState === "ok" ? `📍 ${t("locOk")}` : locState === "wait" ? "📍 …" : `📍 ${t("locNo")}`}</div></div>
        <label className="field">{t("ward")}<input value={ward} list="wards" placeholder={lang === "hi" ? "वार्ड / इलाका" : "Ward / locality"} onChange={e => setWard(e.target.value)} />
          <datalist id="wards">{wards.map(w => <option key={w} value={w} />)}</datalist></label></div>
      <button className="btn primary xl" disabled={!file} onClick={go}>{t("check")} →</button>
      {err && <p role="alert" style={{ color: "var(--crit)" }}>{err}</p>}
    </div>}
  </main>;
}
