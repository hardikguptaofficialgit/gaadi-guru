"use client";
// Accounts via Supabase (email magic link, Google when enabled). Everything degrades to the
// logged-out "from this phone" list if Supabase isn't configured or can't be reached.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { mine } from "./i18n";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
export const GOOGLE = process.env.NEXT_PUBLIC_SUPABASE_GOOGLE === "1";
const TIMEOUT = 6000;
const timedFetch: typeof fetch = (input, init) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), TIMEOUT);
  return fetch(input, { ...init, signal: c.signal }).finally(() => clearTimeout(t)); };
let sb: SupabaseClient | null = null;
export function supa() {
  if (!URL_ || !KEY || typeof window === "undefined") return null;
  return sb ??= createClient(URL_, KEY, { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true }, global: { fetch: timedFetch } });
}

export type Row = { id: string; ward?: string | null; city?: string | null; lat?: number | null; lng?: number | null; hazards?: number; worst?: string | null;
  repair_inr?: number | null; status?: string; authority_id?: string | null; sent_at?: string | null; claimed_from_device?: boolean };
type Ctx = { enabled: boolean; ready: boolean; user: User | null; down: boolean; ids: string[] | null;
  sendLink: (email: string) => Promise<string | null>; google: () => Promise<string | null>; signOut: () => Promise<void>;
  claim: (ids: string[]) => Promise<Claim>; save: (r: Row) => Promise<void>; refresh: () => Promise<void> };
const A = createContext<Ctx>({ enabled: false, ready: true, user: null, down: false, ids: null, sendLink: async () => "off", google: async () => "off",
  signOut: async () => {}, claim: async () => ({ added: 0, missing: [], taken: [], error: null }), save: async () => {}, refresh: async () => {} });
export const useAuth = () => useContext(A);

export type Claim = { added: number; missing: string[]; taken: string[]; error: string | null };
const err = (e: any) => e?.name === "AbortError" || /fetch|network|Failed/i.test(String(e?.message || e));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [ready, setReady] = useState(!URL_);
  const [down, setDown] = useState(false); const [ids, setIds] = useState<string[] | null>(null);
  const c = typeof window !== "undefined" ? supa() : null;

  const refresh = useCallback(async () => {
    const s = supa(); if (!s) return;
    const { data, error } = await s.from("reports").select("id").order("created_at", { ascending: false }).then(x => x, e => ({ data: null, error: e }));
    if (error) { setDown(true); setIds(null); return; }
    setDown(false); setIds((data || []).map((x: any) => x.id));
  }, []);

  const save = useCallback(async (r: Row) => {
    const s = supa(); if (!s) return;
    const { data } = await s.auth.getSession().catch(() => ({ data: { session: null } } as any)); if (!data.session) return;
    const { error } = await s.from("reports").upsert({ ...r, user_id: data.session.user.id }, { onConflict: "id" }).then(x => x, e => ({ error: e }));
    if (error) setDown(err(error) || down); else setIds(v => v ? (v.includes(r.id) ? v : [r.id, ...v]) : [r.id]);
  }, [down]);

  // Claim on-device reports into the account. Returns exactly what happened so the UI can say why, not just "couldn't".
  const claim = useCallback(async (list: string[]): Promise<Claim> => {
    const res: Claim = { added: 0, missing: [], taken: [], error: null };
    const s = supa(); if (!s || !list.length) return res;
    const { data } = await s.auth.getSession().catch(() => ({ data: { session: null } } as any));
    if (!data.session) return { ...res, error: "signed-out" };
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const chk = await fetch(`${API}/reports/check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: list }) })
      .then(x => x.ok ? x.json() : null).catch(() => null);
    if (!chk) return { ...res, error: "server" };
    res.missing = chk.missing || [];
    if (res.missing.length) mine.drop(res.missing);  // ids whose report no longer exists on this server: stop offering them
    const body = (chk.reports || []).map((r: any) => ({ ...toRow(r, true), user_id: data.session.user.id }));
    if (!body.length) return res;
    const { error } = await s.from("reports").upsert(body, { onConflict: "id", ignoreDuplicates: true }).then(x => x, e => ({ error: e }));
    if (error) { if (err(error)) setDown(true); const m = String((error as any).message || error);
      return { ...res, error: /row-level security|JWT|jwt|401|403/.test(m) ? "session" : /relation .* does not exist|schema cache/.test(m) ? "schema" : err(error) ? "account" : m }; }
    const { data: got } = await s.from("reports").select("id").in("id", body.map((b: any) => b.id)).then(x => x, () => ({ data: null } as any));
    const have = new Set((got || []).map((x: any) => x.id));
    res.added = body.filter((b: any) => have.has(b.id)).length;
    res.taken = body.filter((b: any) => !have.has(b.id)).map((b: any) => b.id);  // PK held by another account: RLS hides it, insert was skipped
    if (res.taken.length) mine.drop(res.taken);
    await refresh(); return res;
  }, [refresh]);

  useEffect(() => {
    if (!c) { setReady(true); return; }
    let live = true;
    const t = setTimeout(() => { if (live) { setReady(true); setDown(true); } }, TIMEOUT + 500);
    c.auth.getSession().then(({ data }) => { if (!live) return; setUser(data.session?.user ?? null); setReady(true); clearTimeout(t); })
      .catch(() => { setDown(true); setReady(true); });
    const { data: sub } = c.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => { live = false; clearTimeout(t); sub.subscription.unsubscribe(); };
  }, []);
  useEffect(() => { if (user) refresh(); else setIds(null); }, [user]);
  // New reports made while signed in go to the account too (mine.add fires this event).
  useEffect(() => { const h = (e: Event) => { const id = (e as CustomEvent).detail; if (!user || !id) return;
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${API}/reports/${id}`).then(x => x.ok ? x.json() : null).then(r => r && save(toRow(r, false))).catch(() => {}); };
    window.addEventListener("mine:add", h); return () => window.removeEventListener("mine:add", h); }, [user, save]);

  const v = useMemo<Ctx>(() => ({ enabled: !!(URL_ && KEY), ready, user, down, ids, refresh, save, claim,
    sendLink: async (email) => { const s = supa(); if (!s) return "Accounts are not set up on this server.";
      const { error } = await s.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback` } }).then(x => x, e => ({ error: e }));
      if (error) { if (err(error)) setDown(true); return String(error.message || error); } return null; },
    google: async () => { const s = supa(); if (!s) return "Accounts are not set up on this server.";
      const { error } = await s.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/auth/callback` } }).then(x => x, e => ({ error: e }));
      return error ? String(error.message || error) : null; },
    signOut: async () => { await supa()?.auth.signOut().catch(() => {}); setUser(null); setIds(null); } }), [ready, user, down, ids, refresh, save, claim]);
  return <A.Provider value={v}>{children}</A.Provider>;
}

const SEVS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
export function toRow(r: any, claimed: boolean): Row {
  const ps = r.potholes || [];
  return { id: r.id, ward: r.ward || null, lat: r.lat ?? null, lng: r.lng ?? null, hazards: ps.length, worst: SEVS.find(s => ps.some((p: any) => p.severity === s)) || null,
    repair_inr: Math.round(ps.reduce((a: number, p: any) => a + (p.repair?.inr_est || 0), 0)), status: r.status || "reported", claimed_from_device: claimed };
}
export const unclaimed = (account: string[] | null) => account ? mine.get().filter(x => !account.includes(x)) : [];
