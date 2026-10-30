"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { API, get } from "./api";
const HotMap = dynamic(() => import("./HotMap"), { ssr: false });
const WARDS = ["Ward 12 - Saheed Nagar", "Ward 23 - Patia", "Ward 31 - Old Town", "Ward 45 - Chandrasekharpur", "Ward 7 - Nayapalli"];
const STEPS = [["SAM 3.1", "Segments and tracks every pothole, open manhole and waterlogged patch across the video."],
["Muse Spark", "Plans what to look for, dedups, prices the repair in ₹ and writes a bilingual complaint."],
["Muse Wonder", "Opens the grievance portal and fills the form, then stops so you press Submit."],
["Follow-up", "Re-ride after 7 days; the agent verifies whether the promise was kept."]];
export default function Home() {
  const r = useRouter();
  const [video, setVideo] = useState<File | null>(null); const [voice, setVoice] = useState<File | null>(null);
  const [ward, setWard] = useState(WARDS[0]); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [pts, setPts] = useState<any[]>([]);
  useEffect(() => { get("/reports").then(setPts).catch(() => {}); }, []);
  async function go() {
    if (!video) return; setBusy(true); setErr("");
    const pos: any = await new Promise(ok => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => ok(p.coords), () => ok(null), { timeout: 4000 }) : ok(null));
    const fd = new FormData(); fd.append("video", video); fd.append("ward", ward); if (voice) fd.append("voice_note", voice);
    if (pos) { fd.append("lat", String(pos.latitude)); fd.append("lng", String(pos.longitude)); }
    try { const x = await fetch(API + "/analyze", { method: "POST", body: fd }); if (!x.ok) throw new Error(await x.text()); const j = await x.json(); r.push(`/report?id=${j.id}`); }
    catch (e: any) { setErr(String(e.message || e)); setBusy(false); }
  }
  const total = pts.reduce((a, p) => a + p.count, 0);
  return <main className="wrap">
    <section className="section g2" style={{ alignItems: "center", gap: 48 }}>
      <div className="stack" style={{ gap: 20 }}>
        <span className="eyebrow">Civic AI agent · Bhubaneswar pilot</span>
        <h1>Your ride becomes a road repair.</h1>
        <p className="mut" style={{ fontSize: 18, maxWidth: 480 }}>Record a ride. Gaadi Guru measures every pothole with Meta SAM 3.1, prices the fix, files the complaint and checks back in a week.</p>
        <div className="row"><a href="#report" className="btn primary">Report a road</a><a href="/ride" className="btn">Start live ride</a></div>
        <div className="row" style={{ gap: 28, marginTop: 8 }}>
          <div className="stat"><b>{pts.length}</b><span>rides analysed</span></div>
          <div className="stat"><b>{total}</b><span>hazards mapped</span></div>
          <div className="stat"><b>0</b><span>faces or plates stored</span></div></div>
      </div>
      <div className="card" style={{ padding: 14 }}>
        <img className="media" src={API + "/media/89336bbfda/overlay.gif"} alt="SAM 3.1 overlay on a ride video" />
        <div className="row between" style={{ padding: "12px 6px 2px" }}><span className="tiny">Live SAM 3.1 masks · tracked IDs · severity</span><span className="pill CRITICAL">2 critical</span></div>
      </div>
    </section>
    <section className="g4">{STEPS.map(([t, d], i) => <div key={t} className="card sm stack" style={{ gap: 8 }}><span className="tiny">0{i + 1}</span><h3>{t}</h3><p className="mut" style={{ fontSize: 14 }}>{d}</p></div>)}</section>
    <section id="report" className="section g2">
      <div className="card stack" style={{ gap: 20 }}>
        <div><span className="eyebrow">New report</span><h2 style={{ marginTop: 6 }}>Upload a ride</h2></div>
        <label className="field">Ride video (MP4, up to 20 s is analysed)<div className="well"><input type="file" accept="video/*" onChange={e => setVideo(e.target.files?.[0] || null)} /></div></label>
        <label className="field">Voice note, Hindi or English (optional)<div className="well"><input type="file" accept="audio/*" onChange={e => setVoice(e.target.files?.[0] || null)} /></div></label>
        <label className="field">Ward<select value={ward} onChange={e => setWard(e.target.value)}>{WARDS.map(w => <option key={w}>{w}</option>)}</select></label>
        <button className="btn primary" disabled={!video || busy} onClick={go}>{busy ? "SAM 3.1 is inspecting the road… (~1–2 min)" : "Inspect road"}</button>
        {err && <p style={{ color: "var(--crit)" }}>{err}</p>}
        <p className="tiny">Same video twice? It is served from cache, no second API charge.</p>
      </div>
      <div className="card stack"><div className="row between"><h3>Hazard hotspots</h3><a className="tiny" href="/map">Full map →</a></div><HotMap points={pts} height={380} /></div>
    </section>
  </main>;
}
