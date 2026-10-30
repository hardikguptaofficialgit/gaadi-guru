import type { Metadata } from "next";
import Link from "next/link";
import { load, summary } from "./data";
// Public share page: crawlers (WhatsApp, X) read the OG tags; people get a summary and a link into the app.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const r = await load(params.id); if (!r) return { title: "Gaadi Guru" };
  const s = summary(r); const title = `${s.n} road hazards reported in ${s.ward} · Gaadi Guru`;
  const description = `Repair estimate ₹${Math.round(s.total).toLocaleString("en-IN")}. Status: ${s.status}${s.verdict ? `, re-ride: ${s.verdict.split(" (")[0]}` : ""}. Back it up with one tap.`;
  return { title, description, openGraph: { title, description, type: "article" }, twitter: { card: "summary_large_image", title, description } };
}
export default async function Share({ params }: { params: { id: string } }) {
  const r = await load(params.id);
  if (!r) return <main className="wrap narrow page"><div className="card empty"><h3>Report not found</h3><Link className="btn primary" href="/new">Report a road</Link></div></main>;
  const s = summary(r);
  return <main className="wrap narrow page" data-testid="share-page">
    <div className="og-prev card" style={{ padding: 0 }}><img src={`/r/${r.id}/opengraph-image`} alt={`${s.n} road hazards in ${s.ward}`} /></div>
    <div className="stack gap-2"><span className="eyebrow">{s.ward}</span><h1>{s.n} road hazards reported</h1>
      <p className="mut">Faces and number plates are blurred. Repair estimate ₹{Math.round(s.total).toLocaleString("en-IN")}.</p></div>
    <div className="row"><Link className="btn primary lg" href={`/report?id=${r.id}`}>See the report</Link><Link className="btn lg" href="/new">Report your road</Link></div>
  </main>;
}
