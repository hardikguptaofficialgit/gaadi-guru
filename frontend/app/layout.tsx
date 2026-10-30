import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Inter } from "next/font/google";
import Nav from "./Nav";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
export const metadata = { title: "Gaadi Guru — your ride becomes a road repair", description: "Meta SAM 3.1 + Muse Spark + Muse Wonder civic agent" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={inter.variable}><body><Nav />{children}<footer className="wrap section tiny">Gaadi Guru · Meta SAM 3.1 · Muse Spark · Muse Voice · Muse Wonder · Privacy: faces and plates are blurred before anything is stored or shared.</footer></body></html>;
}
