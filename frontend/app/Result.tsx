import { API, inr } from "./api";
export default function Result({ r }: { r: any }) {
  const total = r.potholes.reduce((a: number, p: any) => a + (p.repair?.inr_est || 0), 0);
  const counts = ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(s => [s, r.potholes.filter((p: any) => p.severity === s).length]);
  return <div className="stack" style={{ gap: 24 }}>
    <div className="g2">
      <div className="card" style={{ padding: 14 }}>
        {r.overlay ? <video className="media" src={API + r.overlay} controls autoPlay muted loop playsInline /> : <p className="mut">No overlay</p>}
        <div className="row between" style={{ padding: "12px 6px 2px" }}><span className="tiny">SAM 3.1 prompts: {r.plan?.prompts?.join(", ")}</span>
          <div className="row"><a className="btn" style={{ padding: "8px 14px", fontSize: 13 }} href={`${API}/reports/${r.id}/coco`}>COCO dataset</a></div></div>
      </div>
      <div className="card stack" style={{ gap: 18 }}>
        <span className="eyebrow">{r.ward || "Unassigned ward"} · {r.status || "reported"}</span>
        <h2>{r.potholes.length} hazards found</h2>
        <div className="row">{counts.map(([s, n]) => <span key={s} className={"pill " + s}>{n} {String(s).toLowerCase()}</span>)}</div>
        <div className="g2" style={{ gap: 14 }}>
          <div className="well stat"><b>{inr(total)}</b><span>estimated repair cost</span></div>
          <div className="well stat"><b>{r.potholes.reduce((a: number, p: any) => a + (p.repair?.area_m2_est || 0), 0).toFixed(1)} m²</b><span>damaged surface</span></div></div>
        <p className="mut" style={{ fontSize: 14 }}>{r.plan?.notes}</p>
        {r.voice?.transcript && <div className="well"><span className="tiny">Voice note</span><p>{r.voice.transcript}</p></div>}
      </div>
    </div>
    <div className="grid">{r.potholes.map((p: any) => <div className="card sm stack" style={{ gap: 10 }} key={p.id}>
      {p.image && <img className="media" src={API + p.image} alt="" />}
      <div className="row between"><b>#{p.id} {p.hazard || "Pothole"}</b><span className={"pill " + p.severity}>{p.severity}</span></div>
      <dl className="kv"><dt>Score</dt><dd>{p.score}</dd><dt>Area</dt><dd>{p.repair?.area_m2_est ?? "—"} m² ({(p.area_ratio * 100).toFixed(1)}% of frame)</dd>
        <dt>Seen</dt><dd>{p.frames_seen} frames from {p.first_seen_s}s</dd><dt>Repair</dt><dd>{inr(p.repair?.inr_est)}</dd></dl></div>)}</div>
    {r.report?.subject && <div className="card stack"><span className="eyebrow">Complaint draft · {r.report.priority}</span><h3>{r.report.subject}</h3>
      <div className="g2"><div className="well"><pre>{r.report.body_en}</pre></div><div className="well"><pre>{r.report.body_hi}</pre></div></div>
      <div><button className="btn" onClick={() => navigator.clipboard.writeText(`${r.report.subject}\n\n${r.report.body_en}`)}>Copy complaint</button></div></div>}
  </div>;
}
