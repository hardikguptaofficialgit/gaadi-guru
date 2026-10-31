"""Claiming on-device reports into an account: the backend must say which ids still exist."""
def test_reports_check_splits_live_missing_and_corrupt(client, rids):
    from app import pipeline
    live = next(iter(rids))
    bad = pipeline.DATA / "zz_claim_empty"; bad.mkdir(exist_ok=True); (bad / "result.json").write_bytes(b"")
    mangled = pipeline.DATA / "zz_claim_cp1252"; mangled.mkdir(exist_ok=True); (mangled / "result.json").write_bytes('{"id": "zz_claim_cp1252", "ward": "Caf\u00e9"'.encode("cp1252"))
    try:
        j = client.post("/reports/check", json={"ids": [live, "nope123", "zz_claim_empty", "zz_claim_cp1252", "../etc"]}).json()
        assert [r["id"] for r in j["reports"]] == [live]
        assert set(j["missing"]) == {"nope123", "zz_claim_empty", "zz_claim_cp1252", "../etc"}
        assert client.get("/reports/zz_claim_empty").status_code == 404  # 404, not a 500 without CORS headers
        assert client.get("/reports/zz_claim_cp1252").status_code == 404
    finally:
        for d in (bad, mangled):
            for f in d.iterdir(): f.unlink()
            d.rmdir()


def test_reports_check_empty_body(client):
    assert client.post("/reports/check", json={}).json() == {"reports": [], "missing": []}
