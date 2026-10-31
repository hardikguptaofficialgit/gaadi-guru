"""Gaadi Guru civic agent: Muse Spark plans and calls tools; every step is streamed to the UI timeline.

Tools: analyze_video, check_duplicates, estimate_repair_cost, draft_complaint,
file_complaint (Muse Wonder pre-fills the portal, stops before final submit),
schedule_followup (+7 days), verify_repair (compare a re-ride).
"""
from __future__ import annotations
import datetime as dt, json, math, threading, time
from pathlib import Path
from . import meta, pipeline

DATA = pipeline.DATA
FOLLOWUPS = DATA / "followups.json"
MODEL = "muse-spark-1.3"

TOOLS = [
    {"type": "function", "name": n, "description": d, "parameters": {"type": "object", "properties": p, "required": list(p)}}
    for n, d, p in [
        ("analyze_video", "Get the SAM 3.1 hazard analysis for the report (cached; never re-runs a video already analysed).", {"report_id": {"type": "string"}}),
        ("check_duplicates", "Find earlier reports within radius_m metres of this one, to avoid duplicate complaints.", {"report_id": {"type": "string"}, "radius_m": {"type": "number"}}),
        ("estimate_repair_cost", "Estimate repair cost in INR from the measured hazard areas.", {"report_id": {"type": "string"}}),
        ("draft_complaint", "Return the bilingual (English + Hindi) complaint drafted from the analysis.", {"report_id": {"type": "string"}}),
        ("file_complaint", "Open the municipal grievance portal and pre-fill the complaint with Muse Wonder. Stops BEFORE final submit for human review.", {"report_id": {"type": "string"}}),
        ("schedule_followup", "Schedule a follow-up check N days out (default 7) to verify the repair promise.", {"report_id": {"type": "string"}, "days": {"type": "integer"}}),
        ("verify_repair", "Compare a later re-ride report against the original to see which hazards are fixed.", {"report_id": {"type": "string"}, "reride_report_id": {"type": "string"}}),
    ]]

SYSTEM = """You are Gaadi Guru, an autonomous civic agent for Indian roads. Goal: turn a citizen's ride video into an
actionable, non-duplicate municipal complaint and make sure it gets fixed. Work step by step using the tools:
1) analyze_video 2) check_duplicates (radius 50 m) 3) estimate_repair_cost 4) draft_complaint
5) file_complaint (unless an open duplicate already exists) 6) schedule_followup in 7 days
7) if a reride_report_id is given, verify_repair. Call ONE tool at a time. Finish with a 3-line summary for the citizen."""


def _load(rid: str) -> dict:
    f = DATA / rid / "result.json"
    if "/" in rid or ".." in rid or not f.exists():
        raise ValueError(f"unknown report {rid}")
    return json.loads(f.read_text(encoding="utf-8"))


def _save(r: dict) -> None:
    pipeline.write_json(DATA / r["id"] / "result.json", r, indent=2, ensure_ascii=False)


def _hav(a, b) -> float:
    if None in (*a, *b): return 1e9
    R = 6371000; p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    return 2 * R * math.asin(math.sqrt(math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))


def all_reports() -> list[dict]:
    return [json.loads(f.read_text(encoding="utf-8")) for f in DATA.glob("*/result.json")]


# ---------------- tools ----------------
def analyze_video(report_id: str, **_):
    r = _load(report_id)
    hz = {}
    for p in r["potholes"]: hz[p.get("hazard", "Pothole")] = hz.get(p.get("hazard", "Pothole"), 0) + 1
    return {"report_id": report_id, "cached": True, "hazards": hz, "count": len(r["potholes"]),
            "severity": {s: sum(p["severity"] == s for p in r["potholes"]) for s in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]},
            "road": r.get("plan", {}).get("road_type"), "sam_prompts": r.get("plan", {}).get("prompts")}


def check_duplicates(report_id: str, radius_m: float = 50, **_):
    r = _load(report_id); hits = []
    for o in all_reports():
        if o["id"] == report_id: continue
        d = _hav((r.get("lat"), r.get("lng")), (o.get("lat"), o.get("lng")))
        if d <= radius_m:
            hits.append({"report_id": o["id"], "distance_m": round(d, 1), "status": o.get("status", "reported"),
                         "same_video": o.get("video_hash") == r.get("video_hash")})
    return {"duplicates": hits, "open_duplicate": any(h["status"] in ("filed", "promised") for h in hits)}


def estimate_repair_cost(report_id: str, **_):
    r = _load(report_id)
    items = [{"id": p["id"], "hazard": p.get("hazard", "Pothole"), "severity": p["severity"],
              **(p.get("repair") or pipeline.repair_estimate(p))} for p in r["potholes"]]
    tot = sum(i["inr_est"] for i in items)
    r["repair_total_inr"] = tot; _save(r)
    return {"total_inr": tot, "items": items, "assumptions": "area = mask share x 30 m2 visible road; Rs 1,800/m2 patching, min Rs 1,500/site"}


def draft_complaint(report_id: str, **_):
    rep = _load(report_id).get("report", {})
    return {"subject": rep.get("subject"), "body_en": pipeline.clean_complaint(rep.get("body_en"))[:1200], "body_hi": pipeline.clean_complaint(rep.get("body_hi"))[:800]}


def file_complaint(report_id: str, _emit=None, **_):
    r = _load(report_id); f = DATA / report_id / "wonder.json"
    if f.exists():  # budget: reuse the already pre-filled form for this report
        res = json.loads(f.read_text(encoding="utf-8")); res["cached"] = True
    else:
        from . import main  # reuse endpoint logic
        c = r.get("contact") or {}
        res = main.file_complaint(report_id, main.FileReq(name=c.get("name", ""), mobile=c.get("mobile", ""), ward=r.get("ward") or ""))
    r["status"] = "filed"; r["filed_at"] = dt.datetime.now().isoformat(timespec="seconds"); _save(r)
    if res.get("error"): return {"error": res["error"]}
    return {"stop_reason": res.get("stop_reason"), "submitted": res.get("submitted"), "screenshot": f"/media/{report_id}/wonder_final.png",
            "fields_filled": sum(bool(v) for v in (res.get("filled") or {}).values()), "cached": res.get("cached", False),
            "note": "Form pre-filled; final Submit left for the citizen."}


def schedule_followup(report_id: str, days: int = 7, **_):
    r = _load(report_id); due = (dt.date.today() + dt.timedelta(days=days or 7)).isoformat()
    fl = json.loads(FOLLOWUPS.read_text(encoding="utf-8")) if FOLLOWUPS.exists() else {}
    fl[report_id] = {"due": due, "ward": r.get("ward"), "created": dt.date.today().isoformat()}
    FOLLOWUPS.write_text(json.dumps(fl, indent=2), encoding="utf-8")
    r["status"] = "promised" if r.get("status") == "filed" else r.get("status", "reported"); r["followup_due"] = due; _save(r)
    return {"followup_due": due}


def verify_repair(report_id: str, reride_report_id: str, **_):
    a, b = _load(report_id), _load(reride_report_id)
    sev = lambda r: sum({"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}[p["severity"]] for p in r["potholes"])
    gap = _hav((a.get("lat"), a.get("lng")), (b.get("lat"), b.get("lng")))
    if gap > 150:
        res = {"verdict": "NOT COMPARABLE", "distance_m": round(gap, 1), "note": "Re-ride is not on the same stretch (>150 m); ask the citizen to re-ride the original road."}
        a["verification"] = {**res, "reride": reride_report_id, "at": dt.datetime.now().isoformat(timespec="seconds")}; _save(a)
        return res
    fixed = len(b["potholes"]) < len(a["potholes"]) * 0.5 and sev(b) < sev(a) * 0.5
    seen = "pothole" in (b.get("plan", {}).get("spark_prompts") or b.get("plan", {}).get("prompts") or [])
    if fixed and seen:  # Spark still sees potholes but SAM masked none: do not claim a fix
        res = {"verdict": "INCONCLUSIVE", "distance_m": round(gap, 1), "before": {"count": len(a["potholes"])},
               "after": {"count": len(b["potholes"])}, "note": "Muse Spark still sees a pothole on the re-ride but SAM could not mask it; please re-ride with a clearer video."}
        a["verification"] = {**res, "reride": reride_report_id, "at": dt.datetime.now().isoformat(timespec="seconds")}; _save(a)
        return res
    res = {"before": {"count": len(a["potholes"]), "severity_points": sev(a)},
           "after": {"count": len(b["potholes"]), "severity_points": sev(b)},
           "distance_m": round(_hav((a.get("lat"), a.get("lng")), (b.get("lat"), b.get("lng"))), 1),
           "verdict": "FIXED" if fixed else "NOT FIXED"}
    a["verification"] = {**res, "reride": reride_report_id, "at": dt.datetime.now().isoformat(timespec="seconds")}
    a["status"] = "fixed" if fixed else a.get("status", "promised"); _save(a)
    return res


FUNCS = {f.__name__: f for f in [analyze_video, check_duplicates, estimate_repair_cost, draft_complaint,
                                 file_complaint, schedule_followup, verify_repair]}


# ---------------- loop ----------------
def _log(rid, ev):
    ev["t"] = time.time()
    with (DATA / rid / "agent.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps(ev, ensure_ascii=False, default=str) + "\n")


def run(rid: str, reride: str | None = None, max_turns: int = 12):
    (DATA / rid / "agent.jsonl").write_text("", encoding="utf-8")
    _log(rid, {"kind": "start", "text": f"Agent started for report {rid}" + (f" (re-ride {reride})" if reride else "")})
    c = meta.client()
    task = f"Report id: {rid}." + (f" reride_report_id: {reride}." if reride else " No re-ride yet.")
    try:
        meta.costs.guard(0.05)
        convo = [{"role": "user", "content": [{"type": "input_text", "text": task}]}]
        resp = c.responses.create(model=MODEL, instructions=SYSTEM, tools=TOOLS, parallel_tool_calls=False, input=convo)
        meta.record_usage(resp, MODEL)
        for _ in range(max_turns):
            calls = [o for o in resp.output if getattr(o, "type", "") == "function_call"]
            if not calls:
                _log(rid, {"kind": "final", "text": resp.output_text}); break
            outs = []
            for call in calls:
                args = json.loads(call.arguments or "{}")
                _log(rid, {"kind": "tool_call", "tool": call.name, "args": args})
                try:
                    res = FUNCS[call.name](**args)
                except Exception as e:  # surface tool errors to the model and the UI
                    res = {"error": str(e)[:300]}
                _log(rid, {"kind": "tool_result", "tool": call.name, "result": res})
                outs.append({"type": "function_call_output", "call_id": call.call_id, "output": json.dumps(res, ensure_ascii=False, default=str)[:6000]})
            meta.costs.guard(0.05)
            # stateless: resend the whole conversation (previous_response_id can expire mid-run)
            convo += [o.model_dump(exclude_none=True) for o in resp.output if getattr(o, "type", "") in ("function_call", "message", "reasoning")] + outs
            resp = c.responses.create(model=MODEL, instructions=SYSTEM, tools=TOOLS, parallel_tool_calls=False, input=convo)
            meta.record_usage(resp, MODEL)
    except Exception as e:
        _log(rid, {"kind": "error", "text": str(e)[:500]})
    _log(rid, {"kind": "done"})


def start(rid: str, reride: str | None = None):
    _load(rid)
    threading.Thread(target=run, args=(rid, reride), daemon=True).start()


def steps(rid: str) -> list[dict]:
    f = DATA / rid / "agent.jsonl"
    return [json.loads(l) for l in f.read_text(encoding="utf-8").splitlines() if l.strip()] if f.exists() else []
