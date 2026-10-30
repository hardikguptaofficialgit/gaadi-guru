import json, re, time, urllib.request
import pytest
from playwright.sync_api import expect
from conftest import WEB, API, CACHED

spent0 = json.load(urllib.request.urlopen("http://localhost:8000/costs"))["total_usd"]
LIVE_A17 = json.load(urllib.request.urlopen("http://localhost:8000/reports/a17ea6e169"))


def api(p): return json.load(urllib.request.urlopen(API + p))


def test_landing_to_report_to_review(page):
    page.goto(WEB + "/")
    expect(page.locator("h1")).to_contain_text("Every bad road")
    page.get_by_role("link", name=re.compile("Report a road")).first.click()
    page.wait_for_url("**/new")
    page.get_by_test_id("video-input").set_input_files(str(CACHED))
    page.get_by_test_id("ward-input").fill("Ward 7 - Nayapalli")
    page.get_by_test_id("check-road").click()
    expect(page.get_by_test_id("progress")).to_be_visible()
    page.wait_for_url(re.compile(r"/report\?id=68237deffd"), timeout=60000)  # cache hit
    expect(page.get_by_test_id("found")).to_contain_text(re.compile(r"\d+"))
    expect(page.get_by_test_id("complaint")).to_be_visible()


def test_agent_portal_stops_before_submit(page):
    page.goto(WEB + "/report?id=a17ea6e169")
    s = page.get_by_test_id("success")
    expect(s).to_be_visible()
    expect(s.locator("img").first).to_be_visible()
    assert api("/reports/a17ea6e169")["wonder"]["submitted"] is False
    steps = api("/reports/a17ea6e169/agent")
    assert any(x.get("tool") == "file_complaint" and x["kind"] == "tool_result" for x in steps)


def test_send_button_starts_agent(page, test_api):
    """Click Send on a fresh (unsent) copy of a report; the agent POST is stubbed (no Spark spend)."""
    rid = "68237deffd"; f = test_api / rid / "result.json"
    r = json.loads(f.read_text()); r["status"] = "reported"; r.pop("followup_due", None); f.write_text(json.dumps(r))
    st = {"on": False}
    def h(r):
        if r.request.method == "POST": st["on"] = True; return r.fulfill(json={"started": True})
        r.fulfill(json=[{"kind": "start"}, {"kind": "tool_call", "tool": "analyze_video", "args": {}}] if st["on"] else [])
    page.route(f"**/reports/{rid}/agent", h)
    page.goto(WEB + f"/report?id={rid}")
    page.get_by_test_id("send").click()
    expect(page.get_by_test_id("agent-running")).to_be_visible()


def test_share_and_og(page):
    page.goto(WEB + "/report?id=a17ea6e169")
    page.context.grant_permissions(["clipboard-read", "clipboard-write"])
    page.get_by_test_id("copy-link").click()
    expect(page.locator(".toast")).to_be_visible()
    page.goto(WEB + "/r/a17ea6e169")
    expect(page.get_by_test_id("share-page")).to_be_visible()
    og = page.locator('meta[property="og:image"]').get_attribute("content")
    r = page.request.get(og.replace("https://", "http://") if og.startswith("http") else WEB + og)
    assert r.ok and r.headers["content-type"].startswith("image/png")


def test_escalation_draft_not_sent(page):
    page.goto(WEB + "/report?id=a17ea6e169")
    e = page.get_by_test_id("escalation")
    expect(e).to_contain_text("not sent")
    assert api("/reports/a17ea6e169/escalation")["sent"] is False


def test_my_reports(page):
    page.goto(WEB + "/report?id=a17ea6e169"); page.goto(WEB + "/mine")
    expect(page.get_by_test_id("mine-list")).to_be_visible()
    expect(page.get_by_test_id("mine-list").locator("a").first).to_be_visible()


def test_city_map_tabs_and_ward(page):
    page.goto(WEB + "/map")
    expect(page.locator(".leaflet-container")).to_be_visible()
    page.get_by_role("tab", name=re.compile("Repairs")).click()
    expect(page.get_by_test_id("board")).to_be_visible()
    assert "tab=board" in page.url
    page.get_by_role("tab", name=re.compile("Ward ranking")).click()
    lb = page.get_by_test_id("leaderboard"); expect(lb).to_be_visible()
    lb.locator("a").first.click()
    page.wait_for_url(re.compile(r"/map/ward\?w="))
    expect(page.get_by_test_id("ward-page")).to_be_visible()
    page.get_by_test_id("ward-copy").click()


def test_reride_inconclusive(page):
    page.goto(WEB + "/report?id=a17ea6e169")
    page.get_by_test_id("reride-btn").click()
    page.get_by_test_id("reride-input").set_input_files(str(CACHED))
    page.get_by_test_id("reride-go").click()
    res = page.get_by_test_id("reride-result")
    expect(res).to_be_visible(timeout=60000)
    expect(res).to_contain_text(re.compile("inconclusive|not fixed|fixed|different", re.I))
    assert api("/reports/a17ea6e169")["verification"]["verdict"]


def test_ride_fake_camera_live(page):
    calls = []
    page.route("**/live/frame", lambda r: (calls.append(1), r.fulfill(json={"detections": [{"box": [100, 300, 300, 400], "conf": .9, "w": 640, "h": 480}], "alert": True, "spent_usd": 0}))[1])
    page.goto(WEB + "/ride")
    page.get_by_test_id("ride-toggle").click()
    page.wait_for_function("document.querySelector('video') && document.querySelector('video').readyState >= 2")
    page.wait_for_timeout(5000)
    assert calls, "no frames sent"
    expect(page.locator(".alert")).to_contain_text("Pothole ahead")
    page.get_by_test_id("ride-toggle").click()


def test_ride_offline_queue_then_upload(page):
    """Offline: frames go to IndexedDB; back online they hit the REAL /rides/offline stitch + job pipeline (Meta faked server-side)."""
    page.route("**/live/frame", lambda r: r.abort())
    page.goto(WEB + "/ride")
    page.evaluate("indexedDB.deleteDatabase('gg-offline')")
    page.reload()
    before = {r["id"] for r in api("/reports")}
    page.context.set_offline(True)
    expect(page.get_by_test_id("net-badge")).to_contain_text(re.compile("offline", re.I))
    page.get_by_test_id("ride-toggle").click()
    page.wait_for_function("document.querySelector('[data-testid=queued]') && parseInt(document.querySelector('[data-testid=queued]').innerText) >= 2", timeout=30000)
    page.get_by_test_id("ride-toggle").click()
    with page.expect_response("**/rides/offline") as resp:
        page.context.set_offline(False)
    body = resp.value.json(); assert resp.value.ok and body["frames"] >= 2
    for _ in range(120):
        j = api(f"/jobs/{body['job_id']}")
        if j["state"] != "running": break
        time.sleep(0.5)
    assert j["state"] == "done", j
    assert j["report_id"] not in before and j["spend_usd"] == 0
    expect(page.get_by_test_id("offline-job")).to_be_visible(timeout=20000)


def test_hindi_toggle(page):
    page.goto(WEB + "/new")
    page.get_by_role("button", name="Switch language").click()
    expect(page.locator("main, body").first).to_contain_text("सड़क")
    page.reload()
    expect(page.get_by_role("button", name="Switch language")).to_have_text("English")
    page.evaluate("localStorage.setItem('lang','en')")


def test_zero_spend_and_live_untouched():
    assert api("/costs")["total_usd"] == spent0
    live = json.load(urllib.request.urlopen("http://localhost:8000/reports/a17ea6e169"))
    assert live["verification"]["at"] == LIVE_A17["verification"]["at"], "e2e mutated the live report"
