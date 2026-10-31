"""Live check against OSM Nominatim (real network, cached afterwards). Usage: .venv/bin/python scripts/geo_check.py [api_base]"""
import sys, time, httpx
API = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
PTS = {"Jaipur": (26.9124, 75.7873), "Delhi": (28.6315, 77.2167), "Kolkata": (22.5726, 88.3639), "Lucknow": (26.8467, 80.9462),
       "New York City": (40.7580, -73.9855), "San Francisco": (37.7793, -122.4193)}
bad = 0
for want, (lat, lng) in PTS.items():
    t = time.time(); j = httpx.get(f"{API}/geo/reverse", params={"lat": lat, "lng": lng}, timeout=20).json()
    ok = j.get("city") == want; bad += not ok
    print(f"{'OK ' if ok else 'BAD'} {want:14} {lat:9.4f},{lng:10.4f} -> {j.get('city')!s:14} | {j.get('label')} | {', '.join(j.get('authorities') or [])} ({time.time()-t:.2f}s)")
sys.exit(bad)
