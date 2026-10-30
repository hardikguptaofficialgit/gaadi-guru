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
        map.current = L.map(ref.current, { scrollWheelZoom: false }).setView([20.2961, 85.8245], 12); // Bhubaneswar
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { attribution: "© OpenStreetMap © CARTO" }).addTo(map.current);
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
