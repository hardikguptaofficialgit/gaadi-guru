"use client";
import { useEffect, useState } from "react";
import { get } from "./api";
export default function Spend() { const [c, setC] = useState<any>(null); useEffect(() => { get("/costs").then(setC).catch(() => {}); }, []);
  return c ? <span title="Meta API spend; guard stops at $70">· API spend ${c.total_usd.toFixed(2)} / $75</span> : null; }
