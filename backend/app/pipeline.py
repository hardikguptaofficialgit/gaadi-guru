"""Patchwise pipeline: video -> Spark plan -> SAM 3.1 tracking -> dedup -> severity -> privacy blur -> report."""
from __future__ import annotations
import json, math, re, subprocess, tempfile, uuid
from collections import defaultdict
from pathlib import Path
import cv2, numpy as np
from . import meta

import os
DATA = Path(os.environ.get("GG_DATA") or Path(__file__).resolve().parents[1] / "data")
DATA.mkdir(exist_ok=True)


def write_json(path: Path, obj, **kw) -> None:
    """UTF-8 (Hindi text breaks Windows' cp1252 default) and atomic: write a temp file, then
    os.replace, so a crash mid-write can never leave a 0-byte result.json behind."""
    path = Path(path); tmp = path.with_name(f".{path.name}.{uuid.uuid4().hex[:6]}.tmp")
    tmp.write_text(json.dumps(obj, **kw), encoding="utf-8")
    os.replace(tmp, path)

HAZARDS = {  # SAM noun phrase -> (hazard label, base severity floor)
    "pothole": ("Pothole", None),
    "open manhole": ("Open manhole", "CRITICAL"),
    "waterlogged road": ("Waterlogging", "MEDIUM"),
    "garbage dump": ("Garbage dump", "LOW"),
    "broken road divider": ("Broken divider", "MEDIUM"),
    "broken streetlight": ("Broken streetlight", "LOW"),
}
MAX_PHRASES = 3  # cost guard: each phrase = one SAM video pass
PLAN_SYS = ("You are a road-safety inspector for Indian roads. Look at the frames and reply JSON only: "
            '{"prompts":[...],"road_type":str,"surface":str,"notes":str}. '
            f"prompts: choose at most {MAX_PHRASES} phrases ONLY from this list, only if clearly visible: "
            + json.dumps(list(HAZARDS)) + '. Always include "pothole" first.')
REPORT_SYS = ("Write a formal civic complaint to the municipal corporation about road damage. Reply JSON only: "
              '{"subject":str,"body_en":str,"body_hi":str,"priority":"LOW|MEDIUM|HIGH|CRITICAL"}. '
              "Be factual, cite the counts, sizes (m2) and repair estimate given, no exaggeration, no medical advice. "
              "Plain language for a municipal officer: NEVER mention scores, confidence, area ratios, frame numbers or model names.")

_TECH = re.compile(r"(score|confidence|area[_ ]ratio|frames?[_ ]seen|best[_ ]frame|first[_ ]seen|sam[_ ]track)", re.I)


def clean_complaint(text: str | None) -> str:
    """Strip any technical scoring detail (scores, confidence, area ratios...) from complaint text."""
    if not text:
        return ""
    out = []
    for line in text.split("\n"):
        if re.match(r"\s*(Details|विवरण)\s*:?\s*$", line):
            continue
        if _TECH.search(line):
            keep = [s for s in re.split(r"(?<=[.;।])\s+", line) if not _TECH.search(s)]
            line = " ".join(keep)
            if not line.strip():
                continue
        out.append(line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip()


def citizen_facts(potholes: list[dict], lat, lng, plan_: dict, voice_text: str | None) -> dict:
    """Facts handed to Spark for the complaint: plain, officer-friendly, no internal metrics."""
    return {"hazards": [{"id": x["id"], "type": x.get("hazard", "Pothole"), "severity": x["severity"],
                         "approx_area_m2": (x.get("repair") or {}).get("area_m2_est"),
                         "repair_estimate_inr": (x.get("repair") or {}).get("inr_est"),
                         "seen_at_seconds_into_video": x.get("first_seen_s")} for x in potholes],
            "total_repair_estimate_inr": sum((x.get("repair") or {}).get("inr_est", 0) for x in potholes),
            "location": {"lat": lat, "lng": lng}, "road": {k: plan_.get(k) for k in ("road_type", "surface", "notes")},
            "citizen_voice_note": voice_text}


def draft_report(potholes, lat, lng, plan_, voice_text) -> dict:
    try:
        rep = meta.spark_json(REPORT_SYS, json.dumps(citizen_facts(potholes, lat, lng, plan_, voice_text), ensure_ascii=False),
                              effort="minimal")  # facts are pre-computed; no reasoning needed to word them
    except Exception as e:
        return {"error": str(e)[:300]}
    for k in ("body_en", "body_hi"):
        rep[k] = clean_complaint(rep.get(k))
    return rep


def hazard_scan(frame: np.ndarray, progress=None, skip: tuple = ()) -> dict:
    """Multi-hazard search: one SAM 3.1 *image* call per non-pothole concept on a mid-ride frame
    ($0.0025 each). Concepts SAM actually finds are promoted to full video tracking."""
    url = jpg_url(frame, 960); found = {}
    # phrases Spark already chose get a full video pass anyway, so don't pay to image-scan them too
    for i, phrase in enumerate([h for h in HAZARDS if h != "pothole" and h not in skip]):
        if progress: progress("scan", f"Searching for: {phrase}", i, len(HAZARDS) - 1)
        try:
            d, _ = meta.sam_segment(phrase, image_url=url)
            found[phrase] = len([x for x in d if (x.confidence or 0) >= 0.5])
        except Exception as e:
            found[phrase] = f"error: {str(e)[:120]}"
    return found


def to_h264(src: Path, dst: Path, max_seconds: int = 20, fps: int = 8, width: int = 960, adaptive: bool = True) -> Path:
    """Normalise upload: cap duration, downsample fps (SAM bills per frame), H.264.
    adaptive: drop near-duplicate frames (bike stopped at a signal / in traffic), keeping at least
    one frame in every 4 so tracking never loses more than 0.5 s. A moving ride keeps every frame."""
    vf = f"fps={fps},scale={width}:-2" + (",mpdecimate=hi=768:lo=320:frac=0.5:max=4,setpts=N/FRAME_RATE/TB" if adaptive else "")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-t", str(max_seconds),
                    "-vf", vf, "-r", str(fps), "-an", "-c:v", "libx264", "-crf", "28",
                    "-pix_fmt", "yuv420p", str(dst)], check=True)
    return dst


def sample_frames(video: Path, n: int = 4) -> list[np.ndarray]:
    cap = cv2.VideoCapture(str(video)); total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    out = []
    for i in range(n):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int((i + 0.5) * total / n)); ok, f = cap.read()
        if ok: out.append(f)
    cap.release(); return out


def jpg_url(img: np.ndarray, w: int = 512) -> str:
    h = int(img.shape[0] * w / img.shape[1])
    ok, b = cv2.imencode(".jpg", cv2.resize(img, (w, h)), [cv2.IMWRITE_JPEG_QUALITY, 80])
    return meta.data_url(b.tobytes(), "image/jpeg")


def plan(frames) -> dict:
    content = [{"type": "input_text", "text": "Frames from a dashcam / bike ride:"}]
    content += [{"type": "input_image", "image_url": jpg_url(f)} for f in frames]
    try:
        p = meta.spark_json(PLAN_SYS, content, effort="low")
    except Exception as e:
        p = {"error": str(e)}
    prompts = ["pothole"] + [x.lower() for x in p.get("prompts", []) if isinstance(x, str)
                             and x.lower() in HAZARDS and x.lower() != "pothole"]
    p["prompts"] = list(dict.fromkeys(prompts))[:MAX_PHRASES]
    return p


def severity(area_ratio: float, persist: int) -> tuple[str, float]:
    """Area of the pothole as share of frame at its largest (closest) sighting."""
    score = min(100.0, 100 * math.sqrt(area_ratio / 0.08)) * (0.7 + 0.3 * min(1, persist / 10))
    level = "CRITICAL" if score >= 75 else "HIGH" if score >= 50 else "MEDIUM" if score >= 25 else "LOW"
    return level, round(score, 1)


def iou(a, b):
    x1, y1, x2, y2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    ua = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - inter
    return inter / ua if ua else 0


def overlap(a, b):
    """Intersection over the smaller box: catches one mask nested inside another."""
    x1, y1, x2, y2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    small = min((a[2]-a[0])*(a[3]-a[1]), (b[2]-b[0])*(b[3]-b[1]))
    return inter / small if small else 0


def dedup(dets: list[meta.Detection], fps: float, min_frames: int = 2, max_frame_share: float = 0.25) -> list[dict]:
    """Count each physical pothole once.
    1. SAM 3.1 object ids are stable across a clip -> one track per (prompt, id).
    2. Drop flickers (< min_frames) and 'whole road' regions (box > max_frame_share of frame).
    3. Merge tracks (from different prompts, or a re-acquired id) that sit on the same spot in the
       frames they share: median IoU >= 0.3 or nested >= 0.7 over >= 30% of shared frames.
    4. Merge a track that starts within 1 s of another ending, near where it was last seen
       (SAM lost and re-found the same pothole)."""
    tracks: dict[str, dict[int, meta.Detection]] = defaultdict(dict)
    for d in dets:
        cur = tracks[d.object_id].get(d.frame)
        if not cur or d.box_area > cur.box_area:
            tracks[d.object_id][d.frame] = d
    keep = {}
    for oid, fr in tracks.items():
        any_d = next(iter(fr.values())); fa = max(1, any_d.img_w * any_d.img_h)
        if len(fr) < min_frames:
            continue
        if np.median([d.box_area / fa for d in fr.values()]) > max_frame_share:
            continue
        keep[oid] = fr
    ids = list(keep); parent = {i: i for i in ids}
    def find(x):
        while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
        return x
    for i, a in enumerate(ids):
        for b in ids[i+1:]:
            A, B = keep[a], keep[b]; shared = set(A) & set(B)
            same = False
            if shared:
                hits = [1 for f in shared if iou(A[f].box, B[f].box) >= 0.3 or overlap(A[f].box, B[f].box) >= 0.7]
                same = len(hits) >= max(1, 0.3 * len(shared))
            else:
                (e, s), (L, R) = ((max(A), min(B)), (A, B)) if max(A) < min(B) else ((max(B), min(A)), (B, A))
                if 0 < s - e <= fps:
                    pa, pb = L[e].box, R[s].box
                    ca = ((pa[0]+pa[2])/2, (pa[1]+pa[3])/2); cb = ((pb[0]+pb[2])/2, (pb[1]+pb[3])/2)
                    same = math.dist(ca, cb) < 0.15 * L[e].img_w
            if same:
                parent[find(b)] = find(a)
    groups = defaultdict(list)
    for oid in ids: groups[find(oid)].append(oid)
    out = []
    for members in groups.values():
        allf = {f: d for m in members for f, d in keep[m].items()}
        ds = [d for m in members for d in keep[m].values()]
        fa = max(1, ds[0].img_w * ds[0].img_h)
        sane = [d for d in ds if d.box_area / fa <= max_frame_share] or ds  # ignore frames where SAM grabbed the whole road
        best = max(sane, key=lambda d: d.mask_area_px or d.box_area)
        frames = sorted(allf)
        ar = (best.mask_area_px or best.box_area) / fa
        lvl, score = severity(ar, len(frames))
        phrases = [m.split(":")[0] for m in members]
        phrase = next((ph for ph in phrases if ph != "pothole" and ph in HAZARDS), phrases[0])
        hazard, floor = HAZARDS.get(phrase, ("Pothole", None))
        if "pothole" in phrase: hazard, floor = "Pothole", None
        order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        if floor and order.index(floor) > order.index(lvl): lvl = floor
        out.append({"hazard": hazard, "sam_tracks": sorted(members), "sam_track": members[0], "first_seen_s": round(frames[0] / fps, 2),
                    "best_frame": best.frame, "frames_seen": len(frames), "box": best.box,
                    "track_boxes": {f: list(allf[f].box) for f in frames},
                    "area_ratio": round(ar, 4), "confidence": round(max((d.confidence or 0) for d in ds), 3),
                    "severity": lvl, "score": score})
    out.sort(key=lambda x: -x["score"])
    for i, o in enumerate(out, 1): o["id"] = i
    return out


try:  # optional local fallback; SAM 3.1 "license plate"/"human face" is the primary detector
    _CASCADES = [cv2.CascadeClassifier(cv2.data.haarcascades + n) for n in
                 ("haarcascade_frontalface_default.xml", "haarcascade_russian_plate_number.xml")]
except Exception:
    _CASCADES = []


def privacy_blur(img: np.ndarray, sam_boxes: list | None = None) -> np.ndarray:
    """Blur faces + number plates (Haar locally, plus optional SAM 'license plate'/'face' boxes)."""
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    boxes = [tuple(map(int, (x, y, x+w, y+h))) for c in _CASCADES
             for (x, y, w, h) in c.detectMultiScale(g, 1.1, 5)]
    boxes += [tuple(map(int, b)) for b in (sam_boxes or [])]
    for x1, y1, x2, y2 in boxes:
        roi = img[max(0,y1):y2, max(0,x1):x2]
        if roi.size: img[max(0,y1):y2, max(0,x1):x2] = cv2.GaussianBlur(roi, (51, 51), 30)
    return img


# Repair cost model (assumptions, documented in README):
#  visible road surface in a forward bike/dash frame ~ 30 m2 near-field; pothole area = area_ratio * 30 m2
#  patching (cold-mix / hot-mix + edge cutting + tack coat) ~ Rs 1,800 per m2, min Rs 1,500 per site
VISIBLE_ROAD_M2 = 30.0
RATE_PER_M2 = {"Pothole": 1800, "Open manhole": 6500, "Waterlogging": 900, "Garbage dump": 400,
               "Broken divider": 3000, "Broken streetlight": 0}
FIXED = {"Broken streetlight": 4500, "Open manhole": 3500}


def repair_estimate(ph: dict) -> dict:
    hz = ph.get("hazard", "Pothole"); m2 = round(ph["area_ratio"] * VISIBLE_ROAD_M2, 2)
    inr = FIXED.get(hz, 0) + m2 * RATE_PER_M2.get(hz, 1800)
    inr = max(1500, round(inr, -2))
    return {"area_m2_est": m2, "inr_est": int(inr), "basis": f"{m2} m2 x Rs {RATE_PER_M2.get(hz,1800)}/m2 (+fixed {FIXED.get(hz,0)})"}


def frame_at(video: Path, idx: int) -> np.ndarray | None:
    cap = cv2.VideoCapture(str(video)); cap.set(cv2.CAP_PROP_POS_FRAMES, idx); ok, f = cap.read(); cap.release()
    return f if ok else None


def has_speech(wav: bytes, min_s: float = 0.4) -> bool:
    """16 kHz s16 mono WAV: at least min_s seconds and some frames louder than near-silence."""
    a = np.frombuffer(wav[44:], np.int16).astype(np.float32)
    if len(a) < min_s * 16000:
        return False
    win = a[: len(a) // 1600 * 1600].reshape(-1, 1600)  # 100 ms windows
    return bool((np.sqrt((win ** 2).mean(1)) > 300).sum() >= 3)


def video_hash(path: Path) -> str:
    import hashlib
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""): h.update(chunk)
    return h.hexdigest()[:16]


def cached(vhash: str) -> dict | None:
    for f in DATA.glob("*/result.json"):
        try:
            if f.stat().st_size == 0:
                continue
            r = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        if isinstance(r, dict) and r.get("video_hash") == vhash:
            return r
    return None


def run(upload: Path, lat: float | None = None, lng: float | None = None, voice_note: bytes | None = None,
        blur_with_sam: bool = True, ward: str | None = None, force: bool = False, progress=None) -> dict:
    prog = progress or (lambda *a: None)
    prog("hash", "Checking if we have seen this ride before")
    vhash = video_hash(upload)
    if not force and (hit := cached(vhash)):
        hit["cache_hit"] = True; prog("cached", "Same video analysed before, reusing it (no new cost)"); return hit
    rid = uuid.uuid4().hex[:10]; out = DATA / rid; out.mkdir(parents=True)
    fps = 8
    prog("prepare", "Preparing your video")
    vid = to_h264(upload, out / "clip.mp4", fps=fps)
    frames = sample_frames(vid)
    prog("plan", "Muse Spark is looking at the road")
    p = plan(frames)
    p["hazard_scan"] = hazard_scan(frames[len(frames) // 2], prog, skip=tuple(p["prompts"])) if frames else {}
    hits = sorted([k for k, v in p["hazard_scan"].items() if isinstance(v, int) and v > 0], key=lambda k: -p["hazard_scan"][k])
    p["spark_prompts"] = list(p["prompts"])
    p["prompts"] = list(dict.fromkeys(["pothole"] + hits + p["prompts"][1:]))[:MAX_PHRASES]
    prog("upload", "Uploading the video to SAM 3.1")
    fid = meta.upload_file(vid)
    dets, sam_runs = [], []
    for k, phrase in enumerate(p["prompts"]):
        prog("sam", f"SAM 3.1 tracking: {phrase}", k, len(p["prompts"]))
        try:
            d, raw = meta.sam_segment(phrase, file_id=fid)
            (out / f"sam_{phrase.replace(' ', '_')}.txt").write_text(raw, encoding="utf-8")
            for x in d: x.object_id = f"{phrase}:{x.object_id}"
            dets += d; sam_runs.append({"prompt": phrase, "detections": len(d)})
        except Exception as e:
            sam_runs.append({"prompt": phrase, "error": str(e)[:300]})
    potholes = dedup(dets, fps)
    privacy = defaultdict(list)
    prog("privacy", "Blurring faces and number plates")
    if blur_with_sam:
        for phrase in ("license plate", "human face"):
            try:
                pd, raw = meta.sam_segment(phrase, file_id=fid)
                (out / f"privacy_{phrase.replace(' ', '_')}.txt").write_text(raw, encoding="utf-8")
                for x in pd: privacy[x.frame].append(x.box)
            except Exception:
                pass
    (out / "privacy.json").write_text(json.dumps({str(k): v for k, v in privacy.items()}), encoding="utf-8")
    prog("render", "Drawing the pothole outlines")
    render_overlay(out, vid, potholes, privacy, fps)
    for ph in potholes:
        f = frame_at(vid, ph["best_frame"])
        if f is None: continue
        f = privacy_blur(f, privacy.get(ph["best_frame"]))
        x1, y1, x2, y2 = map(int, ph["box"])
        col = {"LOW": (0,200,0), "MEDIUM": (0,200,255), "HIGH": (0,120,255), "CRITICAL": (0,0,255)}[ph["severity"]]
        cv2.rectangle(f, (x1, y1), (x2, y2), col, 3)
        cv2.putText(f, f"#{ph['id']} {ph['severity']}", (x1, max(20, y1-8)), cv2.FONT_HERSHEY_SIMPLEX, 0.8, col, 2)
        cv2.imwrite(str(out / f"pothole_{ph['id']}.jpg"), f); ph["image"] = f"/media/{rid}/pothole_{ph['id']}.jpg"
    voice = None
    if voice_note:
        prog("voice", "Transcribing your voice note")
        try:
            wav = out / "note.wav"; src = out / "note.in"; src.write_bytes(voice_note)
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-ac", "1", "-ar", "16000",
                            "-c:a", "pcm_s16le", "-map_metadata", "-1", str(wav)], check=True)
            if not has_speech(wav.read_bytes()):
                raise ValueError("voice note is empty or silent, skipped transcription (no cost)")
            voice = meta.transcribe(wav.read_bytes(), ["Hindi", "English"], ["gaddha", "pothole", "sadak"])
        except Exception as e:
            voice = {"error": str(e)[:300]}
    for ph in potholes: ph["repair"] = repair_estimate(ph)
    prog("cost", "Working out the repair cost")
    prog("write", "Muse Spark is writing the complaint in Hindi and English")
    report = draft_report(potholes, lat, lng, p, (voice or {}).get("transcript"))
    result = {"id": rid, "video_hash": vhash, "ward": ward, "status": "reported", "lat": lat, "lng": lng, "plan": p, "sam_runs": sam_runs, "potholes": potholes,
              "voice": voice, "report": report, "video": f"/media/{rid}/clip.mp4",
              "overlay": f"/media/{rid}/overlay.mp4", "overlay_gif": f"/media/{rid}/overlay.gif"}
    write_json(out / "result.json", result, indent=2, default=str)
    prog("done", "Done")
    return result


def redraft(rid: str) -> dict:
    """Re-write an existing report's complaint from plain facts (one Spark call, no SAM)."""
    out = DATA / rid; r = json.loads((out / "result.json").read_text(encoding="utf-8"))
    for ph in r["potholes"]: ph["repair"] = ph.get("repair") or repair_estimate(ph)
    r["report"] = draft_report(r["potholes"], r.get("lat"), r.get("lng"), r.get("plan", {}), (r.get("voice") or {}).get("transcript"))
    write_json(out / "result.json", r, indent=2, ensure_ascii=False, default=str)
    return r["report"]


def privacy_boxes(rid: str) -> dict:
    out = DATA / rid; f = out / "privacy.json"
    if f.exists():
        return {int(k): v for k, v in json.loads(f.read_text(encoding="utf-8")).items()}
    pv = defaultdict(list)
    for d in load_dets(out, "privacy_"): pv[d.frame].append(d.box)
    return pv


SEV_BGR = {"LOW": (0, 200, 0), "MEDIUM": (0, 210, 255), "HIGH": (0, 130, 255), "CRITICAL": (40, 40, 230)}


def mask_full(d: meta.Detection, shape) -> np.ndarray | None:
    """Place SAM's box-local raster into a full-frame uint8 mask."""
    if not d.mask_payload:
        return None
    try:
        from meta_sam_parser import SegmentationMask, decode_mask_to_raster
        h, w = d.mask_hw
        enc = "one_bit" if d.mask_enc == "!" else "lossless"
        r = np.frombuffer(decode_mask_to_raster(SegmentationMask(enc, d.mask_enc + d.mask_payload, w, h)), np.uint8).reshape(h, w)
    except Exception:
        return None
    H, W = shape[:2]; x1, y1, x2, y2 = [int(round(v)) for v in d.box]
    x1, y1, x2, y2 = max(0, x1), max(0, y1), min(W, x2), min(H, y2)
    m = np.zeros((H, W), np.uint8)
    if x2 > x1 and y2 > y1:
        m[y1:y2, x1:x2] = cv2.resize(r * 255, (x2 - x1, y2 - y1), interpolation=cv2.INTER_NEAREST)
    return m


def load_dets(out: Path, prefix: str = "sam_") -> list[meta.Detection]:
    dets = []
    for f in sorted(out.glob(f"{prefix}*.txt")):
        phrase = f.stem[len(prefix):].replace("_", " ")
        for d in meta.parse_sam_text(f.read_text(encoding="utf-8")):
            d.object_id = f"{phrase}:{d.object_id}"; dets.append(d)
    return dets


def render_overlay(out: Path, vid: Path, potholes: list[dict], privacy: dict, fps: float) -> None:
    """Demo video: privacy blur + translucent SAM masks + severity outlines + live counter."""
    dets = load_dets(out)
    by_track = {t: p for p in potholes for t in p["sam_tracks"]}
    per_frame = defaultdict(list)
    for d in dets:
        if d.object_id in by_track: per_frame[d.frame].append((d, by_track[d.object_id]))
    cap = cv2.VideoCapture(str(vid)); W = int(cap.get(3)); H = int(cap.get(4))
    raw = out / "overlay_raw.mp4"
    vw = cv2.VideoWriter(str(raw), cv2.VideoWriter_fourcc(*"mp4v"), fps, (W, H))
    seen = set(); i = 0
    while True:
        ok, f = cap.read()
        if not ok: break
        f = privacy_blur(f, privacy.get(i)) if privacy.get(i) else f
        layer = f.copy()
        for d, ph in per_frame.get(i, []):
            col = SEV_BGR[ph["severity"]]; seen.add(ph["id"])
            m = mask_full(d, f.shape)
            x1, y1, x2, y2 = map(int, d.box)
            if m is not None:
                layer[m > 0] = col
                cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                cv2.drawContours(f, cs, -1, col, 2)
            else:
                cv2.rectangle(f, (x1, y1), (x2, y2), col, 2)
            cv2.putText(f, f"#{ph['id']} {ph['severity']}", (x1, max(18, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, col, 2)
        f = cv2.addWeighted(layer, 0.35, f, 0.65, 0)
        cv2.rectangle(f, (0, 0), (W, 34), (20, 20, 20), -1)
        cv2.putText(f, f"PATCHWISE  |  SAM 3.1  |  potholes: {len(seen)}", (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (3, 183, 255), 2)
        vw.write(f); i += 1
    cap.release(); vw.release()
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(raw), "-c:v", "libx264", "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart", str(out / "overlay.mp4")], check=True)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(out / "overlay.mp4"), "-vf",
                    "fps=6,scale=480:-2:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse", str(out / "overlay.gif")], check=True)
    raw.unlink(missing_ok=True)


def reprocess(rid: str) -> dict:
    """Re-run dedup/severity/overlay from cached SAM output (no new API spend)."""
    out = DATA / rid; r = json.loads((out / "result.json").read_text(encoding="utf-8")); fps = 8; vid = out / "clip.mp4"
    if not list(out.glob("sam_*.txt")):
        raise FileNotFoundError(f"{rid}: no cached SAM output, refusing to overwrite result.json")
    potholes = dedup(load_dets(out), fps)
    privacy = defaultdict(list)
    for d in load_dets(out, "privacy_"): privacy[d.frame].append(d.box)
    render_overlay(out, vid, potholes, privacy, fps)
    for ph in potholes:
        f = frame_at(vid, ph["best_frame"])
        f = privacy_blur(f, privacy.get(ph["best_frame"]))
        x1, y1, x2, y2 = map(int, ph["box"]); col = SEV_BGR[ph["severity"]]
        cv2.rectangle(f, (x1, y1), (x2, y2), col, 3)
        cv2.putText(f, f"#{ph['id']} {ph['severity']}", (x1, max(20, y1-8)), cv2.FONT_HERSHEY_SIMPLEX, 0.8, col, 2)
        cv2.imwrite(str(out / f"pothole_{ph['id']}.jpg"), f); ph["image"] = f"/media/{rid}/pothole_{ph['id']}.jpg"
    for ph in potholes: ph["repair"] = repair_estimate(ph)
    r["potholes"] = potholes; r["overlay"] = f"/media/{rid}/overlay.mp4"; r["overlay_gif"] = f"/media/{rid}/overlay.gif"
    write_json(out / "result.json", r, indent=2, default=str)
    return r
