"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, MotionConfig, useReducedMotion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { get, inr } from "../api";
import Smooth from "./Smooth";
gsap.registerPlugin(ScrollTrigger, useGSAP);
const HotMap = dynamic(() => import("../HotMap"), { ssr: false });
const ease = [0.22, 1, 0.36, 1] as const;
const up = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
const inView = { initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.25 } } as const;

function Head({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return <motion.div className="l-head" variants={stagger} {...inView}>
    <motion.span variants={up} className="eyebrow">{eyebrow}</motion.span>
    <motion.h2 variants={up} className="l-h2">{title}</motion.h2>
    {sub && <motion.p variants={up} className="l-sub">{sub}</motion.p>}
  </motion.div>;
}

function Hero() {
  const reduce = useReducedMotion();
  const chip = (d: number) => reduce ? {} : { animate: { y: [0, -8, 0] }, transition: { duration: 5, repeat: Infinity, ease: "easeInOut" as const, delay: d } };
  return <section className="l-hero">
    <motion.div className="l-hero-copy" variants={stagger} initial="hidden" animate="show">
      <motion.span variants={up} className="l-badge"><img src="/logo.svg" alt="" width={18} height={18} />Built on Meta SAM 3.1 + Muse agents</motion.span>
      <motion.h1 variants={up} className="l-h1">Every bad road,<br />reported in one tap.</motion.h1>
      <motion.p variants={up} className="l-lead">Record your ride. Gaadi Guru finds each pothole, blurs faces and plates, prices the repair, files the complaint and checks back in 7 days.</motion.p>
      <motion.div variants={up} className="row" style={{ gap: 16 }}>
        <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}><Link href="/new" className="btn primary xl">Report a road →</Link></motion.div>
        <a href="#how" className="l-link">See how it works</a>
      </motion.div>
      <motion.div variants={up} className="l-trust"><span>Hindi + English</span><span>Free for citizens</span><span>0 faces stored</span></motion.div>
    </motion.div>
    <motion.div className="l-visual" initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, ease, delay: 0.2 }}>
      <div className="phone"><div className="phone-notch" /><video src="/demo.mp4" poster="/demo_poster.jpg" autoPlay muted loop playsInline aria-label="Pothole masks drawn live on a ride video" />
        <div className="phone-bar"><b>12 potholes</b><span className="pill CRITICAL">2 dangerous</span></div></div>
      <motion.div className="float f1 glass" {...chip(0)}><span className="dot" style={{ background: "var(--crit)" }} />Pothole ahead · 3.1 m²</motion.div>
      <motion.div className="float f2 glass" {...chip(1.2)}><b>₹27,700</b><span className="tiny">to fix this stretch</span></motion.div>
      <motion.div className="float f3 glass" {...chip(2.4)}>✓ Faces & plates blurred</motion.div>
    </motion.div>
  </section>;
}

function Problem() {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add({ ok: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" }, ctx => {
      const n = root.current!.querySelector<HTMLElement>(".count")!; const obj = { v: 0 };
      if (ctx.conditions!.reduce) { n.textContent = "2,161"; return; }
      gsap.to(obj, { v: 2161, duration: 2, ease: "power2.out", onUpdate: () => { n.textContent = Math.round(obj.v).toLocaleString("en-IN"); },
        scrollTrigger: { trigger: root.current, start: "top 70%", once: true } });
      gsap.from(".p-bar i", { scaleX: 0, transformOrigin: "left", duration: 1.2, ease: "power3.out", stagger: 0.12, scrollTrigger: { trigger: ".p-bars", start: "top 80%" } });
    });
  }, { scope: root });
  return <section ref={root} className="l-sec" id="problem">
    <div className="l-problem">
      <div><span className="eyebrow">The problem</span><div className="l-count"><span className="count">0</span></div>
        <p className="l-h3">people died in pothole-related crashes in India in 2023.</p>
        <p className="tiny" style={{ marginTop: 10 }}>Source: MoRTH, <i>Road Accidents in India 2023</i>. Up 16% from 2022.</p></div>
      <div className="card p-bars stack" style={{ gap: 22 }}>
        {[["5,840", "pothole-related crashes in 2023", 100], ["+31%", "more pothole crashes than 2022", 31 / 0.6], ["1 in 2", "pothole deaths were in Uttar Pradesh", 52]].map(([a, b, w]) =>
          <div key={String(a)} className="stack" style={{ gap: 8 }}><div className="row between"><b className="l-num">{a}</b><span className="mut" style={{ fontSize: 14 }}>{b}</span></div>
            <div className="p-bar"><i style={{ width: `${w}%` }} /></div></div>)}
        <p className="mut" style={{ fontSize: 14 }}>Most complaints never get filed: the portal takes 10 minutes, needs exact location and nobody follows up.</p>
      </div></div>
  </section>;
}

const STEPS = [["01", "Record or snap", "Mount your phone and ride, or take one photo. Location and ward fill in by themselves."],
  ["02", "We review the road", "SAM 3.1 outlines every pothole, rates how bad it is, measures it in m² and estimates the fix in ₹."],
  ["03", "Complaint sent, reminder set", "The agent fills the city portal form for you to check and submit, then reminds you in 7 days."]];
function How() {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
      const cards = gsap.utils.toArray<HTMLElement>(".h-step");
      const tl = gsap.timeline({ scrollTrigger: { trigger: ".h-pin", start: "top top+=96", end: "+=1400", pin: true, scrub: 0.6, invalidateOnRefresh: true } });
      tl.fromTo(".h-progress i", { scaleX: 0 }, { scaleX: 1, ease: "none", duration: 3 }, 0);
      cards.forEach((c, i) => {
        tl.fromTo(c, { opacity: 0.25, y: 40 }, { opacity: 1, y: 0, duration: 0.6 }, i);
        tl.fromTo(`.h-shot-${i}`, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.6 }, i);
        if (i < cards.length - 1) tl.to(`.h-shot-${i}`, { opacity: 0, duration: 0.4 }, i + 0.85);
      });
    });
  }, { scope: root });
  return <section ref={root} className="l-sec" id="how">
    <Head eyebrow="How it works" title="Three steps. About a minute." sub="No forms to understand, no office to visit." />
    <div className="h-pin">
      <div className="h-progress" aria-hidden><i /></div>
      <div className="h-grid">
        <div className="h-steps">{STEPS.map(([n, t, d]) => <div key={n} className="h-step card sm"><span className="h-n">{n}</span><div><h3>{t}</h3><p className="mut">{d}</p></div></div>)}</div>
        <div className="h-stage card">
          <img className="h-shot h-shot-0" src="/demo_poster.jpg" alt="A ride frame from a phone" />
          <img className="h-shot h-shot-1" src="/demo_mask.jpg" alt="A pothole outlined and rated" />
          <img className="h-shot h-shot-2" src="/demo_portal.png" alt="City portal form filled by the agent" />
        </div>
      </div></div>
  </section>;
}

function Bento() {
  const T = ({ className = "", children }: { className?: string; children: React.ReactNode }) =>
    <motion.div variants={up} whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 24 }} className={"bento-t card " + className}>{children}</motion.div>;
  return <section className="l-sec" id="features">
    <Head eyebrow="Features" title="Everything a complaint needs. Nothing it doesn't." />
    <motion.div className="bento" variants={stagger} {...inView}>
      <T className="b-big"><div><h3>Sees what you see</h3><p className="mut">Pixel-accurate outlines of potholes, open manholes and waterlogging, tracked across the video so each one is counted once.</p></div>
        <img src="/demo_mask.jpg" alt="SAM 3.1 pothole mask" className="b-img" /></T>
      <T><h3>Prices the fix</h3><p className="mut">Area × road type × local rates.</p><div className="b-big-num">₹1,800<span>/m²</span></div></T>
      <T><h3>Writes in your language</h3><p className="mut">Complaint drafted in Hindi and English. Speak a voice note in either.</p><div className="row" style={{ marginTop: "auto" }}><span className="pill">हिंदी</span><span className="pill">English</span></div></T>
      <T className="b-wide"><div><h3>Fills the portal for you</h3><p className="mut">Muse Wonder opens the grievance form, fills every field and stops before Submit so you stay in control.</p></div>
        <img src="/demo_portal.png" alt="Portal form filled by the agent" className="b-img top" /></T>
      <T><h3>Ride mode</h3><p className="mut">Phone on the handlebar. Hear “आगे गड्ढा है” before you hit it.</p></T>
      <T><h3>Same pothole?</h3><p className="mut">Nearby reports get an upvote instead of a duplicate.</p></T>
    </motion.div>
  </section>;
}

const AGENT = [["Looking at your ride", "12 potholes · 2 dangerous"], ["Checking for duplicates", "None open within 50 m"], ["Working out the cost", "₹27,700 across 12 sites"],
  ["Writing the complaint", "Hindi + English draft ready"], ["Filling the city portal", "8 fields filled · waiting for you"], ["Setting a reminder", "Re-check on 6 Nov"], ["Checking the repair", "Re-ride compared · verdict saved"]];
function Agent() {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(".a-line i", { scaleY: 0 }, { scaleY: 1, ease: "none", transformOrigin: "top", scrollTrigger: { trigger: ".a-list", start: "top 70%", end: "bottom 60%", scrub: true } });
      gsap.utils.toArray<HTMLElement>(".a-item").forEach(el => gsap.from(el, { opacity: 0, x: 24, duration: 0.6, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 82%" } }));
    });
  }, { scope: root });
  return <section ref={root} className="l-sec" id="agent">
    <div className="a-grid">
      <Head eyebrow="The agent at work" title="It doesn't just detect. It follows through." sub="A Muse Spark agent plans and calls seven tools on its own, the same steps a determined citizen would take, without the hour of effort." />
      <div className="a-list"><div className="a-line" aria-hidden><i /></div>
        {AGENT.map(([t, d], i) => <div key={t} className="a-item glass"><span className="a-dot">{i + 1}</span><div><b>{t}</b><p className="tiny">{d}</p></div><span className="a-ok">✓</span></div>)}</div>
    </div>
  </section>;
}

function Impact() {
  const [pts, setPts] = useState<any[]>([]); const [lb, setLb] = useState<any[]>([]);
  useEffect(() => { get("/reports").then(setPts).catch(() => {}); get("/leaderboard").then(setLb).catch(() => {}); }, []);
  const max = Math.max(1, ...lb.map(w => w.inr));
  return <section className="l-sec" id="impact">
    <Head eyebrow="City impact" title="Every report adds to a public map." sub="Wards are ranked by what they fix, not what they promise." />
    <div className="i-grid">
      <motion.div className="card" style={{ padding: 12 }} variants={up} {...inView}><HotMap points={pts} height={380} /></motion.div>
      <motion.div className="card stack" style={{ gap: 18 }} variants={stagger} {...inView}>
        <h3>Ward ranking</h3>
        {lb.slice(0, 4).map((w, i) => <motion.div key={w.ward} variants={up} className="stack" style={{ gap: 6 }}>
          <div className="row between"><b style={{ fontSize: 14 }}>{i + 1}. {w.ward}</b><span className="tiny">{w.hazards} potholes · {inr(w.inr)}</span></div>
          <div className="p-bar"><motion.i initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1, ease, delay: 0.1 * i }} style={{ width: `${(w.inr / max) * 100}%`, transformOrigin: "left" }} /></div></motion.div>)}
        {!lb.length && <p className="mut">The ranking appears once the first ward gets a report.</p>}
        <Link href="/map" className="l-link" style={{ marginTop: "auto" }}>Open the city map →</Link>
      </motion.div></div>
  </section>;
}

function Privacy() {
  const P = [["Blurred on device path", "Faces and number plates are found by SAM 3.1 and blurred before any image is saved."], ["You press Submit", "The agent never sends a complaint on its own. It fills the form and waits."], ["No account needed", "Reports are tied to a place, not a person. Share only if you want to."]];
  return <section className="l-sec" id="privacy">
    <Head eyebrow="Privacy" title="Built so nobody gets exposed." />
    <motion.div className="g3" variants={stagger} {...inView}>{P.map(([t, d]) => <motion.div key={t} variants={up} className="card sm stack" style={{ gap: 8 }}>
      <span className="pv-ico" aria-hidden>✓</span><h3>{t}</h3><p className="mut">{d}</p></motion.div>)}</motion.div>
  </section>;
}

function CTA() {
  return <section className="l-sec">
    <motion.div className="l-cta card" variants={stagger} {...inView}>
      <motion.img variants={up} src="/logo.svg" width={56} height={56} alt="" />
      <motion.h2 variants={up} className="l-h2">Seen a bad road today?</motion.h2>
      <motion.p variants={up} className="l-sub">It takes about a minute. We handle the paperwork.</motion.p>
      <motion.div variants={up} whileHover={{ y: -2 }}><Link href="/new" className="btn primary xl">Report a road →</Link></motion.div>
    </motion.div>
  </section>;
}

export default function Landing() {
  return <MotionConfig reducedMotion="user"><Smooth /><main className="wrap landing"><Hero /><Problem /><How /><Bento /><Agent /><Impact /><Privacy /><CTA /></main></MotionConfig>;
}
