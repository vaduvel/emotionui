# EmotionUI Semantic Contract Matrix

Updated: 2026-03-07

Purpose:
- Freeze the current semantic contract in one readable file.
- Keep one shared source of truth for internal refinement.
- Align runtime behavior with the original EmotionUI direction.

Runtime source of truth:
- `/Users/vaduvageorge/Projects/emotionui/chrome-extension/pipeline/stateContract.js`

Interpretation order:
1. `primary_state`
2. `emotion_tag`
3. `intent_tag`
4. `constraint_tags`
5. `ui_mode`
6. `intervention_type`

---

## Matrix

| Primary State | Emotion Tag | Intent Tag | Constraint Tags | UI Mode | Intervention Type | Reason Families |
| --- | --- | --- | --- | --- | --- | --- |
| `CALM_BROWSING` | `CALM` | `EXPLORING` | `[]` | `STANDARD` | `none` | `NAV` |
| `EXPLORING` | `CALM` | `EXPLORING` | `[]` | `STANDARD` | `none` | `NAV`, `RESEARCH` |
| `DEEP_RESEARCH` | `UNCERTAIN` | `DEEP_RESEARCH` | `INFO_CONSTRAINT` | `RESEARCH_MODE` | `research_assist` | `RESEARCH`, `TRUST` |
| `PRICE_SENSITIVE` | `UNCERTAIN` | `PRICE_EVALUATION` | `PRICE_CONSTRAINT` | `PRICE_ALERT_MODE` | `price_reassurance` | `PRICE`, `CTA` |
| `REASSURANCE_SEEKING` | `UNCERTAIN` | `DEEP_RESEARCH` | `TRUST_CONSTRAINT` | `NEGOTIATOR_MODE` | `value_reassurance` | `TRUST`, `RESEARCH` |
| `FRUSTRATED` | `FRUSTRATED` | `EXPLORING` | `FRICTION_CONSTRAINT` | `DESIGN_OXYGEN` | `friction_relief` | `FRICTION`, `NAV` |
| `OVERLOADED` | `OVERWHELMED` | `EXPLORING` | `COGNITIVE_LOAD_CONSTRAINT` | `SPOTLIGHT_MODE` | `focus_guidance` | `LOAD`, `NAV` |
| `DECISION_READY` | `CONFIDENT` | `DECISION_READY` | `[]` | `EXPRESS_LANE` | `express_checkout` | `CTA`, `CHECKOUT` |

---

## Interpretation Notes

### 1. `primary_state` is the ML-facing canonical label
- The classifier should optimize for this label first.
- Mapper and rules operate on top of it.

### 2. `emotion_tag` is a compressed affective label
- It is not a literal psychological diagnosis.
- It is a stable behavior-derived proxy.

Allowed values:
- `CALM`
- `UNCERTAIN`
- `FRUSTRATED`
- `OVERWHELMED`
- `CONFIDENT`

### 3. `intent_tag` describes task orientation

Allowed values:
- `EXPLORING`
- `DEEP_RESEARCH`
- `PRICE_EVALUATION`
- `DECISION_READY`
- `CHECKOUT_INTENT`

### 4. `constraint_tags` describe what blocks progress

Allowed values:
- `PRICE_CONSTRAINT`
- `TRUST_CONSTRAINT`
- `INFO_CONSTRAINT`
- `FRICTION_CONSTRAINT`
- `COGNITIVE_LOAD_CONSTRAINT`

### 5. `ui_mode` is runtime-facing
- Existing runtime mode names are preserved for compatibility.
- They may later gain friendlier semantic aliases, but runtime should stay stable during refinement.

### 6. `intervention_type` is the concrete UI behavior
- This remains the cleanest hook for adaptive UI implementation.

Allowed values right now:
- `none`
- `research_assist`
- `price_reassurance`
- `value_reassurance`
- `friction_relief`
- `focus_guidance`
- `express_checkout`

---

## Practical Mapping Rules

### Research should beat commerce when research is sustained
- If active section is `reviews`, `specs`, or `description` for long enough,
- and research depth is dominant,
- the system should prefer:
  - `DEEP_RESEARCH`
  - `RESEARCH_MODE`
  - `research_assist`

### Price interest should not dominate forever
- `PRICE_SENSITIVE` is valid for:
  - repeated price hover
  - voucher/installment checking
  - favorite/cart-value uncertainty
- It should give way when the session becomes clearly informational.

### `REASSURANCE_SEEKING` is not a commerce hack
- It means the user needs confidence:
  - review proof
  - seller trust
  - warranty/returns/shipping clarity
- It should not always force stronger commercial pressure.

### `DECISION_READY` is confidence + action readiness
- It should require stronger progression than a single CTA hover.
- This is the most sensitive state and should remain conservative.

---

## Scope Boundary

This matrix defines:
- semantic state contract
- affective and intent labels
- constraint taxonomy
- expected UI mapping

This matrix does not define:
- final thresholds
- final hysteresis values
- final reason code weights
- final adaptive layout behaviors

Those are refinement tasks after internal testing.
