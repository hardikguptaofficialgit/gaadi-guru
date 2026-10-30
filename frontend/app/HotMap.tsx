"use client";
import { useEffect, useRef } from "react";
import { sevColor } from "./api";
import { verdictKey, VERDICT } from "./ui";
type P = { lat: number; lng: number; worst: number; id: string; count: number; status?: string; verdict?: string; ward?: string };
const sev = (w: number) => (w >= 75 ? "CRITICAL" : w >= 50 ? "HIGH" : w >= 25 ? "MEDIUM" : "LOW");
const VC: Record<string, string> = { FIXED: "#3f8f66", "NOT FIXED": "#d14b47", PARTIALLY: "#d9822f", INCONCLUSIVE: "#b8921a", "NOT COMPARABLE": "#8790a0" };
export default function HotMap({ points, height = 420 }: { points: P[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null); const map = useRef<any>(null); const layer = useRef<any>(null);
  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default;
      if (!map.current && ref.current) {
        map.current = L.map(ref.current, { scrollWheelZoom: false }).setView([20.283, 85.8325], 13); // Bhubaneswar
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(map.current);
      }
      layer.current?.remove(); layer.current = L.layerGroup().addTo(map.current);
      points.filter(p => p.lat != null && p.count > 0).forEach(p => {
        const fixed = p.status === "fixed"; const c = fixed ? sevColor.LOW : sevColor[sev(p.worst)]; const vk = verdictKey(p.verdict);
        L.circle([p.lat, p.lng], { radius: 120 + p.count * 25, color: c, weight: 2, fillColor: c, fillOpacity: 0.24 }).addTo(layer.current);
        if (vk) L.circle([p.lat, p.lng], { radius: 160 + p.count * 25, color: VC[vk], weight: 2.5, dashArray: "6 6", fill: false }).addTo(layer.current);
        L.circleMarker([p.lat, p.lng], { radius: 6, color: "#fff", weight: 2, fillColor: c, fillOpacity: 1 })
          .bindPopup(`<b>${p.count} hazards</b>${p.ward ? ` · ${p.ward}` : ""}<br/>${vk ? `<span style="color:${VC[vk]};font-weight:650">Re-ride: ${VERDICT[vk][0]}</span><br/>` : ""}<a href="/report?id=${p.id}">Open report</a>`).addTo(layer.current);
      });
    })();
  }, [points]);
  return <div id="map" ref={ref} style={{ height }} />;
}
