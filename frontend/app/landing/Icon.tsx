// One consistent 24px stroke icon set (1.75 stroke, round caps). No emojis on the landing page.
const P: Record<string, string> = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z",
  scan: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10",
  rupee: "M7 5h10M7 9h10M7 5c6 0 6 8 0 8h-1l8 7",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  form: "M4 5h16v14H4zM7 9h6M7 13h10M7 16h4",
  bell: "M6 16V11a6 6 0 1112 0v5l2 2H4zM10 20a2 2 0 004 0",
  refresh: "M20 11a8 8 0 10-2.3 5.7M20 5v6h-6",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  eyeoff: "M3 3l18 18M10.6 6.1A9 9 0 0121 12c-.6 1.2-1.4 2.3-2.4 3.2M6.3 7.4A9.6 9.6 0 003 12c1.8 3.6 5.2 6 9 6 1.4 0 2.8-.3 4-.9M9.9 9.9a3 3 0 004.2 4.2",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-6 8-6s8 2 8 6",
  lang: "M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M11 5c0 3-3 7-7 8M13 21l4-9 4 9M14.5 18h5",
  mic: "M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  bike: "M5.5 18a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM18.5 18a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5.5 14.5L9 7h5l4.5 7.5M9 7l3 7.5h-6",
  copy: "M8 8h12v12H8zM4 16V4h12",
  alert: "M12 4l9 16H3zM12 10v4M12 17v.5",
};
export default function Icon({ n, s = 20, className = "" }: { n: keyof typeof P | string; s?: number; className?: string }) {
  return <svg className={"ico " + className} width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={P[n] || P.check} /></svg>;
}
