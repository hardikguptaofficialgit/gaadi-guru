import Landing from "./landing/Landing";
import { API } from "./api";

export const revalidate = 60; // ISR: the example report is server-rendered, refreshed at most once a minute

async function getFeatured() {
  try {
    const r = await fetch(`${process.env.API_INTERNAL_URL || API}/featured`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(2500) });
    return r.ok ? (await r.json()).featured ?? null : null;
  } catch { return null; }
}

export default async function Home() {
  const featured = await getFeatured();
  return <>
    {featured?.poster && <link rel="preload" as="image" href={(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + featured.poster} fetchPriority="high" />}
    <Landing featured={featured} />
  </>;
}
