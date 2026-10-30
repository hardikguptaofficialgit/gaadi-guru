"use client";
import { useEffect, useRef } from "react";
import { sevColor } from "./api";
type P = { lat: number; lng: number; worst: number; id: string; count: number };
const sev = (w: number) => (w >= 75 ? "CRITICAL" : w >= 50 ? "HIGH" : w >= 25 ? "MEDIUM" : "LOW");
export default function HotMap({ points, height = 420 }: { points: P[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null); const map = useRef<any>(null);
  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default;
      if (!map.current && ref.current) {
        map.current = L.map(ref.current, { scrollWheelZoom: false }).setView([20.283, 85.8325], 13); // Bhubaneswar
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(map.current);
      }
      points.filter(p => p.lat != null).forEach(p => {
        const c = sevColor[sev(p.worst)];
        L.circle([p.lat, p.lng], { radius: 120 + p.count * 25, color: c, weight: 2, fillColor: c, fillOpacity: 0.28 })
          .bindPopup(`<b>${p.count} hazards</b><br/><a href="/report?id=${p.id}">Open report ${p.id}</a>`).addTo(map.current);
      });
    })();
  }, [points]);
  return <div id="map" ref={ref} style={{ height }} />;
}
