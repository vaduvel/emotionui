# EmotionUI Implementation Plan

Updated: 2026-03-06

Purpose:
- Merge `round 1` and `round 2` feedback into one executable plan.
- Keep only the items that are technically sound and aligned with the current product direction.
- Make the implementation order explicit, so we do not jump randomly between architecture, tuning, and experimentation.

Scope:
- Chrome extension
- multi-site
- Supabase stays
- no heavy RL
- no big-bang rewrite

---

## 0. Decision Summary

These are the final decisions after reviewing both rounds of feedback.

### ACCEPT
- Data hygiene + anti-contamination
- Stronger PDP gate
- State-first architecture
- `Policy = WHEN`, `Mapper = WHAT`
- De-sticky modes / explicit research regain
- Extended logging for debug and analytics
- Incremental refactor only

### ACCEPT WITH MODIFICATION
- New state taxonomy
- Hysteresis improvements
- Page-context expansion
- Lightweight mode support logic

### REJECT
- background.js state buffer
- global `requestAnimationFrame` rewrite for all listeners
- heavy RL / policy gradient in extension runtime

### POSTPONE
- reward based on state transitions
- advanced personalization
- deep UI transformations

---

## 1. Current State of the Codebase

### Already implemented
- `pipeline/dataCollector.js`
- `pipeline/featureExtractor.js`
- `pipeline/pageContextExtractor.js`
- `pipeline/stateClassifier.js`
- `pipeline/hysteresisGuard.js`
- `pipeline/actionResolver.js`
- background policy bootstrap / logging
- dismiss cooldown
- attribution basics
- SPA route guard
- anti-contamination started
- stronger PDP gating started
- `R_RESEARCH_REGAIN` started

### Still problematic
- `content.js` is still too large and mixes too many responsibilities
- current state taxonomy is still too business-heavy
- listing/search detection is better, but still needs a formal gate verdict
- commercial modes can still dominate too long
- logging is rich, but not yet mapper-centered
- reward attribution still leaks meaning in edge cases

---

## 2. Canonical Architecture We Are Moving Toward

Target pipeline:

`pdpGate -> collect -> extract -> state -> mapper -> policy -> rules/safety -> hysteresis -> ui -> logging`

Interpretation:
- `pdpGate`: decide if the page is a real PDP worth tracking
- `collect`: raw interaction signals
- `extract`: normalized features + derived scores
- `state`: infer human-centered behavioral/affective state
- `mapper`: decide desired UI mode + intervention type
- `policy`: decide whether to act now (`SILENT/OBSERVE/INTERVENE`)
- `rules/safety`: business and safety overrides only
- `hysteresis`: stability, anti-flicker, de-escalation
- `ui`: render assist/highlights/cards
- `logging`: save full reasoning chain

Core principle:
- The model should primarily infer user state.
- UI mode should be derived from that state.
- Rules should override only when needed, not define the whole system.

---

## 3. Canonical State Taxonomy v2

This is the recommended state set to implement next.

- `CALM_BROWSING`
- `EXPLORING`
- `DEEP_RESEARCH`
- `PRICE_SENSITIVE`
- `REASSURANCE_SEEKING`
- `FRUSTRATED`
- `OVERLOADED`
- `DECISION_READY`

Notes:
- do not keep `EXPRESS_BUYER` as a primary state label
- do not keep `NEGOTIATION_READY` as a primary canonical state
- business-heavy states are replaced by more human-centered ones

State mapping intent:
- `PRICE_SENSITIVE` = price attention / repeated price checks / value tension
- `REASSURANCE_SEEKING` = needs trust, guarantees, delivery clarity, lower risk
- `DEEP_RESEARCH` = specs/reviews/faq/description depth
- `DECISION_READY` = strong progression signals, not just raw checkout text

---

## 4. Exact Implementation Order

This is the implementation order that should be followed.

Do not skip steps.
Do not jump to RL or advanced reward shaping before these are complete.

### Phase 0: Finish Data Hygiene

Goal:
- ensure the model is not learning from garbage

Tasks:
1. Mark all EmotionUI-owned nodes with `data-emotionui="1"`
2. Keep universal contamination filtering for:
   - clicks
   - hovers
   - dwell
   - dead clicks
   - CTA intent
3. Log extension UI events separately:
   - `extension_ui_click`
   - `intervention_close`
   - `intervention_accept`
4. Confirm these extension events do not feed:
   - features
   - scores
   - state classifier
   - checkout/cart inference

Status:
- `IMPLEMENTED`

Why first:
- nothing downstream matters if the signal is self-contaminated

---

### Phase 1: Formal PDP Gate

Goal:
- stop training and inference on listing/search/category pages

Tasks:
1. Create formal PDP gate module:
   - `TRACKABLE_PDP`
   - `UNSURE`
   - `NOT_PDP`
2. Add gate score and reasons
3. Include positive evidence:
   - structured product markers
   - strong PDP path
   - single main H1
   - primary price
   - main CTA
   - review/spec blocks
4. Include negative evidence:
   - search/query params
   - listing filters / sort controls
   - many product cards
   - repeated PDP links
   - generic category headings
5. If verdict is not `TRACKABLE_PDP`:
   - stop decision pipeline
   - log gate verdict only

Status:
- `IMPLEMENTED`

Dependency:
- Phase 0 should be clean first

---

### Phase 2: Replace State Layer with Taxonomy v2

Goal:
- move from mixed business labels to true behavioral-emotional proxy states

Tasks:
1. Create `state/canonicalStates.js`
2. Refactor `stateClassifier.js` to output only taxonomy v2 states
3. Keep scores per state
4. Keep reasons per state
5. Remove business-heavy labels from primary inference path

Implementation note:
- old labels can still exist temporarily in compatibility mapping if needed for logs
- but canonical output should be v2 only

Status:
- `IMPLEMENTED`

Why now:
- this is the conceptual pivot that keeps the project aligned with EmotionUI

---

### Phase 3: Introduce Deterministic Adaptation Mapper

Goal:
- cleanly separate state inference from UI adaptation

Tasks:
1. Create `mapper/adaptationMapper.js`
2. Input:
   - canonical state
   - state scores
   - page context
   - selected derived scores
   - selected feature signals
3. Output:
   - `mapped_mode`
   - `mapped_intervention_type`
   - `mapper_reasons`
4. Policy stays responsible only for:
   - `SILENT`
   - `OBSERVE`
   - `INTERVENE`
5. Mapper becomes the single source of truth for:
   - what UI mode we want
   - what intervention type we want

Status:
- `IMPLEMENTED`

Dependency:
- Phase 2 must exist first

---

### Phase 4: Recalibrate Stability and De-Sticky Logic

Goal:
- fix commercial modes sticking too long

Tasks:
1. Keep `HysteresisGuard`, do not replace it
2. Recalibrate by mode family:
   - research
   - commercial
   - friction
3. Add stronger exit conditions:
   - `PRICE_ALERT_MODE -> RESEARCH_MODE`
   - `NEGOTIATOR_MODE -> RESEARCH_MODE`
4. Use sustained research signals:
   - review dwell
   - spec dwell
   - review/spec revisits
   - lower price attention
   - lower CTA pressure
5. If needed, add lightweight support-score logic inside hysteresis
   - do not create a large parallel state machine unless clearly necessary

Status:
- `IMPLEMENTED, NEEDS FINAL CALIBRATION`

Why after mapper:
- de-escalation should happen on mapped modes, not on mixed legacy logic

---

### Phase 5: Rules Become Safety Overrides

Goal:
- stop using rules as the main intelligence layer

Tasks:
1. Keep only high-value rules:
   - frustration override
   - strict price override
   - research regain override
   - express safety override
2. Refactor rules so they:
   - read canonical state
   - read mapper output
   - read scores
3. Rules should only:
   - force intervention
   - block intervention
   - force mode downgrade / upgrade in obvious cases
4. Rules should not remain the primary mode-selection engine

Status:
- `IMPLEMENTED WITH GUARDS`

Dependency:
- Phase 2 + Phase 3 first

---

### Phase 6: Logging Upgrade

Goal:
- make every decision debuggable end-to-end

Required fields to add or standardize:
- `pdp_gate_verdict`
- `pdp_gate_score`
- `pdp_gate_reasons`
- `detected_state`
- `state_scores`
- `state_confidence`
- `mapped_mode`
- `mapped_intervention_type`
- `mapper_reasons`
- `mode_before`
- `mode_after`
- `mode_change_reason`
- `was_ui_contaminated`
- `filtered_extension_ui_event_count`
- `previous_state`
- `new_state`

Status:
- `IMPLEMENTED`

Why:
- without this, threshold tuning becomes guesswork

---

### Phase 7: Attribution and Reward Hygiene

Goal:
- improve learning quality without premature RL complexity

Tasks:
1. Keep attribution window
2. Distinguish:
   - outcome after exposure
   - unrelated later outcome
   - outcome after quick dismiss
3. Track:
   - intervention exposure timestamp
   - close/accept timing
   - outcome timing
4. Reward shaping should continue to use:
   - wishlist
   - add_to_cart
   - checkout_started
   - purchase_completed
   - review_dwell_over_10s
5. Do NOT yet reward based on state transitions

Status:
- `IMPLEMENTED, NEEDS FINAL CALIBRATION`

Dependency:
- better logging first

---

### Phase 8: Structural Refactor

Goal:
- reduce `content.js` to a thin orchestrator

Target modules to create:
- `collector/uiContaminationFilter.js`
- `collector/pdpGate.js`
- `state/canonicalStates.js`
- `mapper/adaptationMapper.js`
- `rules/RulesResolver.js`
- `policy-client/PolicyClient.js`
- `logging/OutcomeLogger.js`

End state:
- `content.js` only wires modules together

Status:
- `PARTIAL, CORE MODULES EXTRACTED`

Important:
- this should happen after behavior is stable enough
- do not do this as a big-bang rewrite

---

### Phase 9: Restore the Original EmotionUI Product Layers

Goal:
- recover the parts of the original EmotionUI vision that are still underrepresented in the current extension

Tasks:
1. add a real dynamic style layer
   - adaptive design tokens
   - visual density changes
   - calm/focus/value styling by state
2. add a real adaptive layout layer
   - reorder or compress noisy sections
   - promote specs/reviews/value blocks contextually
   - simplify fast-buy paths without hiding trust-critical information
3. formalize the UR / transparency layer
   - detected state
   - why UI changed
   - keep / revert / pause / reset controls
4. preserve SDK-compatible thinking
   - do not hard-code all adaptation logic as extension-only assumptions

Status:
- `PENDING, RESTORE AFTER BEHAVIOR CALIBRATION`

Why this matters:
- without this phase, the project risks becoming only a strong behavioral inference engine
- with this phase, it stays aligned with the original EmotionUI concept:
  - signal -> state -> adaptive UI -> transparent user control

---

### Phase 10: Freeze the State/Tag/Mapper Contract

Goal:
- formalize the final semantic contract between ML, mapper, logging, and UI

Tasks:
1. freeze `primary_state` as:
   - `CALM_BROWSING`
   - `EXPLORING`
   - `DEEP_RESEARCH`
   - `PRICE_SENSITIVE`
   - `REASSURANCE_SEEKING`
   - `FRUSTRATED`
   - `OVERWHELMED`
   - `DECISION_READY`
2. add first-class derived tags:
   - `emotion_tag`
   - `intent_tag`
   - `constraint_tags`
3. define one source-of-truth mapper table:
   - `primary_state -> ui_mode -> intervention_type`
4. log this contract explicitly in all saved outcomes

Status:
- `IMPLEMENTED, MATRIX FROZEN`

Reference:
- `/Users/vaduvageorge/Projects/emotionui/final_state_mode_intervention_matrix.md`

Why this matters:
- it closes the ontology gap
- it makes round 4 compatible with the existing state-first architecture

---

### Phase 10A: Live MVP Calibration Loop

Goal:
- tune timing and UI adaptation on a live visual surface, not only from popup/debug logs

Tasks:
1. use `/Users/vaduvageorge/Projects/emotionui/demo/live-mvp.html` as the main calibration harness
2. drive the real pipeline through:
   - price
   - favorite
   - add to cart
   - buy now
   - variant switching
   - section routing (`description/specs/reviews/faq`)
3. validate:
   - enters the right state
   - exits the right state
   - re-enters the right next state
   - adaptive UI changes are not too early / too late / too abrupt / too sticky
4. only after the MVP behavior feels right, compare the same behavior on real PDP pages

Status:
- `IMPLEMENTED HARNESS, READY FOR REFINEMENT`

Reference:
- `/Users/vaduvageorge/Projects/emotionui/demo/live-mvp.html`
- `/Users/vaduvageorge/Projects/emotionui/demo/live-mvp.js`

Why this matters:
- popup/debug-only fine tuning was the wrong loop
- the correct loop is feeling adaptive UI behavior live, then refining the engine against that experience

---

### Phase 11: Add State Definition-of-Done and Reason Code Standard

Goal:
- make state inference explainable and calibratable with stable reason codes

Tasks:
1. define DoD per state:
   - entry logic
   - exit logic
   - negative tests
2. define reason code families:
   - `FRICTION`
   - `LOAD`
   - `NAV`
   - `RESEARCH`
   - `TRUST`
   - `PRICE`
   - `CTA`
   - `CHECKOUT`
3. log max 3 top reason codes per inference
4. use DoD only as calibration/audit guidance, not as hardcoded copied thresholds

Status:
- `IMPLEMENTED FOUNDATION, NEEDS CURATED EXPANSION`

Why this matters:
- it keeps the system debuggable after personalization
- it prevents future tuning from becoming ad hoc and inconsistent

---

### Phase 12: Implement Reason Code Engine Bootstrap

Goal:
- introduce a controlled fine-tuning layer that improves explainability and small score corrections without replacing the state model

Tasks:
1. create `reasonCodeEngine`
2. implement only a curated subset of reason codes based on existing telemetry
3. produce:
   - top 3 `reason_codes`
   - `emotion_tag`
   - `intent_tag`
   - `constraint_tags`
   - small `primary_state` score adjustments
4. log these fields in:
   - popup
   - saved outcomes
   - debug payloads
5. keep weights conservative and calibratable

Status:
- `IMPLEMENTED BOOTSTRAP`

Why this matters:
- this is the main `round 5` layer
- it closes the loop between raw behavior and explainable state changes

---

### Phase 13: Close the Internal Calibration Loop

Goal:
- stop adding architecture and move to deterministic refinement

Tasks:
1. build a manual scenario matrix:
   - calm browse
   - deep research
   - price sensitive
   - reassurance seeking
   - frustrated
   - overwhelmed
   - decision ready
2. compare:
   - expected state
   - observed state
   - expected mode
   - observed mode
   - expected intervention
   - observed intervention
3. tune only:
   - hysteresis
   - rules precedence
   - mapper thresholds
   - reason code deltas
4. freeze a stable internal version

Status:
- `PENDING`

Why this matters:
- this is the last serious refine step before external users

---

### Phase 14: External Pilot Readiness

Goal:
- prepare the extension to learn safely from a small user cohort

Tasks:
1. confirm:
   - no session loss
   - no self-contamination
   - no PDP false positives blocking the pipeline
   - no absurd mode/action combos
2. keep detailed logs on:
   - `primary_state`
   - tags
   - reasons
   - mode
   - intervention
3. release to a small external group first
4. review drift before broad rollout

Status:
- `PENDING`

Why this matters:
- external users should train the model only after the semantic contract is stable

---

## 5. What Must Be Tested After Each Phase

### After Phase 0
- dismiss on overlay should not create fake commerce intent
- extension buttons should not pollute click targets

### After Phase 1
- listing/search/category pages should not track as PDP
- real PDP pages should still track correctly

### After Phase 2
- canonical state output should make sense on:
  - fast bounce
  - deep reviews/specs
  - price checking
  - frustration

### After Phase 3
- mapper should choose reasonable intervention type for each canonical state

### After Phase 4
- system should move back from commercial mode to research mode when user truly resumes research

### After Phase 5
- rules should appear as exceptions, not as the main brain

### After Phase 6-7
- logs should tell the full story of:
  - gate
  - state
  - mapped mode
  - policy
  - override
  - final UI
  - attribution

### After Phase 10
- each session should produce a coherent:
  - `primary_state`
  - `emotion_tag`
  - `intent_tag`
  - `constraint_tags`
  - `mapped_mode`
  - `mapped_intervention_type`

### After Phase 11
- top 3 reason codes should explain state changes without contradicting the final mapped mode
- deterministic replay sessions should activate the intended state and reject close false positives

### After Phase 12
- `emotion_tag`, `intent_tag`, and `constraint_tags` should be coherent with the final `primary_state`
- reason code deltas should help edge cases without causing mode thrash

### After Phase 13
- expected behavior traces from internal manual sessions should match the predicted states closely enough to justify external pilot

### After Phase 14
- external pilot should reveal mostly calibration issues, not architectural failures

---

## 6. What We Explicitly Do NOT Do Now

Do not do these now:
- heavy RL
- policy gradient training in extension runtime
- background.js rolling state buffer
- massive global `requestAnimationFrame` rewrite
- deep DOM transformation engine
- user-level personalization before state logic is stable
- reward based on state transitions before taxonomy is stable
- hardcode round 4 thresholds verbatim without calibration on our data

---

## 7. Practical Next Action

If resuming after the current implementation pass, the next step is no longer architecture work.

The next step is:

1. run controlled manual sessions
2. compare predicted state vs real user intent
3. tune:
   - `research regain`
   - price/commercial stickiness
   - safety policy upgrades
   - mapper thresholds
4. refine adaptive UI presentation using real behavior traces

This is now the critical path.

---

## 8. Final Principle

The project should remain:

`behavior -> inferred human-centered state -> adaptive UI`

Not:

`behavior -> commerce rule -> mode`

If future changes violate this principle, they should be treated as architectural regressions.
