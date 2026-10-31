"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth, GOOGLE } from "../auth";
import { useT, mine } from "../i18n";
import Icon from "../Icon";

export default function Login() {
  const { lang } = useT(); const H = lang === "hi"; const T = (en: string, hi: string) => H ? hi : en;
  const a = useAuth(); const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false); const [err, setErr] = useState("");
  const local = typeof window !== "undefined" ? mine.get().length : 0;
  async function go(e: React.FormEvent) { e.preventDefault(); setBusy(true); setErr(""); const x = await a.sendLink(email.trim()); setBusy(false); x ? setErr(x) : setSent(true); }
  if (a.user) return <main className="wrap narrow page"><div className="card stack gap-3" data-testid="signed-in">
    <div className="row gap-2"><span className="ico-tile ok"><Icon n="user" /></span><div className="stack"><b>{T("Signed in", "साइन इन हैं")}</b><span className="tiny">{a.user.email}</span></div></div>
    <div className="row"><Link className="btn primary" href="/mine">{T("My reports", "मेरी रिपोर्ट")}</Link><button className="btn ghost" onClick={a.signOut}>{T("Sign out", "साइन आउट")}</button></div></div></main>;
  return <main className="wrap narrow page">
    <div className="page-head"><div><h1>{T("Sign in", "साइन इन")}</h1>
      <p className="mut">{T("Keep your reports across phones. You don't need an account to report a road.", "अपनी रिपोर्ट हर फ़ोन पर देखें। सड़क रिपोर्ट करने के लिए अकाउंट ज़रूरी नहीं।")}</p></div></div>
    {!a.enabled ? <div className="card stack gap-2" data-testid="auth-off"><b>{T("Accounts are off on this server", "इस सर्वर पर अकाउंट बंद हैं")}</b><span className="tiny">{T("Reports still save on this phone.", "रिपोर्ट इस फ़ोन पर सेव होती रहेंगी।")}</span></div>
    : sent ? <div className="card stack gap-2" role="status" data-testid="link-sent"><div className="row gap-2"><span className="ico-tile ok"><Icon n="check" /></span><b>{T("Check your email", "अपना ईमेल देखें")}</b></div>
        <p className="small mut">{T(`We sent a sign-in link to ${email}. Open it on this device.`, `${email} पर साइन-इन लिंक भेजा है। इसे इसी डिवाइस पर खोलें।`)}</p>
        <button className="btn ghost" onClick={() => setSent(false)}>{T("Use another email", "दूसरा ईमेल")}</button></div>
    : <form className="card stack gap-3" onSubmit={go} data-testid="login-form">
        <label className="field">{T("Email", "ईमेल")}<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder="you@example.com" /></label>
        <button className="btn primary lg block" disabled={busy || !email} data-testid="magic-link">{busy ? T("Sending…", "भेज रहे हैं…") : T("Email me a sign-in link", "साइन-इन लिंक भेजें")}</button>
        {GOOGLE && <button type="button" className="btn lg block" onClick={async () => { const x = await a.google(); if (x) setErr(x); }}>{T("Continue with Google", "Google से जारी रखें")}</button>}
        {local > 0 && <span className="tiny">{T(`After you sign in you can add the ${local} report${local > 1 ? "s" : ""} from this phone to your account.`, `साइन इन के बाद इस फ़ोन की ${local} रिपोर्ट अपने अकाउंट में जोड़ सकते हैं।`)}</span>}
        {(err || a.down) && <p role="alert" className="small" style={{ color: "var(--crit)" }}>{err || T("Can't reach the account server right now. Reporting still works.", "अभी अकाउंट सर्वर से संपर्क नहीं हो रहा। रिपोर्ट करना चालू है।")}</p>}
      </form>}
  </main>;
}
