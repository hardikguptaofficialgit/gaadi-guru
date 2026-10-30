import json
from pathlib import Path
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from . import pipeline

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
