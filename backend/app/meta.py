"""Thin client for the Meta Model API (https://api.meta.ai/v1)."""
from __future__ import annotations
import base64, json, os, re
from dataclasses import dataclass, field
from pathlib import Path
import httpx
from openai import OpenAI

BASE_URL = os.environ.get("META_BASE_URL", "https://api.meta.ai/v1")
SPARK = os.environ.get("SPARK_MODEL", "muse-spark-1.3")
SAM = os.environ.get("SAM_MODEL", "sam-3.1")
ASR = os.environ.get("ASR_MODEL", "muse-voice-transcribe-1.0")


def api_key() -> str:
    key = os.environ.get("MODEL_API_KEY")
    if not key:
        p = Path(os.environ.get("MODEL_API_KEY_FILE", "/workspace/.meta_key"))
        if p.exists():
            key = p.read_text().strip()
    if not key:
        raise RuntimeError("MODEL_API_KEY not set")
    return key


def client() -> OpenAI:
    return OpenAI(base_url=BASE_URL, api_key=api_key())


def data_url(raw: bytes, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(raw).decode()}"


# ---------------- SAM 3.1 ----------------
_REC = re.compile(r"(\d+)<\|box;([^|]*)\|>(?:<\|mask;([^|]*?)data=(\d+),(\d+),(.)(.*?)\|>)?", re.S)
_FRAME = re.compile(r"<(\d+)f>")


@dataclass
class Detection:
    frame: int
    object_id: str
    box: tuple[float, float, float, float]
    img_w: int
    img_h: int
    confidence: float | None = None
    mask_area_px: float | None = None  # in source pixels
    mask_hw: tuple[int, int] | None = None
    mask_payload: str | None = None
    mask_enc: str | None = None

    @property
    def box_area(self) -> float:
        x1, y1, x2, y2 = self.box
        return max(0.0, x2 - x1) * max(0.0, y2 - y1)


def _kv(s: str) -> dict:
    out = {}
    for part in s.split(";"):
        if "=" in part:
            k, v = part.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def _mask_area(det: Detection) -> float | None:
    try:
        from meta_sam_parser import SegmentationMask, decode_mask_to_raster
        h, w = det.mask_hw
        enc = "one_bit" if det.mask_enc == "!" else "lossless"
        raster = decode_mask_to_raster(SegmentationMask(enc, det.mask_enc + det.mask_payload, w, h))
        on = sum(raster)
        return det.box_area * on / max(1, h * w)  # mask raster is box-local
    except Exception:
        return None


def parse_sam_text(text: str) -> list[Detection]:
    dets: list[Detection] = []
    lines = [l for l in text.splitlines() if l.strip()]
    for line in lines:
        fm = _FRAME.match(line.strip())
        frame = int(fm.group(1)) if fm else 0
        body = line.strip()[fm.end():] if fm else line
        for m in _REC.finditer(body):
            b = _kv(m.group(2))
            try:
                box = tuple(float(b[k]) for k in ("x1", "y1", "x2", "y2"))
            except KeyError:
                continue
            d = Detection(frame, m.group(1), box, int(float(b.get("w", 0))), int(float(b.get("h", 0))),
                          float(b["c"]) if "c" in b else None)
            if m.group(4):
                d.mask_hw = (int(m.group(4)), int(m.group(5)))
                d.mask_enc = m.group(6)
                d.mask_payload = m.group(7)
                d.mask_area_px = _mask_area(d)
            dets.append(d)
    return dets


def sam_segment(prompt: str, *, image_url: str | None = None, video_url: str | None = None,
                file_id: str | None = None, timeout: float = 600) -> tuple[list[Detection], str]:
    """One concept (noun phrase) per request, per Meta docs."""
    media: dict
    if image_url:
        media = {"type": "input_image", "image_url": image_url}
    elif file_id:
        media = {"type": "input_video", "file_id": file_id}
    else:
        media = {"type": "input_video", "video_url": video_url}
    body = {
        "model": SAM,
        "input": [{"type": "message", "role": "user", "content": [
            {"type": "input_text", "text": prompt}, media]}],
        "stream": True,
        "metadata": {"mask_encoding": "one_bit", "include_confidence": "true"},
    }
    text = []
    with httpx.stream("POST", f"{BASE_URL}/responses", json=body, timeout=timeout, headers={
        "Authorization": f"Bearer {api_key()}", "Accept": "text/event-stream"}) as r:
        if r.status_code >= 400:
            raise RuntimeError(f"SAM HTTP {r.status_code}: {r.read().decode()[:800]}")
        for line in r.iter_lines():
            if not line.startswith("data:"):
                continue
            payload = line[5:].strip()
            if payload == "[DONE]":
                break
            try:
                ev = json.loads(payload)
            except json.JSONDecodeError:
                continue
            if ev.get("type") == "response.output_text.delta":
                text.append(ev.get("delta", ""))
            elif ev.get("type") in ("response.failed", "error"):
                raise RuntimeError(f"SAM error: {json.dumps(ev)[:800]}")
    raw = "".join(text)
    return parse_sam_text(raw), raw


def upload_file(path: Path, purpose: str = "user_data") -> str:
    with open(path, "rb") as f:
        return client().files.create(file=f, purpose=purpose).id


# ---------------- Muse Spark ----------------
def spark_json(system: str, user: str | list, model: str = SPARK) -> dict:
    content = user if isinstance(user, list) else [{"type": "input_text", "text": user}]
    resp = client().responses.create(model=model, instructions=system,
                                     input=[{"role": "user", "content": content}])
    txt = resp.output_text.strip()
    m = re.search(r"\{.*\}", txt, re.S)
    return json.loads(m.group(0)) if m else {"raw": txt}


# ---------------- Muse Voice Transcribe ----------------
def transcribe(wav_bytes: bytes, languages: list[str] | None = None, keywords: list[str] | None = None) -> dict:
    """WAV mono 16-bit PCM 16/24 kHz, < 10 min, < 32 MB."""
    req = {"model": ASR, "audioEncoding": "WAV", "mode": "PUSH_TO_TALK"}
    if languages:
        req["languageBias"] = languages
    if keywords:
        req["keywords"] = keywords
    files = {"request": (None, json.dumps(req), "application/json"),
             "audio": ("note.wav", wav_bytes, "audio/wav")}
    r = httpx.post(f"{BASE_URL}/asr/transcribe", files=files, timeout=300,
                   headers={"Authorization": f"Bearer {api_key()}", "Accept": "application/json"})
    if r.status_code >= 400:
        raise RuntimeError(f"ASR HTTP {r.status_code}: {r.text[:800]}")
    return r.json()
