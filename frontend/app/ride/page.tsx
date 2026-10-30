"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { API, get } from "../api";
import { useT, mine } from "../i18n";
import Icon from "../Icon";
import { useToast } from "../ui";
import { queue } from "../offline";
// Live ride: 1 frame every 2.5 s -> SAM 3.1 image call ($0.0025). Auto-stops after 5 min (~$0.30 max).
// No / low network: frames go to IndexedDB instead, and upload as one ride (stitched server-side) when back online.
const EVERY_MS = 2500, MAX_MS = 5 * 60 * 1000, MAX_Q = 240;
export default function Ride() {
  const { lang } = useT(); const H = lang === "hi"; const T = (en: string, hi: string) => H ? hi : en; const toast = useToast();
  const [spent0, setSpent0] = useState<number | null>(null);
  const v = useRef<HTMLVideoElement>(null); const ov = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false); const [n, setN] = useState(0); const [hits, setHits] = useState(0); const [alert, setAlert] = useState(false);
  const [spent, setSpent] = useState<number | null>(null); const [err, setErr] = useState(""); const last = useRef(0);
  const [online, setOnline] = useState(true); const [low, setLow] = useState(false); const lowRef = useRef(false); lowRef.current = low;
  const [queued, setQueued] = useState(0); const [up, setUp] = useState<any>(null); const pos = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    setOnline(navigator.onLine); queue.count().then(setQueued).catch(() => {});
    const a = () => setOnline(true), b = () => setOnline(false); addEventListener("online", a); addEventListener("offline", b);
    navigator.geolocation?.getCurrentPosition(p => { pos.current = { lat: p.coords.latitude, lng: p.coords.longitude }; }, () => {}, { timeout: 5000 });
    return () => { removeEventListener("online", a); removeEventListener("offline", b); };
  }, []);
  // Back online with saved frames and not riding -> upload automatically.
  useEffect(() => { if (online && !low && !on && queued > 0 && !up) flush(); }, [online, low, on, queued]);
  function speak() {
    if (Date.now() - last.current < 6000) return; last.current = Date.now();
    const u = new SpeechSynthesisUtterance("आगे गड्ढा है, धीरे चलें"); u.lang = "hi-IN"; u.rate = 1;
    const hi = speechSynthesis.getVoices().find(x => x.lang.startsWith("hi")); if (hi) u.voice = hi; speechSynthesis.speak(u);
  }
  async function save(blob: Blob) {
    const c = await queue.count(); if (c >= MAX_Q) return;
    await queue.add({ t: Date.now(), blob, ...(pos.current || {}) }); setQueued(c + 1); setN(x => x + 1);
  }
  async function tick() {
    const vid = v.current!; if (!vid.videoWidth) return;
    const c = document.createElement("canvas"); const s = 640 / vid.videoWidth; c.width = 640; c.height = Math.round(vid.videoHeight * s);
    c.getContext("2d")!.drawImage(vid, 0, 0, c.width, c.height);
    const blob: Blob = await new Promise(ok => c.toBlob(b => ok(b!), "image/jpeg", 0.8));
    if (!navigator.onLine || lowRef.current) return save(blob);
    const fd = new FormData(); fd.append("frame", blob, "f.jpg");
    let r: Response; try { r = await fetch(API + "/live/frame", { method: "POST", body: fd }); } catch { return save(blob); } // network dropped mid-ride
    if (!r.ok) { setErr(await r.text()); return; }
    const j = await r.json(); setN(x => x + 1); setSpent(j.spent_usd); setSpent0(s0 => s0 ?? j.spent_usd - 0.0025); setAlert(j.alert);
    if (j.detections.length) setHits(x => x + j.detections.length); if (j.alert) speak();
    const o = ov.current!; o.width = c.width; o.height = c.height; const g = o.getContext("2d")!; g.clearRect(0, 0, o.width, o.height);
    g.lineWidth = 4; g.strokeStyle = "#d14b47"; g.font = "600 16px Inter, sans-serif"; g.fillStyle = "#d14b47";
    j.detections.forEach((d: any) => { const k = c.width / d.w; const [x1, y1, x2, y2] = d.box.map((z: number) => z * k); g.strokeRect(x1, y1, x2 - x1, y2 - y1); g.fillText(`${H ? "गड्ढा" : "pothole"} ${(d.conf ?? 0).toFixed(2)}`, x1, y1 - 6); });
  }
  async function flush() {
    const frames = await queue.all(); if (!frames.length) return;
    setUp({ state: "uploading", frames: frames.length }); setErr("");
    const fd = new FormData(); frames.sort((a, b) => a.t - b.t).forEach((f, i) => fd.append("frames", f.blob, `f${String(i).padStart(4, "0")}.jpg`));
    const p = frames.find(f => f.lat != null); if (p) { fd.append("lat", String(p.lat)); fd.append("lng", String(p.lng)); }
    try { const r = await fetch(API + "/rides/offline", { method: "POST", body: fd }); if (!r.ok) throw new Error(await r.text());
      const { job_id } = await r.json(); await queue.clear(); setQueued(0); toast(T(`Saved ride uploaded (${frames.length} frames)`, `सेव राइड अपलोड हुई (${frames.length} फ्रेम)`));
      for (;;) { await new Promise(z => setTimeout(z, 1500)); const j = await get(`/jobs/${job_id}`); setUp({ ...j, frames: frames.length });
        if (j.state === "done") { mine.add(j.report_id); return; } if (j.state === "error") throw new Error(j.error); } }
    catch (e: any) { setErr(String(e.message || e)); setUp(null); }
  }
  useEffect(() => {
    if (!on) return; let stream: MediaStream; let t: any; const t0 = Date.now();
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }).then(s => {
      stream = s; v.current!.srcObject = s; v.current!.play();
      t = setInterval(() => { if (Date.now() - t0 > MAX_MS) { setOn(false); return; } tick().catch(e => setErr(String(e))); }, EVERY_MS);
    }).catch(e => { setErr(T("Camera blocked: ", "कैमरा बंद है: ") + e.message); setOn(false); });
    return () => { clearInterval(t); stream?.getTracks().forEach(x => x.stop()); };
  }, [on]);
  const offlineMode = !online || low;
  return <main className="wrap page">
    <div className="page-head"><div><span className="eyebrow">{T("Live ride mode", "लाइव राइड मोड")}</span><h1>{T("Eyes on the road", "सड़क पर नज़र")}</h1>
      <p className="mut">{T("Mount the phone, press start. When SAM 3.1 sees a pothole ahead you hear “आगे गड्ढा है”.", "फ़ोन लगाइए, स्टार्ट दबाइए। SAM 3.1 को आगे गड्ढा दिखे तो आपको सुनाई देगा “आगे गड्ढा है”।")}</p></div>
      <div className="row"><button className="btn" onClick={speak}><Icon n="mic" s={16} />{T("Test voice alert", "आवाज़ अलर्ट जांचें")}</button>
        <button className={"btn " + (on ? "" : "primary")} data-testid="ride-toggle" onClick={() => { setErr(""); setOn(!on); }}><Icon n={on ? "x" : "play"} s={16} />{on ? T("Stop ride", "राइड रोकें") : T("Start ride", "राइड शुरू करें")}</button></div></div>
    <div className="split">
      <div className="card" style={{ padding: "var(--s2)" }}><div className="cam"><video ref={v} muted playsInline /><canvas ref={ov} className="ov" />
        {!on && <div className="cam-empty"><div className="stack center gap-2"><Icon n="camera" s={32} /><span className="small">{T("Camera starts when you press Start ride", "स्टार्ट दबाने पर कैमरा चालू होगा")}</span></div></div>}</div></div>
      <div className="stack">
        {alert && on && !offlineMode ? <div className="alert" role="alert">{T("Pothole ahead · आगे गड्ढा है", "आगे गड्ढा है")}</div>
          : <div className="card sm stack gap-1" data-testid="ride-status"><div className="row between"><b>{on ? (offlineMode ? T("Saving frames offline", "फ्रेम ऑफलाइन सेव हो रहे हैं") : T("Scanning…", "स्कैन हो रहा है…")) : T("Idle", "रुका हुआ")}</b>
            <span className={"badge " + (online ? "b-ok" : "b-bad")} data-testid="net-badge"><i />{online ? T("Online", "ऑनलाइन") : T("Offline", "ऑफलाइन")}</span></div>
            <p className="tiny">{T(`1 frame every ${EVERY_MS / 1000} s · auto-stop after 5 min`, `हर ${EVERY_MS / 1000} सेकंड 1 फ्रेम · 5 मिनट बाद अपने-आप बंद`)}</p></div>}
        <div className="stats"><div className="card sm stat"><b className="num">{n}</b><span>{T("frames checked", "फ्रेम जांचे")}</span></div><div className="card sm stat"><b className="num">{hits}</b><span>{T("detections", "पकड़े गए")}</span></div></div>
        <div className="card sm stat"><b className="num">${spent != null && spent0 != null ? (spent - spent0).toFixed(3) : "0.000"}</b><span>{T("this ride (server-metered)", "इस राइड का खर्च (सर्वर से)")} · {T("total", "कुल")} {spent != null ? `$${spent.toFixed(2)}` : "—"}</span></div>
        <div className="card sm stack gap-2" data-testid="offline-card"><div className="row between"><div className="row gap-2"><Icon n="wifioff" s={18} /><b className="small">{T("Low network mode", "कम नेटवर्क मोड")}</b></div>
          <label className="row gap-1 small" style={{ cursor: "pointer" }}><input type="checkbox" checked={low} onChange={e => setLow(e.target.checked)} data-testid="low-net" style={{ width: 20, minHeight: 20 }} />{T("Save for later", "बाद के लिए सेव")}</label></div>
          <p className="tiny">{T("With no signal, frames are kept on this phone and uploaded as one ride when you are back online.", "सिग्नल न हो तो फ्रेम फ़ोन में रहते हैं और नेटवर्क आने पर एक राइड की तरह अपलोड होते हैं।")}</p>
          <div className="row between"><span className="small num" data-testid="queued">{queued} {T("frames saved", "फ्रेम सेव")}</span>
            <button className="btn" disabled={!queued || !online || !!up && up.state !== "done"} onClick={flush} data-testid="flush">{T("Upload now", "अभी अपलोड करें")}</button></div>
          {up && <div className="well stack gap-1" role="status" data-testid="offline-job">{up.state === "done" ? <><b className="small">{T("Saved ride analysed", "सेव राइड जांची गई")}</b><Link className="btn primary" href={`/report?id=${up.report_id}`}>{T("Open report", "रिपोर्ट खोलें")}<Icon n="arrow" s={16} /></Link></>
            : <div className="row"><div className="spinner sm" /><span className="small">{up.state === "uploading" ? T(`Uploading ${up.frames} frames…`, `${up.frames} फ्रेम अपलोड…`) : `${up.stage || up.state}…`}</span></div>}</div>}</div>
        {err && <p role="alert" style={{ color: "var(--crit)" }}>{err}</p>}
      </div></div>
  </main>;
}
