# EmotionUI Improvement Execution Backlog

Updated: 2026-03-09

Source inputs:
- `PROJECT_ARCHITECTURE_SPEC.md`
- live MVP tuning sessions from the current iteration
- the functional analysis provided in the thread

Purpose:
- convert the current analysis into an execution backlog tied to real files
- separate "already exists partially" from "not implemented yet"
- give a concrete order of work for moving from current performance to a more stable `90%+` runtime

## 1. Current baseline

Operational baseline right now:
- live MVP accuracy is closer to `~90%` in recent validation sessions
- extension architecture is still the main source of truth
- adaptation latency target remains `2-3s`
- current strength is stable state behavior
- current weakness is still transition quality and edge-case pacing

Non-goals for this phase:
- no end-to-end rewrite to ML-first state inference
- no expansion of the state space beyond the current 8 canonical states
- no increase in policy action granularity beyond `SILENT / OBSERVE / INTERVENE`

## 2. Principles for execution

1. Keep the extension pipeline as the source of truth.
2. Keep the system rule-first for now; ML remains assistive.
3. Prefer instrumentation and replayability over blind tuning.
4. Target transition errors before steady-state accuracy.
5. Never degrade latency just to gain marginal state accuracy.

## 3. Current implementation notes before touching anything

These points matter because the code already covers part of the analysis:

- SPA route handling already exists in `chrome-extension/content.js`
  - `pushState`
  - `replaceState`
  - `popstate`
  - route debounce
- Recency signals already exist in `chrome-extension/pipeline/featureExtractor.js`
  - current implementation is fixed-window/count-based
  - the missing piece is better decay behavior, not recency introduction
- Intermediate reward is partially present in `chrome-extension/background.js`
  - `review_dwell_over_10s`
  - `intervention_accepted`
- The background policy decision path is separated from Supabase save calls
  - the remaining risk is repeated storage reads for model access, not network blocking inside decide

## 4. Workstream A — State Accuracy

### A1. Replace fixed recency windows with explicit decay curves

Status:
- partially implemented conceptually
- not implemented as true decay yet

Files:
- `chrome-extension/pipeline/featureExtractor.js`
- `chrome-extension/config.js`
- `demo/live-mvp.js`

Current behavior:
- recent signals are built from event counts inside fixed windows
- windows are currently `15000ms` for most commercial/research signals and `10000ms` for friction

Required change:
- add per-signal decay helpers
- compute weighted recency scores from event timestamps, not only window counts
- preserve backward-compatible count fields for debugging

Suggested parameters:
- decision/commercial half-life: `15-20s`
- research half-life: `18-24s`
- friction half-life: `8-10s`

Acceptance:
- exported payload includes both count-based and decayed recency scores
- `decision_ready` drops faster after commerce stops
- research resurgence wins earlier when user returns to specs/reviews/description
- no regression in live MVP on `commerce -> research -> commerce`

### A2. Add transition-pair disambiguators

Status:
- not explicit yet

Files:
- `chrome-extension/pipeline/reasonCodeEngine.js`
- `chrome-extension/pipeline/stateClassifier.js`
- `demo/live-mvp.js`

Target confusion pairs:
- `EXPLORING <-> DEEP_RESEARCH`
- `PRICE_SENSITIVE <-> REASSURANCE_SEEKING`
- `FRUSTRATED <-> OVERWHELMED`

Required change:
- define pair-specific discriminators
- route them as named reason codes or delta helpers

Examples:
- research skim pattern:
  - rapid section shifts with repeated return to specs/reviews
- reassurance loop:
  - price -> trust/reviews -> price pattern
- overload vs frustration:
  - cognitive-load pattern requires breadth/noise, not just dead clicks

Acceptance:
- each confusion pair has at least one explicit disambiguation feature or reason code
- timeline exports show why one side of the pair won
- false `OVERWHELMED` spikes reduce on simple research

### A3. Add session phase awareness

Status:
- not implemented

Files:
- `chrome-extension/pipeline/stateClassifier.js`
- `chrome-extension/pipeline/featureExtractor.js`
- `demo/live-mvp.js`

Required change:
- introduce a lightweight `session_phase`
- phase options can remain simple:
  - `arrival`
  - `exploration`
  - `evaluation`
  - `late_session`

Use:
- weight overview/exploring higher early
- weight decision/friction higher later
- weight deep research higher in mid-session after multiple section confirmations

Acceptance:
- phase value is exposed in `context_metrics` or `policy debug`
- state transitions feel earlier and more correct without raising flicker

## 5. Workstream B — Latency and Stability

### B1. Add per-stage timing instrumentation

Status:
- not implemented

Files:
- `chrome-extension/content.js`
- `chrome-extension/pipeline/outcomeLogger.js`
- `demo/live-mvp.js`

Required change:
- time each major pipeline stage:
  - collector snapshot
  - page context extraction
  - feature extraction
  - reason code analysis
  - state classification
  - rule evaluation
  - adaptation mapping
  - hysteresis stabilization
  - action resolution

Log:
- stage durations in ms
- total decision-cycle duration
- worst stage

Acceptance:
- each exported session contains timing breakdown
- able to identify any stage consistently over `500ms`

### B2. Make hysteresis asymmetric for negative states

Status:
- not implemented

Files:
- `chrome-extension/pipeline/hysteresisGuard.js`
- `chrome-extension/config.js`

Current behavior:
- dwell/stability thresholds are mostly symmetric

Required change:
- lower entry friction for:
  - `FRUSTRATED`
  - `OVERWHELMED`
- keep stricter exit rules away from those states

Suggested shape:
- faster promotion into negative states
- slower decay out unless evidence clearly improves

Acceptance:
- frustration or overload can surface within the `2-3s` target
- mode flicker does not increase on recovery transitions

### B3. Cache policy model in memory in background worker

Status:
- not implemented

Files:
- `chrome-extension/background.js`

Current behavior:
- policy model is accessed through storage-backed getters

Required change:
- initialize in-memory model cache once
- write-through cache on learn/reset
- fall back to storage only when cache is cold or invalid

Acceptance:
- no storage lookup on every `EMOTIONUI_POLICY_DECIDE`
- no behavior change in returned policy format

## 6. Workstream C — PDP Gate and Coverage

### C1. Verify SPA gate re-evaluation on real client-side navigation

Status:
- infrastructure exists
- behavior needs validation

Files:
- `chrome-extension/content.js`
- `chrome-extension/pipeline/pdpGate.js`

Current behavior:
- SPA route hooks exist
- route debounce exists

Required change:
- validate that soft navigations actually:
  - reset collector correctly
  - refresh PDP gate
  - reload session profile
  - restart tracking only when appropriate

Acceptance:
- route change from listing to PDP via client-side navigation produces a new PDP gate decision
- route change away from PDP stops adaptive runtime cleanly

### C2. Convert `UNSURE` into passive collect mode

Status:
- not implemented

Files:
- `chrome-extension/content.js`
- `chrome-extension/pipeline/pdpGate.js`
- `chrome-extension/pipeline/outcomeLogger.js`

Required change:
- when PDP gate says `UNSURE`:
  - collect passive structure/session data
  - do not apply UI adaptation
  - log uncertainty metadata for gate analysis

Acceptance:
- `UNSURE` pages generate analyzable payloads
- no adaptive overlays/actions are rendered in `UNSURE`

### C3. Log gate decisions for false-positive / false-negative analysis

Status:
- partial diagnostics exist

Files:
- `chrome-extension/pipeline/outcomeLogger.js`
- `supabase/schema.sql`
- `supabase/migrate_v2.sql`

Required change:
- ensure PDP verdicts for non-trackable or unsure routes are retained in a useful analyzable shape
- include:
  - path summary
  - host
  - verdict
  - score
  - reasons
  - compact structural metrics

Acceptance:
- can query gate verdict distribution in Supabase
- can inspect unknown site patterns without re-running the session

## 7. Workstream D — Policy Learning

### D1. Add denser intermediate rewards

Status:
- partially implemented

Files:
- `chrome-extension/background.js`
- `chrome-extension/config.js`

Already present:
- reward for `review_dwell_over_10s`
- reward for `intervention_accepted`

Required additions:
- small positive reward for deep non-bounce exploration
- small positive reward for tolerated intervention exposure
- optional reward for meaningful section exploration or strong page depth

Guardrail:
- intermediate rewards must never outweigh purchase/checkout reward

Acceptance:
- more sessions produce non-zero learning signal
- running reward is less sparse and less biased toward pure silence

### D2. Improve attribution from simple windowing to recency-weighted credit

Status:
- not implemented

Files:
- `chrome-extension/pipeline/outcomeLogger.js`
- `chrome-extension/background.js`

Current behavior:
- attribution is reward-window based with exposure delay checks

Required change:
- support weighted credit between `OBSERVE` and `INTERVENE` within the same reward window
- more recent action gets more credit
- stronger action can get more weight if timings are close

Acceptance:
- outcome logging exposes weighted attribution fields
- policy learning uses better credit assignment than crude last-touch logic

### D3. Add epsilon decay

Status:
- not implemented

Files:
- `chrome-extension/background.js`
- `chrome-extension/config.js`

Current behavior:
- static epsilon

Required change:
- make epsilon decay with trained sample count
- keep a floor value

Suggested shape:
- start around `0.25-0.30`
- decay toward `0.05`

Acceptance:
- exported policy debug includes effective epsilon
- exploration rate drops with training progression

### D4. Define global prior vs per-domain adaptation strategy

Status:
- design task, not immediate implementation

Files:
- `chrome-extension/background.js`
- `ml/train_offline_policy.py`
- `PROJECT_ARCHITECTURE_SPEC.md`

Required change:
- define future split between:
  - global prior model
  - site/domain fine-tuning

Acceptance:
- documented design decision
- not required for immediate MVP tuning

## 8. Workstream E — Explainability, Replay, and Dataset Quality

### E1. Add session quality score

Status:
- not implemented

Files:
- `chrome-extension/pipeline/outcomeLogger.js`
- `demo/live-mvp.js`

Required change:
- compute `session_quality_score`
- include factors such as:
  - number of meaningful state transitions
  - intervention exposure
  - positive outcomes
  - amount of informative behavior

Use:
- prioritize sessions for review and offline training

Acceptance:
- every exported session has quality score and quality factors

### E2. Turn reason codes into user-facing explanations

Status:
- not implemented

Files:
- `chrome-extension/pipeline/reasonCodeEngine.js`
- `chrome-extension/pipeline/actionResolver.js`
- `sdk/src/ur.js`

Required change:
- add explanation builder that maps reason codes to readable text
- use it in transparency surfaces

Acceptance:
- active adaptations can be explained without exposing internal code names directly

### E3. Build session replay viewer

Status:
- not implemented

Files:
- `demo/`
- likely new file such as `demo/replay.html`
- likely new file such as `demo/replay.js`

Required change:
- load exported session/timeline JSON
- render:
  - state transitions
  - reason codes
  - signal spikes
  - mode changes
  - outcome events

Acceptance:
- can inspect a session visually without manual JSON reading

### E4. Add operator annotation flow for wrong classifications

Status:
- not implemented

Files:
- `demo/replay.js`
- `demo/admin.html`
- optionally `supabase/`

Required change:
- allow operator notes on timeline slices
- mark:
  - wrong state
  - expected state
  - why it was wrong

Acceptance:
- annotated sessions can be exported for future ML labeling or rules analysis

## 9. Workstream F — Cross-runtime convergence

### F1. Define SDK parity checklist

Status:
- not implemented

Files:
- new checklist document
- `sdk/src/`
- `PROJECT_ARCHITECTURE_SPEC.md`

Minimum parity target:
- canonical states
- semantic tags
- reason codes
- hysteresis
- outcome logging

Acceptance:
- clear list of which extension features are required before SDK is commercially usable

### F2. Turn live MVP into regression harness

Status:
- partially exists via manual scenarios

Files:
- `demo/live-mvp.js`
- new test fixture JSON files under `demo/fixtures/` or similar

Required change:
- replay known session patterns
- compare actual outputs with expected state sequences

Acceptance:
- regression scenarios exist for:
  - `commerce -> research -> commerce`
  - `research -> frustration burst`
  - `price -> reassurance`
  - start-of-page calm vs exploring

## 10. Workstream G — Config operational safety

### G1. Tier config parameters by risk

Status:
- not implemented

Files:
- `chrome-extension/config.js`
- new config ops document

Required change:
- assign config fields to:
  - `Tier 1 Critical`
  - `Tier 2 Tunable`
  - `Tier 3 Stable`

Acceptance:
- tuning decisions become safer and easier to review

### G2. Add config version/hash to session payload

Status:
- not implemented

Files:
- `chrome-extension/config.js`
- `chrome-extension/content.js`
- `chrome-extension/pipeline/outcomeLogger.js`
- `demo/live-mvp.js`

Required change:
- generate config version or stable hash
- attach it to every session/timeline export

Acceptance:
- can correlate session behavior changes to config revisions

## 11. Execution order

### P1 — Do first
- A1. Recency decay curves
- B2. Asymmetric hysteresis
- B1. Per-stage timing instrumentation
- E1. Session quality score
- C2. `UNSURE -> passive collect`

### P2 — Do next
- A2. Transition-pair disambiguators
- D1. Denser intermediate rewards
- D3. Epsilon decay
- C3. Gate decision logging
- E2. User-facing explanations

### P3 — After the above stabilizes
- A3. Session phase awareness
- D2. Recency-weighted attribution
- E3. Session replay viewer
- F2. Live MVP regression harness
- G1. Config tiering
- G2. Config version/hash

### P4 — Strategic layer
- D4. Global prior vs per-domain strategy
- F1. SDK parity checklist
- E4. Annotation workflow

## 12. Recommended next sprint

If only one short sprint is available, implement exactly these 5 items:

1. Recency decay curves
2. Asymmetric hysteresis
3. Per-stage timing instrumentation
4. Session quality score
5. `UNSURE` passive collection

Why:
- they improve accuracy, latency visibility, and dataset quality without rewriting architecture
- they create better diagnostics for every later decision

## 13. Definition of done for this phase

This phase is done when all conditions below are true:

- live MVP remains at or above current practical accuracy
- transition behavior improves on known weak flows
- timing breakdown is visible in exported sessions
- `UNSURE` pages produce useful passive data
- policy model receives denser learning signal
- session replay/debugging quality is improved through better logging quality

## 14. What must remain unchanged in this phase

- keep rule-first state inference
- keep the 8-state canonical contract
- keep `SILENT / OBSERVE / INTERVENE`
- keep the extension as the implementation source of truth
- do not replace heuristics with ML-first state inference yet
