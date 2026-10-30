"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API, get } from "./api";
import { useT } from "./i18n";
export default function Home() {
  const { t, lang } = useT(); const [pts, setPts] = useState<any[]>([]);
  useEffect(() => { get("/reports").then(setPts).catch(() => {}); }, []);
  const fixed = pts.filter(p => p.status === "fixed").length;
  return <main className="wrap">
    <section className="section hero">
      <div className="stack" style={{ gap: 22 }}>
        <img src="/logo.svg" alt="Gaadi Guru logo" width={64} height={64} className="hero-logo" />
        <h1>{t("hero")}</h1>
        <p className="mut lead">{t("sub")}</p>
        <Link href="/new" className="btn primary xl">{t("cta")} →</Link>
        <div className="row mut" style={{ gap: 18, fontSize: 14 }}>
          <Link href="/ride">{t("ride")}</Link><span aria-hidden>·</span><Link href="/map">{t("map")}</Link></div>
        <div className="row" style={{ gap: 28, marginTop: 6 }}>
          <div className="stat"><b>{pts.reduce((a, p) => a + p.count, 0)}</b><span>{lang === "hi" ? "गड्ढे मैप हुए" : "potholes mapped"}</span></div>
          <div className="stat"><b>{pts.length}</b><span>{lang === "hi" ? "रिपोर्ट" : "reports"}</span></div>
          <div className="stat"><b>{fixed}</b><span>{lang === "hi" ? "ठीक हुए" : "fixed"}</span></div></div>
      </div>
      <div className="card" style={{ padding: 12 }}><img className="media" src={API + "/media/89336bbfda/overlay.gif"} alt="Potholes outlined on a ride video" /></div>
    </section>
  </main>;
}
