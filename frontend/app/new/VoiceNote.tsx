"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../Icon";

/** Voice note: record in the browser (MediaRecorder + live AnalyserNode waveform) or upload a file,
 *  then review with a scrubbable waveform. Output is a plain File; the server's ffmpeg→ASR path is unchanged. */
const MAX_S = 120;
const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const ACCEPT = ".mp3,.m4a,.wav,.webm,.ogg,.mp4,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/webm,audio/ogg";
const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "#2F69E9";
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
type St = "idle" | "asking" | "recording" | "paused" | "done" | "denied" | "error";

function bars(ctx: CanvasRenderingContext2D, w: number, h: number, vals: number[], color: string, played = -1, rest = color) {
  ctx.clearRect(0, 0, w, h); const n = vals.length, gap = 3, bw = Math.max(2, (w - gap * (n - 1)) / n);
  for (let i = 0; i < n; i++) { const bh = Math.max(4, vals[i] * (h - 4)); const x = i * (bw + gap), y = (h - bh) / 2;
    ctx.fillStyle = played < 0 || i / n <= played ? color : rest; ctx.beginPath();
    (ctx as any).roundRect ? (ctx as any).roundRect(x, y, bw, bh, bw / 2) : ctx.rect(x, y, bw, bh); ctx.fill(); }
}
function fit(c: HTMLCanvasElement) { const r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  if (c.width !== Math.round(r.width * d)) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); }
  const ctx = c.getContext("2d")!; ctx.setTransform(d, 0, 0, d, 0, 0); return { ctx, w: r.width, h: r.height }; }

export default function VoiceNote({ value, onChange, H }: { value: File | null; onChange: (f: File | null) => void; H: boolean }) {
  const T = (en: string, hi: string) => (H ? hi : en);
  const [st, setSt] = useState<St>(value ? "done" : "idle"); const [secs, setSecs] = useState(0); const [err, setErr] = useState("");
  const rec = useRef<MediaRecorder | null>(null); const chunks = useRef<Blob[]>([]); const stream = useRef<MediaStream | null>(null);
  const actx = useRef<AudioContext | null>(null); const raf = useRef(0); const live = useRef<HTMLCanvasElement>(null);
  const hist = useRef<number[]>([]); const t0 = useRef(0); const acc = useRef(0);
  const reduce = typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cleanup = useCallback(() => { cancelAnimationFrame(raf.current); stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
    actx.current?.close().catch(() => {}); actx.current = null; }, []);
  useEffect(() => cleanup, [cleanup]);

  async function start() {
    setErr(""); if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setSt("error"); setErr(T("This browser can't record audio. Upload a file instead.", "यह ब्राउज़र रिकॉर्ड नहीं कर सकता। फ़ाइल अपलोड करें।")); return; }
    setSt("asking");
    try { stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e: any) { setSt(e?.name === "NotAllowedError" || e?.name === "SecurityError" ? "denied" : "error");
      setErr(e?.name === "NotFoundError" ? T("No microphone found.", "माइक्रोफ़ोन नहीं मिला।") : e?.name === "NotAllowedError" ? "" : T("Couldn't start the microphone.", "माइक्रोफ़ोन शुरू नहीं हुआ।")); return; }
    const mime = TYPES.find(t => MediaRecorder.isTypeSupported(t)) || "";
    const r = new MediaRecorder(stream.current, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined); rec.current = r; chunks.current = [];
    r.ondataavailable = e => e.data.size && chunks.current.push(e.data);
    r.onstop = () => { const type = (r.mimeType || mime || "audio/webm").split(";")[0]; const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      const f = new File(chunks.current, `voice-note.${ext}`, { type }); cleanup(); if (f.size) { onChange(f); setSt("done"); } else { setSt("error"); setErr(T("Nothing was recorded. Try again.", "कुछ रिकॉर्ड नहीं हुआ।")); } };
    r.start(250); acc.current = 0; t0.current = performance.now(); setSecs(0); hist.current = []; setSt("recording");
    // live waveform
    const ac = new AudioContext(); actx.current = ac; const an = ac.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = .6;
    ac.createMediaStreamSource(stream.current).connect(an); const buf = new Float32Array(an.fftSize); const col = css("--sky-deep"); let last = 0;
    const loop = (now: number) => { raf.current = requestAnimationFrame(loop);
      const el = (acc.current + (r.state === "recording" ? now - t0.current : 0)) / 1000; setSecs(s => (Math.floor(el) !== Math.floor(s) ? el : s));
      if (el >= MAX_S && r.state !== "inactive") { r.stop(); return; }
      if (reduce && now - last < 250) return; last = now;
      an.getFloatTimeDomainData(buf); let sum = 0; for (const v of buf) sum += v * v; const lvl = r.state === "recording" ? Math.min(1, Math.sqrt(sum / buf.length) * 4) : 0.02;
      const c = live.current; if (!c) return; const { ctx, w, h } = fit(c); const n = Math.floor(w / 7);
      if (now - (hist as any).t > 50 || !(hist as any).t) { hist.current.push(lvl); (hist as any).t = now; if (hist.current.length > n) hist.current.splice(0, hist.current.length - n); }
      const vals = Array(Math.max(0, n - hist.current.length)).fill(0.02).concat(hist.current); bars(ctx, w, h, vals, col); };
    raf.current = requestAnimationFrame(loop);
  }
  const pause = () => { const r = rec.current; if (!r) return; if (r.state === "recording") { r.pause(); acc.current += performance.now() - t0.current; setSt("paused"); } else if (r.state === "paused") { r.resume(); t0.current = performance.now(); setSt("recording"); } };
  const stop = () => { const r = rec.current; if (r && r.state !== "inactive") { if (r.state === "recording") acc.current += performance.now() - t0.current; r.stop(); } };
  const del = () => { onChange(null); setSt("idle"); setSecs(0); };
  const pick = (f: File | null) => { if (!f) return; if (f.size > 25e6) { setErr(T("That file is over 25 MB.", "फ़ाइल 25 MB से बड़ी है।")); return; } setErr(""); onChange(f); setSt("done"); };

  const busy = st === "recording" || st === "paused";
  return <div className="vn" data-state={st}>
    {busy ? <div className="vn-rec" data-testid="voice-live">
        <div className="vn-top"><span className={"vn-dot" + (st === "paused" ? " off" : "")} aria-hidden /><span className="vn-st">{st === "paused" ? T("Paused", "रुका") : T("Recording", "रिकॉर्डिंग")}</span>
          <span className="vn-time mono-t" data-testid="voice-timer" aria-live="off">{fmt(secs)} <span className="mut">/ {fmt(MAX_S)}</span></span></div>
        <canvas ref={live} className="vn-canvas" aria-hidden />
        <div className="vn-ctl">
          <button type="button" className="btn lg" onClick={pause} data-testid="voice-pause"><Icon n={st === "paused" ? "mic" : "pause"} s={18} />{st === "paused" ? T("Resume", "जारी") : T("Pause", "रोकें")}</button>
          <button type="button" className="btn primary lg" onClick={stop} data-testid="voice-stop"><Icon n="stop" s={18} />{T("Done", "पूरा")}</button></div></div>
      : value && st === "done" ? <Player file={value} onDelete={del} onRerecord={() => { del(); start(); }} T={T} />
      : <div className="vn-idle">
          <button type="button" className="vn-mic" onClick={start} disabled={st === "asking"} data-testid="voice-record" aria-label={T("Record a voice note", "वॉइस नोट रिकॉर्ड करें")}><Icon n="mic" s={26} /></button>
          <div className="vn-copy"><b>{st === "asking" ? T("Allow the microphone…", "माइक्रोफ़ोन की अनुमति दें…") : T("Say what's wrong, in any language", "किसी भी भाषा में बताइए क्या गड़बड़ है")}</b>
            <span className="mut small">{T(`Up to ${MAX_S / 60} minutes. Added to the complaint as text.`, `${MAX_S / 60} मिनट तक। शिकायत में टेक्स्ट बनकर जुड़ता है।`)}</span></div>
          <label className="btn vn-up" data-testid="voice-upload-label"><Icon n="upload" s={16} />{T("Upload audio", "ऑडियो अपलोड")}
            <input type="file" className="sr-only" accept={ACCEPT} data-testid="voice-upload" aria-label={T("Upload an audio file", "ऑडियो फ़ाइल अपलोड करें")} onChange={e => { pick(e.target.files?.[0] || null); e.target.value = ""; }} /></label></div>}
    {(st === "denied" || err) && <p className="vn-err small" role="alert" data-testid="voice-error"><Icon n="alert" s={16} />
      {st === "denied" ? T("Microphone access is blocked. Allow it from the lock icon in the address bar, or upload a file.", "माइक्रोफ़ोन ब्लॉक है। एड्रेस बार के लॉक आइकन से अनुमति दें, या फ़ाइल अपलोड करें।") : err}</p>}
  </div>;
}

function Player({ file, onDelete, onRerecord, T }: { file: File; onDelete: () => void; onRerecord: () => void; T: (a: string, b: string) => string }) {
  const url = useRef(""); const au = useRef<HTMLAudioElement>(null); const cv = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null); const [p, setP] = useState(0); const [dur, setDur] = useState(0); const [on, setOn] = useState(false); const [bad, setBad] = useState(false);
  if (!url.current) url.current = URL.createObjectURL(file);
  useEffect(() => () => URL.revokeObjectURL(url.current), []);
  useEffect(() => { let ok = true; (async () => { try { const ac = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(1, 44100, 44100);
      const b = await ac.decodeAudioData(await file.arrayBuffer()); const d = b.getChannelData(0), N = 64, step = Math.floor(d.length / N) || 1; const out: number[] = [];
      for (let i = 0; i < N; i++) { let m = 0; for (let j = i * step; j < Math.min(d.length, (i + 1) * step); j += 16) m = Math.max(m, Math.abs(d[j])); out.push(m); }
      const mx = Math.max(...out, 0.01); if (ok) { setPeaks(out.map(v => Math.max(0.06, v / mx))); if (isFinite(b.duration)) setDur(b.duration); } }
    catch { if (ok) { setBad(true); setPeaks(Array(64).fill(0.25)); } } })(); return () => { ok = false; }; }, [file]);
  useEffect(() => { const c = cv.current; if (!c || !peaks) return; const { ctx, w, h } = fit(c); bars(ctx, w, h, peaks, css("--sky-deep"), dur ? p / dur : 0, css("--rule")); }, [peaks, p, dur]);
  useEffect(() => { const a = au.current; if (!a) return; let r = 0; const tick = () => { setP(a.currentTime); if (!a.paused) r = requestAnimationFrame(tick); };
    const play = () => { setOn(true); tick(); }; const pause = () => { setOn(false); cancelAnimationFrame(r); setP(a.currentTime); };
    const md = () => { if (isFinite(a.duration)) setDur(a.duration); };
    a.addEventListener("play", play); a.addEventListener("pause", pause); a.addEventListener("ended", pause); a.addEventListener("loadedmetadata", md);
    return () => { cancelAnimationFrame(r); a.removeEventListener("play", play); a.removeEventListener("pause", pause); a.removeEventListener("ended", pause); a.removeEventListener("loadedmetadata", md); }; }, []);
  const seek = (x: number) => { const a = au.current, c = cv.current; if (!a || !c || !dur) return; const r = c.getBoundingClientRect(); a.currentTime = Math.max(0, Math.min(1, (x - r.left) / r.width)) * dur; setP(a.currentTime); };
  const drag = (e: React.PointerEvent) => { (e.target as Element).setPointerCapture(e.pointerId); seek(e.clientX); };
  const key = (e: React.KeyboardEvent) => { const a = au.current; if (!a || !dur) return; const d = e.key === "ArrowRight" ? 2 : e.key === "ArrowLeft" ? -2 : 0; if (d) { e.preventDefault(); a.currentTime = Math.max(0, Math.min(dur, a.currentTime + d)); setP(a.currentTime); } };
  return <div className="vn-play" data-testid="voice-player">
    <audio ref={au} src={url.current} preload="metadata" />
    <button type="button" className="vn-pp" onClick={() => { const a = au.current!; a.paused ? a.play() : a.pause(); }} data-testid="voice-play" aria-label={on ? T("Pause", "रोकें") : T("Play", "चलाएं")}><Icon n={on ? "pause" : "play"} s={20} /></button>
    <div className="vn-wave">
      <canvas ref={cv} className="vn-canvas sm" role="slider" tabIndex={0} aria-label={T("Seek", "आगे-पीछे")} aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(p)} aria-valuetext={`${fmt(p)} / ${fmt(dur)}`}
        data-testid="voice-wave" data-ready={peaks ? "1" : "0"} onPointerDown={drag} onPointerMove={e => e.buttons && seek(e.clientX)} onKeyDown={key} />
      <div className="vn-meta"><span className="mono-t">{fmt(p)} / {dur ? fmt(dur) : "–:––"}</span><span className="mut">{file.name} · {(file.size / 1024).toFixed(0)} KB{bad ? T(" · preview unavailable", " · प्रीव्यू नहीं") : ""}</span></div></div>
    <div className="vn-act">
      <button type="button" className="btn" onClick={onRerecord} data-testid="voice-rerecord"><Icon n="mic" s={16} />{T("Re-record", "फिर रिकॉर्ड")}</button>
      <button type="button" className="btn danger" onClick={onDelete} data-testid="voice-delete" aria-label={T("Delete voice note", "वॉइस नोट हटाएं")}><Icon n="trash" s={16} /></button></div>
  </div>;
}
