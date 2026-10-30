export const API_IN = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export async function load(id: string) {
  if (!/^[a-f0-9]{6,16}$/.test(id)) return null;
  try { const r = await fetch(`${API_IN}/reports/${id}`, { cache: "no-store" }); if (!r.ok) return null; const x = await r.json(); return x?.id ? x : null; } catch { return null; }
}
export const summary = (r: any) => {
  const sev = ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(s => [s, r.potholes.filter((p: any) => p.severity === s).length] as [string, number]).filter(x => x[1]);
  const total = r.potholes.reduce((a: number, p: any) => a + (p.repair?.inr_est || 0), 0);
  return { sev, total, n: r.potholes.length, ward: r.ward || "Bhubaneswar", status: r.status as string, verdict: r.verification?.verdict as string | undefined, img: r.potholes.find((p: any) => p.image)?.image as string | undefined };
};
