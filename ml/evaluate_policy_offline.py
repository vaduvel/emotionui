"""
EmotionUI — Offline Policy Evaluation (IPS / SNIPS / DM / DR)

Evaluates a target policy model against logged sessions without deploying it live.
This is designed for "shadow" safety checks before any policy change.
"""

from __future__ import annotations

import argparse
import json
import os
from typing import Any, Dict, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split

from train_offline_policy import ACTIONS, FEATURES, load_sessions, prepare_training_frame


DEFAULT_GATE = {
    "softmax_temperature": 1.15,
    "min_confidence": 0.44,
    "min_margin": 0.08,
    "max_entropy": 0.9,
}


def _softmax(vals: np.ndarray, temperature: float) -> np.ndarray:
    t = max(0.05, float(temperature))
    z = vals / t
    z = z - np.max(z)
    e = np.exp(z)
    s = np.sum(e)
    if s <= 0:
        return np.ones_like(e) / len(e)
    return e / s


def _entropy_norm(probs: np.ndarray) -> float:
    p = probs[probs > 0]
    if p.size == 0:
        return 1.0
    h = -np.sum(p * np.log(p))
    return float(h / np.log(len(probs)))


def _validate_model_shape(model: Dict[str, Any]) -> None:
    if not isinstance(model, dict) or "actions" not in model:
        raise ValueError("Invalid model JSON: missing 'actions'")
    for a in ACTIONS:
        if a not in model["actions"]:
            raise ValueError(f"Invalid model JSON: missing action '{a}'")


def load_policy_model(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        model = json.load(f)
    _validate_model_shape(model)
    return model


def policy_decision(model: Dict[str, Any], x_row: Dict[str, float], gate: Dict[str, float]) -> Dict[str, Any]:
    logits = []
    for a in ACTIONS:
        w = model["actions"][a]
        z = float(w.get("b", 0.0))
        for k in FEATURES:
            z += float(w.get(k, 0.0)) * float(x_row.get(k, 0.0))
        logits.append(z)

    logits_np = np.array(logits, dtype=np.float64)
    probs = _softmax(logits_np, gate["softmax_temperature"])

    rank_idx = np.argsort(probs)[::-1]
    top_idx = int(rank_idx[0])
    second_idx = int(rank_idx[1]) if len(rank_idx) > 1 else int(rank_idx[0])

    top_prob = float(probs[top_idx])
    margin = float(probs[top_idx] - probs[second_idx])
    entropy = _entropy_norm(probs)

    top_action = ACTIONS[top_idx]
    should_abstain = (
        top_action != "default"
        and (
            top_prob < gate["min_confidence"]
            or margin < gate["min_margin"]
            or entropy > gate["max_entropy"]
        )
    )

    chosen_action = "default" if should_abstain else top_action

    pi = {a: 0.0 for a in ACTIONS}
    pi[chosen_action] = 1.0

    action_probs = {a: float(p) for a, p in zip(ACTIONS, probs)}

    return {
        "chosen_action": chosen_action,
        "pi": pi,
        "action_probs": action_probs,
        "propensity": float(action_probs.get(chosen_action, 0.0)),
        "abstained": bool(should_abstain),
    }


def _build_design(df: pd.DataFrame, action_col: str) -> pd.DataFrame:
    x_num = df[FEATURES].copy()
    a = pd.Categorical(df[action_col], categories=ACTIONS)
    x_a = pd.get_dummies(a, prefix="a")
    x_a = x_a.reindex(columns=[f"a_{a}" for a in ACTIONS], fill_value=0)
    return pd.concat([x_num, x_a], axis=1)


def _predict_q_for_action(model: RandomForestRegressor, x_num: pd.DataFrame, action: str) -> np.ndarray:
    tmp = x_num.copy()
    for a in ACTIONS:
        tmp[f"a_{a}"] = 1.0 if a == action else 0.0
    return model.predict(tmp)


def evaluate(prepared: pd.DataFrame, target_model: Dict[str, Any], seed: int, gate: Dict[str, float]) -> Dict[str, Any]:
    if prepared.empty:
        raise ValueError("No prepared samples available for evaluation")

    data = prepared.copy()
    data = data[data["action"].isin(ACTIONS)].reset_index(drop=True)
    if data.empty:
        raise ValueError("No valid actions found in data")

    train_idx, test_idx = train_test_split(
        np.arange(len(data)),
        test_size=0.3,
        random_state=seed,
        stratify=data["action"],
    )

    train_df = data.iloc[train_idx].reset_index(drop=True)
    test_df = data.iloc[test_idx].reset_index(drop=True)

    x_train_design = _build_design(train_df, "action")
    y_train = train_df["reward"].astype(np.float32)

    q_model = RandomForestRegressor(
        n_estimators=300,
        min_samples_leaf=20,
        random_state=seed,
        n_jobs=-1,
    )
    q_model.fit(x_train_design, y_train)

    x_test_num = test_df[FEATURES].astype(np.float32).reset_index(drop=True)
    logged_action = test_df["action"].astype(str).values
    reward = test_df["reward"].astype(np.float32).values
    logged_prop = np.clip(test_df["logged_propensity"].astype(np.float32).values, 1e-3, 1.0)

    # q_hat(x, a) for every action on test rows
    q_by_action = {a: _predict_q_for_action(q_model, x_test_num, a) for a in ACTIONS}

    dm_terms = []
    ips_terms = []
    dr_terms = []
    weights = []
    policy_actions = []
    abstain_count = 0

    for i in range(len(test_df)):
        row_feat = {k: float(x_test_num.iloc[i][k]) for k in FEATURES}
        dec = policy_decision(target_model, row_feat, gate)
        pi = dec["pi"]
        chosen = dec["chosen_action"]
        policy_actions.append(chosen)
        if dec["abstained"]:
            abstain_count += 1

        q_dm = 0.0
        for a in ACTIONS:
            q_dm += float(pi[a]) * float(q_by_action[a][i])

        pi_logged = float(pi.get(logged_action[i], 0.0))
        w = pi_logged / float(logged_prop[i])
        q_logged = float(q_by_action[logged_action[i]][i])

        ips = w * float(reward[i])
        dr = q_dm + w * (float(reward[i]) - q_logged)

        dm_terms.append(q_dm)
        ips_terms.append(ips)
        dr_terms.append(dr)
        weights.append(w)

    dm_value = float(np.mean(dm_terms))
    ips_value = float(np.mean(ips_terms))
    sum_w = float(np.sum(weights))
    snips_value = float(np.sum(np.array(weights) * reward) / sum_w) if sum_w > 0 else 0.0
    dr_value = float(np.mean(dr_terms))
    logged_value = float(np.mean(reward))

    action_counts = pd.Series(policy_actions).value_counts().to_dict()

    return {
        "n_total": int(len(data)),
        "n_train": int(len(train_df)),
        "n_test": int(len(test_df)),
        "logged_policy_value": logged_value,
        "target_policy_value_ips": ips_value,
        "target_policy_value_snips": snips_value,
        "target_policy_value_dm": dm_value,
        "target_policy_value_dr": dr_value,
        "abstain_rate": float(abstain_count / len(test_df)),
        "target_action_distribution": action_counts,
        "gate": gate,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Offline OPE for EmotionUI policy.")
    parser.add_argument("--csv", type=str, default="", help="Sessions CSV path.")
    parser.add_argument("--supabase-url", type=str, default="", help="Supabase URL.")
    parser.add_argument("--supabase-key", type=str, default="", help="Supabase key.")
    parser.add_argument("--limit", type=int, default=30000, help="Max sessions from Supabase.")
    parser.add_argument(
        "--model",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "..", "chrome-extension", "model-seed.json"),
        help="Target policy model JSON.",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed.")
    parser.add_argument(
        "--out",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "models", "offline_policy_ope_report.json"),
        help="Output report JSON path.",
    )
    parser.add_argument("--temp", type=float, default=DEFAULT_GATE["softmax_temperature"], help="Softmax temperature.")
    parser.add_argument("--min-confidence", type=float, default=DEFAULT_GATE["min_confidence"], help="Abstain min confidence.")
    parser.add_argument("--min-margin", type=float, default=DEFAULT_GATE["min_margin"], help="Abstain min margin.")
    parser.add_argument("--max-entropy", type=float, default=DEFAULT_GATE["max_entropy"], help="Abstain max entropy.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    sessions = load_sessions(args)
    prepared = prepare_training_frame(sessions)
    model = load_policy_model(args.model)

    gate = {
        "softmax_temperature": float(args.temp),
        "min_confidence": float(args.min_confidence),
        "min_margin": float(args.min_margin),
        "max_entropy": float(args.max_entropy),
    }

    report = evaluate(prepared, model, seed=args.seed, gate=gate)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("=" * 64)
    print("EmotionUI Offline Policy Evaluation")
    print("=" * 64)
    print(f"Input sessions:               {len(sessions):,}")
    print(f"Prepared samples:            {len(prepared):,}")
    print(f"Logged policy value:         {report['logged_policy_value']:.4f}")
    print(f"Target value (IPS):          {report['target_policy_value_ips']:.4f}")
    print(f"Target value (SNIPS):        {report['target_policy_value_snips']:.4f}")
    print(f"Target value (DM):           {report['target_policy_value_dm']:.4f}")
    print(f"Target value (DR):           {report['target_policy_value_dr']:.4f}")
    print(f"Abstain rate:                {report['abstain_rate']:.2%}")
    print(f"Report saved:                {args.out}")


if __name__ == "__main__":
    main()
