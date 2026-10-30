"use client";
import { createContext, useContext, useEffect, useState } from "react";
const D = {
  en: { report: "Report", mine: "My reports", map: "City map", ride: "Ride mode", cta: "Report a road", hero: "Bad road? Report it in one tap.",
    sub: "Upload a ride video or a photo. We find the potholes, blur faces and number plates, write the complaint and remind you in 7 days.",
    s1: "Upload", s2: "Review", s3: "Send", howbad: "How bad", fix: "Fix cost (approx.)", found: "problems found", next: "Next", back: "Back",
    upVideo: "Add a ride video or photo", upHint: "Video works best · photo is fine too", voice: "Say it in your words (optional)", voiceHint: "Hindi or English voice note",
    loc: "Location", locOk: "Location found", locNo: "Location not shared, we will use the ward", ward: "Ward", check: "Check my road",
    same: "Same pothole already reported nearby?", upvote: "Upvote it", upvoted: "Upvoted, thanks!", orNew: "or file a new report below",
    send: "Send complaint", sending: "Sending…", sent: "Complaint ready on the portal", remind: "We'll remind you in 7 days to check if it got fixed.",
    share: "Share", wa: "WhatsApp", x: "X", copy: "Copy link", copied: "Link copied", details: "Technical details", empty: "No reports yet. Your first one takes about a minute.",
    reminders: "Reminders", due: "Check again on", tabMap: "Map", tabBoard: "Repairs", tabLb: "Ward ranking" },
  hi: { report: "रिपोर्ट", mine: "मेरी रिपोर्ट", map: "शहर का नक्शा", ride: "राइड मोड", cta: "सड़क रिपोर्ट करें", hero: "खराब सड़क? एक टैप में रिपोर्ट करें।",
    sub: "राइड का वीडियो या फोटो डालें। हम गड्ढे ढूंढेंगे, चेहरे और नंबर प्लेट धुंधले करेंगे, शिकायत लिखेंगे और 7 दिन बाद याद दिलाएंगे।",
    s1: "अपलोड", s2: "जांचें", s3: "भेजें", howbad: "कितना खराब", fix: "मरम्मत खर्च (लगभग)", found: "समस्याएं मिलीं", next: "आगे", back: "पीछे",
    upVideo: "राइड वीडियो या फोटो डालें", upHint: "वीडियो सबसे अच्छा · फोटो भी चलेगा", voice: "अपनी बात बोलें (वैकल्पिक)", voiceHint: "हिंदी या अंग्रेज़ी वॉइस नोट",
    loc: "जगह", locOk: "जगह मिल गई", locNo: "जगह नहीं मिली, वार्ड इस्तेमाल होगा", ward: "वार्ड", check: "मेरी सड़क जांचें",
    same: "यही गड्ढा पास में पहले से रिपोर्ट हुआ है?", upvote: "समर्थन करें", upvoted: "धन्यवाद!", orNew: "या नीचे नई रिपोर्ट करें",
    send: "शिकायत भेजें", sending: "भेज रहे हैं…", sent: "शिकायत पोर्टल पर तैयार है", remind: "7 दिन बाद हम याद दिलाएंगे कि ठीक हुआ या नहीं।",
    share: "शेयर", wa: "WhatsApp", x: "X", copy: "लिंक कॉपी", copied: "लिंक कॉपी हो गया", details: "तकनीकी जानकारी", empty: "अभी कोई रिपोर्ट नहीं। पहली रिपोर्ट में लगभग 1 मिनट लगेगा।",
    reminders: "रिमाइंडर", due: "फिर जांचें", tabMap: "नक्शा", tabBoard: "मरम्मत", tabLb: "वार्ड रैंकिंग" } };
export type K = keyof typeof D.en;
const C = createContext<{ lang: "en" | "hi"; t: (k: K) => string; setLang: (l: "en" | "hi") => void }>({ lang: "en", t: k => D.en[k], setLang: () => {} });
export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setL] = useState<"en" | "hi">("en");
  useEffect(() => { const s = localStorage.getItem("lang"); if (s === "hi") setL("hi"); }, []);
  const setLang = (l: "en" | "hi") => { setL(l); localStorage.setItem("lang", l); document.documentElement.lang = l; };
  return <C.Provider value={{ lang, setLang, t: k => D[lang][k] }}>{children}</C.Provider>;
}
export const useT = () => useContext(C);
export const HOWBAD: Record<string, [string, string]> = { CRITICAL: ["Dangerous", "खतरनाक"], HIGH: ["Bad", "खराब"], MEDIUM: ["Okay-ish", "ठीक-ठाक"], LOW: ["Minor", "हल्का"] };
export const mine = { get: (): string[] => { try { return JSON.parse(localStorage.getItem("mine") || "[]"); } catch { return []; } },
  add: (id: string) => { const m = mine.get().filter(x => x !== id); localStorage.setItem("mine", JSON.stringify([id, ...m])); } };
export function Stepper({ at }: { at: 1 | 2 | 3 }) {
  const { t } = useT();
  return <ol className="stepper" aria-label="Progress">{(["s1", "s2", "s3"] as K[]).map((k, i) =>
    <li key={k} className={i + 1 < at ? "done" : i + 1 === at ? "on" : ""} aria-current={i + 1 === at ? "step" : undefined}><span>{i + 1 < at ? "✓" : i + 1}</span>{t(k)}</li>)}</ol>;
}
export function Share({ id, text }: { id: string; text: string }) {
  const { t } = useT(); const [ok, setOk] = useState(false);
  const url = typeof window !== "undefined" ? `${location.origin}/report?id=${id}` : "";
  const msg = encodeURIComponent(`${text} ${url}`);
  return <div className="row">
    <a className="btn" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${msg}`}>{t("wa")}</a>
    <a className="btn" target="_blank" rel="noreferrer" href={`https://x.com/intent/post?text=${msg}`}>{t("x")}</a>
    <button className="btn" onClick={() => { navigator.clipboard?.writeText(url); setOk(true); }}>{ok ? t("copied") : t("copy")}</button></div>;
}
