# Final State Mode Intervention Matrix

This document freezes the current semantic contract for the Adaptive State Tracker runtime.

Principle:

`behavioral signals -> primary_state -> affect_tag + intent_tag + constraint_tags -> ui_mode -> intervention_type`

The goal is to keep state inference human-readable while keeping UI adaptation deterministic and explainable.

## Matrix

| Primary State | Affect Tag | Intent Tag | Constraint Tags | Default UI Mode | Default Intervention | What It Means |
| --- | --- | --- | --- | --- | --- | --- |
| `CALM_BROWSING` | `CALM` | `EXPLORING` | none | `STANDARD` | `none` | Light browsing, low tension, no meaningful blocker. |
| `EXPLORING` | `CALM` | `EXPLORING` | none | `STANDARD` | `none` | Scanning variants, images, overview, still forming direction. |
| `DEEP_RESEARCH` | `UNCERTAIN` | `DEEP_RESEARCH` | `INFO_CONSTRAINT` | `RESEARCH_MODE` | `research_assist` | Reading specs, reviews, and description to reduce uncertainty. |
| `PRICE_SENSITIVE` | `UNCERTAIN` | `PRICE_EVALUATION` | `PRICE_CONSTRAINT` | `PRICE_ALERT_MODE` | `price_reassurance` | The user is evaluating cost, financing, discount, or value pressure. |
| `REASSURANCE_SEEKING` | `UNCERTAIN` | `DEEP_RESEARCH` | `TRUST_CONSTRAINT` | `NEGOTIATOR_MODE` | `value_reassurance` | The user wants confirmation on trust, warranty, seller, return, delivery, or “is this safe to buy?” |
| `FRUSTRATED` | `FRUSTRATED` | `EXPLORING` | `FRICTION_CONSTRAINT` | `DESIGN_OXYGEN` | `friction_relief` | Interaction friction is dominating: dead clicks, rage clicks, jitter, repeated failed attempts. |
| `OVERWHELMED` | `OVERWHELMED` | `EXPLORING` | `COGNITIVE_LOAD_CONSTRAINT` | `SPOTLIGHT_MODE` | `focus_guidance` | There is too much noise, too many competing stimuli, or too much task load at once. |
| `DECISION_READY` | `CONFIDENT` | `DECISION_READY` | none | `EXPRESS_LANE` | `express_checkout` | The user has regained direction and is ready to commit or move through checkout. |

## Deterministic Rules

1. `primary_state` is the main inference output.
2. `affect_tag`, `intent_tag`, and `constraint_tags` are semantic tags, not separate UI policies.
3. `ui_mode` is derived from `primary_state`, then adjusted by rules and hysteresis.
4. `intervention_type` is derived from `ui_mode`, unless a rule explicitly overrides it.
5. `reason_codes` explain why the state was selected; they must not replace the classifier.

## Transition Expectations

These are the transitions that must feel correct in live MVP tuning:

1. `PRICE_SENSITIVE -> DEEP_RESEARCH`
2. `DEEP_RESEARCH -> DECISION_READY`
3. `DEEP_RESEARCH -> PRICE_SENSITIVE`
4. `DEEP_RESEARCH -> FRUSTRATED`
5. `EXPLORING -> DEEP_RESEARCH`
6. `EXPLORING -> PRICE_SENSITIVE`
7. `FRUSTRATED -> DEEP_RESEARCH`
8. `OVERWHELMED -> RESEARCH_MODE or STANDARD` after simplification

## UI Notes

The current runtime keeps existing UI modes for implementation continuity:

- `STANDARD`
- `RESEARCH_MODE`
- `PRICE_ALERT_MODE`
- `NEGOTIATOR_MODE`
- `DESIGN_OXYGEN`
- `SPOTLIGHT_MODE`
- `EXPRESS_LANE`

This preserves the current extension and MVP while giving us a stable semantic layer above it.

## Compliance Position

This matrix is framed as `behavioral-state adaptive UI`, not biometric emotion recognition.

- `primary_state` = interaction state
- `affect_tag` = lightweight affective interpretation
- `intent_tag` = interaction goal
- `constraint_tags` = what is blocking or shaping progress

No biometric input is required for this contract.
