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


CUA_TOOLS = [
    {"type": "function", "name": "cua_left_click", "description": "Left-click at pixel x,y of the latest screenshot.",
     "parameters": {"type": "object", "properties": {"x": {"type": "integer"}, "y": {"type": "integer"}}, "required": ["x", "y"]}},
    {"type": "function", "name": "cua_type_text", "description": "Type text into the focused field (for a focused dropdown, picks the matching option).",
     "parameters": {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]}},
    {"type": "function", "name": "cua_press_key", "description": "Press a key, e.g. Tab.",
     "parameters": {"type": "object", "properties": {"key": {"type": "string"}}, "required": ["key"]}},
    {"type": "function", "name": "cua_scroll", "description": "Scroll vertically by dy pixels.",
     "parameters": {"type": "object", "properties": {"dy": {"type": "integer"}}, "required": ["dy"]}},
    {"type": "function", "name": "cua_screenshot", "description": "Get a fresh screenshot.", "parameters": {"type": "object", "properties": {}}},
]
SYSTEM = ("You operate a web browser ONLY through the cua_* tools. Each tool returns a new screenshot "
          f"({W}x{H} px; coordinates are pixels of that screenshot). Never click the Submit button.")
_MAP = {"cua_left_click": lambda a: {"type": "click", **a}, "cua_type_text": lambda a: {"type": "type", **a},
        "cua_press_key": lambda a: {"type": "keypress", "keys": [a.get("key", "")]},
        "cua_scroll": lambda a: {"type": "scroll", "scroll_y": a.get("dy", 0)}, "cua_screenshot": lambda a: {"type": "screenshot"}}


def fill_complaint(url: str, data: dict, out_dir: Path, max_steps: int = 30, on_step=None) -> dict:
    """Muse Wonder drives the form via function-call computer tools (the native `computer` tool
    is not enabled on our key, so we expose the same observe-act loop as cua_* functions)."""
    from playwright.sync_api import sync_playwright
    out_dir.mkdir(parents=True, exist_ok=True)
    log = []
    with sync_playwright() as p:
        br = p.chromium.launch(); page = br.new_page(viewport={"width": W, "height": H}); page.goto(url)
        meta.costs.guard(0.5)
        c = meta.client(); model = "muse-wonder-1.0"
        kw = dict(model=model, instructions=SYSTEM, tools=CUA_TOOLS, parallel_tool_calls=False)
        convo = [{"role": "user", "content": [
            {"type": "input_text", "text": TASK.format(data=json.dumps(data, ensure_ascii=False, indent=1))},
            {"type": "input_image", "image_url": _shot(page)}]}]
        resp = c.responses.create(**kw, input=convo)
        meta.record_usage(resp, model)
        stop = "max_steps"
        for step in range(max_steps):
            calls = [o for o in resp.output if getattr(o, "type", "") == "function_call"]
            if not calls:
                stop = "model_done"; log.append({"step": step, "text": (resp.output_text or "")[:500]}); break
            outs, blocked = [], None
            for call in calls:
                a = _MAP.get(call.name, lambda a: {"type": "noop"})(json.loads(call.arguments or "{}"))
                log.append({"step": step, "action": a})
                if on_step: on_step(step, [a])
                blocked = _do(page, a) if a["type"] != "screenshot" else None
                if blocked: break
                time.sleep(0.15)
                outs.append({"type": "function_call_output", "call_id": call.call_id,
                             "output": [{"type": "input_image", "image_url": _shot(page)}]})
            if blocked:
                stop = "stopped_before_submit"; break
            page.screenshot(path=str(out_dir / f"wonder_step_{step:02d}.png"))
            # stateless history (previous_response_id can expire); keep only the latest screenshot to bound tokens
            for item in convo:
                if item.get("type") == "function_call_output" and isinstance(item["output"], list):
                    item["output"] = "ok (older screenshot omitted)"
            if isinstance(convo[0]["content"], list) and len(convo) > 1:
                convo[0]["content"] = [x for x in convo[0]["content"] if x["type"] == "input_text"]
            convo += [o.model_dump(exclude_none=True) for o in resp.output if getattr(o, "type", "") in ("function_call", "message", "reasoning")] + outs
            for o in outs[:-1]: o["output"] = "ok"
            resp = c.responses.create(**kw, input=convo)
            meta.record_usage(resp, model)
        page.screenshot(path=str(out_dir / "wonder_final.png"), full_page=True)
        values = page.evaluate("Object.fromEntries([...document.querySelectorAll('input,select,textarea')].map(e=>[e.name,e.value]))")
        submitted = page.evaluate("document.getElementById('done') && document.getElementById('done').textContent")
        br.close()
    return {"stop_reason": stop, "submitted": bool(submitted), "filled": values, "steps": log,
            "screenshot": str(out_dir / "wonder_final.png")}
