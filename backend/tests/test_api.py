import json, io, time, datetime as dt
import numpy as np, cv2
import pytest


def first(rids, pred=lambda r: True):
    for k, r in rids.items():
        if pred(r): return k
    pytest.skip("no matching report")


def test_health(client):
    assert client.get("/health").json() == {"ok": True}


def test_reports_list(client, rids):
    r = client.get("/reports").json()
    assert {x["id"] for x in r} == set(rids)
    for x in r: assert {"lat", "lng", "count", "status", "verdict", "followup_due"} <= set(x)


def test_report_one_and_404(client, rids):
    rid = next(iter(rids))
    assert client.get(f"/reports/{rid}").json()["id"] == rid
    assert client.get("/reports/nope").status_code == 404
    assert client.get("/reports/..%2Fx").status_code == 404


def test_analyze_cached_no_spend(client, rids, data):
    rid = first(rids, lambda r: r.get("video_hash"))
    clip = next(p for p in (data / rid).glob("*.mp4"))
    from app import pipeline
    if pipeline.video_hash(clip) != rids[rid]["video_hash"]:
        pytest.skip("stored clip is re-encoded; hash differs")
    r = client.post("/analyze", files={"video": ("x.mp4", clip.read_bytes(), "video/mp4")}).json()
    assert r["cache_hit"] and r["id"] == rid


def _wait(client, jid, s=30):
    for _ in range(s * 10):
        j = client.get(f"/jobs/{jid}").json()
        if j["state"] != "running": return j
        time.sleep(0.1)
    raise AssertionError("job hung")


def test_job_cache_hit(client, rids, data, monkeypatch):
    from app import pipeline
    rid = next(iter(rids))
    monkeypatch.setattr(pipeline, "run", lambda *a, **k: {**rids[rid], "cache_hit": True})
    jid = client.post("/jobs", files={"video": ("a.mp4", b"0000", "video/mp4")}, data={"ward": "W"}).json()["job_id"]
    j = _wait(client, jid)
    assert j["state"] == "done" and j["report_id"] == rid and j["cache_hit"] and j["spend_usd"] == 0
    assert client.get("/jobs/missing").status_code == 404


def test_job_error_surfaces(client, monkeypatch):
    from app import pipeline
    def bad(*a, **k): raise RuntimeError("boom")
    monkeypatch.setattr(pipeline, "run", bad)
    j = _wait(client, client.post("/jobs", files={"video": ("a.mp4", b"0", "video/mp4")}).json()["job_id"])
    assert j["state"] == "error" and "boom" in j["error"]


def test_reride_job_runs_verify(client, rids, monkeypatch):
    from app import pipeline
    if len(rids) < 2: pytest.skip()
    a, b = list(rids)[:2]
    monkeypatch.setattr(pipeline, "run", lambda *x, **k: {**rids[b], "cache_hit": True})
    j = _wait(client, client.post("/jobs", files={"video": ("a.mp4", b"0", "video/mp4")}, data={"reride_of": a}).json()["job_id"])
    assert j["state"] == "done" and j["reride_of"] == a
    assert j["verification"]["verdict"] in ("FIXED", "NOT FIXED", "INCONCLUSIVE", "NOT COMPARABLE")
    steps = client.get(f"/reports/{a}/agent").json()
    assert any(s.get("tool") == "verify_repair" and s["kind"] == "tool_result" for s in steps)


def test_offline_ride_stitches_frames(client, rids, monkeypatch):
    from app import pipeline
    seen = {}
    def fake(path, lat, lng, vn, ward=None, progress=None):
        cap = cv2.VideoCapture(str(path)); seen["frames"] = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); seen["ward"] = ward
        return {**rids[next(iter(rids))], "cache_hit": True}
    monkeypatch.setattr(pipeline, "run", fake)
    img = cv2.imencode(".jpg", np.full((240, 320, 3), 120, np.uint8))[1].tobytes()
    r = client.post("/rides/offline", files=[("frames", (f"{i}.jpg", img, "image/jpeg")) for i in range(4)], data={"lat": "20.3", "lng": "85.8", "ward": "W1"})
    assert r.status_code == 200 and r.json()["frames"] == 4
    j = _wait(client, r.json()["job_id"])
    assert j["state"] == "done" and seen["frames"] >= 4 and seen["ward"] == "W1"
    assert client.post("/rides/offline", files=[]).status_code in (400, 422)


def test_mock_portal(client):
    r = client.get("/mock-portal"); assert r.status_code == 200 and "<form" in r.text.lower()


def test_coco(client, rids):
    rid = next(iter(rids))
    for u in (f"/reports/{rid}/coco", "/dataset/coco"):
        r = client.get(u); assert r.status_code == 200 and r.content[:2] == b"PK"


def test_file_complaint_stops_before_submit(client, rids, monkeypatch):
    from app import wonder_agent
    rid = next(iter(rids)); got = {}
    def fill(url, data, out):
        got.update(data); return {"filled": {k: True for k in data}, "fields_filled": len(data), "submitted": False, "stop_reason": "awaiting human submit"}
    monkeypatch.setattr(wonder_agent, "fill_complaint", fill)
    r = client.post(f"/reports/{rid}/file", json={"name": "", "mobile": ""}).json()
    assert r["submitted"] is False and got["Category"] == "Roads & Potholes" and got["Citizen name"] == ""


def test_agent_endpoints(client, rids, monkeypatch):
    from app import agent
    rid = next(iter(rids)); called = []
    monkeypatch.setattr(agent, "start", lambda r, rr=None: called.append(r))
    assert client.post(f"/reports/{rid}/agent").json() == {"started": True} and called == [rid]
    assert isinstance(client.get(f"/reports/{rid}/agent").json(), list)
    assert client.post("/reports/nope/agent").status_code == 404


def test_costs(client):
    c = client.get("/costs").json(); assert c["total_usd"] <= 75


def test_repairs_leaderboard(client, rids):
    rp = client.get("/repairs").json(); assert len(rp) == len(rids)
    lb = client.get("/leaderboard").json()
    assert sum(x["reports"] for x in lb) == len(rids)
    assert all(0 <= x["fix_rate"] <= 100 for x in lb)


def test_live_frame(client, monkeypatch):
    from app import meta
    D = meta.Detection if hasattr(meta, "Detection") else None
    class Det:
        box = (10, 200, 100, 230); confidence = .9; img_w = 320; img_h = 240; box_area = 90 * 30
    monkeypatch.setattr(meta, "sam_segment", lambda *a, **k: ([Det()], ""))
    r = client.post("/live/frame", files={"frame": ("f.jpg", b"\xff\xd8", "image/jpeg")}).json()
    assert r["alert"] is True and len(r["detections"]) == 1


def test_nearby_upvote(client, rids):
    rid = first(rids, lambda r: r.get("lat") is not None and r.get("status") != "fixed")
    r = rids[rid]
    near = client.get("/nearby", params={"lat": r["lat"], "lng": r["lng"]}).json()
    assert rid in [x["id"] for x in near]
    u0 = client.get(f"/reports/{rid}").json().get("upvotes", 0)
    assert client.post(f"/reports/{rid}/upvote").json()["upvotes"] == u0 + 1


def test_contact_sanitised(client, rids):
    rid = next(iter(rids))
    client.post(f"/reports/{rid}/contact", json={"name": " Asha ", "mobile": "+91 98-7654-3210"})
    assert client.get(f"/reports/{rid}").json()["contact"] == {"name": "Asha", "mobile": "919876543210"}


def test_frame_jpeg(client, rids):
    rid = first(rids, lambda r: r["potholes"])
    for k in ("raw", "overlay"):
        r = client.get(f"/reports/{rid}/frame", params={"kind": k})
        assert r.status_code in (200, 404)
        if r.status_code == 200: assert r.headers["content-type"] == "image/jpeg"


def test_geo_reverse_cached(client, monkeypatch):
    from app import main
    main._GEO[(1.0, 2.0)] = {"locality": "X"}
    assert client.get("/geo/reverse", params={"lat": 1, "lng": 2}).json()["locality"] == "X"


def test_wards_stats(client, rids):
    assert isinstance(client.get("/wards").json(), list)
    s = client.get("/stats").json()
    assert s["reports"] == len(rids) and s["hazards"] == sum(len(r["potholes"]) for r in rids.values())


def test_ward_accountability(client, rids):
    ward = next(r["ward"] for r in rids.values() if r.get("ward"))
    a = client.get(f"/wards/{ward}/accountability", params={"as_of": "2030-01-01"}).json()
    assert a["ward"] == ward and a["reports"]
    for o in a.get("overdue", []): assert o["days_overdue"] > 0


def test_followups_and_escalation_draft_only(client, rids, data):
    rid = next(iter(rids))
    fl = json.loads((data / "followups.json").read_text()) if (data / "followups.json").exists() else {}
    fl[rid] = {"due": "2020-01-01", "ward": "W"}; (data / "followups.json").write_text(json.dumps(fl))
    r = rids[rid]; r = json.loads((data / rid / "result.json").read_text()); r["status"] = "promised"; r.pop("verification", None)
    (data / rid / "result.json").write_text(json.dumps(r))
    assert any(f["id"] == rid for f in client.get("/followups").json())
    out = client.post("/followups/run", params={"rid": rid}).json()
    p = next(x for x in out["processed"] if x["id"] == rid)
    assert p["action"] == "escalation_drafted" and p["source"] == "template"  # Spark mocked off -> template fallback
    e = client.get(f"/reports/{rid}/escalation").json()
    assert e["sent"] is False and e["subject"] and e["body_en"]
    again = client.post("/followups/run", params={"rid": rid}).json()
    assert not again["processed"]  # idempotent
