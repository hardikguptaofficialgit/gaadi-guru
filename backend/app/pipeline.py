"""Gaadi Guru pipeline: video -> Spark plan -> SAM 3.1 tracking -> dedup -> severity -> privacy blur -> report."""
from __future__ import annotations
import json, math, subprocess, tempfile, uuid
from collections import defaultdict
from pathlib import Path
import cv2, numpy as np
from . import meta

DATA = Path(__file__).resolve().parents[1] / "data"
DATA.mkdir(exist_ok=True)

PLAN_SYS = ("You are a road-safety inspector for Indian roads. Look at the frames and reply JSON only: "
            '{"prompts":[1-3 short noun phrases for SAM to segment, e.g. "pothole"],'
            '"road_type":str,"surface":str,"notes":str}. Always include "pothole" if any are visible.')
REPORT_SYS = ("Write a formal civic complaint to the municipal corporation about road damage. Reply JSON only: "
              '{"subject":str,"body_en":str,"body_hi":str,"priority":"LOW|MEDIUM|HIGH|CRITICAL"}. '
              "Be factual, cite the numbers given, no exaggeration, no medical advice.")


def to_h264(src: Path, dst: Path, max_seconds: int = 20, fps: int = 8, width: int = 960) -> Path:
    """Normalise upload: cap duration, downsample fps (SAM bills per frame), H.264."""
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-t", str(max_seconds),
                    "-vf", f"fps={fps},scale={width}:-2", "-an", "-c:v", "libx264", "-crf", "28",
                    "-pix_fmt", "yuv420p", str(dst)], check=True)
    return dst


def sample_frames(video: Path, n: int = 4) -> list[np.ndarray]:
    cap = cv2.VideoCapture(str(video)); total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    out = []
    for i in range(n):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int((i + 0.5) * total / n)); ok, f = cap.read()
        if ok: out.append(f)
    cap.release(); return out


def jpg_url(img: np.ndarray, w: int = 768) -> str:
    h = int(img.shape[0] * w / img.shape[1])
    ok, b = cv2.imencode(".jpg", cv2.resize(img, (w, h)), [cv2.IMWRITE_JPEG_QUALITY, 80])
    return meta.data_url(b.tobytes(), "image/jpeg")


def plan(frames) -> dict:
    content = [{"type": "input_text", "text": "Frames from a dashcam / bike ride:"}]
    content += [{"type": "input_image", "image_url": jpg_url(f)} for f in frames]
    try:
        p = meta.spark_json(PLAN_SYS, content)
    except Exception as e:
        p = {"error": str(e)}
    prompts = [x for x in p.get("prompts", []) if isinstance(x, str)][:3] or ["pothole"]
    if "pothole" not in [x.lower() for x in prompts]:
        prompts.insert(0, "pothole")
    p["prompts"] = prompts[:3]
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


def dedup(dets: list[meta.Detection], fps: float) -> list[dict]:
    """SAM gives stable object ids across a clip; merge ids per prompt, then merge ids that
    overlap heavily in the same frame (same pothole picked up by two phrases)."""
    tracks: dict[str, list[meta.Detection]] = defaultdict(list)
    for d in dets:
        tracks[d.object_id].append(d)
    items = []
    for oid, ds in tracks.items():
        best = max(ds, key=lambda d: d.mask_area_px or d.box_area)
        frame_area = max(1, best.img_w * best.img_h)
        area = best.mask_area_px or best.box_area
        items.append({"track": oid, "frames": sorted({d.frame for d in ds}), "best": best,
                      "area_ratio": area / frame_area, "conf": max((d.confidence or 0) for d in ds)})
    items.sort(key=lambda x: -x["area_ratio"])
    merged = []
    for it in items:
        dup = next((m for m in merged if it["best"].frame in m["frames"] and
                    any(iou(it["best"].box, d) > 0.5 for d in [m["best"].box])), None)
        if dup:
            dup["frames"] = sorted(set(dup["frames"]) | set(it["frames"])); continue
        merged.append(it)
    out = []
    for i, m in enumerate(merged, 1):
        lvl, score = severity(m["area_ratio"], len(m["frames"]))
        b = m["best"]
        out.append({"id": i, "sam_track": m["track"], "first_seen_s": round(m["frames"][0] / fps, 2),
                    "best_frame": b.frame, "frames_seen": len(m["frames"]), "box": b.box,
                    "area_ratio": round(m["area_ratio"], 4), "confidence": round(m["conf"], 3),
                    "severity": lvl, "score": score})
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


def frame_at(video: Path, idx: int) -> np.ndarray | None:
    cap = cv2.VideoCapture(str(video)); cap.set(cv2.CAP_PROP_POS_FRAMES, idx); ok, f = cap.read(); cap.release()
    return f if ok else None


def run(upload: Path, lat: float | None = None, lng: float | None = None, voice_note: bytes | None = None,
        blur_with_sam: bool = True) -> dict:
    rid = uuid.uuid4().hex[:10]; out = DATA / rid; out.mkdir(parents=True)
    fps = 8
    vid = to_h264(upload, out / "clip.mp4", fps=fps)
    p = plan(sample_frames(vid))
    fid = meta.upload_file(vid)
    dets, sam_runs = [], []
    for phrase in p["prompts"]:
        try:
            d, _ = meta.sam_segment(phrase, file_id=fid)
            for x in d: x.object_id = f"{phrase}:{x.object_id}"
            dets += d; sam_runs.append({"prompt": phrase, "detections": len(d)})
        except Exception as e:
            sam_runs.append({"prompt": phrase, "error": str(e)[:300]})
    potholes = dedup(dets, fps)
    privacy = defaultdict(list)
    if blur_with_sam:
        for phrase in ("license plate", "human face"):
            try:
                for x in meta.sam_segment(phrase, file_id=fid)[0]: privacy[x.frame].append(x.box)
            except Exception:
                pass
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
        try:
            wav = out / "note.wav"; src = out / "note.in"; src.write_bytes(voice_note)
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-ac", "1", "-ar", "16000",
                            "-c:a", "pcm_s16le", "-map_metadata", "-1", str(wav)], check=True)
            voice = meta.transcribe(wav.read_bytes(), ["Hindi", "English"], ["gaddha", "pothole", "sadak"])
        except Exception as e:
            voice = {"error": str(e)[:300]}
    facts = {"potholes": [{k: v for k, v in x.items() if k not in ("box", "image")} for x in potholes],
             "location": {"lat": lat, "lng": lng}, "road": p, "citizen_voice_note": (voice or {}).get("transcript")}
    try:
        report = meta.spark_json(REPORT_SYS, json.dumps(facts))
    except Exception as e:
        report = {"error": str(e)[:300]}
    result = {"id": rid, "lat": lat, "lng": lng, "plan": p, "sam_runs": sam_runs, "potholes": potholes,
              "voice": voice, "report": report, "video": f"/media/{rid}/clip.mp4"}
    (out / "result.json").write_text(json.dumps(result, indent=2, default=str))
    return result
