"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { get } from "../api";
import Result from "../Result";
import Timeline from "../Timeline";
function R() {
  const id = useSearchParams().get("id"); const [r, setR] = useState<any>(null); const [all, setAll] = useState<any[]>([]);
  useEffect(() => { if (id) { get(`/reports/${id}`).then(setR); get("/reports").then(setAll); } }, [id]);
  return <main className="wrap stack" style={{ gap: 28, paddingTop: 16 }}>
    <div><span className="eyebrow">Report {id}</span><h1 style={{ fontSize: 40, marginTop: 6 }}>Road inspection</h1></div>
    {r ? <><Result r={r} /><Timeline rid={r.id} rerides={all.filter(x => x.id !== r.id)} /></> : <p className="mut">Loading…</p>}
  </main>;
}
export default function Page() { return <Suspense><R /></Suspense>; }
