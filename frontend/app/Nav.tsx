"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { get } from "./api";
const L = [["/", "Report"], ["/ride", "Live ride"], ["/repairs", "Repair board"], ["/map", "Hotspots"]];
export default function Nav() {
  const path = usePathname(); const [c, setC] = useState<any>(null);
  useEffect(() => { get("/costs").then(setC).catch(() => {}); }, [path]);
  return <div className="nav"><div className="wrap"><div className="bar">
    <Link href="/" className="logo"><i />Gaadi Guru</Link>
    <nav className="links">{L.map(([h, t]) => <Link key={h} href={h} className={path === h ? "on" : ""}>{t}</Link>)}</nav>
    <span className="pill" title="Meta API spend (guard stops at $70)">API spend {c ? `$${c.total_usd.toFixed(2)}` : "—"} / $75</span>
  </div></div></div>;
}
