"""Muse Wonder computer-use agent: pre-fills a civic complaint form and STOPS before submit.

Meta's computer tool is a protocol: we run the browser (Playwright), Wonder returns actions.
Hard guardrail: any click that lands on a submit control is refused and ends the run, so a human
always reviews and presses Submit themselves.
"""
from __future__ import annotations
import base64, json, time
from pathlib import Path
from . import meta

W, H = 1280, 900
TASK = """You are filling a municipal public-grievance web form for a citizen. Fill EVERY field using this data:
{data}
For dropdowns pick the closest option (Category = "Roads & Potholes"). Click a field before typing in it.
When all fields are filled, DO NOT click Submit. Stop and say "READY FOR REVIEW"."""


def _shot(page) -> str:
    return "data:image/png;base64," + base64.b64encode(page.screenshot()).decode()


def _is_submit(page, x, y) -> bool:
    return bool(page.evaluate("""([x,y])=>{const e=document.elementFromPoint(x,y);if(!e)return false;
      const b=e.closest('button,input[type=submit]');return !!b&&(b.type==='submit'||/submit/i.test(b.textContent||b.value||''));}""", [x, y]))


def _do(page, a: dict) -> str | None:
    t = a.get("type")
    if t in ("click", "double_click"):
        x, y = a["x"], a["y"]
        if _is_submit(page, x, y):
            return "BLOCKED_SUBMIT"
        # <select> needs a keyboard-friendly path in headless chromium
        page.mouse.click(x, y, button=a.get("button", "left") if a.get("button") in ("left", "right") else "left",
                         click_count=2 if t == "double_click" else 1)
    elif t == "type":
        tag = page.evaluate("document.activeElement && document.activeElement.tagName")
        if tag == "SELECT":
            page.evaluate("""(v)=>{const s=document.activeElement;const o=[...s.options].find(o=>o.text.toLowerCase().includes(v.toLowerCase()));
              if(o){s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));}}""", a["text"])
        else:
            page.keyboard.type(a["text"], delay=5)
    elif t == "keypress":
        keys = a.get("keys", [])
        if any(k.lower() in ("enter", "return") for k in keys) and \
                page.evaluate("document.activeElement && document.activeElement.tagName") in ("INPUT", "BUTTON"):
            return "BLOCKED_SUBMIT"  # Enter in a text input would submit the form
        page.keyboard.press("+".join("Control" if k.upper() == "CTRL" else k for k in keys))
    elif t == "scroll":
        page.mouse.move(a.get("x", W // 2), a.get("y", H // 2)); page.mouse.wheel(a.get("scroll_x", 0), a.get("scroll_y", 0))
    elif t == "move":
        page.mouse.move(a["x"], a["y"])
    elif t == "drag":
        p = a.get("path", [])
        if p:
            page.mouse.move(p[0]["x"], p[0]["y"]); page.mouse.down()
            for q in p[1:]: page.mouse.move(q["x"], q["y"])
            page.mouse.up()
    elif t == "wait":
        time.sleep(1)
    return None


def fill_complaint(url: str, data: dict, out_dir: Path, max_steps: int = 30) -> dict:
    from playwright.sync_api import sync_playwright
    out_dir.mkdir(parents=True, exist_ok=True)
    log = []
    with sync_playwright() as p:
        br = p.chromium.launch(); page = br.new_page(viewport={"width": W, "height": H}); page.goto(url)
        meta.costs.guard(0.5)
        c = meta.client()
        resp = c.responses.create(model="muse-wonder-1.0", tools=[{"type": "computer"}], truncation="auto",
                                  input=[{"role": "user", "content": [
                                      {"type": "input_text", "text": TASK.format(data=json.dumps(data, ensure_ascii=False, indent=1))},
                                      {"type": "input_image", "image_url": _shot(page)}]}])
        meta.record_usage(resp, "muse-wonder-1.0")
        stop = "max_steps"
        for step in range(max_steps):
            calls = [o for o in resp.output if getattr(o, "type", "") == "computer_call"]
            if not calls:
                stop = "model_done"; log.append({"step": step, "text": resp.output_text[:500]}); break
            call = calls[0]; blocked = None
            acts = [a.model_dump() if hasattr(a, "model_dump") else dict(a) for a in (getattr(call, "actions", None) or [getattr(call, "action")])]
            for a in acts:
                log.append({"step": step, "action": a})
                blocked = _do(page, a)
                if blocked: break
                time.sleep(0.15)
            if blocked:
                stop = "stopped_before_submit"; break
            page.screenshot(path=str(out_dir / f"wonder_step_{step:02d}.png"))
            resp = c.responses.create(model="muse-wonder-1.0", tools=[{"type": "computer"}], truncation="auto",
                                      previous_response_id=resp.id,
                                      input=[{"type": "computer_call_output", "call_id": call.call_id,
                                              "output": {"type": "computer_screenshot", "image_url": _shot(page)}}])
            meta.record_usage(resp, "muse-wonder-1.0")
        page.screenshot(path=str(out_dir / "wonder_final.png"), full_page=True)
        values = page.evaluate("Object.fromEntries([...document.querySelectorAll('input,select,textarea')].map(e=>[e.name,e.value]))")
        submitted = page.evaluate("document.getElementById('done') && document.getElementById('done').textContent")
        br.close()
    return {"stop_reason": stop, "submitted": bool(submitted), "filled": values, "steps": log,
            "screenshot": str(out_dir / "wonder_final.png")}
