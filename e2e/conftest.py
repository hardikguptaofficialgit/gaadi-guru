"""E2E against the running app (web :3000, api :8000). Meta-costing calls are either cache hits or stubbed."""
import os, json
from pathlib import Path
import pytest
from playwright.sync_api import sync_playwright

WEB = os.environ.get("WEB", "http://localhost:3000"); API = os.environ.get("API", "http://localhost:8000")
ROOT = Path(__file__).resolve().parents[1]
CACHED = ROOT / "samples" / "reride5s.mp4"      # analysed before -> cache hit, $0
VIDEO_DIR = os.environ.get("E2E_VIDEO")


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
    c.route("**/geo/reverse**", lambda r: r.fulfill(json={"locality": "Nayapalli"}))
    pg = c.new_page(); pg.set_default_timeout(20000)
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    yield pg
    c.close()
    assert not errs, f"page errors: {errs}"
