"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth, GOOGLE } from "../auth";
import { useT, mine } from "../i18n";
import Icon, { Brand } from "../Icon";

const swap = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: .2 } };
export default function Login() {
  const { lang } = useT(); const H = lang === "hi"; const T = (en: string, hi: string) => H ? hi : en;
  const a = useAuth(); const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false); const [err, setErr] = useState("");
  const local = typeof window !== "undefined" ? mine.get().length : 0;
  async function go(e: React.FormEvent) { e.preventDefault(); setBusy(true); setErr(""); const x = await a.sendLink(email.trim()); setBusy(false); x ? setErr(x) : setSent(true); }
  const head = (t: string, s: string) => <div className="auth-head"><img src="/brand/logo.svg" alt="Patchwise" width={48} height={48} /><h1>{t}</h1><p className="mut small">{s}</p></div>;
  return <main className="auth-page bg-topo"><motion.div className="auth-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
    <AnimatePresence mode="wait" initial={false}>
      {a.user ? <motion.div key="in" {...swap} className="stack gap-4" data-testid="signed-in">
        {head(T("You're signed in", "आप साइन इन हैं"), a.user.email || "")}
        <Link className="btn primary lg block" href="/mine"><Icon n="list" s={18} />{T("My reports", "मेरी रिपोर्ट")}</Link>
        <button className="btn ghost block" onClick={a.signOut}><Icon n="out" s={18} />{T("Sign out", "साइन आउट")}</button></motion.div>
      : !a.enabled ? <motion.div key="off" {...swap} className="stack gap-4" data-testid="auth-off">
        {head(T("Accounts are off", "अकाउंट बंद हैं"), T("This server has no sign-in. Your reports still save on this device.", "इस सर्वर पर साइन-इन नहीं है। रिपोर्ट इसी डिवाइस पर सेव होती हैं।"))}
        <Link className="btn primary lg block" href="/new"><Icon n="camera" s={18} />{T("Report a road", "सड़क रिपोर्ट करें")}</Link></motion.div>
      : sent ? <motion.div key="sent" {...swap} className="stack gap-4" role="status" data-testid="link-sent">
        <div className="auth-head"><span className="auth-ok"><Icon n="mail" s={26} /></span><h1>{T("Check your inbox", "अपना ईमेल देखें")}</h1>
          <p className="mut small">{T("We sent a sign-in link to", "साइन-इन लिंक भेजा गया")} <b className="ink">{email}</b>. {T("Open it on this device.", "इसे इसी डिवाइस पर खोलें।")}</p></div>
        <button className="btn ghost block" onClick={() => setSent(false)}>{T("Use a different email", "दूसरा ईमेल")}</button></motion.div>
      : <motion.form key="form" {...swap} className="stack gap-3" onSubmit={go} data-testid="login-form">
        {head(T("Sign in to Patchwise", "Patchwise में साइन इन"), T("Keep your reports on every device.", "अपनी रिपोर्ट हर डिवाइस पर रखें।"))}
        <label className="sr-only" htmlFor="em">{T("Email", "ईमेल")}</label>
        <div className="glass-in"><Icon n="mail" s={18} /><input id="em" type="email" required value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} autoComplete="email" inputMode="email" placeholder="you@example.com" aria-invalid={!!err} /></div>
        <button className="btn primary lg block" disabled={busy || !email} data-testid="magic-link">{busy ? <span className="spinner sm" aria-hidden /> : <Icon n="spark" s={18} />}{busy ? T("Sending…", "भेज रहे हैं…") : T("Email me a magic link", "मैजिक लिंक भेजें")}</button>
        {GOOGLE && <><div className="or"><span>{T("or", "या")}</span></div>
          <button type="button" className="btn lg block" onClick={async () => { const x = await a.google(); if (x) setErr(x); }}><Brand b="google" s={18} />{T("Continue with Google", "Google से जारी रखें")}</button></>}
        <AnimatePresence>{(err || a.down) && <motion.p {...swap} role="alert" className="auth-err small"><Icon n="alert" s={16} />{err || T("Can't reach the account server right now. Reporting still works.", "अभी अकाउंट सर्वर से संपर्क नहीं हो रहा। रिपोर्ट करना चालू है।")}</motion.p>}</AnimatePresence>
        <p className="tiny center row gap-1 just-c"><Icon n="shield" s={14} />{T("No password. No spam. Reporting never needs an account.", "पासवर्ड नहीं, स्पैम नहीं। रिपोर्ट के लिए अकाउंट ज़रूरी नहीं।")}</p>
        {local > 0 && <span className="tiny center">{T(`You can add the ${local} report${local > 1 ? "s" : ""} on this device after signing in.`, `साइन इन के बाद इस डिवाइस की ${local} रिपोर्ट जोड़ सकते हैं।`)}</span>}
      </motion.form>}
    </AnimatePresence></motion.div></main>;
}
