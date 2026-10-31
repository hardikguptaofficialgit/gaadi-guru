"""E2E against the running app (web :3000, api :8000). Meta-costing calls are either cache hits or stubbed."""
import os, json, shutil, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
import pytest
from playwright.sync_api import sync_playwright

WEB = os.environ.get("WEB", "http://localhost:3000")
LIVE_API = "http://localhost:8000"          # what the built frontend calls; rerouted below
API = "http://127.0.0.1:8011"               # isolated test API: copy of data/, Meta faked server-side
ROOT = Path(__file__).resolve().parents[1]
CACHED = ROOT / "samples" / "reride5s.mp4"      # analysed before -> cache hit, $0
VIDEO_DIR = os.environ.get("E2E_VIDEO")


@pytest.fixture(scope="session", autouse=True)
def test_api():
    """Throwaway backend on :8011 over a copy of data/ with GG_FAKE_META=1, so tests never touch live reports or spend."""
    src = ROOT / "backend" / "data"; tmp = Path(tempfile.mkdtemp(prefix="gg_e2e_"))
    for p in src.iterdir():
        if p.is_dir() and (p / "result.json").exists(): shutil.copytree(p, tmp / p.name)
    if (src / "followups.json").exists(): shutil.copy(src / "followups.json", tmp / "followups.json")
    env = {**os.environ, "GG_DATA": str(tmp), "GG_FAKE_META": "1", "META_SPEND_LIMIT_USD": "0", "GG_OFFLINE_GEO": "1"}
    proc = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--port", "8011"], cwd=ROOT / "backend", env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):
        try: urllib.request.urlopen(API + "/health"); break
        except Exception: time.sleep(0.2)
    yield tmp
    proc.terminate(); proc.wait(10); shutil.rmtree(tmp, ignore_errors=True)


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"], slow_mo=int(os.environ.get("SLOW", "0")))
        yield b; b.close()


@pytest.fixture
def page(browser):
    kw = {"viewport": {"width": 1280, "height": 860}, "permissions": ["camera", "geolocation"], "geolocation": {"latitude": 20.2961, "longitude": 85.8245}}
    if VIDEO_DIR: kw |= {"record_video_dir": VIDEO_DIR, "record_video_size": {"width": 1280, "height": 860}}
    c = browser.new_context(**kw)
    c.route(LIVE_API + "/**", lambda r: r.fallback(url=r.request.url.replace(LIVE_API, API)))
    c.route("**/geo/reverse**", lambda r: r.fulfill(json={"locality": "Nayapalli"}))
    pg = c.new_page(); pg.set_default_timeout(20000)
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    yield pg
    c.close()
    assert not errs, f"page errors: {errs}"
