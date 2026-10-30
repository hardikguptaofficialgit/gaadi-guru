"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API, get } from "../api";
import { useT, Stepper, WARDS, nearestWard, mine } from "../i18n";
const STAGES = { en: ["Uploading your ride…", "Spotting potholes…", "Measuring how big they are…", "Blurring faces and number plates for privacy…", "Working out the repair cost…", "Writing your complaint in Hindi and English…"],
  hi: ["आपकी राइड अपलोड हो रही है…", "गड्ढे ढूंढ रहे हैं…", "उनका साइज़ नाप रहे हैं…", "प्राइवेसी के लिए चेहरे और नंबर प्लेट धुंधले कर रहे हैं…", "मरम्मत का खर्च निकाल रहे हैं…", "हिंदी और अंग्रेज़ी में शिकायत लिख रहे हैं…"] };
export default function New() {
  const r = useRouter(); const { t, lang } = useT();
  const [file, setFile] = useState<File | null>(null); const [voice, setVoice] = useState<File | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null); const [locState, setLocState] = useState<"wait" | "ok" | "no">("wait");
  const [ward, setWard] = useState(WARDS[0][0]); const [near, setNear] = useState<any[]>([]); const [voted, setVoted] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [stage, setStage] = useState(0); const [err, setErr] = useState("");
  useEffect(() => {
    if (!navigator.geolocation) { setLocState("no"); return; }
    navigator.geolocation.getCurrentPosition(p => { const c = { lat: p.coords.latitude, lng: p.coords.longitude }; setPos(c); setLocState("ok"); setWard(nearestWard(c.lat, c.lng));
      get(`/nearby?lat=${c.lat}&lng=${c.lng}`).then(setNear).catch(() => {}); }, () => setLocState("no"), { timeout: 6000 });
  }, []);
  useEffect(() => { if (!busy) return; const i = setInterval(() => setStage(s => Math.min(s + 1, 5)), 9000); return () => clearInterval(i); }, [busy]);
  async function go() {
    if (!file) return; setBusy(true); setStage(0); setErr("");
    const fd = new FormData(); fd.append("video", file); fd.append("ward", ward); if (voice) fd.append("voice_note", voice);
    if (pos) { fd.append("lat", String(pos.lat)); fd.append("lng", String(pos.lng)); }
    try { const x = await fetch(API + "/analyze", { method: "POST", body: fd }); if (!x.ok) throw new Error(await x.text()); const j = await x.json(); mine.add(j.id); r.push(`/report?id=${j.id}`); }
    catch (e: any) { setErr(lang === "hi" ? "कुछ गड़बड़ हुई, फिर कोशिश करें।" : "Something went wrong. Please try again."); console.error(e); setBusy(false); }
  }
  const up = (id: string) => fetch(`${API}/reports/${id}/upvote`, { method: "POST" }).then(() => setVoted(v => [...v, id]));
  const isPhoto = file?.type.startsWith("image/");
  return <main className="wrap narrow stack" style={{ gap: 22, paddingTop: 12 }}>
    <Stepper at={1} />
    {busy ? <div className="card stack center" style={{ gap: 18, padding: 40 }} role="status" aria-live="polite">
      <div className="spinner" aria-hidden /><h2>{STAGES[lang][stage]}</h2>
      <ol className="stages">{STAGES[lang].map((s, i) => <li key={i} className={i < stage ? "done" : i === stage ? "on" : ""}>{s}</li>)}</ol>
      <p className="tiny">{lang === "hi" ? "लगभग 1–2 मिनट" : "Takes about 1–2 minutes"}</p></div>
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
        <label className="field">{t("ward")}<select value={ward} onChange={e => setWard(e.target.value)}>{WARDS.map(w => <option key={w[0]}>{w[0]}</option>)}</select></label></div>
      <button className="btn primary xl" disabled={!file} onClick={go}>{t("check")} →</button>
      {err && <p role="alert" style={{ color: "var(--crit)" }}>{err}</p>}
    </div>}
  </main>;
}
