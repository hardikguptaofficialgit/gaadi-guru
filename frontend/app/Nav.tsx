"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useT, K } from "./i18n";
import Icon from "./Icon";
const L: [string, K, string][] = [["/new", "report", "camera"], ["/mine", "mine", "list"], ["/map", "map", "map"], ["/ride", "ride", "bike"]];
export default function Nav() {
  const path = usePathname() || "/"; const { t, lang, setLang } = useT();
  const on = (h: string) => path === h || path.startsWith(h + "/") || (h === "/new" && path === "/report");
  return <>
    <div className="nav"><div className="wrap"><div className="bar">
      <Link href="/" className="logo"><img src="/logo.svg" alt="" width={32} height={32} /><span>Gaadi Guru</span></Link>
      <nav className="links" aria-label="Main">{L.map(([h, k, i]) => <Link key={h} href={h} className={on(h) ? "on" : ""}>
        {on(h) && <motion.span layoutId="nav-bg" className="nav-bg" />}<Icon n={i} s={16} />{t(k)}</Link>)}</nav>
      <button className="lang" onClick={() => setLang(lang === "en" ? "hi" : "en")} aria-label="Switch language">{lang === "en" ? "हिंदी" : "English"}</button>
    </div></div></div>
    <nav className="tabbar" aria-label="Main mobile">{L.map(([h, k, i]) => <Link key={h} href={h} className={on(h) ? "on" : ""}>
      {on(h) && <motion.span layoutId="tab-bg-m" className="nav-bg" />}<Icon n={i} s={20} />{t(k)}</Link>)}</nav>
  </>;
}
