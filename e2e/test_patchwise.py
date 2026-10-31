"""Patchwise additions: brand, authorities + mailto + portal format, accounts (Supabase mocked or unreachable). No Meta, no real email."""
import base64, json, re, time
from pathlib import Path
from urllib.parse import unquote
from playwright.sync_api import expect
from conftest import WEB, ROOT

RID = "a17ea6e169"
ENV = dict(l.split("=", 1) for l in (ROOT / "frontend" / ".env.local").read_text().split() if "=" in l) if (ROOT / "frontend" / ".env.local").exists() else {}
SB = ENV.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")


def test_brand_is_patchwise(page):
    page.goto(WEB + "/")
    expect(page).to_have_title(re.compile("Patchwise"))
    expect(page.locator(".nav .logo")).to_contain_text("Patchwise")
    assert "Gaadi" not in page.content()


def test_authorities_city_override_mailto_and_copy(page):
    page.context.grant_permissions(["clipboard-read", "clipboard-write"])
    page.goto(WEB + f"/report?id={RID}")
    box = page.get_by_test_id("authorities")
    expect(box).to_be_visible()
    box.get_by_test_id("city").select_option("Lucknow")
    a = box.get_by_test_id("authority").first
    expect(a).to_have_attribute("data-id", "lucknow-lmc")
    m = a.get_by_test_id("mailto")
    expect(m).to_have_attribute("href", re.compile(r"^mailto:nnlko@nic\.in\?subject="))
    href = m.get_attribute("href")
    assert len(href) <= 1900 and " " not in href
    body = unquote(href.split("&body=")[1])
    assert f"/r/{RID}" in body and "महोदय" in body
    expect(a.locator("[data-conf=high]").first).to_be_visible()
    expect(a.locator("a.src").first).to_be_visible()                      # source link shown
    a.get_by_test_id("copy-email").click()
    clip = page.evaluate("navigator.clipboard.readText()")
    assert clip.startswith("To: nnlko@nic.in") and "Subject:" in clip


def test_low_confidence_email_hidden_portal_and_helpline_instead(page):
    page.goto(WEB + f"/report?id={RID}")
    page.get_by_test_id("city").select_option("Hyderabad")
    a = page.get_by_test_id("authority").first
    expect(a.get_by_test_id("no-email")).to_be_visible()
    expect(a.get_by_test_id("mailto")).to_have_count(0)
    expect(a).to_contain_text("040-21111111")
    assert "commissioner-ghmc" not in a.inner_text()


def test_delhi_jurisdiction_choice(page):
    page.goto(WEB + f"/report?id={RID}")
    page.get_by_test_id("city").select_option("Delhi")
    ch = page.get_by_test_id("delhi-choice")
    expect(ch).to_be_visible()
    for x in ("MCD", "PWD", "NDMC", "NHAI"):
        expect(ch).to_contain_text(x)
    ch.locator("label", has_text="PWD").click()
    a = page.get_by_test_id("authority").first
    expect(a).to_have_attribute("data-id", "delhi-pwd")
    expect(a.get_by_test_id("no-email")).to_be_visible()                  # PWD email was excluded (not .gov.in)


def test_portal_format_copy_and_unverified(page):
    page.context.grant_permissions(["clipboard-read", "clipboard-write"])
    page.goto(WEB + f"/report?id={RID}")
    page.get_by_test_id("city").select_option("Kolkata")
    a = page.get_by_test_id("authority").first
    expect(a).to_have_attribute("data-id", "kolkata-kmc")
    a.locator("summary", has_text="Portal format").click()
    pf = a.get_by_test_id("portal-format")
    expect(pf.locator("li")).to_have_count(7)
    expect(pf.locator("li").nth(4)).to_contain_text("Complaint Code = 12")
    expect(pf.get_by_test_id("unverified")).to_have_count(0)             # KMC fields verified field-by-field
    pf.locator("li").nth(4).get_by_test_id("copy-field").click()
    assert page.evaluate("navigator.clipboard.readText()") == "12"
    expect(pf.get_by_test_id("open-portal")).to_have_attribute("href", re.compile("kmcgov.in"))
    page.get_by_test_id("city").select_option("Delhi")
    page.get_by_test_id("delhi-choice").locator("label", has_text="MCD").click()
    a = page.get_by_test_id("authority").first
    expect(a).to_have_attribute("data-id", "delhi-mcd")
    a.locator("summary", has_text="Portal format").click()
    expect(a.get_by_test_id("unverified")).to_be_visible()


def test_works_when_supabase_unreachable(page):
    if SB: page.context.route(SB + "/**", lambda r: r.abort())
    page.goto(WEB + "/mine")
    expect(page.get_by_test_id("mine-list")).to_be_visible()
    page.goto(WEB + "/login")
    if SB:
        page.locator("input[type=email]").fill("test@example.com")
        page.get_by_test_id("magic-link").click()
        expect(page.get_by_role("alert")).to_be_visible()
    page.goto(WEB + f"/report?id={RID}")
    expect(page.get_by_test_id("authorities")).to_be_visible()


def _session_js():
    ref = SB.split("//")[1].split(".")[0]
    now = int(time.time())
    hdr = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').decode().rstrip("=")
    pl = base64.urlsafe_b64encode(json.dumps({"sub": "00000000-0000-4000-8000-000000000001", "role": "authenticated", "exp": now + 3600, "email": "rider@example.com"}).encode()).decode().rstrip("=")
    s = {"access_token": f"{hdr}.{pl}.sig", "token_type": "bearer", "expires_in": 3600, "expires_at": now + 3600, "refresh_token": "r",
         "user": {"id": "00000000-0000-4000-8000-000000000001", "aud": "authenticated", "role": "authenticated", "email": "rider@example.com", "app_metadata": {}, "user_metadata": {}, "created_at": "2026-10-31T00:00:00Z"}}
    return f"localStorage.setItem('sb-{ref}-auth-token', {json.dumps(json.dumps(s))}); localStorage.setItem('mine', JSON.stringify(['{RID}']));"


def test_claim_device_reports_after_login(page):
    if not SB: return
    posted = []
    def rest(r):
        if r.request.method == "POST":
            posted.append(json.loads(r.request.post_data)); return r.fulfill(status=201, json=[])
        return r.fulfill(json=[{"id": x["id"]} for p in posted for x in p] if posted else [])
    page.context.route(SB + "/rest/v1/reports**", rest)
    page.context.route(SB + "/auth/v1/**", lambda r: r.fulfill(json={}))
    page.context.add_init_script(_session_js())
    page.goto(WEB + "/mine")
    expect(page.get_by_test_id("account")).to_contain_text("rider")
    c = page.get_by_test_id("claim"); expect(c).to_be_visible()
    c.get_by_role("button").click()
    expect(page.get_by_test_id("claim")).to_have_count(0)
    row = posted[0][0]
    assert row["id"] == RID and row["user_id"].endswith("0001") and row["claimed_from_device"] is True and "lat" in row
