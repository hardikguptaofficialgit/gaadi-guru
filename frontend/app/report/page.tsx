"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { API } from "../api";
import Result from "../Result";
function R() {
  const id = useSearchParams().get("id"); const [r, setR] = useState<any>(null);
  useEffect(() => { if (id) fetch(`${API}/reports/${id}`).then(x => x.json()).then(setR); }, [id]);
  return <main><h1>Gaadi <span>Guru</span> report</h1>{r ? <Result r={r} /> : <p>Loading…</p>}</main>;
}
export default function Page() { return <Suspense><R /></Suspense>; }
