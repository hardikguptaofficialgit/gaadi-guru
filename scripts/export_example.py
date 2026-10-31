#!/usr/bin/env python3
"""Export a real report from backend/data into static hero assets for frontend/public/example.

Outputs:
  - frontend/public/example/report.json (trimmed fields only)
  - frontend/public/example/poster.webp (frame with pothole outlines)
  - frontend/public/example/clip.mp4 (short muted loop <= 6s, < 1.5MB)
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app import routing, pipeline  # noqa: E402

DATA_DIR = pipeline.DATA
OUT_DIR = ROOT / "frontend" / "public" / "example"


def find_newest_report() -> tuple[Path, dict]:
    candidates = []
    for d in DATA_DIR.iterdir():
        if not d.is_dir() or d.name.startswith("_"):
            continue
        rf = d / "result.json"
        if not rf.exists() or rf.stat().st_size == 0:
            continue
        try:
            data = json.loads(rf.read_text(encoding="utf-8"))
        except Exception:
            continue
        if isinstance(data, dict) and data.get("potholes") and len(data["potholes"]) > 0:
            mtime = rf.stat().st_mtime
            candidates.append((mtime, d, data))

    if not candidates:
        raise RuntimeError(f"No valid reports with potholes found in {DATA_DIR}")

    candidates.sort(key=lambda c: c[0], reverse=True)
    return candidates[0][1], candidates[0][2]


def main() -> None:
    rep_dir, r = find_newest_report()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    ph = r["potholes"]
    rep = r.get("report") or {}
    try:
        auth = (routing.route(r, city=r.get("city_pick")).get("authorities") or [{}])[0].get("authority")
    except Exception:
        auth = None

    body_lines = [
        l.strip() for l in (rep.get("body_en") or "").split("\n")
        if l.strip() and not l.strip().startswith("To:") and not l.strip().startswith("Respected")
    ]
    excerpt = body_lines[0][:210] if body_lines else ""

    best_frame = ph[0].get("best_frame", 0) if ph else 0

    trimmed = {
        "id": r["id"],
        "status": r.get("status", "reported"),
        "ward": r.get("ward"),
        "lat": r.get("lat"),
        "lng": r.get("lng"),
        "count": len(ph),
        "dangerous": sum(p.get("severity") == "CRITICAL" for p in ph),
        "top_m2": round(max(((p.get("repair") or {}).get("area_m2_est", 0) for p in ph), default=0), 2),
        "inr": sum((p.get("repair") or {}).get("inr_est", 0) for p in ph),
        "authority": auth,
        "followup_due": r.get("followup_due") or "2026-11-07",
        "best_frame": best_frame,
        "subject": rep.get("subject"),
        "excerpt": excerpt,
    }

    report_json_path = OUT_DIR / "report.json"
    report_json_path.write_text(json.dumps(trimmed, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {report_json_path} ({report_json_path.stat().st_size} bytes)")

    overlay_src = rep_dir / "overlay.mp4"
    if not overlay_src.exists():
        overlay_src = rep_dir / "clip.mp4"
    if not overlay_src.exists():
        raise FileNotFoundError(f"Neither overlay.mp4 nor clip.mp4 found in {rep_dir}")

    poster_path = OUT_DIR / "poster.webp"
    # Select frame with pothole outlines, scale to 16:10 aspect
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(overlay_src),
        "-vf", f"select=eq(n\\,{int(best_frame)}),scale=640:400:force_original_aspect_ratio=increase,crop=640:400",
        "-frames:v", "1", "-quality", "80", str(poster_path)
    ], check=True)
    print(f"Wrote {poster_path} ({poster_path.stat().st_size} bytes)")

    clip_path = OUT_DIR / "clip.mp4"
    # Short muted loop <= 6s, 16:10 aspect, crf 26 for < 1.5MB size
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(overlay_src),
        "-t", "6",
        "-vf", "scale=640:400:force_original_aspect_ratio=increase,crop=640:400",
        "-c:v", "libx264", "-crf", "26", "-pix_fmt", "yuv420p",
        "-an", "-movflags", "+faststart", str(clip_path)
    ], check=True)
    clip_size = clip_path.stat().st_size
    print(f"Wrote {clip_path} ({clip_size} bytes, {clip_size / (1024 * 1024):.2f} MB)")
    assert clip_size < 1.5 * 1024 * 1024, f"clip.mp4 exceeds 1.5 MB limit: {clip_size} bytes"


if __name__ == "__main__":
    main()
