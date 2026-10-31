// UI icons: Phosphor (regular weight everywhere, 1em = s px). Brand logos live in /public/brands (thesvg.org) via <Brand>.
import { Check, ArrowRight, Camera, Scan, CurrencyInr, FileText, Textbox, Bell, ArrowClockwise, ShieldCheck, EyeSlash, User, Translate, Microphone,
  MapTrifold, Motorcycle, Copy, WarningCircle, House, ListBullets, UploadSimple, VideoCamera, WifiSlash, X, ShareNetwork, ArrowSquareOut, Clock, MapPin,
  ThumbsUp, Play, TrendUp, Envelope, Buildings, Phone, Globe, SignOut } from "@phosphor-icons/react/dist/ssr";
type PI = typeof Check;
const P: Record<string, PI> = { check: Check, arrow: ArrowRight, camera: Camera, scan: Scan, rupee: CurrencyInr, doc: FileText, form: Textbox, bell: Bell,
  refresh: ArrowClockwise, shield: ShieldCheck, eyeoff: EyeSlash, user: User, lang: Translate, mic: Microphone, map: MapTrifold, bike: Motorcycle, copy: Copy,
  alert: WarningCircle, home: House, list: ListBullets, upload: UploadSimple, video: VideoCamera, wifioff: WifiSlash, x: X, share: ShareNetwork, ext: ArrowSquareOut,
  clock: Clock, pin: MapPin, thumb: ThumbsUp, play: Play, trend: TrendUp, mail: Envelope, gov: Buildings, phone: Phone, globe: Globe, out: SignOut };
export default function Icon({ n, s = 20, className = "" }: { n: string; s?: number; className?: string }) {
  const C = P[n] || Check;
  return <C className={"ico " + className} size={s} weight="regular" aria-hidden />;
}
export function Brand({ b, s = 18, label }: { b: "meta" | "gmail" | "google" | "github" | "x" | "whatsapp" | "supabase" | "openstreetmap"; s?: number; label?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="brand" src={`/brands/${b}.svg`} alt={label || ""} aria-hidden={!label} height={s} style={{ height: s, width: "auto" }} />;
}
