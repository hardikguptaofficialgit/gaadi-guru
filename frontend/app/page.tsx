import Landing from "./landing/Landing";
import { API } from "./api";

export const revalidate = 60;

async function getStats() {
  try {
    const r = await fetch(`${process.env.API_INTERNAL_URL || API}/stats`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(2000) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

export default async function Home() {
  const initialStats = await getStats();
  return <>
    <link rel="preload" as="image" href="/example/poster.webp" fetchPriority="high" />
    <Landing initialStats={initialStats} />
  </>;
}
