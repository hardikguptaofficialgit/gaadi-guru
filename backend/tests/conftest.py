"""Tests run on a throwaway copy of data/ with every Meta call mocked: zero API spend."""
import os, shutil, sys, tempfile, json
from pathlib import Path
import pytest

SRC = Path(__file__).resolve().parents[1] / "data"
TMP = Path(tempfile.mkdtemp(prefix="gg_test_"))
for p in SRC.iterdir():
    if p.is_dir() and (p / "result.json").exists():
        shutil.copytree(p, TMP / p.name)
for n in ("followups.json",):
    if (SRC / n).exists(): shutil.copy(SRC / n, TMP / n)
os.environ["GG_DATA"] = str(TMP)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import meta, costs  # noqa: E402


class NoMeta(Exception):
    pass


def _boom(*a, **k):
    raise NoMeta("Meta API is disabled in tests")


@pytest.fixture(autouse=True)
def no_meta(monkeypatch):
    for n in ("sam_segment", "spark_json", "transcribe", "upload_file", "client"):
        monkeypatch.setattr(meta, n, _boom)
    monkeypatch.setattr(meta, "record_usage", lambda *a, **k: None)
    before = costs.total()
    yield
    assert costs.total() == before, "a test spent Meta budget"


@pytest.fixture(scope="session")
def data():
    return TMP


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient
    from app import main
    main.app.router.on_startup.clear()  # no background scheduler in tests
    return TestClient(main.app)


@pytest.fixture(scope="session")
def rids():
    rs = {p.name: json.loads((p / "result.json").read_text()) for p in TMP.iterdir() if (p / "result.json").exists()}
    assert rs, "need at least one cached report in data/"
    return rs


def pytest_sessionfinish(session, exitstatus):
    shutil.rmtree(TMP, ignore_errors=True)
