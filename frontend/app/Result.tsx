import { API } from "./api";
export default function Result({ r }: { r: any }) {
  return <div>
    <div className="card"><h2>{r.potholes.length} pothole(s) found</h2>
      <p className="mut">Spark asked SAM to look for: {r.plan?.prompts?.join(", ")} · {r.plan?.notes}</p></div>
    <div className="grid">{r.potholes.map((p: any) => <div className="card" key={p.id}>
      {p.image && <img src={API + p.image} alt="" />}
      <p><span className={"pill " + p.severity}>{p.severity}</span> score {p.score} · seen {p.frames_seen} frames · at {p.first_seen_s}s</p>
      <p className="mut">covers {(p.area_ratio * 100).toFixed(1)}% of frame · conf {p.confidence}</p></div>)}</div>
    {r.voice?.transcript && <div className="card"><h3>🎙️ Voice note</h3><p>{r.voice.transcript}</p></div>}
    {r.report?.subject && <div className="card"><h3>📝 Complaint ({r.report.priority})</h3><b>{r.report.subject}</b>
      <pre>{r.report.body_en}</pre><pre>{r.report.body_hi}</pre>
      <button onClick={() => navigator.clipboard.writeText(`${r.report.subject}\n\n${r.report.body_en}`)}>Copy complaint</button></div>}
  </div>;
}
