# Adaptive UI Contract

This is the official contract for adaptive UI behavior in EmotionUI.

It exists to keep the product aligned with the original concept:
- adaptive PDP UI
- local-first adaptation
- state detection in service of UI help, not analytics for its own sake
- no arbitrary full-page redesign on every state fluctuation

## 1. Official MVP state scope

These are the only official MVP states:

- `CALM_BROWSING`
- `EXPLORING`
- `DEEP_RESEARCH`
- `PRICE_SENSITIVE`
- `REASSURANCE_SEEKING`
- `FRUSTRATED`
- `OVERWHELMED`
- `DECISION_READY`

Not officialized in MVP:

- `CART_BUILDING`
- `SAVE_FOR_LATER`
- `LOYALTY`
- `PASSIVE_IDLE`
- `COMPARISON` as a standalone state

Those can exist later as derived scenarios, not as canonical state expansion right now.

## 2. Intervention levels

Every visible adaptation must fit one of these levels:

- `SILENT`
  - no visible mutation
  - tracking and inference only
- `EMPHASIS`
  - no structural rewrite
  - only local emphasis, grouping, anchors, subtle focus
- `ASSIST`
  - local helper UI is allowed
  - summaries, shortcuts, trust/value blocks, declutter, guided access
- `ACCELERATE`
  - allowed only with strong commercial intent
  - compress path to action, simplify buy box, strengthen CTA context

## 3. State-to-level mapping

| State | User need | Intervention level |
|------|------|------|
| `CALM_BROWSING` | orientation | `SILENT` |
| `EXPLORING` | wayfinding | `EMPHASIS` |
| `DEEP_RESEARCH` | clarity | `ASSIST` |
| `PRICE_SENSITIVE` | value explained | `ASSIST` |
| `REASSURANCE_SEEKING` | trust | `ASSIST` |
| `FRUSTRATED` | recovery | `ASSIST` |
| `OVERWHELMED` | simplification | `ASSIST` |
| `DECISION_READY` | frictionless action | `ACCELERATE` |

## 4. Zone-first rule

The page is `local-first`.

- Adaptation lands in the active zone first.
- Abandoned zones should not keep receiving upgrades.
- If the current focus is outside the allowed zone family for a state, the local visible adaptation is suppressed instead of being teleported into another zone.

Official zone families:

- `overview`
- `variants`
- `purchase`
- `research`
- `compare`

## 5. Allowed and forbidden behavior by state

### `CALM_BROWSING`

Allowed:
- passive observation
- very light local focus hints

Forbidden:
- checkout push
- price takeover
- global relayout

### `EXPLORING`

Allowed:
- quick navigation
- section emphasis
- compare scaffolding

Forbidden:
- checkout push
- price takeover
- global relayout

### `DEEP_RESEARCH`

Allowed:
- research summaries
- review highlights
- specs summary
- trust and delivery facts
- quick navigation inside research

Forbidden:
- checkout push
- fake urgency
- global relayout

### `PRICE_SENSITIVE`

Allowed:
- price clarity
- installment framing
- shipping / return clarity
- value comparison

Forbidden:
- fake urgency
- research takeover
- global relayout

### `REASSURANCE_SEEKING`

Allowed:
- trust rail
- review quotes
- seller / return / warranty clarity
- social proof framing

Forbidden:
- discount blast
- fake urgency
- global relayout

### `FRUSTRATED`

Allowed:
- help strip
- blocker highlight
- recovery shortcuts
- declutter

Forbidden:
- sales push
- urgency
- promo takeover

### `OVERWHELMED`

Allowed:
- declutter
- summary cards
- focus mode
- chunking

Forbidden:
- extra noise
- multi-action push
- visual stimulation increase

### `DECISION_READY`

Allowed:
- sticky CTA
- buy-box compression
- selected variant summary
- checkout shortcuts
- delivery / return / rate clarity near CTA

Forbidden:
- research takeover
- promo spam
- global relayout

## 6. Priority scenarios to operationalize first

We are not productizing every adaptive scenario at once.

The first 3 priority scenarios are:

1. `RESEARCH_HEAVY`
   - state family: `DEEP_RESEARCH`
   - target help: research shortcuts, summaries, reduced noise

2. `VALUE_CLARITY`
   - state family: `PRICE_SENSITIVE`, `REASSURANCE_SEEKING`
   - target help: price clarity, trust clarity, delivery / return clarity, installment clarity

3. `DECISION_ACCELERATION`
   - state family: `DECISION_READY`
   - target help: simplified buy box, clean CTA support, selection summary, path compression

Other states remain supported, but are treated as supporting scenarios, not the first commercialization focus.

## 7. Guardrails

- Maximum one major visible adaptation at a time
- No layout-wide jump for every small state fluctuation
- No `ACCELERATE` without strong commercial evidence
- No commercial push in `FRUSTRATED`
- No early commercial push in `DEEP_RESEARCH`
- Global adaptation is reserved for `DESIGN_OXYGEN` and `SPOTLIGHT_MODE`
- Any major adaptation should be explainable and reversible

## 8. Runtime model

The runtime decision model should be understood as:

1. infer `state`
2. resolve `intervention level`
3. resolve `active zone`
4. verify zone is allowed by the contract
5. apply visible adaptation only if the contract allows it

This is why a state alone is not enough.

The visible mutation must always be justified by:
- state
- user need
- intervention level
- zone

## 9. Success criteria

We do not measure success only by state accuracy.

We also care about:

- fit between state and visible adaptation
- reduced noise in research
- reduced hesitation in price / reassurance states
- cleaner purchase path in decision-ready states
- low annoyance / low false adaptation

## 10. Implementation status

This contract is now reflected in:

- [uiAdaptationContract.js](/Users/vaduvageorge/Projects/emotionui/chrome-extension/pipeline/uiAdaptationContract.js)
- [live-mvp.js](/Users/vaduvageorge/Projects/emotionui/demo/live-mvp.js)

The live MVP now exposes:

- official intervention level
- priority scenario key
- user need
- zone suppression when a state tries to adapt outside its allowed zone family
