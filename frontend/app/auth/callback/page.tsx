"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../auth";
import Icon from "../../Icon";
// Supabase redirects here from the magic link / Google; supabase-js exchanges the ?code= for a session.
export default function Callback() {
  const a = useAuth(); const r = useRouter(); const [slow, setSlow] = useState(false);
  useEffect(() => { if (a.user) r.replace("/mine"); }, [a.user]);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(t); }, []);
  return <main className="wrap narrow page"><div className="card stack center gap-2" role="status">
    {slow && !a.user ? <><span className="ico-tile"><Icon n="alert" /></span><b>The sign-in link didn't work</b>
      <span className="tiny">Links work once, on the device that asked for them. <a href="/login">Try again</a></span></>
      : <><div className="spinner" /><b>Signing you in…</b></>}</div></main>;
}
