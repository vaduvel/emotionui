# EmotionUI (Behavioral-State Adaptive UI)

Behavioral-state adaptive UI toolkit for e-commerce. Infers interaction states from on-page signals and adapts the interface in real time without biometric inputs in EU-safe mode.

## Architecture

5 layers, all processing on-device:

1. **Sensory** — Tracks mouse jitter, rage clicks, dwell time, exit intent, scroll patterns
2. **State Inference Engine** — Rule-based classifier + optional ML model for behavioral states
3. **Design Tokens** — Maps interaction states to CSS custom properties
4. **Adaptive Layout** — Modifies page structure per interaction state
5. **UR (User Rights)** — Transparency widget showing what was detected

## Behavioral States

| Rule | State | Weight | Trigger |
|------|-------|--------|---------|
| R_EXPRESS | EXPRESS_LANE | 0.88 | Direct checkout |
| R_PRICE | PRICE_ALERT_MODE | 0.90 | Price hover + cart abandons + repeat visits |
| R_FRUSTRATION | DESIGN_OXYGEN | 0.85 | Rage clicks or jitter + scroll thrash |
| R_HESITANT | NEGOTIATOR_MODE | 0.82 | Exit intent + abandons/price hover |
| R_RESEARCH | RESEARCH_MODE | 0.75 | Spec dwell or many product views |
| R_CONFUSED | SPOTLIGHT_MODE | 0.78 | Long dwell or dead clicks |
| R_NIGHT | EDITORIAL_MODE | 0.60 | Late + mobile + new visitor |

## Quick Start

```bash
# 1. Train ML model
pip3 install -r ml/requirements.txt
python3 ml/train.py
python3 ml/quantize.py

# 2. Build SDK
cd sdk && npm install && npm run build

# 3. Run demo
# Open demo/index.html in browser
```

## Offline Pipeline (Real Sessions)

Train a policy seed from real sessions (not synthetic) and export weights compatible
with the extension online model:

```bash
# Option A: train from Supabase directly
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_KEY="<anon-or-service-key>"
python3 ml/train_offline_policy.py --limit 20000

# Option B: train from CSV export
python3 ml/train_offline_policy.py --csv /path/to/sessions.csv
```

Outputs:
- `ml/models/offline_online_model_seed.json`
- `ml/models/offline_online_model_metrics.json`

Evaluate a policy safely in shadow mode (no live challenger) using IPS/SNIPS/DM/DR:

```bash
# Evaluate packaged extension policy seed against logged sessions
python3 ml/evaluate_policy_offline.py --limit 30000

# Or evaluate from CSV export
python3 ml/evaluate_policy_offline.py --csv /path/to/sessions.csv
```

Output:
- `ml/models/offline_policy_ope_report.json`

Notes:
- Extension logs policy metadata (`propensity`, `entropy`, `margin`, `abstained`, `action_probs`)
  under `outcome_detail.policy` to keep compatibility with the current `sessions` schema.

## Smart-But-Safe Behavioral Layer (Extension)

The Chrome extension now includes an incremental behavioral layer designed to improve
state prediction without breaking compatibility or introducing aggressive live risk.

### New behavioral metrics (raw)

- Friction: `repeat_click_same_target`, `dead_click_rate`, `error_loop_count`, `backtrack_rate`, `retry_rate`, `time_to_first_action`
- Hesitation: `hover_to_click_latency`, `scroll_reversal_count`, `micro_pause_count`, `field_focus_switching`
- Research: `spec_open_depth`, `compare_trigger_count`, `media_engagement_count`, `faq_expand_count`
- Purchase intent: `cart_add_then_price_check`, `shipping_cost_visibility`, `checkout_entry_count`, `payment_method_hover`, `time_on_price_area`
- Context: `input_type`, `network_latency_bucket`, `battery_saver_mode_if_available`, `session_depth`

### Derived deterministic scores

- `friction_score`
- `hesitation_score`
- `research_depth_score`
- `purchase_momentum_score`

These are computed deterministically with bounded ranges and robust fallbacks when
some signals are unavailable.

### Baseline normalization

Session-local baseline normalization is applied (when enough samples exist) for:

- mouse jitter behavior
- scroll speed behavior
- pause behavior

Fallback: if baseline is not ready, the model uses raw-safe values (`baseline_active=false`).

### Mode stability / anti-flicker

The live decision layer adds:

- cooldown between mode switches
- minimum persistence before switch
- hysteresis (entry vs exit confidence behavior)
- evidence support gate by derived scores
- safe fallback to current/default mode when uncertain

### User respect guard

- Popup button: **Reset current mode**
- If user resets the same mode 2 times in one session, that mode is temporarily suppressed
  for the rest of that session.
- Logged as negative intervention feedback in `outcome_detail.policy.reset_feedback`.

### Logging compatibility

No schema change required. New information is logged under `outcome_detail.policy`:

- `derived_scores`
- `normalized_metrics`
- `behavior_metrics`
- `stability` (blocked reason, switch reason, cooldown status, suppressed modes)
- `reset_feedback`

## Project Structure

```
emotionui/
├── sdk/          # JavaScript SDK (5 layers)
├── demo/         # Product page demo + admin dashboard
├── ml/           # Training pipeline (RF + MLP → ONNX)
├── supabase/     # Database schema for session collection
└── .env.example  # Configuration template
```

## Compliance Notes

- Zero data leaves the device during browsing (only anonymized session summary at end)
- Transparency widget always visible when adaptation is active
- EU-safe mode disables biometric and wearable inputs in the production extension
- No fake urgency patterns (countdown timers, fake scarcity) — blocked by design
- User can reset to standard view at any time
