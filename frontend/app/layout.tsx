import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import Nav from "./Nav";
import Spend from "./Spend";
import { Brand } from "./Icon";
import { LangProvider } from "./i18n";
import { ToastProvider } from "./ui";
import { AuthProvider } from "./auth";
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const metadata = { icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/brand/favicon.ico", sizes: "48x48" }], apple: "/brand/apple-touch-icon.png" }, manifest: "/manifest.webmanifest", metadataBase: new URL(SITE), title: "Patchwise: report a bad road in one tap", description: "Meta SAM 3.1 + Muse Spark + Muse Wonder civic agent",
  openGraph: { title: "Patchwise", description: "Report a bad road in one tap. Faces and plates blurred." } };
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#2F69E9" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`}><body><LangProvider><AuthProvider><ToastProvider><Nav />{children}
    <footer className="wrap"><div className="foot">
      <div className="foot-l"><b>Patchwise</b><span>Pothole reports that reach the office that owns the road.</span></div>
      <dl className="foot-m"><div><dt>Privacy</dt><dd>Faces and plates blurred before storage</dd></div><div><dt>Models</dt><dd className="row gap-1"><Brand b="meta" s={12} label="Meta" /> SAM 3.1 · Muse</dd></div><div><dt>Spend</dt><dd><Spend /></dd></div></dl>
    </div></footer></ToastProvider></AuthProvider></LangProvider></body></html>;
}
