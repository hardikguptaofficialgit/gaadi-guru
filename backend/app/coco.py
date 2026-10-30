"""Export SAM 3.1 pothole masks as a COCO instance-segmentation dataset (RLE masks)."""
from __future__ import annotations
import json, zipfile, io
from pathlib import Path
import cv2, numpy as np
from . import pipeline


def _rle(mask: np.ndarray) -> dict:
    """Uncompressed COCO RLE (column-major counts, starting with zeros)."""
    flat = (mask.T.reshape(-1) > 0).astype(np.uint8)
    counts, prev, run = [], 0, 0
    for v in flat:
        if v != prev:
            counts.append(run); run = 0; prev = v
        run += 1
    counts.append(run)
    return {"size": [int(mask.shape[0]), int(mask.shape[1])], "counts": counts}


def export(rids: list[str], every: int = 4) -> bytes:
    """Zip with images/ + annotations.json. Every `every`-th frame that has a kept pothole track."""
    coco = {"info": {"description": "Gaadi Guru Indian road potholes — SAM 3.1 masks", "version": "0.1"},
            "licenses": [{"id": 1, "name": "CC BY 4.0"}],
            "categories": [{"id": 1, "name": "pothole", "supercategory": "road_damage"}],
            "images": [], "annotations": []}
    buf = io.BytesIO(); z = zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED)
    img_id = ann_id = 0
    for rid in rids:
        out = pipeline.DATA / rid; res = json.loads((out / "result.json").read_text())
        sev = {t: p for p in res["potholes"] for t in p.get("sam_tracks", [p.get("sam_track")])}
        privacy = {}
        for d in pipeline.load_dets(out, "privacy_"): privacy.setdefault(d.frame, []).append(d.box)
        by_frame: dict[int, list] = {}
        for d in pipeline.load_dets(out):
            if d.object_id in sev: by_frame.setdefault(d.frame, []).append(d)
        cap = cv2.VideoCapture(str(out / "clip.mp4")); i = 0
        while True:
            ok, f = cap.read()
            if not ok: break
            if i in by_frame and i % every == 0:
                img_id += 1; name = f"{rid}_{i:05d}.jpg"
                f = pipeline.privacy_blur(f, privacy.get(i))
                z.writestr(f"images/{name}", cv2.imencode(".jpg", f, [cv2.IMWRITE_JPEG_QUALITY, 90])[1].tobytes())
                coco["images"].append({"id": img_id, "file_name": name, "width": f.shape[1], "height": f.shape[0],
                                       "lat": res.get("lat"), "lng": res.get("lng"), "license": 1})
                for d in by_frame[i]:
                    m = pipeline.mask_full(d, f.shape)
                    if m is None or not m.any(): continue
                    ys, xs = np.nonzero(m); ann_id += 1; ph = sev[d.object_id]
                    coco["annotations"].append({"id": ann_id, "image_id": img_id, "category_id": 1, "iscrowd": 0,
                        "segmentation": _rle(m), "area": int((m > 0).sum()),
                        "bbox": [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)],
                        "attributes": {"pothole_id": ph["id"], "severity": ph["severity"], "score": ph["score"],
                                       "sam_track": d.object_id, "confidence": d.confidence}})
            i += 1
        cap.release()
    z.writestr("annotations.json", json.dumps(coco)); z.close()
    return buf.getvalue()
