"""Authorities: routing, Nominatim policy, mailto building, portal formats. No network, no Meta."""
import json, time
from urllib.parse import unquote
from fastapi.testclient import TestClient
from app import routing as R, pipeline
from app.main import app

c = TestClient(app)


def rep(**kw):
    r = {"id": "t1", "ward": "Nayapalli", "lat": 20.3001, "lng": 85.8301, "potholes": [
        {"id": 1, "severity": "CRITICAL", "image": "/media/t1/p1.jpg", "repair": {"inr_est": 5000, "area_m2_est": 1.2}},
        {"id": 2, "severity": "LOW", "repair": {"inr_est": 800, "area_m2_est": 0.3}}]}
    r.update(kw); return r


def nomi(**addr):
    t = addr.pop("_type", "residential"); ref = addr.pop("_ref", None)
    return lambda: {"category": "highway", "type": t, "extratags": {"ref": ref} if ref else {}, "display_name": ", ".join(map(str, addr.values())),
                    "address": addr}


def test_dataset_loaded_with_sources_and_confidence():
    assert len(R.AUTH) == 27 and len({a["id"] for a in R.AUTH}) == 27
    for a in R.AUTH:
        assert a["sources"] and "confidence" in a


def test_only_high_or_medium_complaint_emails_are_exposed():
    assert R.public_contact(R.BY_ID["hyderabad-ghmc"])["emails"] == []      # low confidence
    assert R.public_contact(R.BY_ID["mumbai-bmc"])["emails"] == []          # high, but app-support only
    assert R.public_contact(R.BY_ID["lucknow-lmc"])["emails"][0]["email"] == "nnlko@nic.in"
    assert R.public_contact(R.BY_ID["delhi-mcd"])["emails"]                  # medium


def test_reverse_respects_policy_cache_and_rate_limit(monkeypatch):
    calls = []
    def f():
        calls.append(time.monotonic()); return nomi(city="Kolkata", country_code="in")()
    (pipeline.DATA / "geocache.json").unlink(missing_ok=True)
    assert R.reverse(22.5, 88.3, fetch=f)["city"] == "Kolkata"
    assert R.reverse(22.5, 88.3, fetch=f)["city"] == "Kolkata"  # cached: no second request
    R.reverse(22.6, 88.3, fetch=f)
    assert len(calls) == 2 and calls[1] - calls[0] >= 0.99      # 1 request / second
    assert "Patchwise" in R.UA and "github.com" in R.UA
    assert json.loads((pipeline.DATA / "geocache.json").read_text(encoding="utf-8"))


def test_reverse_failure_is_none():
    def f(): raise OSError("down")
    assert R.reverse(1.1111, 2.2222, fetch=f) is None


def test_route_city_detect_and_override():
    r = rep(lat=19.07, lng=72.87)
    o = R.route(r, fetch=nomi(city="Mumbai", country_code="in"))
    assert o["detected_city"] == "Mumbai" and o["authorities"][0]["id"] == "mumbai-bmc" and o["fallback"]["id"] == "national-cpgrams"
    o = R.route(r, city="Kolkata", fetch=nomi(city="Mumbai", country_code="in"))
    assert o["city"] == "Kolkata" and o["overridden"] and o["authorities"][0]["id"] == "kolkata-kmc"
    assert R.route(rep(lat=40.7, lng=-74.0), fetch=nomi(city="City of New York", country_code="us"))["authorities"][0]["id"] == "nyc-311"


def test_delhi_routing_rules():
    D = R.delhi_route
    assert D({"osm_type": "trunk", "ref": "NH 48"})["choice"] == "delhi-nhai"
    assert D({"osm_type": "trunk", "ref": "NH 48"})["decided"]
    n = D({"osm_type": "secondary", "postcode": "110001", "suburb": "Connaught Place"})
    assert n["choice"] == "delhi-ndmc" and not n["decided"]
    p = D({"osm_type": "primary", "postcode": "110092"})
    assert p["choice"] == "delhi-pwd" and not p["decided"]          # 60 ft can't be measured from OSM: user confirms
    assert D({"osm_class": "highway", "osm_type": "residential", "postcode": "110092"}) == {**D({"osm_class": "highway", "osm_type": "residential", "postcode": "110092"}), "choice": "delhi-mcd", "decided": True}
    assert not D(None)["decided"] and len(D(None)["options"]) == 4
    o = R.route(rep(lat=28.6, lng=77.2), pick="delhi-pwd", fetch=nomi(city="Delhi", country_code="in", postcode="110092", _type="primary"))
    assert o["picked"] == "delhi-pwd" and o["authorities"][0]["id"] == "delhi-pwd"


def test_mailto_bilingual_encoded_and_bounded():
    m = R.mailto(rep(), "lucknow-lmc", "https://pw.example", "https://api.example")
    assert m["href"].startswith("mailto:nnlko@nic.in?subject=") and " " not in m["href"] and "\n" not in m["href"]
    assert len(m["href"]) <= R.MAILTO_MAX
    body = unquote(m["href"].split("&body=")[1])
    assert "https://pw.example/r/t1" in body and "https://api.example/media/t1/p1.jpg" in body or m["short"]
    assert "Nayapalli" in body and ("गड्ढ" in m["subject"] or "गड्ढ" in body or "खतर" in body)
    assert "Patchwise" not in m["to"]


def test_mailto_falls_back_to_short_body_when_long():
    m = R.mailto(rep(ward="X" * 400), "delhi-mcd", "https://pw.example", "https://api.example")
    assert m["short"] and len(m["href"]) <= R.MAILTO_MAX and "pw.example/r/t1" in unquote(m["href"])


def test_mailto_refused_without_verified_email():
    m = R.mailto(rep(), "hyderabad-ghmc", "s", "a")
    assert m["error"] == "no verified email" and m["portal_link"]
    m = R.mailto(rep(lat=40.7), "nyc-311", "s", "a")
    assert m["error"]


def test_us_mail_is_english_only():
    m = R.mailto(rep(), "houston-311", "https://s", "https://a")
    assert "हिंदी" not in m["body"] and "₹" not in m["body"]


def test_portal_format_kmc_in_order_with_prefill():
    p = R.portal_format(rep(contact={"name": "Asha", "mobile": "98"}), "kolkata-kmc", "https://s", "https://a")
    labels = [f["label"] for f in p["fields"]]
    assert labels == R.BY_ID["kolkata-kmc"]["portal_fields"] and p["verified"]
    by = {f["label"]: f for f in p["fields"]}
    assert by["2a Complaint Code = 12"]["value"] == "12"
    assert "Nayapalli" in by["2b Location of Road/Footpath + Ward No."]["value"]
    assert by["1a Full Name"]["kind"] == "you" and "Asha" in by["1a Full Name"]["value"]


def test_portal_format_low_confidence_is_unverified_and_steps_not_copyable():
    p = R.portal_format(rep(), "delhi-mcd", "https://s", "https://a")
    assert not p["verified"] and p["fields_confidence"] == "low"
    assert p["fields"][0]["kind"] == "step" and p["fields"][1]["value"] == "Potholes on roads"
    assert R.portal_format(rep(), "delhi-nhai", "s", "a")["error"]


def test_api_endpoints(data):
    rid = next(p.name for p in data.iterdir() if (p / "result.json").exists())
    assert len(c.get("/authorities").json()["authorities"]) == 27
    o = c.get(f"/reports/{rid}/route", params={"city": "Kolkata"}).json()
    assert o["city"] == "Kolkata" and o["authorities"][0]["has_portal_format"]
    m = c.get(f"/reports/{rid}/mailto", params={"authority": "kolkata-kmc", "site": "https://pw.example"}).json()
    assert m["href"].startswith("mailto:eecl_roads_civil@kmcgov.in") and f"pw.example%2Fr%2F{rid}" in m["href"]
    assert c.get(f"/reports/{rid}/portal-format", params={"authority": "sf-311"}).json()["verified"]
    assert c.get(f"/reports/{rid}/mailto", params={"authority": "nope"}).status_code == 404
    assert c.get(f"/reports/{rid}/route").json()["city"] in (None, *R.CITIES)  # offline geocoder: still answers
