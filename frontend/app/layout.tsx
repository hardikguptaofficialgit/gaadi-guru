import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Inter } from "next/font/google";
import Nav from "./Nav";
import Spend from "./Spend";
import { Brand } from "./Icon";
import { LangProvider } from "./i18n";
import { ToastProvider } from "./ui";
import { AuthProvider } from "./auth";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const metadata = { icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/brand/favicon.ico", sizes: "48x48" }], apple: "/brand/apple-touch-icon.png" }, manifest: "/manifest.webmanifest", metadataBase: new URL(SITE), title: "Patchwise: report a bad road in one tap", description: "Meta SAM 3.1 + Muse Spark + Muse Wonder civic agent",
  openGraph: { title: "Patchwise", description: "Report a bad road in one tap. Faces and plates blurred." } };
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#2F69E9" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={inter.variable}><body><LangProvider><AuthProvider><ToastProvider><Nav />{children}
    <footer className="wrap"><div className="foot tiny"><span>Patchwise · Faces and number plates are blurred before anything is stored or shared.</span><span className="row gap-2"><span className="row gap-1">Powered by <Brand b="meta" s={12} label="Meta" /> Meta</span><Spend /></span></div></footer></ToastProvider></AuthProvider></LangProvider></body></html>;
}
