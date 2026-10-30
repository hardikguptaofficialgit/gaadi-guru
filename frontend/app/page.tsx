"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { API } from "./api";
import Result from "./Result";
const Heatmap = dynamic(() => import("./Heatmap"), { ssr: false });
export default function Home() {
  const [video, setVideo] = useState<File | null>(null); const [voice, setVoice] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [res, setRes] = useState<any>(null); const [err, setErr] = useState("");
  const [pts, setPts] = useState<any[]>([]);
  const load = () => fetch(API + "/reports").then(r => r.json()).then(setPts).catch(() => {});
  useEffect(() => { load(); }, []);
  async function go() {
    if (!video) return; setBusy(true); setErr(""); setRes(null);
    const pos: any = await new Promise(ok => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => ok(p.coords), () => ok(null)) : ok(null));
    const fd = new FormData(); fd.append("video", video); if (voice) fd.append("voice_note", voice);
    if (pos) { fd.append("lat", String(pos.latitude)); fd.append("lng", String(pos.longitude)); }
    try { const r = await fetch(API + "/analyze", { method: "POST", body: fd }); if (!r.ok) throw new Error(await r.text()); setRes(await r.json()); load(); }
    catch (e: any) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }
  return <main>
    <h1>Gaadi <span>Guru</span></h1>
    <p className="mut">Ride. Record. Report. Your phone video becomes a measured, privacy-safe pothole complaint — powered by Meta SAM 3.1 + Muse Spark + Muse Voice.</p>
    <div className="card">
      <p>🎥 Ride video <input type="file" accept="video/*" onChange={e => setVideo(e.target.files?.[0] || null)} /></p>
      <p>🎙️ Voice note (Hindi/English, optional) <input type="file" accept="audio/*" onChange={e => setVoice(e.target.files?.[0] || null)} /></p>
      <button disabled={!video || busy} onClick={go}>{busy ? "SAM is inspecting the road…" : "Inspect road"}</button>
      {err && <p style={{ color: "#e63946" }}>{err}</p>}
    </div>
    {res && <Result r={res} />}
    <div className="card"><h3>🔥 Pothole heatmap</h3><Heatmap points={pts} /></div>
  </main>;
}
