"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, MotionConfig, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { API, get, inr } from "../api";
import { useT } from "../i18n";
import Smooth from "./Smooth";
import Icon from "./Icon";
import { Brand } from "../Icon";
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

const TOOLS: [string, string, string, string][] = [["analyze_video", "scan", "Looking at your ride", "राइड देख रहे हैं"], ["check_duplicates", "map", "Checking for duplicates", "डुप्लिकेट जांच"],
  ["estimate_repair_cost", "rupee", "Working out the cost", "खर्च निकाल रहे हैं"], ["draft_complaint", "doc", "Writing the complaint", "शिकायत लिख रहे हैं"],
  ["file_complaint", "form", "Filling the city portal", "पोर्टल फॉर्म भर रहे हैं"], ["schedule_followup", "bell", "Setting a reminder", "रिमाइंडर लगा रहे हैं"], ["verify_repair", "refresh", "Checking the repair", "मरम्मत जांच"]];
function detail(tool: string, r: any, L: (a: string, b: string) => string) {
  if (!r) return null;
  if (r.error) return L("Failed: ", "विफल: ") + r.error;
  switch (tool) {
    case "analyze_video": return `${r.count} ${L("hazards", "खतरे")}, ${r.severity?.CRITICAL || 0} ${L("dangerous", "खतरनाक")}`;
    case "check_duplicates": return r.open_duplicate ? L("Open report nearby, upvoted instead", "पास में खुली रिपोर्ट, समर्थन किया") : `${r.duplicates?.length || 0} ${L("nearby, none open within 50 m", "पास में, 50 m में कोई खुली नहीं")}`;
    case "estimate_repair_cost": return `${inr(r.total_inr)} ${L("across", "कुल")} ${r.items?.length || 0} ${L("sites", "जगह")}`;
    case "draft_complaint": return L("Hindi + English draft ready", "हिंदी + अंग्रेज़ी ड्राफ्ट तैयार");
    case "file_complaint": return `${r.fields_filled ?? "No"} ${L("fields filled, waiting for you to submit", "फ़ील्ड भरे, सबमिट आपका")}`;
    case "schedule_followup": return `${L("Re-check on", "फिर जांच")} ${r.followup_due}`;
    case "verify_repair": return r.verdict;
  }
}

function Idx({ i, t }: { i: string; t: string }) { return <div className="l-idx"><span className="num">{i}</span><span>{t}</span></div>; }

/** Three-column value strip under the hero, ruled by hairlines. */
function Strip() {
  const L = useL();
  const V: [string, string, string, string][] = [["scan", "01", L("Detect", "पहचान"), L("SAM 3.1 outlines every pothole in your ride and rates how bad it is.", "SAM 3.1 राइड में हर गड्ढे का निशान और गंभीरता बताता है।")],
    ["gov", "02", L("Route", "सही विभाग"), L("Finds the body that owns the road, with the source for every contact.", "सड़क किस विभाग की है, हर संपर्क के स्रोत के साथ।")],
    ["mail", "03", L("Send", "भेजें"), L("A ready email in English and Hindi, or the portal form field by field.", "अंग्रेज़ी-हिंदी में तैयार ईमेल, या पोर्टल फ़ॉर्म फ़ील्ड-दर-फ़ील्ड।")]];
  return <motion.ol className="l-strip" variants={stagger} {...inView}>{V.map(([ic, i, t, d]) => <motion.li key={i} variants={up}>
    <div className="row between"><Icon n={ic} s={20} /><span className="tiny num">{i}</span></div><h3>{t}</h3><p className="mut small">{d}</p></motion.li>)}</motion.ol>;
}

/** Send to the right authority: real coverage from /authorities. */
function Send() {
  const L = useL(); const [d, setD] = useState<any>(null);
  useEffect(() => { get("/authorities").then(setD).catch(() => {}); }, []);
  const a: any[] = d?.authorities || []; const cities = (cc: string) => Array.from(new Set(a.filter(x => x.country === cc && x.city).map(x => x.city))).sort();
  const IN = cities("IN"), US = cities("US");
  const withMail = a.filter(x => (x.emails || []).length).length, withPf = a.filter(x => x.has_portal_format).length;
  return <section className="l-sec" id="send">
    <Idx i="03" t={L("Send", "भेजें")} />
    <div className="l-two">
      <div className="l-head"><Lines lines={L("Sent to the office|that owns the road.", "उसी दफ़्तर तक|जिसकी सड़क है।").split("|")} className="l-h2" />
        <motion.p variants={up} {...inView} className="l-sub">{L("Patchwise picks the authority from the location, and you can change the city. Then one tap opens a ready email in English and Hindi, or a copy-ready list of the portal's fields in order. Every contact shows its source and how sure we are.",
          "Patchwise जगह से विभाग चुनता है, शहर आप बदल सकते हैं। फिर एक टैप में अंग्रेज़ी-हिंदी ईमेल, या पोर्टल के फ़ील्ड क्रम से कॉपी के लिए। हर संपर्क का स्रोत और भरोसा दिखता है।")}</motion.p></div>
      <motion.dl className="l-table" variants={stagger} {...inView}>
        {d ? <>
          <motion.div variants={up}><dt>{L("India", "भारत")} <span className="tiny num">{IN.length}</span></dt><dd>{IN.join(" · ")}</dd></motion.div>
          <motion.div variants={up}><dt>{L("United States", "अमेरिका")} <span className="tiny num">{US.length}</span></dt><dd>{US.join(" · ")}</dd></motion.div>
          <motion.div variants={up}><dt><Icon n="mail" s={16} /> {L("Email", "ईमेल")}</dt><dd>{L(`${withMail} authorities with a checked complaint email; the rest get the portal and helpline instead.`, `${withMail} विभागों के जांचे हुए ईमेल; बाकी के लिए पोर्टल और हेल्पलाइन।`)}</dd></motion.div>
          <motion.div variants={up}><dt><Icon n="form" s={16} /> {L("Portal format", "पोर्टल फ़ॉर्म")}</dt><dd>{L(`${withPf} portals mapped field by field, each with a copy button.`, `${withPf} पोर्टल फ़ील्ड-दर-फ़ील्ड, हर एक पर कॉपी बटन।`)}</dd></motion.div>
        </> : <motion.div variants={up}><dt>{L("Coverage", "कवरेज")}</dt><dd className="mut">{L("Loading the authority list", "सूची लोड हो रही है")}</dd></motion.div>}
      </motion.dl>
    </div>
  </section>;
}

/* Hallmark redesign: one idea per screen, no eyebrows, no feature grid, page ends on its one action. */
function Hero() {
  const s = useContext(S); const f = s?.featured; const L = useL();
  return <section className="hm-hero">
    <div className="hm-hero-copy">
      <Lines now as="h1" className="l-h1" delay={0.05} lines={L("Every bad road,|reported in one tap.", "हर खराब सड़क,|एक टैप में रिपोर्ट।").split("|")} />
      <motion.p className="l-lead" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.35 }}>
        {L("Record your ride. Patchwise finds each pothole, prices the fix and routes the complaint to the authority that owns the road.",
           "राइड रिकॉर्ड करें। Patchwise हर गड्ढा ढूंढता है, मरम्मत का खर्च निकालता है और शिकायत सही विभाग तक पहुंचाता है।")}</motion.p>
      <motion.div className="row" style={{ gap: 20 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.45 }}>
        <Magnetic><Link href="/new" className="btn primary xl cta">{L("Report a road", "सड़क रिपोर्ट करें")}<Icon n="arrow" s={18} /></Link></Magnetic>
        <a href="#record" className="l-link">{L("See a real report", "असली रिपोर्ट देखें")}</a>
      </motion.div>
      <motion.p className="l-built tiny" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.6 }}>
        <span>{L("Built on", "आधार")}</span><span className="row gap-1"><Brand b="meta" s={12} label="Meta" /> SAM 3.1 · Muse</span>
        <span className="row gap-1"><Brand b="openstreetmap" s={14} label="OpenStreetMap" /> OpenStreetMap</span><span className="row gap-1"><Brand b="supabase" s={14} label="Supabase" /> Supabase</span></motion.p>
    </div>
    <motion.figure className="hm-stage card" initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease, delay: 0.15 }}>
      {f?.overlay ? <video src={API + f.overlay} autoPlay muted loop playsInline aria-label={L("Pothole masks drawn by SAM 3.1 on a real ride", "असली राइड पर SAM 3.1 के गड्ढा निशान")} /> : <div className="hm-empty" />}
      <figcaption className="hm-cap">
        {f ? <><span><b>{f.count}</b> {L("potholes found", "गड्ढे मिले")}</span><span><b>{f.top_m2} m²</b> {L("largest", "सबसे बड़ा")}</span><span><b>{inr(f.inr)}</b> {L("to fix, estimated", "अनुमानित मरम्मत")}</span></>
          : <span className="mut">{L("Loading the latest report", "ताज़ा रिपोर्ट लोड हो रही है")}</span>}
      </figcaption>
      {f && <p className="tiny hm-src">{L(`Live from report ${f.id}${f.ward ? ", " + f.ward : ""}. Faces and plates blurred.`, `रिपोर्ट ${f.id} से लाइव${f.ward ? ", " + f.ward : ""}। चेहरे व प्लेट धुंधले।`)}</p>}
    </motion.figure>
  </section>;
}

function Problem() {
  const root = useRef<HTMLElement>(null); const L = useL();
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add({ ok: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" }, ctx => {
      const el = root.current!.querySelector<HTMLElement>(".count")!; const obj = { v: 0 };
      if (ctx.conditions!.reduce) return;
      el.textContent = "0";
      gsap.to(obj, { v: 2161, duration: 2, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(obj.v).toLocaleString("en-IN"); }, scrollTrigger: { trigger: root.current, start: "top 70%", once: true } });
    });
  }, { scope: root });
  return <section ref={root} className="l-sec" id="problem">
    <Idx i="01" t={L("The problem", "समस्या")} />
    <div className="hm-problem">
    <div className="l-count"><span className="count">2,161</span></div>
    <div className="hm-problem-text">
      <Lines as="h2" className="l-h3" lines={[L("people died in pothole-related crashes", "लोगों की मौत 2023 में भारत में"), L("in India in 2023. 61% of them in Uttar Pradesh.", "गड्ढों से जुड़े हादसों में हुई। 61% उत्तर प्रदेश में।")]} />
      <motion.p variants={up} {...inView} className="mut">{L("Most of those roads were never reported. The portal takes ten minutes, wants an exact location, and nobody follows up.", "ज़्यादातर सड़कें कभी रिपोर्ट नहीं हुईं। पोर्टल में दस मिनट लगते हैं, सही जगह चाहिए, और कोई फॉलो-अप नहीं करता।")}</motion.p>
      <p className="tiny l-cite">{L("Source: ", "स्रोत: ")}<a href={SRC} target="_blank" rel="noreferrer">MoRTH, Road Accidents in India 2023, Table 3.5 and state annexure</a></p>
    </div></div>
  </section>;
}

/** Drag to compare: privacy-blurred raw frame vs the SAM 3.1 mask on the same frame. */
function Compare() {
  const s = useContext(S); const f = s?.featured; const L = useL(); const [v, setV] = useState(50); const box = useRef<HTMLDivElement>(null); const drag = useRef(false);
  const at = (x: number) => { const r = box.current!.getBoundingClientRect(); setV(Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100))); };
  if (!f) return null;
  return <section className="l-sec" id="record">
    <Idx i="02" t={L("Detect", "पहचान")} />
    <div className="l-head"><Lines lines={L("Drag to see the road|the way the model does.", "खींचकर देखें, मॉडल|सड़क को कैसे देखता है।").split("|")} className="l-h2" />
      <motion.p variants={up} {...inView} className="l-sub">{L(`Frame ${f.best_frame} of report ${f.id}. Left, the camera with faces and plates blurred. Right, every pothole SAM 3.1 outlined and rated.`, `रिपोर्ट ${f.id} का फ्रेम ${f.best_frame}। बाएं कैमरा, चेहरे-प्लेट धुंधले। दाएं, SAM 3.1 के हर गड्ढे का निशान और रेटिंग।`)}</motion.p></div>
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

/** The agent's real tool log for the featured report, pinned beside the frame it is working on. */
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
    <Idx i="04" t={L("Follow-up", "फॉलो-अप")} />
    <div className="a-grid">
      <div className="l-head"><Lines lines={L("It doesn't stop at detection.|It follows through.", "सिर्फ़ पहचानता नहीं,|अंत तक पीछा करता है।").split("|")} className="l-h2" />
        <motion.p variants={up} {...inView} className="l-sub">{L(`A Muse Spark agent plans and calls seven tools by itself. This is its real log for report ${f?.id || ""}. It fills the portal and waits: you press Submit.`, `Muse Spark एजेंट खुद सात टूल चलाता है। यह रिपोर्ट ${f?.id || ""} का असली लॉग है। फॉर्म भरकर रुकता है, सबमिट आप दबाते हैं।`)}</motion.p>
        {f?.portal && <motion.img variants={up} {...inView} src={API + f.portal} alt={L("The portal form the agent filled", "एजेंट का भरा पोर्टल फॉर्म")} className="hm-portal" />}</div>
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
  const nums: [string, string][] = s ? [[n(s.reports), L("reports", "रिपोर्ट")], [n(s.hazards), L("hazards mapped", "खतरे दर्ज")], [inr(s.inr_total), L("repair backlog, estimated", "मरम्मत बकाया, अनुमान")], [`${s.filed} of ${s.reports}`, L("complaints filled", "शिकायतें भरी गईं")]] : [];
  return <section className="l-sec" id="impact">
    <Idx i="05" t={L("Public map", "सार्वजनिक नक्शा")} />
    <div className="l-head"><Lines lines={L("Every report lands|on a public map.", "हर रिपोर्ट जुड़ती है|एक सार्वजनिक नक्शे में।").split("|")} className="l-h2" />
      <motion.p variants={up} {...inView} className="l-sub">{L("Wards are ranked by what they fix. These numbers are read live from the reports.", "वार्डों की रैंकिंग काम से। ये आंकड़े रिपोर्टों से लाइव हैं।")}</motion.p></div>
    <motion.dl className="hm-nums" variants={stagger} {...inView}>{nums.map(([a, b]) => <motion.div key={b} variants={up}><dt className="tiny">{b}</dt><dd className="l-num">{a}</dd></motion.div>)}</motion.dl>
    <div className="i-grid">
      <motion.div className="card" style={{ padding: 12 }} variants={up} {...inView}><HotMap points={pts} height={380} /></motion.div>
      <motion.div className="card stack" style={{ gap: 18 }} variants={stagger} {...inView}>
        <h3>{L("Ward ranking", "वार्ड रैंकिंग")}</h3>
        {lb.slice(0, 4).map((w, i) => <motion.div key={w.ward} variants={up} className="stack" style={{ gap: 6 }}>
          <div className="row between"><b style={{ fontSize: 14 }}>{i + 1}. {w.ward}</b><span className="tiny">{w.hazards} {L("potholes", "गड्ढे")}, {inr(w.inr)}</span></div>
          <div className="p-bar"><motion.i initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1, ease, delay: 0.1 * i }} style={{ width: `${(w.inr / max) * 100}%`, transformOrigin: "left" }} /></div></motion.div>)}
        {!lb.length && <p className="mut">{L("The ranking appears once the first ward gets a report.", "पहली रिपोर्ट के बाद रैंकिंग दिखेगी।")}</p>}
        <Link href="/map" className="l-link" style={{ marginTop: "auto", alignSelf: "flex-start" }}>{L("Open the city map", "शहर का नक्शा खोलें")}</Link>
      </motion.div></div>
  </section>;
}

function Privacy() {
  const L = useL();
  const P: [string, string, string][] = [["eyeoff", L("Blurred before saving", "सेव से पहले धुंधला"), L("SAM 3.1 finds faces and number plates and blurs them before any frame is stored.", "SAM 3.1 चेहरे और नंबर प्लेट ढूंढकर हर फ्रेम सेव होने से पहले धुंधला करता है।")],
    ["shield", L("You press Submit", "सबमिट आप दबाते हैं"), L("The agent never sends a complaint by itself.", "एजेंट खुद कभी शिकायत नहीं भेजता।")],
    ["user", L("Account optional", "अकाउंट वैकल्पिक"), L("Reports work without signing in. Sign in only to keep your list across devices.", "बिना साइन-इन रिपोर्ट करें। साइन-इन सिर्फ़ अपनी सूची हर डिवाइस पर रखने के लिए।")]];
  return <section className="l-sec" id="privacy">
    <Idx i="06" t={L("Privacy", "निजता")} />
    <div className="hm-privacy">
    <Lines lines={[L("Built so nobody gets exposed.", "ऐसा बना कि कोई उजागर न हो।")]} className="l-h2" />
    <motion.ul className="hm-plist" variants={stagger} {...inView}>{P.map(([ic, t, d]) => <motion.li key={t} variants={up}>
      <span className="pv-ico"><Icon n={ic} s={20} /></span><div><h3>{t}</h3><p className="mut">{d}</p></div></motion.li>)}</motion.ul>
    </div></section>;
}

function CTA() {
  const L = useL();
  return <section className="l-sec">
    <div className="l-cta">
      <img src="/logo.svg" width={56} height={56} alt="" />
      <Lines lines={[L("Seen a bad road today?", "आज कोई खराब सड़क दिखी?")]} className="l-h2" />
      <motion.p variants={up} {...inView} className="l-sub">{L("It takes about a minute. The paperwork is on us.", "लगभग एक मिनट लगता है। कागज़ी काम हमारा।")}</motion.p>
      <Magnetic><Link href="/new" className="btn primary xl cta">{L("Report a road", "सड़क रिपोर्ट करें")}<Icon n="arrow" s={18} /></Link></Magnetic>
    </div>
  </section>;
}

export default function Landing() {
  const [s, setS] = useState<any>(null);
  useEffect(() => { get("/stats").then(setS).catch(() => {}); }, []);
  useEffect(() => { if (s) requestAnimationFrame(() => ScrollTrigger.refresh()); }, [s]);
  return <MotionConfig reducedMotion="user"><S.Provider value={s}><Smooth />
    <main className="wrap landing"><Hero /><Strip /><Problem /><Compare /><Send /><Agent /><Impact /><Privacy /><CTA /></main></S.Provider></MotionConfig>;
}
