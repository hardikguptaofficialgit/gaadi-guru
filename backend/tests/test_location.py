"""Location flow: video GPS -> browser GPS -> manual city; Nominatim stubbed (real-network check lives in scripts/geo_check.py)."""
import subprocess, time
import pytest
from app import routing

# Nominatim jsonv2 shapes for the six spots we verified live on 2026-10-31.
NOM = {
    (26.9124, 75.7873): {"address": {"suburb": "Sodala", "city": "Jaipur", "state": "Rajasthan", "country_code": "in"}},
    (28.6315, 77.2167): {"address": {"suburb": "Connaught Place", "city": "New Delhi", "state": "Delhi", "postcode": "110001", "country_code": "in"}},
    (22.5726, 88.3639): {"address": {"suburb": "Bowbazar", "city": "Kolkata", "state": "West Bengal", "country_code": "in"}},
    (26.8467, 80.9462): {"address": {"suburb": "Hazratganj", "city": "Lucknow", "state": "Uttar Pradesh", "country_code": "in"}},
    (40.7580, -73.9855): {"address": {"suburb": "Manhattan", "city": "New York", "state": "New York", "country_code": "us"}},
    (37.7793, -122.4193): {"address": {"suburb": "Civic Center", "city": "San Francisco", "state": "California", "country_code": "us"}},
}
WANT = ["Jaipur", "Delhi", "Kolkata", "Lucknow", "New York City", "San Francisco"]


@pytest.mark.parametrize("pt,city", list(zip(NOM, WANT)))
def test_place_maps_city_and_authority(pt, city):
    p = routing.place(*pt, fetch=lambda: {**NOM[pt], "display_name": "x"})
    assert p["ok"] and p["city"] == city and p["supported"] and p["authorities"] and p["label"]


def test_place_cached_and_offline_safe():
    pt = (26.9124, 75.7873)
    routing.place(*pt, fetch=lambda: NOM[pt])
    t = time.monotonic(); assert routing.place(*pt)["city"] == "Jaipur"; assert time.monotonic() - t < 0.2  # cache, no fetch
    assert routing.place(1.234, 5.678)["ok"] is False  # offline + uncached -> graceful


def test_nominatim_sends_user_agent_and_rate_limits(monkeypatch):
    import httpx, os
    monkeypatch.delenv("GG_OFFLINE_GEO", raising=False)
    seen = []
    class R:
        def json(self): return NOM[(22.5726, 88.3639)]
    def fake_get(url, params=None, headers=None, timeout=None):
        seen.append((time.monotonic(), headers)); return R()
    monkeypatch.setattr(httpx, "get", fake_get)
    routing.reverse(10.001, 10.001); routing.reverse(10.002, 10.002)
    assert all("Patchwise" in h["User-Agent"] for _, h in seen)
    assert seen[1][0] - seen[0][0] >= 0.95


def test_iso6709():
    assert routing.iso6709("+26.9124+075.7873+431.000/") == (26.9124, 75.7873)
    assert routing.iso6709("-33.8688+151.2093/") == (-33.8688, 151.2093)
    assert routing.iso6709("+00.0000+000.0000/") is None and routing.iso6709("junk") is None


def test_video_gps_from_metadata(tmp_path):
    v = tmp_path / "g.mp4"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=gray:s=64x64:d=0.4", "-metadata",
                    "location=+28.6315+077.2167/", "-movflags", "use_metadata_tags", str(v)], check=True)
    assert routing.video_gps(v) == (28.6315, 77.2167)
    n = tmp_path / "n.mp4"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=gray:s=64x64:d=0.4", str(n)], check=True)
    assert routing.video_gps(n) is None


def test_manual_search_supported_first():
    assert routing.search("luck")[0] == {"city": "Lucknow", "label": "Lucknow", "supported": True}
    assert routing.search("calc")[0]["city"] == "Kolkata"
    assert routing.search("x") == []


def test_geo_endpoints(client):
    pt = (40.7580, -73.9855); routing.place(*pt, fetch=lambda: NOM[pt])
    j = client.get(f"/geo/reverse?lat={pt[0]}&lng={pt[1]}").json()
    assert j["city"] == "New York City" and "NYC311" in j["authorities"][0]
    assert client.get("/geo/search?q=jai").json()[0]["city"] == "Jaipur"


def test_job_records_manual_city(client, rids, monkeypatch):
    from app import pipeline
    rid = next(iter(rids)); monkeypatch.setattr(pipeline, "run", lambda *a, **k: {**rids[rid], "lat": None, "lng": None})
    jid = client.post("/jobs", files={"video": ("a.mp4", b"0", "video/mp4")}, data={"city": "lucknow", "loc_source": "manual"}).json()["job_id"]
    for _ in range(50):
        j = client.get(f"/jobs/{jid}").json()
        if j["state"] != "running": break
        time.sleep(.1)
    assert j["state"] == "done"
    o = client.get(f"/reports/{rid}/route").json()
    assert o["city"] == "Lucknow" and o["loc_source"] == "manual"


def test_job_prefers_video_gps(client, rids, monkeypatch):
    from app import pipeline
    rid = list(rids)[-1]; got = {}
    def run(tmp, lat, lng, *a, **k): got["ll"] = (lat, lng); return {**rids[rid]}
    monkeypatch.setattr(pipeline, "run", run); monkeypatch.setattr(routing, "video_gps", lambda p: (26.8467, 80.9462))
    jid = client.post("/jobs", files={"video": ("a.mp4", b"0", "video/mp4")}, data={"lat": "1", "lng": "2", "loc_source": "browser"}).json()["job_id"]
    for _ in range(50):
        if client.get(f"/jobs/{jid}").json()["state"] != "running": break
        time.sleep(.1)
    assert got["ll"] == (26.8467, 80.9462)


def test_match_city_strips_civic_suffixes():
    from app.routing import match_city
    assert match_city("Bhubaneswar Municipal Corporation") == "Bhubaneswar"
    assert match_city("Lucknow (M.Corp.)") == "Lucknow"
    assert match_city("Greater Jaipur") == "Jaipur"
