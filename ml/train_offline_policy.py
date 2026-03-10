"""
EmotionUI — Offline Policy Training

Trains an offline policy seed from real sessions and exports weights in the same
shape used by chrome-extension/background.js online model.

Data sources:
- CSV exported from Supabase
- Supabase REST API (if SUPABASE_URL + SUPABASE_KEY are available)
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split


ACTIONS = [
    "default",
    "show_price_tools",
    "simplify_layout",
    "show_reassurance",
    "streamline_checkout",
    "expand_details",
    "highlight_actions",
]

FEATURES = [
    # Base
    "rage_clicks",
    "mouse_jitter",
    "exit_intent",
    "scroll_thrash",
    "dead_clicks",
    "dwell_events",
    "scroll_depth",
    "time_on_price",
    "form_errors",
    "fast_scroll",
    "user_returning",
    # New friction / hesitation / research / intent
    "repeat_click_same_target",
    "dead_click_rate",
    "error_loop_count",
    "backtrack_rate",
    "retry_rate",
    "time_to_first_action",
    "hover_to_click_latency",
    "scroll_reversal_count",
    "micro_pause_count",
    "field_focus_switching",
    "spec_open_depth",
    "compare_trigger_count",
    "media_engagement_count",
    "faq_expand_count",
    "cart_add_then_price_check",
    "shipping_cost_visibility",
    "checkout_entry_count",
    "payment_method_hover",
    "time_on_price_area",
    "session_depth",
    # Derived
    "friction_score",
    "hesitation_score",
    "research_depth_score",
    "purchase_momentum_score",
    # Baseline-normalized
    "normalized_mouse_jitter",
    "normalized_scroll_speed",
    "normalized_pause_behavior",
    "baseline_active",
    # Context one-hot
    "input_type_mouse",
    "input_type_touch",
    "input_type_keyboard",
    "input_type_mixed",
    "network_latency_low",
    "network_latency_medium",
    "network_latency_high",
    "battery_saver_on",
]


@dataclass
class TrainingOutput:
    model: Dict[str, Any]
    metrics: Dict[str, Any]


def _parse_jsonish(v: Any) -> Dict[str, Any]:
    if isinstance(v, dict):
        return v
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return {}
    if isinstance(v, str):
        text = v.strip()
        if not text:
            return {}
        try:
            obj = json.loads(text)
            return obj if isinstance(obj, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _num(v: Any, default: float = 0.0) -> float:
    try:
        if v is None:
            return default
        if isinstance(v, str) and not v.strip():
            return default
        return float(v)
    except (TypeError, ValueError):
        return default


def compute_reward(outcome: Any, outcome_detail: Dict[str, Any]) -> float:
    outcome_str = str(outcome or "").lower()
    if bool(outcome_detail.get("purchase_completed")) or "purchase" in outcome_str:
        return 1.0
    if bool(outcome_detail.get("checkout_started")) or "checkout" in outcome_str:
        return 0.7
    if bool(outcome_detail.get("added_to_cart")) or "add_to_cart" in outcome_str:
        return 0.45
    if outcome_str in {"inactivity_30s", "tab_closed", "left", "abandoned", "tracker_disabled"}:
        return 0.05
    return 0.15


def normalize_row(row: pd.Series) -> Dict[str, float]:
    detail = _parse_jsonish(row.get("outcome_detail", {}))
    policy = detail.get("policy") if isinstance(detail, dict) else {}
    policy = policy if isinstance(policy, dict) else {}
    behavior = policy.get("behavior_metrics") if isinstance(policy, dict) else {}
    behavior = behavior if isinstance(behavior, dict) else {}
    derived = policy.get("derived_scores") if isinstance(policy, dict) else {}
    derived = derived if isinstance(derived, dict) else {}
    normalized = policy.get("normalized_metrics") if isinstance(policy, dict) else {}
    normalized = normalized if isinstance(normalized, dict) else {}

    scroll_speed = str(row.get("scroll_speed", "")).lower()
    user_type = str(row.get("user_type", "")).lower()
    input_type = str(behavior.get("input_type", row.get("input_type", ""))).lower()
    net = str(behavior.get("network_latency_bucket", row.get("network_latency_bucket", ""))).lower()
    battery = str(behavior.get("battery_saver_mode_if_available", row.get("battery_saver_mode_if_available", ""))).lower()

    return {
        # Base
        "rage_clicks": min(1.0, _num(row.get("rage_clicks")) / 8.0),
        "mouse_jitter": min(1.0, _num(row.get("mouse_jitter")) / 10.0),
        "exit_intent": min(1.0, _num(row.get("exit_intent")) / 6.0),
        "scroll_thrash": min(1.0, _num(row.get("scroll_thrash")) / 10.0),
        "dead_clicks": min(1.0, _num(row.get("dead_clicks")) / 8.0),
        "dwell_events": min(1.0, _num(row.get("dwell_events")) / 8.0),
        "scroll_depth": min(1.0, _num(row.get("scroll_depth")) / 100.0),
        "time_on_price": min(1.0, _num(row.get("time_on_price")) / 20.0),
        "form_errors": min(1.0, _num(row.get("form_errors")) / 5.0),
        "fast_scroll": 1.0 if scroll_speed == "fast" else 0.0,
        "user_returning": 1.0 if user_type == "returning" else 0.0,
        # New friction / hesitation / research / intent
        "repeat_click_same_target": min(1.0, _num(behavior.get("repeat_click_same_target", row.get("repeat_click_same_target"))) / 8.0),
        "dead_click_rate": min(1.0, _num(behavior.get("dead_click_rate", row.get("dead_click_rate")))),
        "error_loop_count": min(1.0, _num(behavior.get("error_loop_count", row.get("error_loop_count"))) / 5.0),
        "backtrack_rate": min(1.0, _num(behavior.get("backtrack_rate", row.get("backtrack_rate")))),
        "retry_rate": min(1.0, _num(behavior.get("retry_rate", row.get("retry_rate")))),
        "time_to_first_action": min(1.0, _num(behavior.get("time_to_first_action", row.get("time_to_first_action"))) / 20.0),
        "hover_to_click_latency": min(1.0, _num(behavior.get("hover_to_click_latency", row.get("hover_to_click_latency"))) / 6.0),
        "scroll_reversal_count": min(1.0, _num(behavior.get("scroll_reversal_count", row.get("scroll_reversal_count"))) / 14.0),
        "micro_pause_count": min(1.0, _num(behavior.get("micro_pause_count", row.get("micro_pause_count"))) / 12.0),
        "field_focus_switching": min(1.0, _num(behavior.get("field_focus_switching", row.get("field_focus_switching"))) / 10.0),
        "spec_open_depth": min(1.0, _num(behavior.get("spec_open_depth", row.get("spec_open_depth"))) / 6.0),
        "compare_trigger_count": min(1.0, _num(behavior.get("compare_trigger_count", row.get("compare_trigger_count"))) / 6.0),
        "media_engagement_count": min(1.0, _num(behavior.get("media_engagement_count", row.get("media_engagement_count"))) / 8.0),
        "faq_expand_count": min(1.0, _num(behavior.get("faq_expand_count", row.get("faq_expand_count"))) / 6.0),
        "cart_add_then_price_check": min(1.0, _num(behavior.get("cart_add_then_price_check", row.get("cart_add_then_price_check"))) / 3.0),
        "shipping_cost_visibility": min(1.0, _num(behavior.get("shipping_cost_visibility", row.get("shipping_cost_visibility"))) / 6.0),
        "checkout_entry_count": min(1.0, _num(behavior.get("checkout_entry_count", row.get("checkout_entry_count"))) / 4.0),
        "payment_method_hover": min(1.0, _num(behavior.get("payment_method_hover", row.get("payment_method_hover"))) / 8.0),
        "time_on_price_area": min(1.0, _num(behavior.get("time_on_price_area", row.get("time_on_price_area", row.get("time_on_price")))) / 20.0),
        "session_depth": min(1.0, _num(behavior.get("session_depth", row.get("session_depth"))) / 10.0),
        # Derived
        "friction_score": min(1.0, _num(derived.get("friction_score", row.get("friction_score")))),
        "hesitation_score": min(1.0, _num(derived.get("hesitation_score", row.get("hesitation_score")))),
        "research_depth_score": min(1.0, _num(derived.get("research_depth_score", row.get("research_depth_score")))),
        "purchase_momentum_score": min(1.0, _num(derived.get("purchase_momentum_score", row.get("purchase_momentum_score")))),
        # Baseline-normalized
        "normalized_mouse_jitter": min(1.5, max(0.0, _num(normalized.get("normalized_mouse_jitter", row.get("normalized_mouse_jitter"))) / 10.0)),
        "normalized_scroll_speed": min(1.5, max(0.0, _num(normalized.get("normalized_scroll_speed", row.get("normalized_scroll_speed"))))),
        "normalized_pause_behavior": min(1.5, max(0.0, _num(normalized.get("normalized_pause_behavior", row.get("normalized_pause_behavior"))))),
        "baseline_active": 1.0 if bool(normalized.get("baseline_active", row.get("baseline_active"))) else 0.0,
        # Context
        "input_type_mouse": 1.0 if input_type == "mouse" else 0.0,
        "input_type_touch": 1.0 if input_type == "touch" else 0.0,
        "input_type_keyboard": 1.0 if input_type == "keyboard" else 0.0,
        "input_type_mixed": 1.0 if input_type == "mixed" else 0.0,
        "network_latency_low": 1.0 if net == "low" else 0.0,
        "network_latency_medium": 1.0 if net == "medium" else 0.0,
        "network_latency_high": 1.0 if net == "high" else 0.0,
        "battery_saver_on": 1.0 if battery == "on" else 0.0,
    }


def fetch_sessions_from_supabase(url: str, key: str, limit: int) -> pd.DataFrame:
    import requests

    base = url.rstrip("/")
    endpoint = f"{base}/rest/v1/sessions"
    params = {
        "select": "*",
        "order": "created_at.desc",
        "limit": str(limit),
    }
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }

    resp = requests.get(endpoint, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if not isinstance(data, list):
        raise ValueError("Supabase response is not a list of sessions")

    return pd.DataFrame(data)


def load_sessions(args: argparse.Namespace) -> pd.DataFrame:
    if args.csv:
        return pd.read_csv(args.csv)

    supabase_url = args.supabase_url or os.environ.get("SUPABASE_URL")
    supabase_key = args.supabase_key or os.environ.get("SUPABASE_KEY")
    if not supabase_url or not supabase_key:
        raise ValueError("Provide --csv OR Supabase creds (--supabase-url/--supabase-key or env vars).")

    return fetch_sessions_from_supabase(supabase_url, supabase_key, args.limit)


def prepare_training_frame(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        raise ValueError("No sessions available for training")

    work = df.copy()
    work["classified_action"] = work.get("classified_action", "default").fillna("default")
    work["outcome"] = work.get("outcome", "left").fillna("left")
    work["outcome_detail"] = work.get("outcome_detail", "{}").apply(_parse_jsonish)

    rows = []
    for _, row in work.iterrows():
        action = str(row.get("classified_action", "default"))
        if action not in ACTIONS:
            action = "default"

        detail = row.get("outcome_detail") or {}
        policy = detail.get("policy") if isinstance(detail, dict) else {}
        policy = policy if isinstance(policy, dict) else {}

        reward = compute_reward(row.get("outcome"), detail)
        feat = normalize_row(row)
        feat["action"] = action
        feat["reward"] = reward
        logged_propensity = _num(
            policy.get("propensity"),
            _num(row.get("policy_propensity"), 1.0 / len(ACTIONS)),
        )
        feat["logged_propensity"] = float(np.clip(logged_propensity, 1e-3, 1.0))
        feat["abstained"] = 1 if bool(policy.get("abstained")) else 0
        rows.append(feat)

    prepared = pd.DataFrame(rows)
    if prepared.empty:
        raise ValueError("Prepared training frame is empty")

    return prepared


def train_offline_policy(prepared: pd.DataFrame, random_state: int) -> TrainingOutput:
    X = prepared[FEATURES].astype(np.float32)
    weights = prepared["reward"].astype(np.float32)

    model_out: Dict[str, Any] = {
        "version": 1,
        "trained_samples": int(len(prepared)),
        "lr": 0.03,
        "l2": 0.0003,
        "actions": {},
    }

    metrics: Dict[str, Any] = {
        "samples": int(len(prepared)),
        "actions": {},
    }

    # Holdout split only for metrics.
    idx_train, idx_test = train_test_split(
        np.arange(len(prepared)),
        test_size=0.2,
        random_state=random_state,
        stratify=prepared["action"],
    )

    X_train = X.iloc[idx_train]
    X_test = X.iloc[idx_test]
    w_train = weights.iloc[idx_train]

    for action in ACTIONS:
        y = (prepared["action"] == action).astype(np.int32)
        y_train = y.iloc[idx_train]
        y_test = y.iloc[idx_test]

        # If action is too rare, keep neutral weights.
        if y_train.nunique() < 2 or y_train.sum() < 8:
            model_out["actions"][action] = {
                "b": 0.0,
                **{k: 0.0 for k in FEATURES},
            }
            metrics["actions"][action] = {
                "auc": None,
                "positives_train": int(y_train.sum()),
                "note": "insufficient positives",
            }
            continue

        clf = LogisticRegression(
            solver="liblinear",
            max_iter=800,
            random_state=random_state,
        )
        clf.fit(X_train, y_train, sample_weight=w_train)

        probs = clf.predict_proba(X_test)[:, 1]
        auc = float(roc_auc_score(y_test, probs)) if y_test.nunique() > 1 else None

        action_weights = {name: float(val) for name, val in zip(FEATURES, clf.coef_[0])}
        action_weights["b"] = float(clf.intercept_[0])

        model_out["actions"][action] = action_weights
        metrics["actions"][action] = {
            "auc": auc,
            "positives_train": int(y_train.sum()),
        }

    auc_values = [m["auc"] for m in metrics["actions"].values() if m.get("auc") is not None]
    metrics["macro_auc"] = float(np.mean(auc_values)) if auc_values else None

    return TrainingOutput(model=model_out, metrics=metrics)


def save_outputs(output: TrainingOutput, out_model: str, out_metrics: str) -> None:
    os.makedirs(os.path.dirname(out_model), exist_ok=True)
    with open(out_model, "w", encoding="utf-8") as f:
        json.dump(output.model, f, indent=2)

    with open(out_metrics, "w", encoding="utf-8") as f:
        json.dump(output.metrics, f, indent=2)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train offline policy seed from real sessions.")
    parser.add_argument("--csv", type=str, default="", help="Path to sessions CSV export.")
    parser.add_argument("--supabase-url", type=str, default="", help="Supabase project URL.")
    parser.add_argument("--supabase-key", type=str, default="", help="Supabase anon/service key.")
    parser.add_argument("--limit", type=int, default=20000, help="Max sessions to fetch from Supabase.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed.")
    parser.add_argument(
        "--out-model",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "models", "offline_online_model_seed.json"),
        help="Output JSON path for model seed.",
    )
    parser.add_argument(
        "--out-metrics",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "models", "offline_online_model_metrics.json"),
        help="Output JSON path for metrics.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    sessions = load_sessions(args)
    prepared = prepare_training_frame(sessions)
    output = train_offline_policy(prepared, random_state=args.seed)
    save_outputs(output, args.out_model, args.out_metrics)

    print("=" * 64)
    print("EmotionUI Offline Policy Training")
    print("=" * 64)
    print(f"Input sessions:    {len(sessions):,}")
    print(f"Training samples:  {len(prepared):,}")
    print(f"Model output:      {args.out_model}")
    print(f"Metrics output:    {args.out_metrics}")
    print(f"Macro AUC:         {output.metrics.get('macro_auc')}")


if __name__ == "__main__":
    main()
