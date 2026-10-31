"""Windows-safety (UTF-8 + atomic writes) and the credit-saving helpers. No Meta spend."""
import json, locale, shutil
import numpy as np
from app import pipeline


def test_write_json_utf8_atomic(tmp_path, monkeypatch):
    # simulate Windows: the platform default text encoding cannot hold Hindi
    monkeypatch.setattr(locale, "getpreferredencoding", lambda *a, **k: "cp1252")
    p = tmp_path / "result.json"
    obj = {"id": "x", "report": {"body_hi": "सड़क पर गड्ढा है"}}
    pipeline.write_json(p, obj, ensure_ascii=False)
    assert json.loads(p.read_bytes().decode("utf-8")) == obj
    assert [f.name for f in tmp_path.iterdir()] == ["result.json"]  # no temp file left


def test_reports_skips_corrupt_file(client, rids, data):
    bad = data / "zz_corrupt"; bad.mkdir(exist_ok=True); (bad / "result.json").write_bytes(b"")
    try:
        r = client.get("/reports")
        assert r.status_code == 200
        assert {x["id"] for x in r.json()} == set(rids)
    finally:
        shutil.rmtree(bad)


def test_has_speech():
    sr = 16000; hdr = b"\0" * 44
    assert not pipeline.has_speech(hdr + np.zeros(sr * 2, np.int16).tobytes())
    tone = (3000 * np.sin(np.arange(sr * 2) * 2 * np.pi * 220 / sr)).astype(np.int16)
    assert pipeline.has_speech(hdr + tone.tobytes())
    assert not pipeline.has_speech(hdr + tone[: sr // 10].tobytes())  # 0.1 s is too short


def test_adaptive_frames_drop_only_stopped_frames(tmp_path):
    import subprocess, cv2
    src = tmp_path / "s.mp4"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=8:duration=3",
                    "-f", "lavfi", "-i", "color=c=gray:s=320x180:r=8:d=3", "-filter_complex", "[0][1]concat=n=2", str(src)], check=True)
    n = lambda a: int(cv2.VideoCapture(str(pipeline.to_h264(src, tmp_path / f"o{a}.mp4", adaptive=a))).get(7))
    full, adaptive = n(False), n(True)
    assert full == 48 and 24 + 4 <= adaptive < full  # moving part kept, still part thinned to >=1 in 4
