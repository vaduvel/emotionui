# EmotionUI Backlog: 7 Major Improvements

Updated: 2026-03-06

Purpose:
- Keep the 7 major architecture improvements in one stable file.
- Use this as the resume point after reviewing new session dumps or LLM feedback.
- This file tracks what is already implemented, what is partial, and what is still pending.

Context:
- Source baseline: `llm_feedback.md`, section `GPT + Grok FEEDBACK SUMMARY (apply ALL of these improvements)`
- We intentionally saved only items `1-7` here, because these were the main architecture upgrades we were working through.

---

## 1. Modular Structure

Original goal:
- Break the monolithic `content.js` into proper folders/modules.
- Keep `content.js` as a thin orchestrator.

Target structure:
- `collector/`
- `features/`
- `state/`
- `rules/`
- `policy-client/`
- `ui/`
- `orchestrator/`
- `logging/`

Current status:
- `IMPLEMENTED, STRUCTURE STILL THINNING`

What exists already:
- `chrome-extension/pipeline/dataCollector.js`
- `chrome-extension/pipeline/featureExtractor.js`
- `chrome-extension/pipeline/stateClassifier.js`
- `chrome-extension/pipeline/hysteresisGuard.js`
- `chrome-extension/pipeline/actionResolver.js`
- `chrome-extension/pipeline/rulesResolver.js`
- `chrome-extension/pipeline/policyClient.js`
- `chrome-extension/pipeline/outcomeLogger.js`
- `background.js`

What is still missing:
- `content.js` is still too large and still contains:
  - page gating
  - rule resolution
  - orchestration
  - logging composition
  - popup snapshot payload logic
- We still need a real split into:
  - `rules/RulesResolver.js`
  - `policy-client/PolicyClient.js`
  - `logging/OutcomeLogger.js`
  - thin `content.js`

Resume note:
- This is a structural cleanup item, not the highest-priority behavior fix.

---

## 2. StateClassifier Layer

Original goal:
- Add a state layer between features and policy.
- Make the system reason in terms of user state, not only UI mode.

Current status:
- `IMPLEMENTED`

What exists already:
- `chrome-extension/pipeline/stateClassifier.js`
- Current canonical labels:
  - `CALM_BROWSING`
  - `EXPLORING`
  - `DEEP_RESEARCH`
  - `PRICE_SENSITIVE`
  - `REASSURANCE_SEEKING`
  - `FRUSTRATED`
  - `OVERLOADED`
  - `DECISION_READY`
- `content.js` already injects state into decision/logging.

Main issue:
- The taxonomy is now correct conceptually.
- Remaining work is calibration:
  - reduce overuse of `CALM_BROWSING`
  - improve transition from `PRICE_SENSITIVE/REASSURANCE_SEEKING` back to `DEEP_RESEARCH`

Resume note:
- This is one of the two most important conceptual items.

---

## 3. Hysteresis + Stability Guard

Original goal:
- Prevent flicker.
- Prevent random mode hopping.
- Support cooldown after dismiss.

Current status:
- `IMPLEMENTED, NEEDS FINAL CALIBRATION`

What exists already:
- `chrome-extension/pipeline/hysteresisGuard.js`
- `dismissDomainMs` cooldown in config
- cold-start promotion logic
- mode history logging
- blocked/candidate decision logging

What is still wrong:
- Commercial modes can remain too sticky:
  - `NEGOTIATOR_MODE`
  - `PRICE_ALERT_MODE`
- The system can stay in price/negotiation mode even after sustained reviews/specs behavior.

Recent fixes already added:
- `R_RESEARCH_REGAIN`
- commercial-to-research dwell handling in `hysteresisGuard.js`

Still to tune:
- Separate hysteresis behavior by mode family:
  - commercial modes
  - research modes
  - frustration modes
- Lower stickiness for:
  - `NEGOTIATOR_MODE -> RESEARCH_MODE`
  - `PRICE_ALERT_MODE -> RESEARCH_MODE`

Resume note:
- This is the other main behavior item still active.

---

## 4. Separate `intervention_type` from Base Mode

Original goal:
- Keep action policy simple:
  - `SILENT`
  - `OBSERVE`
  - `INTERVENE`
- But separate concrete UI intervention semantics.

Current status:
- `IMPLEMENTED`

What exists already:
- `intervention_type` mapping in `content.js`
- Current types:
  - `research_assist`
  - `price_reassurance`
  - `value_reassurance`
  - `friction_relief`
  - `focus_guidance`
  - `express_checkout`

What still needs work:
- Better mapping from new future state taxonomy to intervention types.
- Avoid overusing commerce-heavy intervention types when user is actually researching.

Resume note:
- Keep this architecture.
- Do not collapse back to mode-only logic.

---

## 5. Attribution Window + Exposure Logic

Original goal:
- Reduce reward leakage.
- Reward only meaningful post-exposure outcomes.

Current status:
- `IMPLEMENTED, NEEDS TUNING`

What exists already:
- attribution context extracted into `pipeline/outcomeLogger.js`
- fields such as:
  - `exposure_ts`
  - `exposure_delay_ms`
  - `reward_window_ms`
  - `within_reward_window`
  - `recent_exposure_count`
  - `post_action_outcome_delay_ms`
  - `attribution_kind`
  - `assisted_outcome_confidence`
- domain dismiss cooldown

What is still missing:
- Better reward attribution correctness when:
  - user dismisses overlay
  - later performs unrelated actions
  - moves across route/state transitions
- Distinguish:
  - UI-caused positive outcome
  - naturally occurring outcome

Important note:
- We already fixed one contamination source:
  - extension overlay clicks should no longer pollute commerce signals.

Resume note:
- This should be improved before any serious RL attempt.

---

## 6. Page Context Features

Original goal:
- Build a minimal but useful page-context layer.

Current status:
- `IMPLEMENTED EXPANDED VERSION`

What exists already:
- `chrome-extension/pipeline/pageContextExtractor.js`
- current page context summary:
  - `hasPrimaryPrice`
  - `hasDiscountSignal`
  - `hasStickyPurchaseCta`
  - `hasUrgencySignal`
  - `hasInstallmentSignal`
  - `hasReviewDensitySignal`
  - `hasSpecTableSignal`
  - `hasTrustSignal`
  - `hasVariantChoices`
  - `hasCompareAction`
  - `hasShippingSignal`
  - `hasWarrantySignal`
  - `hasPromoCluster`
- current metrics:
  - `primaryActionCount`
  - `secondaryActionCount`
  - `variantOptionCount`
  - `reviewAnchorCount`
  - `promoBlockCount`
  - `infoBlockCount`
  - `pageDensityScore`

What still needs work:
- Better PDP vs listing discrimination
- More page complexity context:
  - `variant_complexity`
  - `number_of_cta_buttons`
  - `multiple_offer_layout`
  - `listing_density`

Recent fix already added:
- tighter `shouldTrackPage()` logic in `content.js`

Resume note:
- This item is not blocked, but still needs expansion.

---

## 7. Refined Rules

Original goal:
- Keep rules narrow, legible, and secondary to state inference + mapping.

Current status:
- `IMPLEMENTED, NEEDS FINAL CALIBRATION`

What exists already:
- `chrome-extension/pipeline/rulesResolver.js`
- `R_EXPRESS`
- `R_PRICE`
- `R_FRUSTRATION`
- `R_HESITANT`
- `R_RESEARCH`
- `R_RESEARCH_REGAIN`
- `R_CONFUSED`

What is still wrong:
- Price/commercial rules can still win too easily in mixed sessions.
- `R_PRICE` and `R_HESITANT` still need stricter recency weighting versus active research.
- Safety upgrades can still be too aggressive in cold-start negotiation scenarios.

Recent fixes already added:
- `purchaseCtaIntentCount` split from `wishlistIntentCount`
- research-active blocking for commercial rules
- `RESEARCH_MODE + INTERVENE -> OBSERVE` guard

Resume note:
- This is now a calibration item, not a missing architecture item.

---

## 8. Restore Original EmotionUI Product Layers

Original goal:
- Preserve the original `EmotionUI` vision from the first drafts:
  - Dynamic Styles
  - Adaptive Layout
  - User Transparency / UR Layer
  - eventual SDK framing

Current status:
- `PARTIAL, PRODUCT LAYERS STILL THIN`

What existed in the early drafts:
- `layer3-dynamic-styles.html`
- `layer4-adaptive-layout.html`
- `layer5-ur-layer.html`
- `emotionui-integrated.html`
- `emotionui-sdk.js`

What is missing today:
- no true `dynamic style layer` driven by state
- no real `adaptive layout engine` beyond overlay/highlight/panel interventions
- no coherent `UR transparency layer` as a product concept
- current implementation is extension-first, while the original concept also supported SDK/product framing

What we should restore:
- state-driven visual token changes:
  - density
  - spacing
  - emphasis
  - calm/focus styling
- layout-level adaptations:
  - reduce noise
  - promote key sections
  - reorder information blocks
  - focus assist for research / value / checkout
- clear user transparency layer:
  - detected state
  - why UI changed
  - keep / revert / pause / reset controls
- preserve the possibility of an SDK/public product direction later

Resume note:
- This is not a blocker for the ML core.
- It is a blocker for staying aligned with the original EmotionUI product vision.

Original goal:
- Make rules reflect behavior more accurately.

Current status:
- `IN PROGRESS`

What exists already:
- `R_EXPRESS`
- `R_PRICE`
- `R_FRUSTRATION`
- `R_HESITANT`
- `R_RESEARCH`
- `R_CONFUSED`
- plus newly added:
  - `R_RESEARCH_REGAIN`

Recent behavior fixes already added:
- extension overlay clicks removed from tracking
- extension UI events counted and logged separately
- commerce action detection restricted to interactive/CTA-like targets
- wishlist/favorite intent separated from purchase CTA intent
- listing/search pages rejected more aggressively
- research regain can override commercial stickiness in some sessions

What still needs work:
- Refine precedence between:
  - `R_HESITANT`
  - `R_PRICE`
  - `R_RESEARCH`
  - `R_RESEARCH_REGAIN`
- Distinguish better between:
  - price sensitivity
  - confusion
  - real checkout urgency
  - research with temporary price checks

Resume note:
- This is the most active logic area after stability tuning.

---

## Resume Priority Order

When we come back to this backlog, resume in this order:

1. Refine `StateClassifier` taxonomy
   - move from mixed business labels to cleaner affective-behavioral states

2. Recalibrate `HysteresisGuard`
   - especially commercial-mode de-escalation into research

3. Refine rules precedence
   - especially `R_HESITANT` vs `R_RESEARCH_REGAIN`

4. Improve attribution logic
   - reward leakage and post-exposure credit assignment

5. Expand page-context features
   - more PDP confidence, more complexity signals

6. Refactor structure
   - thin `content.js`

7. Only after the above:
   - discuss contextual bandit v3 or RL-readiness

---

## Short Resume Summary

The project did NOT lose direction completely.

What is already solid:
- signal collection
- feature extraction
- state layer exists
- intervention type exists
- hysteresis exists
- page context exists

What is still conceptually unresolved:
- the state taxonomy is still too close to purchase intent
- commercial modes can still dominate too long
- rule precedence still needs tuning

Main reminder for future work:
- keep the architecture `state-first`
- do NOT collapse back into a pure funnel/rules engine
- UI mode should be derived from user state, not be the primary learned concept

---

## 9. Formal State/Tag/Mapper Contract

Original goal:
- Freeze the final vocabulary of the system so ML, mapper, logging, and UI all speak the same language.

Current status:
- `IMPLEMENTED, MATRIX FROZEN`

What round 4 clarified:
- primary state should remain a single operational label
- affect, intent, and constraint should be separate tags
- mapper should consume this contract, not invent semantics ad hoc

Target contract:
- `primary_state`
  - `CALM_BROWSING`
  - `EXPLORING`
  - `DEEP_RESEARCH`
  - `PRICE_SENSITIVE`
  - `REASSURANCE_SEEKING`
  - `FRUSTRATED`
  - `OVERWHELMED`
  - `DECISION_READY`
- `emotion_tag`
  - `CALM`
  - `UNCERTAIN`
  - `FRUSTRATED`
  - `OVERWHELMED`
  - `CONFIDENT`
- `intent_tag`
  - `EXPLORING`
  - `DEEP_RESEARCH`
  - `PRICE_EVALUATION`
  - `DECISION_READY`
  - `CHECKOUT_INTENT`
- `constraint_tags`
  - `PRICE_CONSTRAINT`
  - `TRUST_CONSTRAINT`
  - `INFO_CONSTRAINT`
  - `FRICTION_CONSTRAINT`
  - `COGNITIVE_LOAD_CONSTRAINT`

Reference:
- `/Users/vaduvageorge/Projects/emotionui/semantic_contract_matrix.md`

What now exists:
- canonical tags exist in runtime
- `primary_state` now exists explicitly
- mapper carries state-contract metadata
- saved policy debug now includes state-contract fields

What is still missing:
- final freeze of the exact `primary_state -> ui_mode -> intervention_type` matrix
- possible cleanup of legacy UI-mode naming

Resume note:
- This is the cleanest way to keep round 4 aligned with the current codebase without importing speculative psychology.

---

## 10. State DoD + Reason Code Standard

Original goal:
- Make each state auditable, testable, and calibratable without magic thresholds copied from LLM text.

Current status:
- `IMPLEMENTED FOUNDATION, USE AS CALIBRATION SPEC`

What round 4 contributed:
- entry/exit logic per primary state
- negative tests per state
- reason code families for:
  - `FRICTION`
  - `LOAD`
  - `NAV`
  - `RESEARCH`
  - `TRUST`
  - `PRICE`
  - `CTA`
  - `CHECKOUT`

What we should keep:
- DoD format:
  - entry conditions
  - exit conditions
  - negative tests
  - top reason codes
- reason codes as debug/audit artifacts
- log only top 3 reason codes per inference

What we should NOT do:
- copy exact thresholds blindly
- treat all example events as universal across sites
- let reason codes replace the primary state model

Resume note:
- Use this as the final refinement layer after personal behavior mapping, not as a rules dump.

---

## 11. Reason Code Engine Bootstrap

Original goal:
- Add a lightweight scoring/explainability layer that helps close the loop between telemetry and state calibration.

Current status:
- `IMPLEMENTED BOOTSTRAP`

What round 5 clarified:
- reason codes should not replace the state model
- reason codes should:
  - explain state changes
  - add small score deltas
  - support inhibitors
  - support future calibration without rewriting classifier logic

What we should keep:
- a small curated subset of reason codes based on existing telemetry only
- top 3 logged per inference
- additive score deltas with conservative weights
- inhibitors only where conflicts are obvious

What we should NOT do:
- import the full reason-code catalog immediately
- treat the JSON config as the whole brain
- add codes for signals we do not actually instrument yet

Resume note:
- This is the right `round 5` contribution to implement before broader user rollout.

---

## 12. Closing Loops, Replay QA, and External Rollout Readiness

Original goal:
- move from architecture work to refinement loops and rollout discipline

Current status:
- `PENDING AFTER INTERNAL FINE-TUNING`

What still needs to happen:
- deterministic replay / manual scenario QA
- compare predicted state vs expected state
- refine only:
  - hysteresis
  - mapper thresholds
  - reason code deltas
  - rule precedence
- run a small external-user pilot only after internal loops look stable

Resume note:
- This is the final bridge between internal tuning and real user learning.

---

## 13. Live MVP as the Main Fine-Tuning Harness

Original goal:
- stop tuning only from popup payloads and make UI adaptation directly observable

Current status:
- `IMPLEMENTED, NOW THE PRIMARY INTERNAL TUNING SURFACE`

What exists now:
- `/Users/vaduvageorge/Projects/emotionui/demo/live-mvp.html`
- `/Users/vaduvageorge/Projects/emotionui/demo/live-mvp.js`
- real extension pipeline loaded into the MVP
- product hooks for:
  - price interaction
  - favorite
  - add to cart
  - buy now
  - variant switching
  - section routing

What this is for:
- measure whether transitions are:
  - too early
  - too late
  - too sticky
  - too abrupt
- feel the adaptive UI, not only the classifier output

Resume note:
- use this harness before further threshold tuning
- use real PDP pages only as cross-check after the MVP feels right
