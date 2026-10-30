"use client";
import { useEffect, useRef } from "react";
type P = { lat: number; lng: number; worst: number; id: string };
export default function Heatmap({ points }: { points: P[] }) {
  const ref = useRef<HTMLDivElement>(null); const map = useRef<any>(null);
  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default; (window as any).L = L; await import("leaflet.heat");
      if (!map.current && ref.current) {
        map.current = L.map(ref.current).setView([20.2961, 85.8245], 12); // Bhubaneswar
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map.current);
      }
      const pts = points.filter(p => p.lat != null);
      (L as any).heatLayer(pts.map(p => [p.lat, p.lng, Math.max(0.2, p.worst / 100)]), { radius: 30 }).addTo(map.current);
      pts.forEach(p => L.circleMarker([p.lat, p.lng], { radius: 6 }).bindPopup(`<a href="/report?id=${p.id}">Report ${p.id}</a>`).addTo(map.current));
    })();
  }, [points]);
  return <div id="map" ref={ref} />;
}
