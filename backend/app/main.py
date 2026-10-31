import json, os
from pathlib import Path
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from . import pipeline, coco, routing

app = FastAPI(title="Patchwise API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/media", StaticFiles(directory=pipeline.DATA), name="media")


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/analyze")
async def analyze(video: UploadFile = File(...), lat: float | None = Form(None), lng: float | None = Form(None),
                  voice_note: UploadFile | None = File(None), ward: str | None = Form(None)):
    tmp = pipeline.DATA / f"upload_{Path(video.filename or 'clip').name}"
    tmp.write_bytes(await video.read())
    if (video.content_type or "").startswith("image/") or tmp.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".heic"):
        # Photo report: turn the still into a 1 s clip so the same SAM video pipeline (and cache) applies.
        import subprocess
        mp4 = tmp.with_suffix(".photo.mp4")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-loop", "1", "-i", str(tmp), "-t", "1", "-r", "5",
                        "-vf", "scale='min(1280,iw)':-2,format=yuv420p", "-c:v", "libx264", str(mp4)], check=True)
        tmp.unlink(missing_ok=True); tmp = mp4
    vn = await voice_note.read() if voice_note else None
    try:
        return pipeline.run(tmp, lat, lng, vn, ward=ward)
    finally:
        tmp.unlink(missing_ok=True)


# ---------------- async analysis jobs: real pipeline progress for the UI ----------------
import threading, time, uuid  # noqa: E402
JOBS: dict[str, dict] = {}
STAGE_ORDER = ["hash", "prepare", "plan", "scan", "upload", "sam", "privacy", "render", "voice", "cost", "write", "done"]


@app.post("/jobs")
async def job_start(video: UploadFile = File(...), lat: float | None = Form(None), lng: float | None = Form(None),
                    voice_note: UploadFile | None = File(None), ward: str | None = Form(None), reride_of: str | None = Form(None)):
    if reride_of:
        o = _load(reride_of)
        if lat is None: lat, lng = o.get("lat"), o.get("lng")
        ward = ward or o.get("ward")
    jid = uuid.uuid4().hex[:10]
    tmp = pipeline.DATA / f"upload_{jid}_{Path(video.filename or 'clip').name}"
    tmp.write_bytes(await video.read())
    is_img = (video.content_type or "").startswith("image/") or tmp.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".heic")
    vn = await voice_note.read() if voice_note else None
    job = JOBS[jid] = {"id": jid, "state": "running", "stage": "upload_received", "events": [], "started": time.time(), "spend_start": costs.total()}

    def prog(stage, text, i=None, n=None):
        job["stage"] = stage
        job["events"].append({"stage": stage, "text": text, "i": i, "n": n, "t": round(time.time() - job["started"], 1)})

    def work():
        nonlocal tmp
        try:
            if is_img:
                import subprocess
                prog("prepare", "Converting your photo")
                mp4 = tmp.with_suffix(".photo.mp4")
                subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-loop", "1", "-i", str(tmp), "-t", "1", "-r", "5",
                                "-vf", "scale='min(1280,iw)':-2,format=yuv420p", "-c:v", "libx264", str(mp4)], check=True)
                tmp.unlink(missing_ok=True); tmp = mp4
            r = pipeline.run(tmp, lat, lng, vn, ward=ward, progress=prog)
            if reride_of and reride_of != r["id"]:  # Re-ride: run the verify_repair tool for real and log it on the original's timeline
                prog("verify", "Comparing with the original report")
                agent._log(reride_of, {"kind": "tool_call", "tool": "verify_repair", "args": {"report_id": reride_of, "reride_report_id": r["id"]}})
                v = agent.verify_repair(reride_of, r["id"])
                agent._log(reride_of, {"kind": "tool_result", "tool": "verify_repair", "result": v})
                job["verification"] = v
            job.update(state="done", report_id=r["id"], cache_hit=bool(r.get("cache_hit")), reride_of=reride_of)
        except Exception as e:
            job.update(state="error", error=str(e)[:400])
        finally:
            tmp.unlink(missing_ok=True); job["spend_usd"] = round(costs.total() - job["spend_start"], 4)
    threading.Thread(target=work, daemon=True).start()
    return {"job_id": jid}


@app.get("/jobs/{jid}")
def job_status(jid: str):
    if jid not in JOBS:
        raise HTTPException(404)
    j = JOBS[jid]
    return {**j, "elapsed_s": round(time.time() - j["started"], 1), "spend_usd": j.get("spend_usd", round(costs.total() - j["spend_start"], 4))}


@app.get("/reports")
def reports():
    out = []
    for f in sorted(pipeline.DATA.glob("*/result.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            r = json.loads(f.read_text(encoding="utf-8")); r["id"], r["potholes"]
        except Exception:  # half-written / corrupt report: skip it rather than 500 the whole list
            continue
        out.append({"id": r["id"], "lat": r["lat"], "lng": r["lng"], "count": len(r["potholes"]), "ward": r.get("ward"), "status": r.get("status", "reported"), "upvotes": r.get("upvotes", 0),
                    "worst": max((p["score"] for p in r["potholes"]), default=0), "verdict": (r.get("verification") or {}).get("verdict"),
                    "followup_due": r.get("followup_due")})
    return out


@app.get("/reports/{rid}")
def report(rid: str):
    f = pipeline.DATA / rid / "result.json"
    if not f.exists() or "/" in rid:
        raise HTTPException(404)
    r = json.loads(f.read_text(encoding="utf-8")); w = f.parent / "wonder.json"
    if w.exists() and (f.parent / "wonder_final.png").exists():
        wj = json.loads(w.read_text(encoding="utf-8")); r["wonder"] = {"screenshot": f"/media/{rid}/wonder_final.png", "submitted": wj.get("submitted"), "filled": wj.get("filled")}
    return r


STATIC = Path(__file__).parent / "static"


@app.get("/mock-portal")
def mock_portal():
    """Local stand-in for a municipal grievance portal (real portals need OTP login)."""
    return FileResponse(STATIC / "mock_portal.html")


def _load(rid: str) -> dict:
    f = pipeline.DATA / rid / "result.json"
    if "/" in rid or ".." in rid or not f.exists():
        raise HTTPException(404)
    return json.loads(f.read_text(encoding="utf-8"))


@app.get("/reports/{rid}/coco")
def coco_one(rid: str):
    _load(rid)
    return Response(coco.export([rid]), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="patchwise-{rid}-coco.zip"'})


@app.get("/dataset/coco")
def coco_all():
    rids = [p.parent.name for p in pipeline.DATA.glob("*/result.json")]
    return Response(coco.export(rids), media_type="application/zip",
                    headers={"Content-Disposition": 'attachment; filename="patchwise-coco.zip"'})


class FileReq(BaseModel):
    name: str = ""      # citizen fills on the portal if not given; never invented
    mobile: str = ""
    ward: str = ""
    portal_url: str | None = None


@app.post("/reports/{rid}/file")
def file_complaint(rid: str, req: FileReq):
    """Muse Wonder pre-fills the grievance form and stops BEFORE submit for human review."""
    from . import wonder_agent
    r = _load(rid); rep = r.get("report", {})
    worst = max((p["severity"] for p in r["potholes"]), key=["LOW", "MEDIUM", "HIGH", "CRITICAL"].index, default="LOW")
    data = {"Citizen name": req.name, "Mobile number": req.mobile, "Ward / Zone": req.ward or r.get("ward") or "", "Category": "Roads & Potholes",
            "Location": f"{r.get('lat')}, {r.get('lng')}", "Subject": rep.get("subject", "Potholes"),
            "Description": pipeline.clean_complaint(rep.get("body_en"))[:900], "Severity": worst}
    res = wonder_agent.fill_complaint(req.portal_url or "http://127.0.0.1:8000/mock-portal", data, pipeline.DATA / rid)
    res["screenshot"] = f"/media/{rid}/wonder_final.png"
    (pipeline.DATA / rid / "wonder.json").write_text(json.dumps(res, indent=2, default=str), encoding="utf-8")
    if res.get("fields_filled", len(res.get("filled", {}))):
        r = _load(rid); r["status"] = "promised" if r.get("followup_due") else "filed"
        pipeline.write_json(pipeline.DATA / rid / "result.json", r, ensure_ascii=False, indent=2, default=str)
    return res


# ---------------- agent, budget, boards, live ride ----------------
from . import agent, costs  # noqa: E402


@app.post("/reports/{rid}/agent")
def agent_start(rid: str, reride: str | None = None):
    _load(rid); agent.start(rid, reride); return {"started": True}


@app.get("/reports/{rid}/agent")
def agent_steps(rid: str):
    return agent.steps(rid)


@app.get("/costs")
def cost_summary():
    return costs.summary()


@app.get("/repairs")
def repairs():
    out = []
    for r in agent.all_reports():
        out.append({"id": r["id"], "ward": r.get("ward") or "Unassigned", "status": r.get("status", "reported"), "upvotes": r.get("upvotes", 0),
                    "count": len(r["potholes"]), "repair_total_inr": r.get("repair_total_inr") or sum((p.get("repair") or {}).get("inr_est", 0) for p in r["potholes"]),
                    "filed_at": r.get("filed_at"), "followup_due": r.get("followup_due"), "verification": r.get("verification"),
                    "thumb": f"/media/{r['id']}/pothole_1.jpg" if r["potholes"] else None})
    return out


@app.get("/leaderboard")
def leaderboard():
    w = {}
    for r in repairs():
        x = w.setdefault(r["ward"], {"ward": r["ward"], "reports": 0, "hazards": 0, "fixed": 0, "open": 0, "inr": 0})
        x["reports"] += 1; x["hazards"] += r["count"]; x["inr"] += r["repair_total_inr"]
        x["fixed" if r["status"] == "fixed" else "open"] += 1
    rows = list(w.values())
    for x in rows: x["fix_rate"] = round(100 * x["fixed"] / max(1, x["reports"]))
    return sorted(rows, key=lambda x: (-x["fix_rate"], x["hazards"]))


@app.post("/live/frame")
async def live_frame(frame: UploadFile = File(...)):
    """Live ride mode: one JPEG frame -> SAM 3.1 image call ($0.0025). Client throttles to 1 frame / 2 s."""
    import base64
    from . import meta
    b = await frame.read()
    dets, _ = meta.sam_segment("pothole", image_url="data:image/jpeg;base64," + base64.b64encode(b).decode())
    out = [{"box": list(d.box), "conf": d.confidence, "w": d.img_w, "h": d.img_h} for d in dets]
    near = any(d.box[3] > 0.55 * d.img_h and d.box_area > 0.004 * d.img_w * d.img_h for d in dets)
    return {"detections": out, "alert": near, "spent_usd": costs.total()}


def _km(a, b, c, d):
    import math
    p = math.pi / 180
    h = math.sin((c - a) * p / 2) ** 2 + math.cos(a * p) * math.cos(c * p) * math.sin((d - b) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


@app.get("/nearby")
def nearby(lat: float, lng: float, radius_m: float = 75):
    """Open reports within radius, so the UI can offer 'Same pothole? Upvote it' instead of a duplicate."""
    out = []
    for r in reports():
        if r["lat"] is None or r["status"] == "fixed":
            continue
        d = _km(lat, lng, r["lat"], r["lng"]) * 1000
        if d <= radius_m:
            out.append({**r, "distance_m": round(d)})
    return sorted(out, key=lambda x: x["distance_m"])


@app.post("/reports/{rid}/upvote")
def upvote(rid: str):
    r = _load(rid)
    r["upvotes"] = r.get("upvotes", 0) + 1
    pipeline.write_json(pipeline.DATA / rid / "result.json", r, ensure_ascii=False, indent=2)
    return {"id": rid, "upvotes": r["upvotes"]}


@app.get("/followups")
def followups():
    f = pipeline.DATA / "followups.json"
    d = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
    return sorted([{"id": k, **v} for k, v in d.items()], key=lambda x: x["due"])


class Contact(BaseModel):
    name: str = ""
    mobile: str = ""


@app.post("/reports/{rid}/contact")
def set_contact(rid: str, c: Contact):
    r = _load(rid); r["contact"] = {"name": c.name.strip()[:80], "mobile": "".join(ch for ch in c.mobile if ch.isdigit())[:12]}
    pipeline.write_json(pipeline.DATA / rid / "result.json", r, ensure_ascii=False, indent=2, default=str)
    return {"ok": True}


@app.get("/reports/{rid}/frame")
def frame(rid: str, kind: str = "raw", i: int | None = None):
    """One frame as JPEG: raw ride frame (privacy-blurred) or the SAM overlay frame, for the before/after slider."""
    import cv2
    r = _load(rid); i = r["potholes"][0]["best_frame"] if i is None and r["potholes"] else (i or 0)
    src = pipeline.DATA / rid / ("overlay.mp4" if kind == "overlay" else "clip.mp4")
    f = pipeline.frame_at(src, i)
    if f is None:
        raise HTTPException(404)
    if kind != "overlay":
        f = pipeline.privacy_blur(f, pipeline.privacy_boxes(rid).get(i))
    ok, b = cv2.imencode(".jpg", f, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return Response(b.tobytes(), media_type="image/jpeg", headers={"Cache-Control": "public, max-age=3600"})


@app.get("/geo/reverse")
def geo_reverse(lat: float, lng: float):
    """Locality from OpenStreetMap Nominatim, via the shared policy-compliant client (UA, 1 req/s, disk cache)."""
    g = routing.reverse(lat, lng)
    if not g:
        return {"error": "geocoder unavailable"}
    return {"locality": g.get("suburb") or g.get("road"), "city": g.get("city") or g.get("state_district"), "display": g.get("display"), "source": g["source"]}


def _site(site: str | None) -> str:
    return site or os.getenv("PUBLIC_SITE_URL", "http://localhost:3000")


def _api(api: str | None) -> str:
    return api or os.getenv("PUBLIC_API_URL", "http://localhost:8000")


@app.get("/authorities")
def authorities_list():
    return {"cities": routing.CITIES, "authorities": [routing.public_contact(a) for a in routing.AUTH]}


@app.get("/reports/{rid}/route")
def report_route(rid: str, city: str | None = None, pick: str | None = None):
    """Who should get this report: reverse-geocoded city (user can override), Delhi jurisdiction choice, verified contacts."""
    return routing.route(_load(rid), city=city, pick=pick)


@app.get("/reports/{rid}/mailto")
def report_mailto(rid: str, authority: str, site: str | None = None, api: str | None = None):
    m = routing.mailto(_load(rid), authority, _site(site), _api(api))
    if m.get("error") == "unknown authority":
        raise HTTPException(404, "unknown authority")
    return m


@app.get("/reports/{rid}/portal-format")
def report_portal_format(rid: str, authority: str, site: str | None = None, api: str | None = None):
    p = routing.portal_format(_load(rid), authority, _site(site), _api(api))
    if p.get("error"):
        raise HTTPException(404, p["error"])
    return p


@app.get("/wards")
def wards():
    """Ward names citizens have actually used, for autocomplete."""
    return sorted({r.get("ward") for r in agent.all_reports() if r.get("ward")})


@app.get("/stats")
def stats():
    """Everything the landing page shows, computed from real reports + the spend log."""
    rs = agent.all_reports(); rp = repairs()
    feat = max(rs, key=lambda r: (len(r["potholes"]), (pipeline.DATA / r["id"] / "agent.jsonl").exists()), default=None)
    f = None
    if feat:
        ph = feat["potholes"]
        tot = sum((p.get("repair") or pipeline.repair_estimate(p))["inr_est"] for p in ph)
        steps_ = agent.steps(feat["id"])
        f = {"id": feat["id"], "ward": feat.get("ward"), "count": len(ph), "dangerous": sum(p["severity"] == "CRITICAL" for p in ph),
             "inr": tot, "top_m2": max(((p.get("repair") or {}).get("area_m2_est", 0) for p in ph), default=0),
             "overlay": feat.get("overlay"), "best_frame": ph[0]["best_frame"] if ph else 0,
             "hazard_types": sorted({p.get("hazard", "Pothole") for p in ph}), "followup_due": feat.get("followup_due"),
             "portal": f"/media/{feat['id']}/wonder_final.png" if (pipeline.DATA / feat["id"] / "wonder_final.png").exists() else None,
             "agent": [{"tool": s["tool"], "result": s.get("result")} for s in steps_ if s.get("kind") == "tool_result"]}
    return {"reports": len(rs), "hazards": sum(len(r["potholes"]) for r in rs),
            "dangerous": sum(p["severity"] == "CRITICAL" for r in rs for p in r["potholes"]),
            "inr_total": sum(x["repair_total_inr"] for x in rp), "wards": len({x["ward"] for x in rp}),
            "filed": sum(x["status"] in ("filed", "promised", "fixed") for x in rp), "fixed": sum(x["status"] == "fixed" for x in rp),
            "upvotes": sum(x["upvotes"] for x in rp), "spend_usd": costs.total(),
            "rates": {"pothole_inr_per_m2": pipeline.RATE_PER_M2["Pothole"], "min_inr": 1500, "visible_road_m2": pipeline.VISIBLE_ROAD_M2,
                      "label": "Assumption: typical urban patching rate; not a municipal quote"},
            "featured": f}


# ---------------- ward accountability, follow-up scheduler, offline rides ----------------
import datetime as _dt  # noqa: E402
from . import followup  # noqa: E402


@app.get("/wards/{ward}/accountability")
def ward_accountability(ward: str, as_of: str | None = None):
    today = as_of or _dt.date.today().isoformat()
    rows = [r for r in repairs() if r["ward"] == ward]
    if not rows:
        raise HTTPException(404, "no reports for this ward")
    promised = [r for r in rows if r["status"] in ("filed", "promised")]
    overdue = [r for r in promised if r.get("followup_due") and r["followup_due"] < today]
    esc = {k: v for k, v in followup.load().items()}
    for r in rows: r["escalation"] = esc.get(r["id"], {}).get("escalation")
    for r in overdue: r["days_overdue"] = (_dt.date.fromisoformat(today[:10]) - _dt.date.fromisoformat(r["followup_due"][:10])).days
    lb = next((x for x in leaderboard() if x["ward"] == ward), {})
    rank = [x["ward"] for x in leaderboard()].index(ward) + 1
    return {"ward": ward, "today": today, "rank": rank, "of": len(leaderboard()), "reports": rows, "promised": len(promised), "fixed": sum(r["status"] == "fixed" for r in rows),
            "overdue": overdue, "pending_inr": sum(r["repair_total_inr"] for r in rows if r["status"] != "fixed"),
            "fix_rate": lb.get("fix_rate", 0), "hazards": lb.get("hazards", 0)}


@app.post("/followups/run")
def followups_run(today: str | None = None, llm: bool = True, rid: str | None = None):
    """Run the follow-up scheduler now (it also runs by itself every 10 minutes). `today` lets a demo/test pretend a date."""
    return followup.run_due(today, llm=llm, only=rid)


@app.get("/reports/{rid}/escalation")
def escalation(rid: str):
    _load(rid); f = pipeline.DATA / rid / "escalation.json"
    if not f.exists():
        raise HTTPException(404, "no escalation drafted")
    return json.loads(f.read_text(encoding="utf-8"))


@app.post("/rides/offline")
async def offline_ride(frames: list[UploadFile] = File(...), lat: float | None = Form(None), lng: float | None = Form(None),
                       ward: str | None = Form(None), fps: float = Form(0.4)):
    """Frames cached on the phone (IndexedDB) while offline: stitched into a clip and run through the normal job pipeline."""
    import subprocess, tempfile
    if not 1 <= len(frames) <= 240:
        raise HTTPException(400, "send 1-240 frames")
    d = Path(tempfile.mkdtemp(dir=pipeline.DATA, prefix="upload_off_"))
    for i, f in enumerate(frames):
        (d / f"{i:04d}.jpg").write_bytes(await f.read())
    out = pipeline.DATA / f"upload_offline_{d.name}.mp4"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-framerate", "2", "-i", str(d / "%04d.jpg"), "-vf", "scale='min(1280,iw)':-2,format=yuv420p",
                    "-r", "8", "-c:v", "libx264", str(out)], check=True)
    import shutil; shutil.rmtree(d, ignore_errors=True)
    up = UploadFile(file=open(out, "rb"), filename=out.name, headers={"content-type": "video/mp4"})
    try:
        res = await job_start(video=up, lat=lat, lng=lng, voice_note=None, ward=ward, reride_of=None)
    finally:
        up.file.close(); out.unlink(missing_ok=True)
    return {**res, "frames": len(frames)}


@app.on_event("startup")
def _start_scheduler():
    followup.start_loop()
