"use client";
import { useEffect, useState } from "react";
import { get } from "./api";
export default function Spend() { const [c, setC] = useState<any>(null);
  useEffect(() => { const f = () => get("/costs").then(setC).catch(() => {}); f(); const i = setInterval(f, 4000); return () => clearInterval(i); }, []);
  return c ? <span title="Meta API spend; guard stops at $70">· API spend ${c.total_usd.toFixed(2)} / $75</span> : null; }
