"use client";
import { useEffect, useRef, useState } from "react";
import { API } from "../api";
import { useT } from "../i18n";
// Live ride: 1 frame every 2.5 s -> SAM 3.1 image call ($0.0025). Auto-stops after 5 min (~$0.30 max).
const EVERY_MS = 2500, MAX_MS = 5 * 60 * 1000;
export default function Ride() {
  const { lang } = useT(); const H = lang === "hi"; const T = (en: string, hi: string) => H ? hi : en;
  const [spent0, setSpent0] = useState<number | null>(null);
  const v = useRef<HTMLVideoElement>(null); const ov = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false); const [n, setN] = useState(0); const [hits, setHits] = useState(0); const [alert, setAlert] = useState(false);
  const [spent, setSpent] = useState<number | null>(null); const [err, setErr] = useState(""); const last = useRef(0);
  function speak() {
    if (Date.now() - last.current < 6000) return; last.current = Date.now();
    const u = new SpeechSynthesisUtterance("आगे गड्ढा है, धीरे चलें"); u.lang = "hi-IN"; u.rate = 1;
    const hi = speechSynthesis.getVoices().find(x => x.lang.startsWith("hi")); if (hi) u.voice = hi; speechSynthesis.speak(u);
  }
  async function tick() {
    const vid = v.current!; if (!vid.videoWidth) return;
    const c = document.createElement("canvas"); const s = 640 / vid.videoWidth; c.width = 640; c.height = Math.round(vid.videoHeight * s);
    c.getContext("2d")!.drawImage(vid, 0, 0, c.width, c.height);
    const blob: Blob = await new Promise(ok => c.toBlob(b => ok(b!), "image/jpeg", 0.8));
    const fd = new FormData(); fd.append("frame", blob, "f.jpg");
    const r = await fetch(API + "/live/frame", { method: "POST", body: fd }); if (!r.ok) { setErr(await r.text()); return; }
    const j = await r.json(); setN(x => x + 1); setSpent(j.spent_usd); setSpent0(s0 => s0 ?? j.spent_usd - 0.0025); setAlert(j.alert);
    if (j.detections.length) setHits(x => x + j.detections.length); if (j.alert) speak();
    const o = ov.current!; o.width = c.width; o.height = c.height; const g = o.getContext("2d")!; g.clearRect(0, 0, o.width, o.height);
    g.lineWidth = 4; g.strokeStyle = "#d9534f"; g.font = "600 16px Inter, sans-serif"; g.fillStyle = "#d9534f";
    j.detections.forEach((d: any) => { const k = c.width / d.w; const [x1, y1, x2, y2] = d.box.map((z: number) => z * k); g.strokeRect(x1, y1, x2 - x1, y2 - y1); g.fillText(`${H ? "गड्ढा" : "pothole"} ${(d.conf ?? 0).toFixed(2)}`, x1, y1 - 6); });
  }
  useEffect(() => {
    if (!on) return; let stream: MediaStream; let t: any; const t0 = Date.now();
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }).then(s => {
      stream = s; v.current!.srcObject = s; v.current!.play();
      t = setInterval(() => { if (Date.now() - t0 > MAX_MS) { setOn(false); return; } tick().catch(e => setErr(String(e))); }, EVERY_MS);
    }).catch(e => { setErr(T("Camera blocked: ", "कैमरा बंद है: ") + e.message); setOn(false); });
    return () => { clearInterval(t); stream?.getTracks().forEach(x => x.stop()); };
  }, [on]);
  return <main className="wrap stack" style={{ gap: 24, paddingTop: 16 }}>
    <div className="row between"><div><span className="eyebrow">{T("Live ride mode", "लाइव राइड मोड")}</span><h1 style={{ fontSize: 40, marginTop: 6 }}>{T("Eyes on the road", "सड़क पर नज़र")}</h1>
      <p className="mut" style={{ marginTop: 8 }}>{T("Mount the phone, press start. When SAM 3.1 sees a pothole ahead you hear “आगे गड्ढा है”.", "फ़ोन लगाइए, स्टार्ट दबाइए। SAM 3.1 को आगे गड्ढा दिखे तो आपको सुनाई देगा “आगे गड्ढा है”।")}</p></div>
      <div className="row"><button className="btn" onClick={speak}>{T("Test voice alert", "आवाज़ अलर्ट जांचें")}</button><button className={"btn " + (on ? "" : "primary")} onClick={() => { setErr(""); setOn(!on); }}>{on ? T("Stop ride", "राइड रोकें") : T("Start ride", "राइड शुरू करें")}</button></div></div>
    <div className="g2" style={{ gridTemplateColumns: "2fr 1fr" }}>
      <div className="card" style={{ padding: 14 }}><div className="cam"><video ref={v} muted playsInline style={{ minHeight: 280, background: "var(--surface-2)" }} /><canvas ref={ov} className="ov" /></div></div>
      <div className="stack">
        {alert && on ? <div className="alert">{T("Pothole ahead · आगे गड्ढा है", "आगे गड्ढा है")}</div> : <div className="card sm"><b>{on ? T("Scanning…", "स्कैन हो रहा है…") : T("Idle", "रुका हुआ")}</b><p className="tiny">{T(`1 frame every ${EVERY_MS / 1000} s · auto-stop after 5 min`, `हर ${EVERY_MS / 1000} सेकंड 1 फ्रेम · 5 मिनट बाद अपने-आप बंद`)}</p></div>}
        <div className="g2" style={{ gap: 14 }}><div className="card sm stat"><b>{n}</b><span>{T("frames checked", "फ्रेम जांचे")}</span></div><div className="card sm stat"><b>{hits}</b><span>{T("detections", "पकड़े गए")}</span></div></div>
        <div className="card sm stat"><b>${spent != null && spent0 != null ? (spent - spent0).toFixed(3) : "0.000"}</b><span>{T("this ride (server-metered)", "इस राइड का खर्च (सर्वर से)")} · {T("total API spend", "कुल API खर्च")} {spent != null ? `$${spent.toFixed(2)}` : "—"}</span></div>
        {err && <p style={{ color: "var(--crit)" }}>{err}</p>}
      </div></div>
  </main>;
}
