"""Meta API spend tracker + hard budget guard (project cap $75, refuse new calls above $70)."""
from __future__ import annotations
import json, os, threading, time
from pathlib import Path

LOG = Path(__file__).resolve().parents[1] / "data" / "costs.jsonl"
LIMIT = float(os.environ.get("META_SPEND_LIMIT_USD", "70"))
PRICES = {
    "sam_video_frame": 0.20 / 1000, "sam_image": 2.50 / 1000,
    "spark_in": 1.25 / 1e6, "spark_out": 4.25 / 1e6,
    "wonder_in": 4.0 / 1e6, "wonder_out": 20.0 / 1e6,
    "voice_hour": 0.18,
}
_lock = threading.Lock()


class BudgetExceeded(RuntimeError):
    pass


def total() -> float:
    if not LOG.exists():
        return 0.0
    return round(sum(json.loads(l)["usd"] for l in LOG.read_text().splitlines() if l.strip()), 4)


def guard(estimate: float = 0.0) -> None:
    t = total()
    if t + estimate > LIMIT:
        raise BudgetExceeded(f"Meta API budget guard: spent ${t:.2f} + est ${estimate:.2f} > ${LIMIT:.2f}")


def record(kind: str, usd: float, **meta) -> float:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with _lock, LOG.open("a") as f:
        f.write(json.dumps({"ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "kind": kind, "usd": round(usd, 6), **meta}) + "\n")
    return usd


def summary() -> dict:
    by = {}
    if LOG.exists():
        for l in LOG.read_text().splitlines():
            if l.strip():
                r = json.loads(l); by[r["kind"]] = round(by.get(r["kind"], 0) + r["usd"], 4)
    return {"total_usd": total(), "limit_usd": LIMIT, "hard_cap_usd": 75.0, "by_kind": by}
