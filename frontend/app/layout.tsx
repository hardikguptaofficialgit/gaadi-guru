import "./globals.css";
import "leaflet/dist/leaflet.css";
export const metadata = { title: "Gaadi Guru — pothole reports from your ride", description: "SAM 3.1 + Muse Spark road inspector" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
