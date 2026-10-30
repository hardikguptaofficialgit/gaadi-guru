"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, MotionConfig, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { API, get, inr } from "../api";
import { useT } from "../i18n";
import Smooth from "./Smooth";
import Icon from "./Icon";
gsap.registerPlugin(ScrollTrigger, useGSAP);
const HotMap = dynamic(() => import("../HotMap"), { ssr: false });
const ease = [0.22, 1, 0.36, 1] as const;
const up = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
const inView = { initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.25 } } as const;
// Verified: MoRTH "Road Accidents in India 2023", Table 3.5 (road features) and state annexure.
const SRC = "https://morth.gov.in/backend/documents/uploaded/Road-Accident-in-India-2023-Publications.pdf";

const S = createContext<any>(null);
function useL() { const { lang } = useT(); return (en: string, hi: string) => (lang === "hi" ? hi : en); }
const n = (x: number) => Math.round(x || 0).toLocaleString("en-IN");

/** Line-by-line text reveal: each line slides up inside its own mask. */
function Lines({ lines, as: Tag = "h2", className = "", delay = 0, now = false }: { lines: string[]; as?: any; className?: string; delay?: number; now?: boolean }) {
  const M = (motion as any)[Tag];
  return <M className={className} initial="hidden" {...(now ? { animate: "show" } : { whileInView: "show", viewport: { once: true, amount: 0.6 } })}
    variants={{ hidden: {}, show: { transition: { staggerChildren: 0.11, delayChildren: delay } } }}>
    {lines.map((l, i) => <span key={i + l} className="ln"><motion.span className="ln-i" variants={{ hidden: { y: "105%" }, show: { y: "0%", transition: { duration: 0.85, ease } } }}>{l}</motion.span></span>)}
  </M>;
}

/** Magnetic CTA: the button drifts toward the pointer, springs back on leave. */
function Magnetic({ children, k = 0.3 }: { children: React.ReactNode; k?: number }) {
  const x = useMotionValue(0), y = useMotionValue(0); const sx = useSpring(x, { stiffness: 220, damping: 18 }), sy = useSpring(y, { stiffness: 220, damping: 18 });
  const reduce = useReducedMotion();
  return <motion.div className="mag" style={reduce ? {} : { x: sx, y: sy }}
    onPointerMove={e => { if (e.pointerType !== "mouse") return; const r = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - r.left - r.width / 2) * k); y.set((e.clientY - r.top - r.height / 2) * k); }}
    onPointerLeave={() => { x.set(0); y.set(0); }}>{children}</motion.div>;
}

/** Card that tilts a few degrees toward the cursor (transform only, 60fps). */
function Tilt({ className = "", children, ...rest }: { className?: string; children: React.ReactNode } & any) {
  const px = useMotionValue(0.5), py = useMotionValue(0.5); const reduce = useReducedMotion();
  const rx = useSpring(useTransform(py, [0, 1], [3, -3]), { stiffness: 180, damping: 20 }); const ry = useSpring(useTransform(px, [0, 1], [-3, 3]), { stiffness: 180, damping: 20 });
  return <motion.div {...rest} className={"tilt " + className} style={reduce ? {} : { rotateX: rx, rotateY: ry, transformPerspective: 900 }}
    onPointerMove={(e: any) => { if (e.pointerType !== "mouse") return; const r = e.currentTarget.getBoundingClientRect(); px.set((e.clientX - r.left) / r.width); py.set((e.clientY - r.top) / r.height); }}
    onPointerLeave={() => { px.set(0.5); py.set(0.5); }}>{children}</motion.div>;
}

function Head({ eyebrow, lines, sub }: { eyebrow: string; lines: string[]; sub?: string }) {
  return <div className="l-head">
    <motion.span className="eyebrow" variants={up} {...inView}>{eyebrow}</motion.span>
    <Lines lines={lines} className="l-h2" />
    {sub && <motion.p variants={up} {...inView} className="l-sub">{sub}</motion.p>}
  </div>;
}

function Hero() {
  const s = useContext(S); const f = s?.featured; const L = useL(); const reduce = useReducedMotion();
  const chip = (d: number) => reduce ? {} : { animate: { y: [0, -8, 0] }, transition: { duration: 5, repeat: Infinity, ease: "easeInOut" as const, delay: d } };
  return <section className="l-hero">
    <div className="l-hero-copy">
      <motion.span className="l-badge" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}><img src="/logo.svg" alt="" width={18} height={18} />{L("Built on Meta SAM 3.1 + Muse agents", "Meta SAM 3.1 + Muse एजेंट पर बना")}</motion.span>
      <Lines now as="h1" className="l-h1" delay={0.1} lines={L("Every bad road,|reported in one tap.", "हर खराब सड़क,|एक टैप में रिपोर्ट।").split("|")} />
      <motion.p className="l-lead" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.45 }}>
        {L("Record your ride. Gaadi Guru finds each pothole, blurs faces and plates, prices the repair, fills the complaint and checks back in 7 days.",
           "राइड रिकॉर्ड करें। गाड़ी गुरु हर गड्ढा ढूंढता है, चेहरे और नंबर प्लेट धुंधले करता है, मरम्मत का खर्च निकालता है, शिकायत भरता है और 7 दिन बाद फिर जांचता है।")}</motion.p>
      <motion.div className="row" style={{ gap: 20 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.55 }}>
        <Magnetic><Link href="/new" className="btn primary xl cta">{L("Report a road", "सड़क रिपोर्ट करें")}<Icon n="arrow" s={18} /></Link></Magnetic>
        <a href="#how" className="l-link">{L("See how it works", "कैसे काम करता है")}</a>
      </motion.div>
      <motion.div className="l-trust" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
        {[L("Hindi + English", "हिंदी + अंग्रेज़ी"), L("Free for citizens", "नागरिकों के लिए मुफ़्त"), L("Faces blurred before saving", "सेव से पहले चेहरे धुंधले")].map(t => <span key={t}><Icon n="check" s={14} />{t}</span>)}</motion.div>
    </div>
    <motion.div className="l-visual" initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, ease, delay: 0.2 }}>
      <div className="phone"><div className="phone-notch" />
        {f?.overlay ? <video src={API + f.overlay} autoPlay muted loop playsInline aria-label={L("Pothole masks drawn by SAM 3.1 on a real ride", "असली राइड पर SAM 3.1 के गड्ढा निशान")} /> : <div className="phone-empty" />}
        <div className="phone-bar"><b>{f ? `${f.count} ${L("potholes", "गड्ढे")}` : "…"}</b>{f?.dangerous ? <span className="pill CRITICAL">{f.dangerous} {L("dangerous", "खतरनाक")}</span> : null}</div></div>
      {f && <>
        <motion.div className="float f1 glass" {...chip(0)}><span className="dot" style={{ background: "var(--crit)" }} />{L("Largest", "सबसे बड़ा")} · {f.top_m2} m²</motion.div>
        <motion.div className="float f2 glass" {...chip(1.2)}><b>{inr(f.inr)}</b><span className="tiny">{L("est. to fix this stretch", "इस हिस्से की अनुमानित मरम्मत")}</span></motion.div>
        <motion.div className="float f3 glass" {...chip(2.4)}><Icon n="eyeoff" s={16} />{L("Faces & plates blurred", "चेहरे व प्लेट धुंधले")}</motion.div></>}
    </motion.div>
    <p className="l-hero-src tiny">{f ? L(`Live from report ${f.id} · ${f.ward || ""}`, `रिपोर्ट ${f.id} से लाइव · ${f.ward || ""}`) : ""}</p>
  </section>;
}

function Problem() {
  const root = useRef<HTMLElement>(null); const L = useL();
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add({ ok: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" }, ctx => {
      const el = root.current!.querySelector<HTMLElement>(".count")!; const obj = { v: 0 };
      if (ctx.conditions!.reduce) { el.textContent = "2,161"; return; }
      gsap.to(obj, { v: 2161, duration: 2, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(obj.v).toLocaleString("en-IN"); }, scrollTrigger: { trigger: root.current, start: "top 70%", once: true } });
      gsap.from(".p-bar i", { scaleX: 0, transformOrigin: "left", duration: 1.2, ease: "power3.out", stagger: 0.12, scrollTrigger: { trigger: ".p-bars", start: "top 80%" } });
    });
  }, { scope: root });
  const rows: [string, string, number][] = [["5,840", L("pothole-related crashes in 2023", "2023 में गड्ढों से जुड़े हादसे"), 100],
    ["+31.4%", L("more pothole crashes than 2022 (4,446)", "2022 (4,446) से ज़्यादा हादसे"), 31.4],
    ["61%", L("of pothole deaths were in Uttar Pradesh (1,320)", "गड्ढा-मौतें उत्तर प्रदेश में (1,320)"), 61]];
  return <section ref={root} className="l-sec" id="problem">
    <div className="l-problem">
      <div><span className="eyebrow">{L("The problem", "समस्या")}</span><div className="l-count"><span className="count">0</span></div>
        <Lines as="p" className="l-h3" lines={[L("people died in pothole-related", "लोगों की मौत 2023 में भारत में"), L("crashes in India in 2023.", "गड्ढों से जुड़े हादसों में हुई।")]} />
        <p className="tiny l-cite">{L("Up 16.4% from 1,856 in 2022. Source: ", "2022 के 1,856 से 16.4% ज़्यादा। स्रोत: ")}
          <a href={SRC} target="_blank" rel="noreferrer">MoRTH, <i>Road Accidents in India 2023</i>, Table 3.5 & state annexure</a></p></div>
      <div className="card p-bars stack" style={{ gap: 22 }}>
        {rows.map(([a, b, w]) => <div key={a} className="stack" style={{ gap: 8 }}><div className="row between"><b className="l-num">{a}</b><span className="mut" style={{ fontSize: 14 }}>{b}</span></div>
          <div className="p-bar"><i style={{ width: `${w}%` }} /></div></div>)}
        <p className="mut" style={{ fontSize: 14 }}>{L("Most complaints never get filed: the portal takes 10 minutes, needs an exact location and nobody follows up.", "ज़्यादातर शिकायतें दर्ज ही नहीं होतीं: पोर्टल में 10 मिनट लगते हैं, सही जगह चाहिए और कोई फॉलो-अप नहीं करता।")}</p>
      </div></div>
  </section>;
}

/** Drag to compare: privacy-blurred raw frame vs the SAM 3.1 mask on the same frame. */
function Compare() {
  const s = useContext(S); const f = s?.featured; const L = useL(); const [v, setV] = useState(50); const box = useRef<HTMLDivElement>(null); const drag = useRef(false);
  const at = (x: number) => { const r = box.current!.getBoundingClientRect(); setV(Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100))); };
  if (!f) return null;
  return <section className="l-sec" id="see">
    <Head eyebrow={L("What SAM 3.1 sees", "SAM 3.1 क्या देखता है")} lines={L("Drag to see the road|the way the model does.", "खींचकर देखें, मॉडल|सड़क को कैसे देखता है।").split("|")}
      sub={L(`Frame ${f.best_frame} of report ${f.id}. Left: the camera frame (faces and plates already blurred). Right: every pothole masked and rated.`, `रिपोर्ट ${f.id} का फ्रेम ${f.best_frame}। बाएं: कैमरा फ्रेम (चेहरे-प्लेट धुंधले)। दाएं: हर गड्ढे का निशान और रेटिंग।`)} />
    <motion.div variants={up} {...inView} ref={box} className="cmp card" onPointerDown={e => { drag.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); at(e.clientX); }}
      onPointerMove={e => drag.current && at(e.clientX)} onPointerUp={() => (drag.current = false)}>
      <img src={`${API}/reports/${f.id}/frame?kind=overlay`} alt={L("SAM 3.1 pothole masks", "SAM 3.1 गड्ढा निशान")} draggable={false} />
      <img src={`${API}/reports/${f.id}/frame?kind=raw`} alt={L("Raw camera frame", "कैमरा फ्रेम")} draggable={false} className="cmp-top" style={{ clipPath: `inset(0 ${100 - v}% 0 0)` }} />
      <div className="cmp-bar" style={{ transform: `translateX(${v}%)` }}><span className="cmp-knob"><Icon n="arrow" s={14} className="flip" /><Icon n="arrow" s={14} /></span></div>
      <span className="cmp-tag l">{L("Camera", "कैमरा")}</span><span className="cmp-tag r">SAM 3.1</span>
      <input className="cmp-range" type="range" min={0} max={100} value={v} onChange={e => setV(+e.target.value)} aria-label={L("Compare raw frame and mask", "फ्रेम और निशान की तुलना")} />
    </motion.div>
  </section>;
}

function How() {
  const root = useRef<HTMLElement>(null); const L = useL(); const f = useContext(S)?.featured;
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
      const cards = gsap.utils.toArray<HTMLElement>(".h-step");
      const tl = gsap.timeline({ scrollTrigger: { trigger: ".h-pin", start: "top top+=96", end: "+=1400", pin: true, scrub: 0.6, invalidateOnRefresh: true } });
      tl.fromTo(".h-progress i", { scaleX: 0 }, { scaleX: 1, ease: "none", duration: 3 }, 0);
      cards.forEach((c, i) => {
        tl.fromTo(c, { opacity: 0.3, y: 40 }, { opacity: 1, y: 0, duration: 0.6 }, i);
        tl.fromTo(`.h-shot-${i}`, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.6 }, i);
        if (i < cards.length - 1) tl.to(`.h-shot-${i}`, { opacity: 0, duration: 0.4 }, i + 0.85);
      });
    });
  }, { scope: root, dependencies: [!!f] });
  const STEPS: [string, string, string, string][] = [["01", "camera", L("Record or snap", "रिकॉर्ड या फोटो"), L("Mount your phone and ride, or take one photo. Location and locality fill in by themselves.", "फ़ोन लगाकर राइड करें या एक फोटो लें। जगह और इलाका अपने-आप भर जाते हैं।")],
    ["02", "scan", L("We review the road", "हम सड़क जांचते हैं"), L("SAM 3.1 outlines every pothole, rates how bad it is, measures it in m² and estimates the fix in ₹.", "SAM 3.1 हर गड्ढे की रेखा खींचता है, गंभीरता बताता है, m² में नापता है और ₹ में खर्च आंकता है।")],
    ["03", "form", L("Complaint filled, reminder set", "शिकायत भरी, रिमाइंडर लगा"), L("The agent fills the city portal form for you to check and submit, then reminds you in 7 days.", "एजेंट पोर्टल फॉर्म भरता है, आप जांचकर सबमिट करें; 7 दिन बाद याद दिलाता है।")]];
  const shots = f ? [`${API}/reports/${f.id}/frame?kind=raw`, `${API}/reports/${f.id}/frame?kind=overlay`, f.portal ? API + f.portal : `${API}/reports/${f.id}/frame?kind=overlay`] : [];
  return <section ref={root} className="l-sec" id="how">
    <Head eyebrow={L("How it works", "कैसे काम करता है")} lines={L("Three steps.|About a minute.", "तीन कदम।|लगभग एक मिनट।").split("|")} sub={L("No forms to understand, no office to visit.", "न फॉर्म समझना, न दफ़्तर जाना।")} />
    <div className="h-pin">
      <div className="h-progress" aria-hidden><i /></div>
      <div className="h-grid">
        <div className="h-steps">{STEPS.map(([k, ic, t, d]) => <div key={k} className="h-step card sm"><span className="h-n"><Icon n={ic} s={22} /></span><div><span className="tiny">{k}</span><h3>{t}</h3><p className="mut">{d}</p></div></div>)}</div>
        <div className="h-stage card">{shots.map((src, i) => <img key={i} className={`h-shot h-shot-${i}`} src={src} alt={STEPS[i][2]} />)}</div>
      </div></div>
  </section>;
}

function Bento() {
  const s = useContext(S); const L = useL(); const r = s?.rates;
  return <section className="l-sec" id="features">
    <Head eyebrow={L("Features", "खूबियां")} lines={L("Everything a complaint needs.|Nothing it doesn't.", "शिकायत को जो चाहिए, सब।|जो नहीं चाहिए, कुछ नहीं।").split("|")} />
    <motion.div className="bento" variants={stagger} {...inView}>
      <Tilt variants={up} className="bento-t card b-big"><div><Icon n="scan" s={26} /><h3>{L("Sees what you see", "जो आप देखते हैं, वही देखता है")}</h3>
        <p className="mut">{L("Pixel-accurate outlines of potholes, plus a scan for open manholes, waterlogging and more, tracked across the video so each one is counted once.", "गड्ढों की सटीक रेखाएं, साथ में खुले मैनहोल, जलभराव आदि की जांच; वीडियो में हर एक को एक ही बार गिना जाता है।")}</p></div>
        {s?.featured && <img src={`${API}/reports/${s.featured.id}/frame?kind=overlay`} alt="" className="b-img" />}</Tilt>
      <Tilt variants={up} className="bento-t card"><Icon n="rupee" s={26} /><h3>{L("Prices the fix", "मरम्मत का दाम")}</h3><p className="mut">{L("Measured area × patching rate.", "नापा गया क्षेत्र × पैचिंग दर।")}</p>
        <div className="b-big-num">{r ? inr(r.pothole_inr_per_m2) : "—"}<span>/m²</span></div><span className="tiny">{L("Assumption: typical urban patching rate, not a municipal quote", "अनुमान: सामान्य शहरी पैचिंग दर, नगर निगम का कोटेशन नहीं")}</span></Tilt>
      <Tilt variants={up} className="bento-t card"><Icon n="lang" s={26} /><h3>{L("Writes in your language", "आपकी भाषा में")}</h3><p className="mut">{L("Complaint drafted in Hindi and English. Speak a voice note in either.", "शिकायत हिंदी और अंग्रेज़ी में। वॉइस नोट किसी में भी बोलें।")}</p>
        <div className="row" style={{ marginTop: "auto" }}><span className="pill">हिंदी</span><span className="pill">English</span></div></Tilt>
      <Tilt variants={up} className="bento-t card b-wide"><div><Icon n="form" s={26} /><h3>{L("Fills the portal for you", "पोर्टल आपके लिए भरता है")}</h3>
        <p className="mut">{L("Muse Wonder opens the grievance form, fills every field and stops before Submit so you stay in control.", "Muse Wonder शिकायत फॉर्म खोलकर हर फ़ील्ड भरता है और सबमिट से पहले रुकता है, फैसला आपका।")}</p></div>
        {s?.featured?.portal && <img src={API + s.featured.portal} alt="" className="b-img top" />}</Tilt>
      <Tilt variants={up} className="bento-t card"><Icon n="bike" s={26} /><h3>{L("Ride mode", "राइड मोड")}</h3><p className="mut">{L("Phone on the handlebar. Hear “आगे गड्ढा है” before you hit it.", "फ़ोन हैंडल पर। गड्ढे से पहले सुनें “आगे गड्ढा है”।")}</p></Tilt>
      <Tilt variants={up} className="bento-t card"><Icon n="user" s={26} /><h3>{L("Same pothole?", "वही गड्ढा?")}</h3><p className="mut">{L("Nearby reports get an upvote instead of a duplicate.", "पास की रिपोर्ट को दोबारा दर्ज करने की जगह समर्थन मिलता है।")}</p></Tilt>
    </motion.div>
  </section>;
}

const TOOLS: [string, string, string, string][] = [["analyze_video", "scan", "Looking at your ride", "राइड देख रहे हैं"], ["check_duplicates", "map", "Checking for duplicates", "डुप्लिकेट जांच"],
  ["estimate_repair_cost", "rupee", "Working out the cost", "खर्च निकाल रहे हैं"], ["draft_complaint", "doc", "Writing the complaint", "शिकायत लिख रहे हैं"],
  ["file_complaint", "form", "Filling the city portal", "पोर्टल फॉर्म भर रहे हैं"], ["schedule_followup", "bell", "Setting a reminder", "रिमाइंडर लगा रहे हैं"], ["verify_repair", "refresh", "Checking the repair", "मरम्मत जांच"]];
function detail(tool: string, r: any, L: (a: string, b: string) => string) {
  if (!r) return null;
  if (r.error) return L("Failed: ", "विफल: ") + r.error;
  switch (tool) {
    case "analyze_video": return `${r.count} ${L("hazards", "खतरे")} · ${r.severity?.CRITICAL || 0} ${L("dangerous", "खतरनाक")}`;
    case "check_duplicates": return r.open_duplicate ? L("Open report nearby, upvoted instead", "पास में खुली रिपोर्ट, समर्थन किया") : `${r.duplicates?.length || 0} ${L("nearby, none open within 50 m", "पास में, 50 m में कोई खुली नहीं")}`;
    case "estimate_repair_cost": return `${inr(r.total_inr)} ${L("across", "कुल")} ${r.items?.length || 0} ${L("sites", "जगह")}`;
    case "draft_complaint": return L("Hindi + English draft ready", "हिंदी + अंग्रेज़ी ड्राफ्ट तैयार");
    case "file_complaint": return `${r.fields_filled ?? "—"} ${L("fields filled · waiting for you to submit", "फ़ील्ड भरे · सबमिट आपका")}`;
    case "schedule_followup": return `${L("Re-check on", "फिर जांच")} ${r.followup_due}`;
    case "verify_repair": return r.verdict;
  }
}
function Agent() {
  const root = useRef<HTMLElement>(null); const L = useL(); const f = useContext(S)?.featured;
  const res: Record<string, any> = {}; (f?.agent || []).forEach((a: any) => (res[a.tool] = a.result));
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(".a-line i", { scaleY: 0 }, { scaleY: 1, ease: "none", transformOrigin: "top", scrollTrigger: { trigger: ".a-list", start: "top 70%", end: "bottom 60%", scrub: 0.5 } });
      gsap.utils.toArray<HTMLElement>(".a-item").forEach(el => gsap.fromTo(el, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.6, ease: "power3.out", immediateRender: false, scrollTrigger: { trigger: el, start: "top 92%", once: true } }));
    });
  }, { scope: root, dependencies: [!!f] });
  return <section ref={root} className="l-sec" id="agent">
    <div className="a-grid">
      <Head eyebrow={L("The agent at work", "काम करता एजेंट")} lines={L("It doesn't just detect.|It follows through.", "सिर्फ़ पहचानता नहीं,|अंत तक पीछा करता है।").split("|")}
        sub={L(`A Muse Spark agent plans and calls seven tools on its own. This is its real log for report ${f?.id || "…"}.`, `Muse Spark एजेंट खुद योजना बनाकर सात टूल चलाता है। यह रिपोर्ट ${f?.id || "…"} का असली लॉग है।`)} />
      <div className="a-list"><div className="a-line" aria-hidden><i /></div>
        {TOOLS.map(([k, ic, en, hi]) => { const d = detail(k, res[k], L); const ok = d && !res[k]?.error;
          return <div key={k} className={"a-item glass" + (d ? "" : " wait")}><span className="a-dot"><Icon n={ic} s={18} /></span><div><b>{L(en, hi)}</b>
            <p className="tiny">{d || (k === "verify_repair" ? L("Runs when someone re-rides this road", "जब कोई यह सड़क दोबारा रिकॉर्ड करे तब चलता है") : L("Not run yet", "अभी नहीं चला"))}</p></div>
            <span className="a-ok">{ok ? <Icon n="check" s={16} /> : res[k]?.error ? <Icon n="alert" s={16} /> : null}</span></div>; })}</div>
    </div>
  </section>;
}

function Impact() {
  const [pts, setPts] = useState<any[]>([]); const [lb, setLb] = useState<any[]>([]); const s = useContext(S); const L = useL();
  useEffect(() => { get("/reports").then(setPts).catch(() => {}); get("/leaderboard").then(setLb).catch(() => {}); }, []);
  const max = Math.max(1, ...lb.map(w => w.inr));
  const nums: [string, string][] = s ? [[n(s.reports), L("reports", "रिपोर्ट")], [n(s.hazards), L("hazards mapped", "खतरे दर्ज")], [inr(s.inr_total), L("repair backlog (est.)", "मरम्मत बकाया (अनुमान)")], [`${s.filed}/${s.reports}`, L("complaints filled", "शिकायतें भरी गईं")]] : [];
  return <section className="l-sec" id="impact">
    <Head eyebrow={L("City impact", "शहर पर असर")} lines={L("Every report adds|to a public map.", "हर रिपोर्ट जुड़ती है|एक सार्वजनिक नक्शे में।").split("|")} sub={L("Wards are ranked by what they fix, not what they promise. All numbers below are live.", "वार्डों की रैंकिंग काम से, वादों से नहीं। नीचे सारे आंकड़े लाइव हैं।")} />
    <motion.div className="i-nums" variants={stagger} {...inView}>{nums.map(([a, b]) => <motion.div key={b} variants={up} className="card sm"><b className="l-num">{a}</b><span className="tiny">{b}</span></motion.div>)}</motion.div>
    <div className="i-grid">
      <motion.div className="card" style={{ padding: 12 }} variants={up} {...inView}><HotMap points={pts} height={380} /></motion.div>
      <motion.div className="card stack" style={{ gap: 18 }} variants={stagger} {...inView}>
        <h3>{L("Ward ranking", "वार्ड रैंकिंग")}</h3>
        {lb.slice(0, 4).map((w, i) => <motion.div key={w.ward} variants={up} className="stack" style={{ gap: 6 }}>
          <div className="row between"><b style={{ fontSize: 14 }}>{i + 1}. {w.ward}</b><span className="tiny">{w.hazards} {L("potholes", "गड्ढे")} · {inr(w.inr)}</span></div>
          <div className="p-bar"><motion.i initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1, ease, delay: 0.1 * i }} style={{ width: `${(w.inr / max) * 100}%`, transformOrigin: "left" }} /></div></motion.div>)}
        {!lb.length && <p className="mut">{L("The ranking appears once the first ward gets a report.", "पहली रिपोर्ट के बाद रैंकिंग दिखेगी।")}</p>}
        <Link href="/map" className="l-link" style={{ marginTop: "auto" }}>{L("Open the city map", "शहर का नक्शा खोलें")} →</Link>
      </motion.div></div>
  </section>;
}

function Privacy() {
  const L = useL();
  const P: [string, string, string][] = [["eyeoff", L("Blurred before saving", "सेव से पहले धुंधला"), L("Faces and number plates are found by SAM 3.1 and blurred before any image is stored or shown.", "चेहरे और नंबर प्लेट SAM 3.1 ढूंढकर किसी भी तस्वीर के सेव होने से पहले धुंधले करता है।")],
    ["shield", L("You press Submit", "सबमिट आप दबाते हैं"), L("The agent never sends a complaint on its own. It fills the form and waits.", "एजेंट खुद शिकायत नहीं भेजता। फॉर्म भरकर इंतज़ार करता है।")],
    ["user", L("No account needed", "अकाउंट की ज़रूरत नहीं"), L("Reports are tied to a place, not a person. Name and phone are optional.", "रिपोर्ट जगह से जुड़ी है, व्यक्ति से नहीं। नाम और फ़ोन वैकल्पिक हैं।")]];
  return <section className="l-sec" id="privacy">
    <Head eyebrow={L("Privacy", "प्राइवेसी")} lines={[L("Built so nobody gets exposed.", "ऐसा बना कि कोई उजागर न हो।")]} />
    <motion.div className="g3" variants={stagger} {...inView}>{P.map(([ic, t, d]) => <Tilt key={t} variants={up} className="card sm stack" style={{ gap: 10 }}>
      <span className="pv-ico"><Icon n={ic} s={20} /></span><h3>{t}</h3><p className="mut">{d}</p></Tilt>)}</motion.div>
  </section>;
}

function CTA() {
  const L = useL();
  return <section className="l-sec">
    <div className="l-cta card">
      <motion.img variants={up} {...inView} src="/logo.svg" width={56} height={56} alt="" />
      <Lines lines={[L("Seen a bad road today?", "आज कोई खराब सड़क दिखी?")]} className="l-h2" />
      <motion.p variants={up} {...inView} className="l-sub">{L("It takes about a minute. We handle the paperwork.", "लगभग एक मिनट लगता है। कागज़ी काम हम करेंगे।")}</motion.p>
      <Magnetic><Link href="/new" className="btn primary xl cta">{L("Report a road", "सड़क रिपोर्ट करें")}<Icon n="arrow" s={18} /></Link></Magnetic>
    </div>
  </section>;
}

export default function Landing() {
  const [s, setS] = useState<any>(null);
  useEffect(() => { get("/stats").then(setS).catch(() => {}); }, []);
  useEffect(() => { if (s) requestAnimationFrame(() => ScrollTrigger.refresh()); }, [s]);
  return <MotionConfig reducedMotion="user"><S.Provider value={s}><Smooth />
    <main className="wrap landing"><Hero /><Problem /><Compare /><How /><Bento /><Agent /><Impact /><Privacy /><CTA /></main></S.Provider></MotionConfig>;
}
