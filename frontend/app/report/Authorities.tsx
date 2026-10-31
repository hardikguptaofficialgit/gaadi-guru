"use client";
// Who to send this report to: city from OpenStreetMap (user can change it), Delhi jurisdiction choice,
// verified contacts with source + confidence, a mailto draft, and the portal's own field order.
import { useEffect, useState } from "react";
import { API } from "../api";
import Icon, { Brand } from "../Icon";
import { useToast } from "../ui";
import { useAuth, toRow } from "../auth";

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand("copy"); } catch {} t.remove(); return ok; }
}
const CONF: Record<string, [string, string, string]> = { high: ["High confidence", "पक्की जानकारी", "b-ok"], medium: ["Medium confidence", "मध्यम भरोसा", "b-warn"],
  low: ["Low confidence", "कम भरोसा", "b-bad"], unknown: ["Not checked", "जांचा नहीं", ""] };
const Conf = ({ c, H }: { c?: string; H: boolean }) => { const x = CONF[c || "unknown"] || CONF.unknown; return <span className={"badge " + x[2]} data-conf={c}><i />{x[H ? 1 : 0]}</span>; };
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u.slice(0, 40); } };

function Sources({ a, H }: { a: any; H: boolean }) {
  return <div className="stack gap-1"><span className="tiny">{H ? "स्रोत" : "Sources"} · {H ? "जांचा" : "checked"} {a.checked}</span>
    {a.sources.map((s: string) => s.startsWith("http") ? <a key={s} className="src" href={s} target="_blank" rel="noreferrer">{host(s)}<Icon n="ext" s={12} /></a> : <span key={s} className="src">{s}</span>)}</div>;
}

function PortalFormat({ rid, a, H }: { rid: string; a: any; H: boolean }) {
  const [p, setP] = useState<any>(null); const toast = useToast();
  useEffect(() => { fetch(`${API}/reports/${rid}/portal-format?authority=${a.id}&site=${encodeURIComponent(location.origin)}&api=${encodeURIComponent(API)}`)
    .then(x => x.ok ? x.json() : null).then(setP).catch(() => {}); }, [rid, a.id]);
  if (!p) return null;
  return <div className="stack gap-2" data-testid="portal-format">
    <div className="row between"><b className="small">{H ? "पोर्टल फ़ॉर्म, इसी क्रम में" : "Portal form, in this order"}</b>
      {p.verified ? <span className="badge b-ok"><i />{H ? "फ़ील्ड जांचे गए" : "Fields checked"}</span> : <span className="badge b-warn" data-testid="unverified"><i />{H ? "फ़ील्ड अपुष्ट" : "Fields unverified"}</span>}</div>
    {!p.verified && <span className="tiny">{H ? "पोर्टल पर फ़ील्ड का नाम या क्रम अलग हो सकता है।" : `Field names or order may differ on the portal (${p.confidence_raw || "not checked"}).`}</span>}
    <ol className="pf">{p.fields.map((f: any) => <li key={f.n} className="well" data-kind={f.kind}>
      <span className="n">{f.n}</span>
      <div className="stack gap-1"><b className="small">{f.label}</b>
        {f.kind === "step" ? <span className="tiny">{f.value || (H ? "पोर्टल पर आप खुद करें" : "Do this on the portal")}</span>
        : f.kind === "you" && !f.value ? <span className="tiny">{H ? "आपकी जानकारी" : "Your own details"}</span>
        : <span className="v">{f.value}</span>}</div>
      {f.value && f.kind !== "step" ? <button className="btn ghost" aria-label={`Copy ${f.label}`} data-testid="copy-field"
        onClick={async () => toast(await copyText(f.value) ? (H ? "कॉपी हुआ" : "Copied") : (H ? "कॉपी नहीं हुआ" : "Couldn't copy"), "ok")}><Icon n="copy" s={16} /></button> : <span />}</li>)}</ol>
    {p.portal_link && <a className="btn block" href={p.portal_link} target="_blank" rel="noreferrer" data-testid="open-portal"><Icon n="ext" s={16} />{H ? "पोर्टल खोलें" : "Open the portal"} · {host(p.portal_link)}</a>}
  </div>;
}

function Authority({ r, a, H, onSent }: { r: any; a: any; H: boolean; onSent: (a: any) => void }) {
  const [m, setM] = useState<any>(null); const toast = useToast(); const email = a.emails[0];
  useEffect(() => { if (!email) return; fetch(`${API}/reports/${r.id}/mailto?authority=${a.id}&site=${encodeURIComponent(location.origin)}&api=${encodeURIComponent(API)}`)
    .then(x => x.ok ? x.json() : null).then(setM).catch(() => {}); }, [r.id, a.id]);
  const copyMail = async () => { if (!m) return; const ok = await copyText(`To: ${m.to}\nSubject: ${m.full_subject}\n\n${m.full_body}`);
    toast(ok ? (H ? "ईमेल कॉपी हुआ — अपने मेल ऐप में पेस्ट करें" : "Email copied. Paste it into your mail app.") : (H ? "कॉपी नहीं हुआ" : "Couldn't copy"), ok ? "ok" : "err"); };
  return <div className="card stack gap-3 auth-card" data-testid="authority" data-id={a.id}>
    <div className="stack gap-1"><b>{a.authority}</b>{a.ward_note && <span className="tiny">{a.ward_note}</span>}</div>
    {email ? <div className="stack gap-2">
      <div className="contact"><span className="small row gap-1"><Icon n="doc" s={16} />{email.email}</span><Conf c={email.confidence} H={H} /></div>
      {email.purpose && <span className="tiny">{email.purpose}</span>}
      <a className={"btn primary lg block" + (m ? "" : " disabled")} href={m?.href || undefined} aria-disabled={!m} data-testid="mailto"
        onClick={() => m && onSent(a)}><Icon n="share" s={18} />{H ? "अधिकारियों को भेजें" : "Send to authorities"}</a>
      <button className="btn block" onClick={copyMail} disabled={!m} data-testid="copy-email"><Icon n="copy" s={16} />{H ? "ईमेल कॉपी करें" : "Copy email text"}</button>
      <span className="tiny">{H ? "आपका मेल ऐप खुलेगा; भेजने से पहले पढ़ लें।" : "Opens your mail app with the email written. Read it, then press send."}{m?.short ? (H ? " छोटा संस्करण, पूरी रिपोर्ट लिंक में।" : " Shortened to fit; the report link has the rest.") : ""}</span>
    </div> : <span className="tiny" data-testid="no-email">{H ? "कोई जांचा हुआ शिकायत ईमेल नहीं। पोर्टल या हेल्पलाइन इस्तेमाल करें।" : "No verified complaint email. Use the portal or helpline."}</span>}
    <div className="g2">
      {a.phone && <div className="well stack gap-1"><span className="tiny row gap-1">{H ? "हेल्पलाइन" : "Helpline"}<Conf c={a.confidence.phone} H={H} /></span><b className="small num">{a.phone}</b></div>}
      {a.portal_link && <div className="well stack gap-1"><span className="tiny row gap-1">{H ? "पोर्टल" : "Portal"}<Conf c={a.confidence.portal} H={H} /></span>
        <a className="small" href={a.portal_link} target="_blank" rel="noreferrer">{host(a.portal_link)}<Icon n="ext" s={12} /></a>{a.portal_note && <span className="tiny">{a.portal_note}</span>}</div>}
    </div>
    {a.has_portal_format && <details><summary className="small"><b>{H ? "पोर्टल फ़ॉर्म भरने में मदद" : "Portal format: copy each field"}</b></summary><div style={{ marginTop: "var(--s2)" }}><PortalFormat rid={r.id} a={a} H={H} /></div></details>}
    <Sources a={a} H={H} />
  </div>;
}

export default function Authorities({ r, H }: { r: any; H: boolean }) {
  const [city, setCity] = useState<string>(""); const [pick, setPick] = useState<string>(""); const [o, setO] = useState<any>(null); const [err, setErr] = useState(false);
  const auth = useAuth();
  useEffect(() => { const q = new URLSearchParams(); if (city) q.set("city", city); if (pick) q.set("pick", pick);
    fetch(`${API}/reports/${r.id}/route?${q}`).then(x => x.json()).then(x => { setO(x); setErr(false); }).catch(() => setErr(true)); }, [r.id, city, pick]);
  const onSent = (a: any) => auth.save({ ...toRow(r, false), city: o?.city || null, authority_id: a.id, sent_at: new Date().toISOString() });
  if (err) return <section className="card"><span className="small">{H ? "अधिकारी की जानकारी अभी लोड नहीं हुई।" : "Couldn't load who to send this to."}</span></section>;
  if (!o) return null;
  const d = o.delhi;
  return <section className="card stack gap-4" data-testid="authorities">
    <div className="stack gap-1"><span className="eyebrow">{H ? "किसे भेजें" : "Who to send it to"}</span>
      <h3>{o.city ? (H ? `${o.city} की ज़िम्मेदार संस्था` : `Responsible authority in ${o.city}`) : (H ? "अपना शहर चुनें" : "Pick your city")}</h3></div>
    {(o.place || o.city) && <div className="where ok" data-testid="report-place"><span className="ico-tile ok"><Icon n="pin" /></span>
      <div className="stack grow"><b>{o.place || o.city}</b><span className="tiny">{({ video: H ? "वीडियो के GPS से" : "From the video's GPS", browser: H ? "आपके फ़ोन की लोकेशन से" : "From your phone's location",
        manual: H ? "आपने चुना" : "You picked this" } as any)[o.overridden ? "manual" : o.loc_source] || (H ? "आपने चुना" : "You picked this")}{o.lat != null ? ` · ${(+o.lat).toFixed(4)}, ${(+o.lng).toFixed(4)}` : ""}</span></div>
      <button type="button" className="btn ghost sm" onClick={() => (document.querySelector('[data-testid="city"]') as HTMLSelectElement)?.focus()}>{H ? "बदलें" : "Change"}</button></div>}
    <label className="field">{H ? "शहर" : "City"}
      <select value={o.city || ""} onChange={e => { setCity(e.target.value); setPick(""); }} data-testid="city">
        <option value="">{H ? "चुनें…" : "Choose…"}</option>{o.cities.map((c: string) => <option key={c} value={c}>{c}</option>)}</select>
      <span className="hint">{o.detected_city ? (H ? `जगह से पता चला: ${o.detected_city}` : `Detected from the location: ${o.detected_city}`) + (o.overridden ? (H ? " (आपने बदला)" : " (you changed it)") : "")
        : (H ? "जगह से शहर पता नहीं चला" : "Couldn't tell the city from the location")}{o.osm_credit ? <> · <Brand b="openstreetmap" s={12} /> {o.osm_credit}</> : ""}</span></label>
    {d && (!d.decided || pick) && <fieldset className="stack gap-2" style={{ border: 0, padding: 0, margin: 0 }} data-testid="delhi-choice">
      <legend className="small"><b>{H ? "दिल्ली में सड़क किसकी है?" : "Which body owns this Delhi road?"}</b></legend>
      <span className="tiny">{d.reason}</span>
      <div className="opts">{d.options.map((x: any) => <label key={x.id} className="opt well"><input type="radio" name="delhi" checked={(o.picked || "") === x.id} onChange={() => setPick(x.id)} />
        <span className="stack"><b className="small">{{ "delhi-mcd": "MCD", "delhi-pwd": "PWD", "delhi-ndmc": "NDMC", "delhi-nhai": "NHAI" }[x.id as string]}</b><span className="tiny">{H ? x.rule_hi : x.rule}</span></span></label>)}</div></fieldset>}
    {d?.decided && !pick && <span className="tiny">{d.reason}</span>}
    {o.authorities.map((a: any) => <Authority key={a.id} r={r} a={a} H={H} onSent={onSent} />)}
    {o.fallback && <details className="well" data-testid="fallback"><summary className="small"><b>{H ? "जवाब नहीं मिला? राष्ट्रीय शिकायत पोर्टल" : "No reply? National grievance portal"}</b></summary>
      <div style={{ marginTop: "var(--s2)" }}><Authority r={r} a={o.fallback} H={H} onSent={onSent} /></div></details>}
  </section>;
}
