"""
Robust MLB Alert Deduper – Replit‑ready
--------------------------------------
Drop this file into your project as `dedup.py` and import `AlertDeduper`.
Key features:
- Monotonic time (immune to clock changes)
- Tuple keys (no string split/join bugs)
- Hashed dedup key for large content fields
- Stable, normalized state comparison
- Safe cleanup (no dict‑while‑iterating)
- Optional per‑game token bucket (burst control)
- Config validation on init

Usage example (see bottom of file) demonstrates basic flow.
"""
from __future__ import annotations

import hashlib
import threading
import time
from typing import Any, Dict, Iterable, List, MutableMapping, Optional, Tuple


# ---------------------------
# Small utilities
# ---------------------------
class TokenBucket:
    """Simple per-key token bucket to cap bursts (thread-safe).

    capacity: max tokens
    refill_rate: tokens per second
    """

    __slots__ = ("capacity", "refill_rate", "_tokens", "_last", "_lock")

    def __init__(self, capacity: int, refill_rate: float) -> None:
        self.capacity = max(1, int(capacity))
        self.refill_rate = float(refill_rate)
        self._tokens = float(capacity)
        self._last = time.monotonic()
        self._lock = threading.Lock()

    def consume(self, n: float = 1.0) -> bool:
        with self._lock:
            now = time.monotonic()
            elapsed = now - self._last
            if elapsed > 0:
                self._tokens = min(self.capacity, self._tokens + elapsed * self.refill_rate)
                self._last = now
            if self._tokens >= n:
                self._tokens -= n
                return True
            return False


# ---------------------------
# Default Configuration (override by passing your own on init)
# ---------------------------
DEFAULT_ALERT_CONFIG: Dict[str, Dict[str, Any]] = {
    # Power & Performance Alerts
    "power_hitter": {
        "window": 15,
        "scope": "plate_appearance",
        "content_fields": ["batter_id", "pa_id", "prob_tier"],  # include tier for escalations
        "realert_after_secs": None,
    },
    # Scoring Situation Alerts (per-batter tracking)
    "bases_loaded_no_outs": {
        "window": 60,
        "scope": "plate_appearance",
        "content_fields": ["bases_hash", "outs", "batter_id"],
        "realert_after_secs": 180,
    },
    "runners_23_no_outs": {
        "window": 60,
        "scope": "plate_appearance",
        "content_fields": ["bases_hash", "outs", "batter_id"],
        "realert_after_secs": 180,
    },
    # Play-by-Play Alerts
    "hit": {
        "window": 15,
        "scope": "play",
        "content_fields": ["play_id", "description"],
        "realert_after_secs": None,
    },
    "home_run": {
        "window": 15,
        "scope": "play",
        "content_fields": ["play_id", "description"],
        "realert_after_secs": None,
    },
    # Hot Hitter Special Analysis
    "hot_hitter_bases_loaded_ai": {
        "window": 300,  # 5 minutes for specialized AI analysis
        "scope": "plate_appearance",
        "content_fields": ["batter_id", "game_hrs", "bases_loaded", "inning"],
        "realert_after_secs": None,
    },
    # Fallback / default values
    "default": {
        "window": 15,
        "scope": "game",
        "content_fields": ["digest"],
        "realert_after_secs": None,
    },
}


# ---------------------------
# Core Deduper
# ---------------------------
class AlertDeduper:
    def __init__(
        self,
        alert_config: Optional[Dict[str, Dict[str, Any]]] = None,
        alert_dedup_window: int = 15,
        enable_buckets: bool = True,
        bucket_capacity: int = 5,
        bucket_refill_seconds: int = 10,
    ) -> None:
        self.cfg: Dict[str, Dict[str, Any]] = dict(DEFAULT_ALERT_CONFIG)
        if alert_config:
            self.cfg.update(alert_config)
        self._validate_alert_config(self.cfg)

        self.alert_dedup_window = int(alert_dedup_window)
        self._lock = threading.RLock()

        # Stores
        self.recent_alerts: Dict[Tuple[Any, ...], float] = {}
        self.game_states: Dict[Tuple[Any, ...], Tuple[Any, ...]] = {}
        self.last_sent_by_simple: Dict[Tuple[Any, ...], float] = {}

        # Per-game token buckets
        self.enable_buckets = enable_buckets
        self.bucket_capacity = int(bucket_capacity)
        self.bucket_refill_seconds = max(1, int(bucket_refill_seconds))
        self._buckets: Dict[str, TokenBucket] = {}

    # --------------- Public API ---------------
    def is_new_alert(self, game_id: str, alert_type: str, data: Dict[str, Any]) -> bool:
        """Return True if alert should be sent now; updates internal state if allowed."""
        now = time.monotonic()
        cfg = self.cfg.get(alert_type, self.cfg["default"])

        with self._lock:
            simple_key = self._make_simple_key(game_id, alert_type, cfg["scope"], data)
            dedup_key = self._make_dedup_key(game_id, alert_type, cfg["content_fields"], data)
            state = self._normalized_state(alert_type, data)

            # 1) Time-based throttle on dedup key
            last_ts = self.recent_alerts.get(dedup_key)
            if last_ts is not None and (now - last_ts) < cfg.get("window", self.alert_dedup_window):
                return False

            # 2) State-based check (block if unchanged unless re-alert window hit)
            prev_state = self.game_states.get(simple_key)
            if prev_state == state:
                ra = cfg.get("realert_after_secs")
                if not ra:
                    return False
                last_sent = self.last_sent_by_simple.get(simple_key, 0.0)
                if (now - last_sent) < float(ra):
                    return False
                # Re-alert allowed – refresh timers before returning True
                self.recent_alerts[dedup_key] = now
                self.last_sent_by_simple[simple_key] = now
                # Optional per-game bucket
                if self.enable_buckets and not self._consume_bucket(game_id):
                    return False
                return True

            # 3) New state – accept and update
            self.game_states[simple_key] = state
            self.recent_alerts[dedup_key] = now
            self.last_sent_by_simple[simple_key] = now
            if self.enable_buckets and not self._consume_bucket(game_id):
                return False
            return True

    def cleanup_old_alerts(self) -> None:
        """Remove expired dedup/state entries safely. Call periodically (e.g., every 5s)."""
        now = time.monotonic()
        to_delete: List[Tuple[Any, ...]] = []

        with self._lock:
            for key, ts in list(self.recent_alerts.items()):
                # key is a tuple: (game_id, alert_type, digest)
                alert_type = key[1] if isinstance(key, tuple) and len(key) > 1 else None
                cfg = self.cfg.get(str(alert_type), self.cfg["default"])
                ttl = cfg.get("window", self.alert_dedup_window)
                if now - ts > (ttl + 10):
                    to_delete.append(key)
            for k in to_delete:
                self.recent_alerts.pop(k, None)

            old_simple = [k for k, ts in self.last_sent_by_simple.items() if now - ts > 3600]
            for k in old_simple:
                self.last_sent_by_simple.pop(k, None)

    # --------------- Internals ---------------
    def _consume_bucket(self, game_id: str) -> bool:
        if not self.enable_buckets:
            return True
        b = self._buckets.get(game_id)
        if b is None:
            refill_rate = self.bucket_capacity / float(self.bucket_refill_seconds)
            b = self._buckets[game_id] = TokenBucket(self.bucket_capacity, refill_rate)
        return b.consume(1.0)

    def _make_simple_key(self, game_id: str, alert_type: str, scope: str, data: Dict[str, Any]) -> Tuple[Any, ...]:
        if scope == "play":
            return (game_id, alert_type, "play", data.get("play_id"))
        elif scope == "plate_appearance":
            return (game_id, alert_type, "pa", self._half_inning_key(data), data.get("pa_id") or self._plate_appearance_id(data))
        elif scope == "half_inning":
            return (game_id, alert_type, "half", self._half_inning_key(data))
        elif scope == "game":
            return (game_id, alert_type, "game")
        else:
            return (game_id, alert_type, "unknown")

    def _make_dedup_key(self, game_id: str, alert_type: str, content_fields: Iterable[str], data: Dict[str, Any]) -> Tuple[Any, ...]:
        chunks: List[str] = []
        for f in content_fields:
            if f == "bases_hash":
                chunks.append(self._bases_hash(data.get("runners", [])))
            else:
                chunks.append(str(data.get(f, "")))
        digest = hashlib.blake2b("|".join(chunks).encode("utf-8"), digest_size=12).hexdigest()
        return (game_id, alert_type, digest)

    def _normalized_state(self, alert_type: str, data: Dict[str, Any]) -> Tuple[Any, ...]:
        cfg = self.cfg.get(alert_type, self.cfg["default"])
        fields = list(cfg.get("content_fields", []))
        base: Dict[str, Any] = {
            "half": self._half_inning_key(data),
            "outs": data.get("outs"),
        }
        for f in fields:
            if f == "bases_hash":
                base["bases"] = self._bases_hash(data.get("runners", []))
            else:
                base[f] = data.get(f)
        # Convert dict to a stable, hashable tuple sorted by key
        return tuple(sorted(base.items()))

    @staticmethod
    def _bases_hash(runners: Optional[Iterable[Any]]) -> str:
        if not runners:
            return "EMPTY"
        norm: List[str] = []
        for r in runners:
            if isinstance(r, str):
                if r.endswith("B"):
                    norm.append(r)
                else:
                    # Try to coerce e.g., "1" -> "1B"
                    norm.append((r + "B") if r.isdigit() else r)
            elif isinstance(r, int):
                norm.append(f"{r}B")
            elif isinstance(r, dict):
                b = r.get("base")
                if isinstance(b, int):
                    norm.append(f"{b}B")
                elif isinstance(b, str):
                    norm.append(b if b.endswith("B") else (b + "B" if b.isdigit() else b))
        if not norm:
            return "EMPTY"
        return "_".join(sorted(set(norm)))

    @staticmethod
    def _plate_appearance_id(data: Dict[str, Any]) -> str:
        return "|".join(
            map(
                str,
                [
                    data.get("game_id"),
                    AlertDeduper._half_inning_key(data),
                    data.get("batter_id", "unknown"),
                    # prefer at_bat_index; fall back to play_index
                    data.get("at_bat_index") if data.get("at_bat_index") is not None else data.get("play_index"),
                ],
            )
        )

    @staticmethod
    def _half_inning_key(data: Dict[str, Any]) -> str:
        inning = data.get("inning", 0)
        is_top = data.get("inning_top", True)
        half = "top" if is_top else "bottom"
        return f"inning_{inning}_{half}"

    @staticmethod
    def _validate_alert_config(cfg: Dict[str, Dict[str, Any]]) -> None:
        required = {"window": int, "scope": str, "content_fields": list}
        valid_scopes = {"play", "plate_appearance", "half_inning", "game"}
        for t, c in cfg.items():
            # allow "default" to be partial
            if t == "default":
                continue
            for k, typ in required.items():
                if k not in c or not isinstance(c[k], typ):
                    raise ValueError(f"ALERT_CONFIG[{t}] missing/invalid {k}")
            if c["scope"] not in valid_scopes:
                raise ValueError(f"ALERT_CONFIG[{t}] invalid scope '{c['scope']}'")


# ---------------------------
# Example usage / quick test
# ---------------------------
if __name__ == "__main__":
    deduper = AlertDeduper()

    # Example: bases loaded, no outs, two consecutive batters in same half-inning
    game_id = "G123"

    batter1 = {
        "game_id": game_id,
        "inning": 3,
        "inning_top": True,
        "outs": 0,
        "runners": ["1B", "2B", "3B"],
        "batter_id": "B001",
        "at_bat_index": 12,
        "pa_id": None,
    }

    batter2 = dict(batter1, batter_id="B002", at_bat_index=13)

    # First alert should pass
    print("batter1 allowed:", deduper.is_new_alert(game_id, "bases_loaded_no_outs", batter1))  # True
    # Immediate repeat for same batter should be blocked by window/state
    print("batter1 repeat allowed:", deduper.is_new_alert(game_id, "bases_loaded_no_outs", batter1))  # False
    # Next batter, same situation, should pass because scope=plate_appearance with batter_id in fields
    print("batter2 allowed:", deduper.is_new_alert(game_id, "bases_loaded_no_outs", batter2))  # True

    # Play-scoped discrete event
    hit_data = {"game_id": game_id, "play_id": "P456", "description": "Single to left"}
    print("hit allowed:", deduper.is_new_alert(game_id, "hit", hit_data))  # True
    print("hit duplicate:", deduper.is_new_alert(game_id, "hit", hit_data))  # False

    print("Deduper test complete!")