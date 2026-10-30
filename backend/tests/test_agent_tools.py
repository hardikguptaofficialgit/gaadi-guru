"""All 7 agent tools, plus the tool-calling loop driven by a fake Muse Spark client (no API calls)."""
import json, types
import pytest
from app import agent


@pytest.fixture
def rid(rids):
    return next(k for k, r in rids.items() if r["potholes"])


def test_tool_schema_covers_funcs():
    assert {t["name"] for t in agent.TOOLS} == set(agent.FUNCS) and len(agent.FUNCS) == 7


def test_analyze_video(rid, rids):
    r = agent.analyze_video(rid)
    assert r["count"] == len(rids[rid]["potholes"]) and sum(r["severity"].values()) == r["count"]


def test_check_duplicates(rid):
    r = agent.check_duplicates(rid, radius_m=1e7)
    assert isinstance(r, dict)


def test_estimate_repair_cost(rid):
    r = agent.estimate_repair_cost(rid)
    assert r["total_inr"] == sum(i["inr_est"] for i in r["items"]) and all(i["inr_est"] >= 1500 for i in r["items"])


def test_draft_complaint(rid):
    r = agent.draft_complaint(rid)
    assert r["subject"] and r["body_en"] and "score" not in r["body_en"].lower()


def test_file_complaint_uses_cached_form(rid, data, monkeypatch):
    (data / rid / "wonder.json").write_text(json.dumps({"filled": {"a": "x", "b": ""}, "submitted": False, "stop_reason": "review"}))
    r = agent.file_complaint(rid)
    assert r["cached"] and r["submitted"] is False and r["fields_filled"] == 1


def test_schedule_followup(rid, data):
    r = agent.schedule_followup(rid, days=7)
    assert rid in json.loads((data / "followups.json").read_text()) and r["followup_due"]


def _mk(rid, ph):
    import copy
    return copy.deepcopy(ph)


def test_verify_repair_verdicts(rids, data):
    a = next(k for k, r in rids.items() if len(r["potholes"]) >= 2 and r.get("lat") is not None)
    ra = json.loads((data / a / "result.json").read_text())
    # fixed: same place, no potholes, Spark no longer prompts pothole
    b = "zz_fixed"; (data / b).mkdir(exist_ok=True)
    (data / b / "result.json").write_text(json.dumps({"id": b, "lat": ra["lat"], "lng": ra["lng"], "potholes": [], "plan": {"prompts": ["crack"], "spark_prompts": ["crack"]}}))
    assert agent.verify_repair(a, b)["verdict"] == "FIXED"
    (data / b / "result.json").write_text(json.dumps({"id": b, "lat": ra["lat"], "lng": ra["lng"], "potholes": [], "plan": {"spark_prompts": ["pothole"]}}))
    assert agent.verify_repair(a, b)["verdict"] == "INCONCLUSIVE"
    (data / b / "result.json").write_text(json.dumps({"id": b, "lat": ra["lat"], "lng": ra["lng"], "potholes": ra["potholes"], "plan": {}}))
    assert agent.verify_repair(a, b)["verdict"] == "NOT FIXED"
    (data / b / "result.json").write_text(json.dumps({"id": b, "lat": ra["lat"] + 1, "lng": ra["lng"], "potholes": [], "plan": {}}))
    assert agent.verify_repair(a, b)["verdict"] == "NOT COMPARABLE"
    import shutil; shutil.rmtree(data / b)
    (data / a / "result.json").write_text(json.dumps(ra))


def test_agent_loop_with_fake_spark(rid, monkeypatch):
    """Fake model asks for each tool once, then answers. Checks the loop logs every call/result and finishes."""
    from app import meta
    order = ["analyze_video", "check_duplicates", "estimate_repair_cost", "draft_complaint", "schedule_followup"]
    state = {"i": 0}

    class Call:
        def __init__(s, n): s.type = "function_call"; s.name = n; s.arguments = json.dumps({"report_id": rid}); s.call_id = n
        def model_dump(s, **k): return {"type": "function_call", "name": s.name, "arguments": s.arguments, "call_id": s.call_id}

    def create(**k):
        i = state["i"]; state["i"] += 1
        if i < len(order): return types.SimpleNamespace(output=[Call(order[i])], output_text="")
        return types.SimpleNamespace(output=[], output_text="Done: complaint ready, follow-up in 7 days.")
    monkeypatch.setattr(meta, "client", lambda: types.SimpleNamespace(responses=types.SimpleNamespace(create=create)))
    monkeypatch.setattr(meta.costs, "guard", lambda *a: None)
    agent.run(rid)
    st = agent.steps(rid)
    assert [s["tool"] for s in st if s["kind"] == "tool_result"] == order
    assert not any("error" in (s.get("result") or {}) for s in st if s["kind"] == "tool_result")
    assert st[-2]["kind"] == "final" and st[-1]["kind"] == "done"


def test_agent_tool_error_is_reported(rid, monkeypatch):
    from app import meta
    class Call:
        type = "function_call"; name = "analyze_video"; arguments = '{"report_id": "nope"}'; call_id = "x"
        def model_dump(s, **k): return {}
    n = {"i": 0}
    def create(**k):
        n["i"] += 1
        return types.SimpleNamespace(output=[Call()] if n["i"] == 1 else [], output_text="ok")
    monkeypatch.setattr(meta, "client", lambda: types.SimpleNamespace(responses=types.SimpleNamespace(create=create)))
    monkeypatch.setattr(meta.costs, "guard", lambda *a: None)
    agent.run(rid)
    res = [s for s in agent.steps(rid) if s["kind"] == "tool_result"][0]["result"]
    assert "error" in res


def test_budget_guard_refuses():
    from app import costs
    with pytest.raises(Exception):
        costs.guard(10_000)
