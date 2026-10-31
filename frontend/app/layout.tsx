import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Inter } from "next/font/google";
import Nav from "./Nav";
import Spend from "./Spend";
import { LangProvider } from "./i18n";
import { ToastProvider } from "./ui";
import { AuthProvider } from "./auth";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const metadata = { metadataBase: new URL(SITE), title: "Patchwise: report a bad road in one tap", description: "Meta SAM 3.1 + Muse Spark + Muse Wonder civic agent",
  openGraph: { title: "Patchwise", description: "Report a bad road in one tap. Faces and plates blurred." } };
export const viewport = { width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={inter.variable}><body><LangProvider><AuthProvider><ToastProvider><Nav />{children}
    <footer className="wrap"><div className="foot tiny"><span>Patchwise · Faces and number plates are blurred before anything is stored or shared.</span><Spend /></div></footer></ToastProvider></AuthProvider></LangProvider></body></html>;
}
