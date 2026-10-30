import json
from pathlib import Path
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from . import pipeline, coco

app = FastAPI(title="Gaadi Guru API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/media", StaticFiles(directory=pipeline.DATA), name="media")


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/analyze")
async def analyze(video: UploadFile = File(...), lat: float | None = Form(None), lng: float | None = Form(None),
                  voice_note: UploadFile | None = File(None)):
    tmp = pipeline.DATA / f"upload_{video.filename}"
    tmp.write_bytes(await video.read())
    vn = await voice_note.read() if voice_note else None
    try:
        return pipeline.run(tmp, lat, lng, vn)
    finally:
        tmp.unlink(missing_ok=True)


@app.get("/reports")
def reports():
    out = []
    for f in sorted(pipeline.DATA.glob("*/result.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        r = json.loads(f.read_text())
        out.append({"id": r["id"], "lat": r["lat"], "lng": r["lng"], "count": len(r["potholes"]),
                    "worst": max((p["score"] for p in r["potholes"]), default=0)})
    return out


@app.get("/reports/{rid}")
def report(rid: str):
    f = pipeline.DATA / rid / "result.json"
    if not f.exists() or "/" in rid:
        raise HTTPException(404)
    return json.loads(f.read_text())


STATIC = Path(__file__).parent / "static"


@app.get("/mock-portal")
def mock_portal():
    """Local stand-in for a municipal grievance portal (real portals need OTP login)."""
    return FileResponse(STATIC / "mock_portal.html")


def _load(rid: str) -> dict:
    f = pipeline.DATA / rid / "result.json"
    if "/" in rid or ".." in rid or not f.exists():
        raise HTTPException(404)
    return json.loads(f.read_text())


@app.get("/reports/{rid}/coco")
def coco_one(rid: str):
    _load(rid)
    return Response(coco.export([rid]), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="gaadi-guru-{rid}-coco.zip"'})


@app.get("/dataset/coco")
def coco_all():
    rids = [p.parent.name for p in pipeline.DATA.glob("*/result.json")]
    return Response(coco.export(rids), media_type="application/zip",
                    headers={"Content-Disposition": 'attachment; filename="gaadi-guru-coco.zip"'})


class FileReq(BaseModel):
    name: str = "Citizen"
    mobile: str = "9XXXXXXXXX"
    ward: str = "Ward 7"
    portal_url: str | None = None


@app.post("/reports/{rid}/file")
def file_complaint(rid: str, req: FileReq):
    """Muse Wonder pre-fills the grievance form and stops BEFORE submit for human review."""
    from . import wonder_agent
    r = _load(rid); rep = r.get("report", {})
    worst = max((p["severity"] for p in r["potholes"]), key=["LOW", "MEDIUM", "HIGH", "CRITICAL"].index, default="LOW")
    data = {"Citizen name": req.name, "Mobile number": req.mobile, "Ward / Zone": req.ward, "Category": "Roads & Potholes",
            "Location": f"{r.get('lat')}, {r.get('lng')}", "Subject": rep.get("subject", "Potholes"),
            "Description": (rep.get("body_en") or "")[:900], "Severity": worst}
    res = wonder_agent.fill_complaint(req.portal_url or "http://127.0.0.1:8000/mock-portal", data, pipeline.DATA / rid)
    res["screenshot"] = f"/media/{rid}/wonder_final.png"
    (pipeline.DATA / rid / "wonder.json").write_text(json.dumps(res, indent=2, default=str))
    return res
