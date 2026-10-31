"""Voice note: record with Chromium's fake mic, and upload a file; both end in the same scrubbable player."""
import io, math, struct, wave, os
from conftest import WEB

SHOTS = os.environ.get("SHOTS")


def _wav(sec=2.0, rate=16000):
    b = io.BytesIO(); w = wave.open(b, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
    w.writeframes(b"".join(struct.pack("<h", int(9000 * math.sin(2 * math.pi * 330 * i / rate) * (0.4 + 0.6 * abs(math.sin(i / 3000))))) for i in range(int(sec * rate))))
    w.close(); return b.getvalue()


def test_voice_record_with_fake_mic(page):
    page.context.grant_permissions(["microphone", "camera", "geolocation"])
    page.goto(WEB + "/new")
    if SHOTS: page.get_by_test_id("voice-record").scroll_into_view_if_needed(); page.screenshot(path=f"{SHOTS}/r7_voice_idle.png")
    page.get_by_test_id("voice-record").click()
    page.get_by_test_id("voice-live").wait_for()
    page.wait_for_timeout(2200)
    assert page.get_by_test_id("voice-timer").inner_text().strip() not in ("0:00", "")
    if SHOTS: page.screenshot(path=f"{SHOTS}/r7_voice_recording.png")
    page.get_by_test_id("voice-stop").click()
    page.get_by_test_id("voice-player").wait_for()
    page.locator("[data-testid=voice-wave][data-ready='1']").wait_for()
    if SHOTS: page.screenshot(path=f"{SHOTS}/r7_voice_playback.png")
    page.get_by_test_id("voice-delete").click()
    page.get_by_test_id("voice-record").wait_for()


def test_voice_upload_gets_player(page):
    page.goto(WEB + "/new")
    page.get_by_test_id("voice-upload").set_input_files({"name": "note.wav", "mimeType": "audio/wav", "buffer": _wav()})
    page.locator("[data-testid=voice-wave][data-ready='1']").wait_for()
    page.get_by_test_id("voice-wave").press("ArrowRight")
    page.get_by_test_id("voice-rerecord").wait_for()
