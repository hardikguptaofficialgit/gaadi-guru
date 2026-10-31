from fastapi.testclient import TestClient
from app.main import app

def test_featured_is_compact_and_real():
    c = TestClient(app); r = c.get("/featured"); assert r.status_code == 200
    f = r.json()["featured"]
    if f is None:
        return
    for k in ("id", "count", "inr", "poster", "subject", "authority"):
        assert k in f
    assert c.get(f"/reports/{f['id']}").json()["id"] == f["id"]  # points at a real report
