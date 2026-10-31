"""Follow-up scheduler: when a report's 7-day follow-up falls due, re-check its status and, if it is still not
verified fixed, draft an escalation complaint (draft only; it is never sent anywhere)."""
from __future__ import annotations
import datetime as dt, json, threading, time
from . import pipeline

DATA = pipeline.DATA
F = DATA / "followups.json"
_lock = threading.Lock()

ESC_SYSTEM = """You draft a short, polite but firm ESCALATION of an unresolved municipal road complaint in India,
addressed to the Executive Engineer (Roads) of the ward. Use only the facts given. No scores, no model names.
Return JSON: {"subject": str, "body_en": str (<= 160 words), "body_hi": str (<= 120 words, Hindi)}."""


def load() -> dict:
    return json.loads(F.read_text(encoding="utf-8")) if F.exists() else {}


def _template(r: dict, days_over: int, verdict: str | None) -> dict:
    n = len(r["potholes"]); w = r.get("ward") or "the ward"; inr = r.get("repair_total_inr") or 0
    why = {"NOT FIXED": "A re-ride shows the hazards are still there.", "INCONCLUSIVE": "A re-ride could not confirm a repair."}.get(verdict or "", "No repair has been confirmed.")
    return {"subject": f"Escalation: {n} road hazards in {w} still unrepaired ({days_over} days past follow-up)",
            "body_en": f"Respected Executive Engineer (Roads),\n\nI reported {n} road hazards at {r.get('lat')}, {r.get('lng')} in {w}"
                       f" on {(r.get('filed_at') or '')[:10] or 'an earlier date'}. The follow-up date was {r.get('followup_due')}. {why}\n\n"
                       f"Estimated repair cost is Rs {inr:,}. I request inspection and repair within 7 days, and a written update on this complaint.\n\nThank you.",
            "body_hi": f"आदरणीय अधिशासी अभियंता (सड़क),\n\nमैंने {w} में {n} सड़क खतरों की शिकायत की थी। फॉलो-अप की तारीख {r.get('followup_due')} थी, पर मरम्मत की पुष्टि नहीं हुई। "
                       f"अनुमानित खर्च ₹{inr:,} है। कृपया 7 दिनों में मरम्मत करवाएं और लिखित जानकारी दें।\n\nधन्यवाद।"}


def run_due(today: str | None = None, llm: bool = True, only: str | None = None) -> dict:
    today = today or dt.date.today().isoformat(); out = []
    with _lock:
        fl = load()
        for rid, fu in fl.items():
            if only and rid != only: continue
            if fu.get("due", "9999") > today or fu.get("state") in ("closed", "escalated"):
                continue
            f = DATA / rid / "result.json"
            if not f.exists() or f.stat().st_size == 0:
                fu["state"] = "closed"; fu["reason"] = "report missing"; continue
            try:
                r = json.loads(f.read_text(encoding="utf-8"))
                if not isinstance(r, dict):
                    raise ValueError("not a dict")
            except Exception:
                fu["state"] = "closed"; fu["reason"] = "report corrupt"; continue
            v = (r.get("verification") or {}).get("verdict")
            fu["checked_at"] = dt.datetime.now().isoformat(timespec="seconds")
            if r.get("status") == "fixed" or v == "FIXED":
                fu["state"] = "closed"; fu["reason"] = "verified fixed"; out.append({"id": rid, "action": "closed"}); continue
            days_over = (dt.date.fromisoformat(today) - dt.date.fromisoformat(fu["due"])).days
            draft, src = None, "template"
            if llm:
                try:
                    from . import meta
                    facts = {"ward": r.get("ward"), "hazards": len(r["potholes"]), "location": [r.get("lat"), r.get("lng")], "filed_at": r.get("filed_at"),
                             "followup_due": fu["due"], "days_overdue": days_over, "repair_estimate_inr": r.get("repair_total_inr"), "reride_verdict": v,
                             "original_subject": (r.get("report") or {}).get("subject")}
                    d = meta.spark_json(ESC_SYSTEM, json.dumps(facts, ensure_ascii=False), effort="minimal")
                    if d.get("subject") and d.get("body_en"):
                        draft, src = d, "muse-spark"
                except Exception as e:
                    fu["llm_error"] = str(e)[:200]
            draft = draft or _template(r, days_over, v)
            esc = {**draft, "body_en": pipeline.clean_complaint(draft["body_en"]), "report_id": rid, "drafted_at": fu["checked_at"], "source": src,
                   "days_overdue": days_over, "as_of": today, "simulated_date": today != dt.date.today().isoformat(), "reride_verdict": v, "sent": False, "note": "Draft only. Nothing is sent; the citizen decides."}
            (DATA / rid / "escalation.json").write_text(json.dumps(esc, ensure_ascii=False, indent=2), encoding="utf-8")
            fu["state"] = "escalated"; fu["escalation"] = {"at": fu["checked_at"], "source": src}
            r["escalation"] = {"at": fu["checked_at"], "source": src}; pipeline.write_json(f, r, ensure_ascii=False, indent=2, default=str)
            out.append({"id": rid, "action": "escalation_drafted", "source": src, "days_overdue": days_over})
        F.write_text(json.dumps(fl, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"today": today, "processed": out}


_started = False


def start_loop(every_s: int = 600):
    global _started
    if _started: return
    _started = True

    def loop():
        while True:
            try: run_due()
            except Exception: pass
            time.sleep(every_s)
    threading.Thread(target=loop, daemon=True).start()
