"""Authority routing: which civic body gets this pothole report, and how to reach it.

Data: app/authorities/authorities.json (hand-checked 2026-10-31, every contact has sources + confidence).
Location: OpenStreetMap Nominatim reverse geocoding, following its usage policy
(https://operations.osmfoundation.org/policies/nominatim/): identifying User-Agent, at most 1 request/second,
results cached on disk so a point is looked up once, attribution shown in the UI.
"""
import re
import json, os, re, threading, time
from pathlib import Path
from urllib.parse import quote
from . import pipeline

DATA_FILE = Path(__file__).parent / "authorities" / "authorities.json"
UA = os.getenv("NOMINATIM_UA", "Patchwise/1.0 (+https://github.com/hardikguptaofficialgit/gaadi-guru)")
NOMINATIM = os.getenv("NOMINATIM_URL", "https://nominatim.openstreetmap.org/reverse")
OSM_CREDIT = "© OpenStreetMap contributors (Nominatim)"
MAILTO_MAX = 1900  # stay under the ~2000-char limit of Outlook/Windows shell handlers and older browsers
OK_CONF = ("high", "medium")


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def _conf(s: str | None) -> str:
    s = (s or "").lower()
    return next((c for c in ("high", "medium", "low") if s.startswith(c)), "unknown")


IDS = {"Municipal Corporation of Delhi": "delhi-mcd", "New Delhi Municipal": "delhi-ndmc", "Public Works Department, GNCTD": "delhi-pwd",
       "Brihanmumbai": "mumbai-bmc", "BBMP": "bengaluru-gba", "Greater Chennai": "chennai-gcc", "Greater Hyderabad": "hyderabad-ghmc",
       "Kolkata Municipal": "kolkata-kmc", "Pune Municipal": "pune-pmc", "Amdavad": "ahmedabad-amc", "Jaipur Municipal Corporation Greater": "jaipur-greater",
       "Jaipur Municipal Corporation Heritage": "jaipur-heritage", "Lucknow": "lucknow-lmc", "Bhubaneswar": "bhubaneswar-bmc", "CPGRAMS": "national-cpgrams",
       "Swachhata": "national-swachhata", "NYC": "nyc-311", "StreetsLA": "la-311", "Chicago": "chicago-311", "Houston": "houston-311",
       "City of Phoenix": "phoenix", "Philadelphia": "philly-311", "SF Public Works": "sf-311", "Seattle": "seattle-fifi", "Boston": "boston-311",
       "Austin": "austin-311"}


def load() -> list[dict]:
    out = []
    for a in json.loads(DATA_FILE.read_text(encoding="utf-8")):
        aid = next((v for k, v in IDS.items() if a["authority"].startswith(k)), None) or slug(f"{a['city']}-{a['authority']}")[:40]
        url = (a.get("portal_url") or "").split(" ")[0]
        out.append({**a, "id": aid, "portal_link": url if url.startswith("http") else None,
                    "portal_note": (a.get("portal_url") or "")[len(url):].strip(" ()") or None})
    # NHAI is named in the dataset notes as Delhi's highway authority (helpline 1033); no email/portal fields verified.
    out.append({"id": "delhi-nhai", "city": "Delhi", "country": "IN", "authority": "National Highways Authority of India (NHAI)",
                "ward_note": "National highways passing through Delhi.", "emails": [], "phone": "1033 (NHAI highway helpline)",
                "portal_url": "", "portal_link": None, "portal_note": None, "portal_fields": [], "categories": "",
                "sources": ["authorities/NOTES.md (Delhi jurisdiction gap: NHAI 1033)"], "checked": "2026-10-31",
                "confidence": {"phone": "medium", "email": "n/a", "portal": "n/a", "fields": "n/a"}})
    return out


AUTH = load()
BY_ID = {a["id"]: a for a in AUTH}
CITIES = sorted({a["city"] for a in AUTH if a["city"] != "National"})
ALIASES = {"new delhi": "Delhi", "delhi": "Delhi", "bangalore": "Bengaluru", "bengaluru": "Bengaluru", "bombay": "Mumbai",
           "calcutta": "Kolkata", "madras": "Chennai", "city of new york": "New York City", "new york": "New York City",
           "brooklyn": "New York City", "queens": "New York City", "manhattan": "New York City", "the bronx": "New York City",
           "staten island": "New York City", "bhubaneshwar": "Bhubaneswar", "amdavad": "Ahmedabad", "sf": "San Francisco"}


def match_city(*names) -> str | None:
    for n in names:
        if not n:
            continue
        raw = n.strip().lower()
        if raw in ALIASES:
            return ALIASES[raw]
        k = re.sub(r"\s*\(.*?\)|\b(greater|municipal corporation|municipal council|nagar nigam|mahanagar palika|corporation|city|district|metropolitan region|urban)\b", "", n.lower())
        k = re.sub(r"\s+", " ", k).strip(" ,.-")
        if k in ALIASES:
            return ALIASES[k]
        for c in CITIES:
            if c.lower() == k:
                return c
    return None


def public_contact(a: dict) -> dict:
    """What the UI may show: emails only when confidence is high/medium and the email is meant for complaints."""
    emails = [e for e in a.get("emails", []) if _conf(e.get("confidence")) in OK_CONF and "not for complaint" not in (e.get("purpose") or "").lower()]
    c = a.get("confidence", {})
    return {"id": a["id"], "city": a["city"], "country": a["country"], "authority": a["authority"], "ward_note": a.get("ward_note"),
            "emails": emails, "phone": a.get("phone"), "portal_link": a.get("portal_link"), "portal_note": a.get("portal_note"),
            "sources": a.get("sources", []), "checked": a.get("checked"),
            "confidence": {k: _conf(v) for k, v in c.items()}, "confidence_raw": c, "has_portal_format": bool(a.get("portal_fields") and a.get("portal_link"))}


# ---------- Nominatim (policy-compliant) ----------
_lock = threading.Lock()
_last = [0.0]
def _cfile():
    return pipeline.DATA / "geocache.json"


def _cache() -> dict:
    try:
        return json.loads(_cfile().read_text(encoding="utf-8"))
    except Exception:
        return {}


def reverse(lat: float, lng: float, fetch=None) -> dict | None:
    key = f"{lat:.4f},{lng:.4f}"
    c = _cache()
    if key in c:
        return c[key]
    if fetch is None and os.getenv("GG_OFFLINE_GEO") == "1":
        return None
    import httpx
    fetch = fetch or (lambda: httpx.get(NOMINATIM, params={"lat": lat, "lon": lng, "format": "jsonv2", "zoom": 17, "addressdetails": 1,
                                                          "extratags": 1, "accept-language": "en"}, headers={"User-Agent": UA}, timeout=8).json())
    with _lock:  # max 1 request per second across the whole server
        wait = 1.0 - (time.monotonic() - _last[0])
        if wait > 0:
            time.sleep(wait)
        try:
            j = fetch()
        except Exception:
            return None
        finally:
            _last[0] = time.monotonic()
    a = j.get("address", {}) if isinstance(j, dict) else {}
    g = {"city": a.get("city") or a.get("town") or a.get("village"), "state_district": a.get("state_district"), "county": a.get("county"),
         "state": a.get("state"), "country_code": (a.get("country_code") or "").upper(), "postcode": a.get("postcode"),
         "suburb": a.get("suburb") or a.get("neighbourhood") or a.get("city_district"), "road": a.get("road"),
         "osm_class": j.get("category"), "osm_type": j.get("type"), "ref": (j.get("extratags") or {}).get("ref") or "",
         "display": j.get("display_name"), "source": OSM_CREDIT}
    c = _cache(); c[key] = g
    pipeline.write_json(_cfile(), c)
    return g


# ---------- location helpers ----------
def _rate(fn):
    with _lock:  # shared 1 req/s budget with reverse()
        wait = 1.0 - (time.monotonic() - _last[0])
        if wait > 0:
            time.sleep(wait)
        try:
            return fn()
        except Exception:
            return None
        finally:
            _last[0] = time.monotonic()


def iso6709(s: str | None):
    """'+26.9124+075.7873+431.000/' -> (26.9124, 75.7873)."""
    m = re.match(r"\s*([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)", s or "")
    if not m:
        return None
    lat, lng = float(m.group(1)), float(m.group(2))
    return (lat, lng) if -90 <= lat <= 90 and -180 <= lng <= 180 and (lat, lng) != (0.0, 0.0) else None


def video_gps(path) -> tuple[float, float] | None:
    """GPS from video container metadata (iPhone/Android MP4/MOV 'location' tags), via ffprobe."""
    import subprocess
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
                             capture_output=True, text=True, timeout=20).stdout
        j = json.loads(out or "{}")
    except Exception:
        return None
    tags = [j.get("format", {}).get("tags", {})] + [st.get("tags", {}) for st in j.get("streams", [])]
    for t in tags:
        for k, v in (t or {}).items():
            if "location" in k.lower() and (g := iso6709(v)):
                return g
    return None


def place(lat: float, lng: float, fetch=None) -> dict:
    """Reverse-geocode a point and map it to a supported city + its authorities."""
    g = reverse(lat, lng, fetch=fetch)
    if not g:
        return {"ok": False, "error": "geocoder unavailable", "lat": lat, "lng": lng}
    city = match_city(g.get("city"), g.get("state_district"), g.get("county"), g.get("state"))
    auths = [a["authority"] for a in AUTH if a["city"] == city]
    if city == "Delhi":
        d = delhi_route(g); auths = [BY_ID[d["choice"]]["authority"]] if d.get("choice") else auths
    loc = g.get("suburb") or g.get("road")
    label = ", ".join(x for x in (loc, city or g.get("city") or g.get("state_district"), g.get("state")) if x)
    return {"ok": True, "lat": lat, "lng": lng, "locality": loc, "raw_city": g.get("city") or g.get("state_district"), "city": city,
            "supported": bool(city), "authorities": auths, "label": label, "country_code": g.get("country_code"),
            "display": g.get("display"), "source": g["source"]}


SEARCH = os.getenv("NOMINATIM_SEARCH_URL", "https://nominatim.openstreetmap.org/search")


def search(q: str, fetch=None) -> list[dict]:
    """Manual city search: our supported cities first (instant, no network), then Nominatim for anything else."""
    q = (q or "").strip()
    if len(q) < 2:
        return []
    ql = q.lower()
    local = [c for c in CITIES if c.lower().startswith(ql)] + [v for k, v in ALIASES.items() if k.startswith(ql)]
    out = [{"city": c, "label": c, "supported": True} for c in dict.fromkeys(local)]
    if out or (fetch is None and os.getenv("GG_OFFLINE_GEO") == "1"):
        return out[:6]
    key = "q:" + ql; c = _cache()
    if key in c:
        return c[key]
    import httpx
    fetch = fetch or (lambda: httpx.get(SEARCH, params={"q": q, "format": "jsonv2", "addressdetails": 1, "limit": 5, "accept-language": "en"},
                                        headers={"User-Agent": UA}, timeout=8).json())
    j = _rate(fetch) or []
    res = []
    for it in j if isinstance(j, list) else []:
        a = it.get("address", {})
        city = match_city(a.get("city"), a.get("town"), a.get("state_district"), a.get("county"), a.get("state"))
        res.append({"city": city, "label": it.get("display_name", "")[:90], "supported": bool(city),
                    "lat": float(it["lat"]), "lng": float(it["lon"])})
    c = _cache(); c[key] = res; pipeline.write_json(_cfile(), c)
    return res


# ---------- Delhi jurisdiction ----------
NDMC_PIN = {"110001", "110002", "110003", "110004", "110011", "110021", "110023"}  # Lutyens' Delhi / NDMC area postcodes
NDMC_AREAS = ("connaught place", "chanakyapuri", "lodhi", "lutyens", "gole market", "rashtrapati bhavan", "india gate", "janpath",
              "khan market", "sarojini nagar", "kaka nagar", "bapa nagar", "netaji nagar", "golf links", "safdarjung")
ARTERIAL = {"primary", "secondary", "primary_link", "secondary_link"}
HIGHWAY = {"motorway", "trunk", "motorway_link", "trunk_link"}


def delhi_route(g: dict | None) -> dict:
    """Return {decided, choice, reason, options}. Auto-decide only on clear signals; otherwise the user picks."""
    opts = [
        {"id": "delhi-mcd", "rule": "Most Delhi roads and colony lanes (default)", "rule_hi": "दिल्ली की ज़्यादातर सड़कें और कॉलोनी की गलियां"},
        {"id": "delhi-pwd", "rule": "Arterial roads 60 ft wide or more", "rule_hi": "60 फ़ुट या ज़्यादा चौड़ी मुख्य सड़कें"},
        {"id": "delhi-ndmc", "rule": "Lutyens' Delhi / New Delhi Municipal Council area", "rule_hi": "लुटियंस दिल्ली / NDMC क्षेत्र"},
        {"id": "delhi-nhai", "rule": "National highways (NH)", "rule_hi": "राष्ट्रीय राजमार्ग (NH)"},
    ]
    if not g:
        return {"decided": False, "choice": None, "reason": "Location unknown", "options": opts}
    t = (g.get("osm_type") or "").lower(); ref = (g.get("ref") or "").upper().replace(" ", "")
    hay = " ".join(str(g.get(k) or "") for k in ("suburb", "road", "display")).lower()
    if ref.startswith("NH") or t in ("motorway", "motorway_link"):
        return {"decided": True, "choice": "delhi-nhai", "reason": f"OSM marks this road as a national highway ({g.get('ref') or t})", "options": opts}
    if g.get("postcode") in NDMC_PIN or any(x in hay for x in NDMC_AREAS):
        return {"decided": False, "choice": "delhi-ndmc", "reason": "Looks like the NDMC area; check the road isn't under PWD", "options": opts}
    if t in ARTERIAL or t in HIGHWAY:
        return {"decided": False, "choice": "delhi-pwd", "reason": f"OSM marks this as a {t} road; PWD if it's 60 ft or wider, else MCD", "options": opts}
    if g.get("osm_class") == "highway" and t:
        return {"decided": True, "choice": "delhi-mcd", "reason": f"Local {t} road, so MCD", "options": opts}
    return {"decided": False, "choice": "delhi-mcd", "reason": "Couldn't tell the road type", "options": opts}


def route(r: dict, city: str | None = None, pick: str | None = None, fetch=None) -> dict:
    g = None
    if r.get("lat") is not None and r.get("lng") is not None:
        g = reverse(r["lat"], r["lng"], fetch=fetch)
    detected = match_city(g.get("city"), g.get("state_district"), g.get("county"), g.get("state")) if g else None
    chosen = match_city(city) if city else detected
    out = {"detected_city": detected, "city": chosen, "overridden": bool(city), "geo": g, "cities": CITIES, "osm_credit": OSM_CREDIT if g else None,
           "loc_source": r.get("loc_source") or ("browser" if g else None), "lat": r.get("lat"), "lng": r.get("lng"),
           "place": ", ".join(x for x in ((g or {}).get("suburb") or (g or {}).get("road"), detected or (g or {}).get("city")) if x) or None}
    country = (g or {}).get("country_code") or ("IN" if not chosen else next(a["country"] for a in AUTH if a["city"] == chosen))
    if chosen == "Delhi":
        d = delhi_route(g if not city or detected == "Delhi" else None)
        sel = pick if pick in BY_ID and pick.startswith("delhi-") else d["choice"]
        out.update(delhi=d, picked=sel, authorities=[public_contact(BY_ID[sel])] if sel else [])
    elif chosen:
        out["authorities"] = [public_contact(a) for a in AUTH if a["city"] == chosen]
    else:
        out["authorities"] = []
    if country == "IN" and not any(a["id"] == "delhi-nhai" for a in out["authorities"]):
        out["fallback"] = public_contact(BY_ID["national-cpgrams"])  # not Swachhata: it has no pothole category
    out["country"] = country
    return out


# ---------- complaint text, mailto, portal format ----------
SEV = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
SEV_HI = {"CRITICAL": "बहुत खतरनाक", "HIGH": "खतरनाक", "MEDIUM": "मध्यम", "LOW": "हल्का"}


def facts(r: dict, site: str, api: str) -> dict:
    ps = r.get("potholes", [])
    counts = {s: sum(1 for p in ps if p.get("severity") == s) for s in SEV}
    worst = next((s for s in SEV if counts[s]), None)
    lat, lng = r.get("lat"), r.get("lng")
    place = r.get("ward") or (f"{lat:.5f}, {lng:.5f}" if lat is not None else "location in the report")
    img = next((p["image"] for p in ps if p.get("image")), None)
    return {"n": len(ps), "counts": counts, "worst": worst, "place": place, "lat": lat, "lng": lng,
            "gps": f"{lat:.5f}, {lng:.5f}" if lat is not None else None,
            "map": f"https://www.openstreetmap.org/?mlat={lat:.5f}&mlon={lng:.5f}#map=18/{lat:.5f}/{lng:.5f}" if lat is not None else None,
            "inr": round(sum((p.get("repair") or {}).get("inr_est") or 0 for p in ps)),
            "area": round(sum((p.get("repair") or {}).get("area_m2_est") or 0 for p in ps), 1),
            "link": f"{site.rstrip('/')}/r/{r['id']}", "photo": f"{api.rstrip('/')}{img}" if img else f"{api.rstrip('/')}/reports/{r['id']}/frame",
            "summary": (r.get("voice") or {}).get("transcript") or ""}


def _sev_en(f):
    return ", ".join(f"{n} {s.lower()}" for s, n in f["counts"].items() if n) or "none measured"


def _sev_hi(f):
    return ", ".join(f"{n} {SEV_HI[s]}" for s, n in f["counts"].items() if n) or "मापा नहीं गया"


def letter(f: dict, a: dict, hindi: bool, mode: str = "full") -> tuple[str, str]:
    """mode: full (EN + HI), mid (full EN + short HI), short (short EN + short HI; the report link carries the rest)."""
    subj = f"Pothole complaint: {f['place']}" + (" / गड्ढे की शिकायत" if hindi else "")
    hi_short = f"महोदय/महोदया,\n{f['place']} पर {f['n']} सड़क खतरे ({_sev_hi(f)})। फ़ोटो और नक्शे के साथ पूरी रिपोर्ट: {f['link']}\nकृपया जांच कर मरम्मत कराएं। धन्यवाद।"
    short = mode == "short"
    if short:
        en = (f"Dear Sir/Madam,\n\n{f['n']} road hazard{'' if f['n'] == 1 else 's'} ({_sev_en(f)}) at {f['place']}" + (f", GPS {f['gps']}" if f['gps'] else "") +
              f".\nFull report with photos and map: {f['link']}\n\nPlease inspect and repair. Thank you.")
        hi = hi_short
    else:
        en = (f"Dear Sir/Madam,\n\nI am reporting {f['n']} road hazard{'' if f['n'] == 1 else 's'} on a road under {a['authority']}.\n\n"
              f"Location: {f['place']}" + (f"\nGPS: {f['gps']} ({f['map']})" if f['gps'] else "") +
              f"\nSeverity: {_sev_en(f)}" + (f" (worst: {f['worst'].lower()})" if f['worst'] else "") +
              (f"\nMeasured damage: about {f['area']} m², repair estimate ₹{f['inr']:,}" if f['inr'] and a['country'] == "IN" else "") +
              f"\nPhoto (faces and number plates blurred): {f['photo']}\nFull public report: {f['link']}\n\n"
              "Please inspect the stretch and repair it. Thank you.")
        hi = (f"महोदय/महोदया,\n\nमैं {f['place']} पर {f['n']} सड़क खतरों की शिकायत कर रहा/रही हूं।\n" +
              (f"GPS: {f['gps']}\n" if f['gps'] else "") + f"गंभीरता: {_sev_hi(f)}\n" +
              (f"अनुमानित मरम्मत खर्च: ₹{f['inr']:,}\n" if f['inr'] else "") +
              f"फ़ोटो (चेहरे और नंबर प्लेट धुंधले): {f['photo']}\nपूरी रिपोर्ट: {f['link']}\n\nकृपया जांच कर मरम्मत कराएं। धन्यवाद।")
        if mode == "mid":
            hi = hi_short
    return subj, en + ("\n\n— हिंदी —\n" + hi if hindi else "")


def mailto(r: dict, aid: str, site: str, api: str) -> dict:
    a = BY_ID.get(aid)
    if not a:
        return {"error": "unknown authority"}
    pc = public_contact(a)
    if not pc["emails"]:
        return {"error": "no verified email", "portal_link": pc["portal_link"], "phone": pc["phone"]}
    to = pc["emails"][0]["email"]
    f = facts(r, site, api); hindi = a["country"] == "IN"
    # Hindi percent-encodes to 9 chars per letter, so shrink the Hindi part first, then the English.
    for hi_on, mode in ((hindi, "full"), (hindi, "mid"), (hindi, "short"), (False, "short")):
        subj, body = letter(f, a, hi_on, mode)
        href = f"mailto:{to}?subject={quote(subj, safe='')}&body={quote(body, safe='')}"
        if len(href) <= MAILTO_MAX:
            break
    short = mode == "short"
    return {"to": to, "subject": subj, "body": body, "href": href, "short": short, "mode": mode, "length": len(href),
            "full_subject": letter(f, a, hindi)[0], "full_body": letter(f, a, hindi)[1]}


def _field_value(label: str, f: dict, r: dict) -> tuple[str, str]:
    """(kind, value). kind: step (do it yourself), you (your own details), copy (pre-filled)."""
    l = label.lower(); contact = r.get("contact") or {}
    after = label.split(":", 1)[1].strip() if ":" in label else ""
    after = re.sub(r"^\s*=\s*", "", label.split("=", 1)[1]).strip() if "=" in label and not after else after
    if re.search(r"login|\botp\b|register|language|allow location|submit|updates via|new registration", l) and not re.search(r"name|address", l):
        return "step", ""
    if re.match(r"1[a-d] ", label) or re.search(r"\bname\b|gender|pincode", l):  # complainant's own details
        return "you", ", ".join(x for x in (contact.get("name"), contact.get("mobile")) if x)
    if " or " in after:  # a choice the citizen makes on the portal
        return "step", after
    if re.search(r"categor|type|code|nature of|problem|grievance against|department|request", l):
        return "copy", after or "Pothole / damaged road"
    if re.search(r"photo|image|video|document", l):
        return "copy", f["photo"]
    if re.search(r"location|address|gps|road|street|intersection|ward|zone", l) and not re.search(r"name", l):
        return "copy", f["place"] + (f" (GPS {f['gps']})" if f["gps"] else "")
    if re.search(r"descr|detail|reason|text|complaint|brief", l):
        return "copy", (f"{f['n']} pothole{'' if f['n'] == 1 else 's'} ({_sev_en(f)}) at {f['place']}. Photos and map: {f['link']}")
    if re.search(r"name|mobile|phone|contact|email|gender|pincode", l):
        v = ", ".join(x for x in (contact.get("name"), contact.get("mobile")) if x)
        return "you", v
    return "copy", after


def portal_format(r: dict, aid: str, site: str, api: str) -> dict:
    a = BY_ID.get(aid)
    if not a or not a.get("portal_fields"):
        return {"error": "no portal format"}
    f = facts(r, site, api); fc = _conf(a.get("confidence", {}).get("fields"))
    fields = []
    for i, lab in enumerate(a["portal_fields"]):
        kind, val = _field_value(lab, f, r)
        fields.append({"n": i + 1, "label": lab, "kind": kind, "value": val})
    return {"id": a["id"], "authority": a["authority"], "portal_link": a.get("portal_link"), "portal_note": a.get("portal_note"),
            "fields_confidence": fc, "verified": fc == "high", "confidence_raw": a.get("confidence", {}).get("fields"),
            "sources": a.get("sources", []), "fields": fields}
