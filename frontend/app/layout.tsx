import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Inter } from "next/font/google";
import Nav from "./Nav";
import Spend from "./Spend";
import { LangProvider } from "./i18n";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
export const metadata = { title: "Gaadi Guru — report a bad road in one tap", description: "Meta SAM 3.1 + Muse Spark + Muse Wonder civic agent" };
export const viewport = { width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={inter.variable}><body><LangProvider><Nav />{children}
    <footer className="wrap section tiny">Gaadi Guru · Faces and number plates are blurred before anything is stored or shared. <Spend /></footer></LangProvider></body></html>;
}
