"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT, K } from "./i18n";
const L: [string, K][] = [["/new", "report"], ["/mine", "mine"], ["/map", "map"], ["/ride", "ride"]];
export default function Nav() {
  const path = usePathname(); const { t, lang, setLang } = useT();
  return <div className="nav"><div className="wrap"><div className="bar">
    <Link href="/" className="logo"><img src="/logo.svg" alt="" width={32} height={32} /><span>Gaadi Guru</span></Link>
    <nav className="links">{L.map(([h, k]) => <Link key={h} href={h} className={path === h ? "on" : ""}>{t(k)}</Link>)}</nav>
    <button className="lang" onClick={() => setLang(lang === "en" ? "hi" : "en")} aria-label="Switch language">{lang === "en" ? "हिंदी" : "English"}</button>
  </div></div></div>;
}
