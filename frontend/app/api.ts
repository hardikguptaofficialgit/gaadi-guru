export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const SEV = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
export const sevColor: Record<string, string> = { CRITICAL: "#d9534f", HIGH: "#e08a3c", MEDIUM: "#c9a227", LOW: "#4f9d74" };
export const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
export const get = (p: string) => fetch(API + p, { cache: "no-store" }).then(r => r.json());
