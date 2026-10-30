"use client";
// Shared UI primitives: Button/Card come from CSS classes; these are the stateful ones.
import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "./Icon";

type Toast = { id: number; text: string; kind: "ok" | "err" | "info" };
const TC = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random(); setList(l => [...l, { id, text, kind }]);
    setTimeout(() => setList(l => l.filter(x => x.id !== id)), 3600);
  }, []);
  return <TC.Provider value={push}>{children}
    <div className="toasts" aria-live="polite"><AnimatePresence>{list.map(t =>
      <motion.div key={t.id} className={"toast " + t.kind} role="status" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
        <Icon n={t.kind === "err" ? "alert" : t.kind === "info" ? "bell" : "check"} />{t.text}</motion.div>)}</AnimatePresence></div></TC.Provider>;
}
export const useToast = () => useContext(TC);

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return <AnimatePresence>{open && <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <motion.div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}
      initial={{ opacity: 0, y: 24, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: .25 }}>
      <div className="modal-h"><h2>{title}</h2><button className="btn ghost" aria-label="Close" onClick={onClose}><Icon n="x" /></button></div>{children}
    </motion.div></motion.div>}</AnimatePresence>;
}

export function Tabs<T extends string>({ value, onChange, items, id }: { value: T; onChange: (v: T) => void; items: [T, React.ReactNode][]; id: string }) {
  return <div className="tabs" role="tablist">{items.map(([k, l]) =>
    <button key={k} role="tab" aria-selected={value === k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>
      {value === k && <motion.span layoutId={"tab-" + id} className="tab-bg" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
      <span className="tab-l">{l}</span></button>)}</div>;
}

export const Sk = ({ h = 16, w = "100%", r }: { h?: number; w?: number | string; r?: number }) => <span className="sk" style={{ height: h, width: w, borderRadius: r }} aria-hidden />;
export function SkList({ n = 3 }: { n?: number }) {
  return <div className="list" role="status" aria-label="Loading">{Array.from({ length: n }).map((_, i) =>
    <div key={i} className="li"><Sk h={64} w={88} /><div className="stack grow gap-2"><Sk h={16} w="50%" /><Sk h={12} w="30%" /></div></div>)}</div>;
}

export function Empty({ icon = "doc", title, body, children }: { icon?: string; title: string; body?: string; children?: React.ReactNode }) {
  return <div className="card empty"><span className="ico-tile"><Icon n={icon} s={28} /></span><h3>{title}</h3>{body && <p className="mut small">{body}</p>}{children}</div>;
}

// Status + re-ride verdict badges (same vocabulary on map, board, report, ward page)
const STATUS: Record<string, [string, string, string]> = { reported: ["Reported", "रिपोर्ट हुआ", ""], filed: ["Complaint filled", "शिकायत भरी", "b-info"],
  promised: ["Waiting for repair", "मरम्मत का इंतज़ार", "b-warn"], fixed: ["Fixed", "ठीक हुआ", "b-ok"] };
export const VERDICT: Record<string, [string, string, string]> = { FIXED: ["Fixed on re-ride", "री-राइड में ठीक", "b-ok"], "NOT FIXED": ["Not fixed", "ठीक नहीं हुआ", "b-bad"],
  PARTIALLY: ["Partly fixed", "थोड़ा ठीक", "b-warn"], INCONCLUSIVE: ["Inconclusive", "अनिश्चित", "b-warn"], "NOT COMPARABLE": ["Different road", "अलग सड़क", ""] };
export const verdictKey = (v?: string) => !v ? "" : v.startsWith("NOT FIXED") ? "NOT FIXED" : v.startsWith("PARTIAL") ? "PARTIALLY" : v.startsWith("FIXED") ? "FIXED" : v.startsWith("NOT COMP") ? "NOT COMPARABLE" : "INCONCLUSIVE";
export function StatusBadge({ s, hi }: { s: string; hi?: boolean }) { const x = STATUS[s] || [s, s, ""]; return <span className={"badge " + x[2]} data-status={s}><i />{x[hi ? 1 : 0]}</span>; }
export function VerdictBadge({ v, hi }: { v?: string; hi?: boolean }) { const k = verdictKey(v); if (!k) return null; const x = VERDICT[k];
  return <span className={"badge " + x[2]} data-verdict={k}><Icon n="refresh" s={12} />{x[hi ? 1 : 0]}</span>; }
