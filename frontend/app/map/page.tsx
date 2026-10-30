"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { get } from "../api";
const HotMap = dynamic(() => import("../HotMap"), { ssr: false });
export default function Page() {
  const [pts, setPts] = useState<any[]>([]); useEffect(() => { get("/reports").then(setPts); }, []);
  return <main className="wrap stack" style={{ gap: 24, paddingTop: 16 }}>
    <div><span className="eyebrow">City view</span><h1 style={{ fontSize: 40, marginTop: 6 }}>Hazard hotspots</h1></div>
    <div className="card" style={{ padding: 14 }}><HotMap points={pts} height={560} /></div>
    <div className="row">{["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(s => <span key={s} className={"pill " + s}>{s.toLowerCase()}</span>)}<span className="tiny">Circle size = hazards in that ride</span></div>
  </main>;
}
