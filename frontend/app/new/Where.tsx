"use client";
// Where is this road? 1) GPS inside the video (read on the server after upload), 2) browser location (asked with a clear prompt),
// 3) manual city search. Reverse geocoding: OSM Nominatim via our API (UA, 1 req/s, cached).
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { get } from "../api";
import Icon, { Brand } from "../Icon";
export type Loc = { lat?: number; lng?: number; city?: string; src: "browser" | "manual" | null; locality?: string };
type Place = { ok: boolean; city?: string | null; label?: string; authorities?: string[]; supported?: boolean; locality?: string; source?: string };
type St = "idle" | "asking" | "ok" | "denied" | "error" | "search";
export default function Where({ H, onChange }: { H: boolean; onChange: (l: Loc) => void }) {
  const T = (en: string, hi: string) => H ? hi : en;
  const [st, setSt] = useState<St>("idle"); const [pl, setPl] = useState<Place | null>(null); const [prev, setPrev] = useState<St>("idle");
  const [q, setQ] = useState(""); const [res, setRes] = useState<any[]>([]); const tm = useRef<any>();
  const locate = () => {
    if (!navigator.geolocation) { setSt("denied"); return; }
    setSt("asking");
    navigator.geolocation.getCurrentPosition(async p => {
      const c = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) };
      onChange({ ...c, src: "browser" });
      try { const g: Place = await get(`/geo/reverse?lat=${c.lat}&lng=${c.lng}`); setPl(g.ok ? g : { ok: false });
        onChange({ ...c, src: "browser", city: g.city || undefined, locality: g.locality }); } catch { setPl({ ok: false }); }
      setSt("ok");
    }, e => setSt(e.code === 1 ? "denied" : "error"), { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true });
  };
  useEffect(() => { // already allowed earlier? locate without a second click
    (navigator as any).permissions?.query({ name: "geolocation" }).then((s: any) => { if (s.state === "granted") locate(); else if (s.state === "denied") setSt("denied"); }).catch(() => {});
  }, []); // eslint-disable-line
  useEffect(() => { clearTimeout(tm.current); if (q.trim().length < 2) { setRes([]); return; }
    tm.current = setTimeout(() => get(`/geo/search?q=${encodeURIComponent(q.trim())}`).then(setRes).catch(() => setRes([])), 300); }, [q]);
  const pick = (r: any) => { setPl({ ok: true, city: r.city, label: r.label, supported: r.supported, authorities: [] }); setSt("ok"); setQ(""); setRes([]);
    onChange({ src: "manual", city: r.city || undefined, lat: r.lat, lng: r.lng }); };
  const change = () => { setPrev(st); setSt("search"); };
  const anim = { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: .18 } };
  return <div className="field" data-testid="where">{T("Location", "जगह")}
    <AnimatePresence mode="wait" initial={false}>
      {st === "ok" && pl ? <motion.div key="ok" {...anim} className="where ok" data-testid="where-ok">
        <span className="ico-tile ok"><Icon n="pin" /></span>
        <div className="stack grow"><b data-testid="where-city">{pl.city || pl.label || T("Location found", "जगह मिल गई")}</b>
          <span className="tiny">{pl.ok === false ? T("Got your GPS, but couldn't name the place. Pick the city below if needed.", "GPS मिला, पर जगह का नाम नहीं मिला।")
            : [pl.label && pl.label !== pl.city ? pl.label : null, pl.supported === false ? T("City not in our list yet: national portal", "यह शहर अभी सूची में नहीं: राष्ट्रीय पोर्टल") : pl.authorities?.[0]].filter(Boolean).join(" · ")}</span></div>
        <button type="button" className="btn ghost sm" onClick={change} data-testid="where-change">{T("Change", "बदलें")}</button></motion.div>
      : st === "search" || st === "denied" || st === "error" ? <motion.div key="s" {...anim} className="where col">
        {st !== "search" && <span className="tiny row gap-1"><Icon n="alert" s={14} />{st === "denied" ? T("Location is off for this site. No problem: type your city.", "इस साइट के लिए लोकेशन बंद है। कोई बात नहीं, शहर लिखें।") : T("Couldn't get a GPS fix. Type your city instead.", "GPS नहीं मिला। शहर लिखें।")}</span>}
        <div className="search"><Icon n="search" s={18} /><input autoFocus={st === "search"} value={q} onChange={e => setQ(e.target.value)} placeholder={T("Search your city, e.g. Jaipur", "अपना शहर खोजें, जैसे जयपुर")} aria-label={T("City", "शहर")} data-testid="city-search" /></div>
        {res.length > 0 && <ul className="opts" role="listbox">{res.map((r, i) => <li key={i}><button type="button" onClick={() => pick(r)} data-testid="city-opt">
          <Icon n={r.supported ? "gov" : "globe"} s={16} /><span className="grow">{r.label}</span>{r.supported && <span className="tiny">{T("supported", "उपलब्ध")}</span>}</button></li>)}</ul>}
        <div className="row gap-2">{st !== "denied" && <button type="button" className="btn ghost sm" onClick={locate}><Icon n="target" s={16} />{T("Use my location", "मेरी लोकेशन")}</button>}
          {prev === "ok" && st === "search" && <button type="button" className="btn ghost sm" onClick={() => setSt("ok")}>{T("Cancel", "रद्द")}</button>}</div></motion.div>
      : <motion.div key="i" {...anim} className="where">
        <span className="ico-tile"><Icon n={st === "asking" ? "target" : "pin"} /></span>
        <div className="stack grow"><b>{st === "asking" ? T("Waiting for your browser…", "ब्राउज़र का इंतज़ार…") : T("Where is this road?", "यह सड़क कहां है?")}</b>
          <span className="tiny">{st === "asking" ? T("Tap Allow in the prompt. We only use it to find the right authority.", "प्रॉम्प्ट में Allow दबाएं। सिर्फ़ सही विभाग ढूंढने के लिए।")
            : T("If your video has GPS we use that. Otherwise share your location once, or type the city.", "वीडियो में GPS हो तो वही लेंगे। नहीं तो लोकेशन दें या शहर लिखें।")}</span></div>
        <div className="row gap-1 wrap-sm"><button type="button" className="btn primary sm" disabled={st === "asking"} onClick={locate} data-testid="where-locate"><Icon n="target" s={16} />{T("Use my location", "मेरी लोकेशन")}</button>
          <button type="button" className="btn ghost sm" onClick={change} data-testid="where-type">{T("Type city", "शहर लिखें")}</button></div></motion.div>}
    </AnimatePresence>
    <span className="tiny row gap-1"><Brand b="openstreetmap" s={12} />{T("Place names © OpenStreetMap contributors", "जगह के नाम © OpenStreetMap")}</span>
  </div>;
}
