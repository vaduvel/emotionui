# EmotionUI Project Architecture Spec

Updated: 2026-03-09

Purpose:
- give one technical entry point for the whole repository
- describe what exists now, not an idealized future version
- explain runtime flow, config, signals, models, storage, and implementation split

This file complements, not replaces:
- `README.md`
- `adaptive_ui_outcome_contract.md`
- `semantic_contract_matrix.md`
- `final_state_mode_intervention_matrix.md`

## 1. What this project is

EmotionUI is a behavioral-state adaptive UI system for e-commerce product pages.

Core idea:
- measure on-page behavioral signals only
- infer a canonical user interaction state
- map that state to a UI mode and intervention type
- adapt the page locally or globally depending on the state
- log the session in an anonymized way for analysis and policy learning

The repo contains multiple implementations of the same idea:
- a simplified SDK in `sdk/`
- a Chrome extension in `chrome-extension/`
- live demos in `demo/`
- ML training pipelines in `ml/`
- Supabase schema/migrations in `supabase/`

## 2. Repository map

### `chrome-extension/`
Production-oriented runtime.

Main files:
- `manifest.json` - MV3 manifest, permissions, content scripts, background worker
- `config.js` - runtime config source of truth for collector, features, hysteresis, policy, rewards
- `content.js` - page runtime orchestrator
- `background.js` - online policy model, reward logic, storage, Supabase save flow
- `popup.html` / `popup.js` - operator/debug popup and side panel
- `model-seed.json` - initial policy seed weights

Pipeline folder:
- `pipeline/dataCollector.js`
- `pipeline/featureExtractor.js`
- `pipeline/pageContextExtractor.js`
- `pipeline/reasonCodeEngine.js`
- `pipeline/pdpGate.js`
- `pipeline/stateClassifier.js`
- `pipeline/adaptationMapper.js`
- `pipeline/rulesResolver.js`
- `pipeline/policyClient.js`
- `pipeline/outcomeLogger.js`
- `pipeline/hysteresisGuard.js`
- `pipeline/actionResolver.js`
- `pipeline/canonicalStates.js`
- `pipeline/stateContract.js`

### `demo/`
Contains local demos and the current live MVP product page.

Important files:
- `live-mvp.html` - adaptive product page demo used for interaction tuning
- `live-mvp.js` - local UI adaptation engine, threshold FSM, live inspector, export tools
- `admin.html` - session dashboard UI
- `assets/model.onnx` and `assets/model.onnx.gz` - ONNX assets used by the simpler demo path

### `sdk/`
Earlier, simpler package version of the system with 5 layers:
- `sensory.js`
- `engine.js`
- `tokens.js`
- `layout.js`
- `ur.js`
- `index.js`

This package is easier to embed but is less advanced than the extension pipeline.

### `ml/`
Training and evaluation code.

Important files:
- `train.py` - synthetic-data RF/MLP state model training and ONNX export
- `quantize.py` - model quantization
- `train_offline_policy.py` - offline policy seed training from real sessions
- `evaluate_policy_offline.py` - offline policy evaluation
- `models/` - exported ONNX and charts

### `supabase/`
Persistence layer definitions.

Files:
- `schema.sql` - base `sessions` table
- `migrate_v2.sql` - additive migration for richer event/policy metadata

## 3. Runtime variants in this repo

There are 3 distinct runtime styles:

### A. SDK runtime
Simple 5-layer implementation:
- Sensory -> rule engine -> design tokens -> adaptive layout -> UR widget

Characteristics:
- lightweight
- easier to read
- supports optional ONNX state model
- mainly for library/demo packaging

### B. Chrome extension runtime
The most complete runtime.

Characteristics:
- runs as a content script on live pages
- includes PDP gating
- richer behavioral metrics
- canonical state contract
- reason codes
- policy model in background worker
- hysteresis and stability control
- session logging and online learning

### C. Live MVP runtime
A local product-page demo used to tune interaction logic and UI adaptation behavior.

Characteristics:
- product page is intentionally commerce-like
- adaptive changes are localized by active zone
- includes inspector, exported session JSON, scenario buttons
- uses a local threshold FSM on top of the same conceptual state contract

Important note:
- `demo/live-mvp.js` is not a byte-for-byte copy of extension runtime logic
- it is a tuning surface that mirrors the semantic contract but has its own presentation pacing logic

## 4. End-to-end extension flow

The Chrome extension runtime is the best source of truth for how the system works.

Flow:

1. `manifest.json`
- loads content scripts on almost all URLs
- excludes hosts like Figma, Claude, ChatGPT, OpenAI, Kaggle

2. `content.js`
- performs early host deny
- constructs the full pipeline
- evaluates PDP eligibility with `PdpGate`
- starts tracking only on product-detail-like pages

3. `dataCollector.js`
- listens to clicks, hover, scroll, viewport section changes, CTA interaction, price interaction
- builds the raw session snapshot
- tracks outcomes like wishlist/add to cart/checkout/intervention accepted/closed

4. `featureExtractor.js`
- converts raw session snapshot into:
  - normalized features
  - derived scores
  - context metrics

5. `pageContextExtractor.js`
- scans DOM and product page surface
- produces page hints like price, reviews, specs, trust, sticky CTA, installments

6. `reasonCodeEngine.js`
- converts behavioral evidence into reason codes and semantic deltas
- affects primary state, affect, intent, and constraint scoring

7. `stateClassifier.js`
- classifies the canonical state
- output includes:
  - `primary_state`
  - `confidence`
  - score distributions
  - affect/intention/constraint tags
  - reason families and codes

8. `rulesResolver.js`
- resolves rule winners such as `R_EXPRESS`, `R_PRICE`, `R_HESITANT`, `R_RESEARCH`
- applies safety upgrades/downgrades over policy decisions

9. `background.js` through `policyClient.js`
- receives feature vector and context
- chooses policy:
  - `SILENT`
  - `OBSERVE`
  - `INTERVENE`
- can learn online from rewards

10. `adaptationMapper.js`
- maps canonical state + rule context + page context into UI mode and intervention type

11. `hysteresisGuard.js`
- stabilizes transitions
- blocks flicker and unstable mode churn

12. `actionResolver.js`
- applies overlays/highlights/assist UI to the live page

13. `outcomeLogger.js`
- packages the final session payload for Supabase
- includes policy, attribution, state, reason, page context, and behavior debug

## 5. What the system measures

The repo mixes raw metrics, normalized metrics, derived scores, semantic tags, and final UI outputs.

### 5.1 Raw behavioral signals

Collected primarily by `chrome-extension/pipeline/dataCollector.js`.

Examples:
- clicks
- rage clicks
- mouse jitter
- dead clicks
- exit intent
- dwell events
- scroll events
- scroll reversals
- max scroll percentage
- cart add/remove
- price hover count
- time on price
- cart abandons
- section switches
- section visits by area
- section dwell ms by area
- click targets
- hover targets
- event log

Tracked outcomes:
- `added_to_wishlist`
- `added_to_cart`
- `checkout_started`
- `purchase_completed`
- `intervention_exposed`
- `intervention_accepted`
- `intervention_closed`
- `review_dwell_over_10s`

### 5.2 Product page context

Extracted by `pageContextExtractor.js`.

Examples:
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

Context metrics:
- primary action count
- secondary action count
- variant option count
- review anchor count
- promo block count
- info block count
- page density score

### 5.3 Normalized metrics

Built by `featureExtractor.js`.

Examples:
- `scrolledPercentage`
- `clickRate`
- `sectionSwitchRate`
- `averageReadingSpeed`
- `reviewFocusRatio`
- `specFocusRatio`
- `researchCoverage`
- `reversalRate`
- `rageClicks`
- `mouseJitter`
- `deadClickRate`
- `exitIntentSignal`
- `priceHoverSignal`
- `cartIntentSignal`
- `checkoutSignal`
- `cartAbandonSignal`
- `purchaseCompleteSignal`
- `policyExposure`
- `wishlistSignal`
- `interventionClosed`
- `reviewReadLong`
- `bounceRisk`

Also includes recency signals:
- `recentDecisionSignal`
- `recentPriceSignal`
- `recentResearchSignal`
- `recentFrictionSignal`
- `sessionCommerceMemorySignal`

### 5.4 Derived deterministic scores

Current important derived scores:
- `friction_score`
- `hesitation_score`
- `research_depth_score`
- `purchase_momentum_score`
- `decision_reengagement_score`
- `negotiation_pressure_score`
- `express_checkout_score`
- `frustration_rebound_score`

These are not learned by a model inside the extension runtime. They are formula-based.

## 6. Canonical states and semantic layer

Canonical state contract lives in:
- `chrome-extension/pipeline/canonicalStates.js`
- `chrome-extension/pipeline/stateContract.js`
- `semantic_contract_matrix.md`
- `final_state_mode_intervention_matrix.md`

Current canonical states:
- `CALM_BROWSING`
- `EXPLORING`
- `DEEP_RESEARCH`
- `PRICE_SENSITIVE`
- `REASSURANCE_SEEKING`
- `FRUSTRATED`
- `OVERWHELMED`
- `DECISION_READY`

Important naming note:
- `chrome-extension/pipeline/canonicalStates.js` normalizes `OVERLOADED` to `OVERWHELMED`
- some files still mention `OVERLOADED` as an older alias
- the semantic state should be treated as `OVERWHELMED`

Each decision can also carry:
- `affect_tag`
- `intent_tag`
- `constraint_tags`
- `reason_codes`
- `reason_families`

The intended interpretation order is:
1. `primary_state`
2. `emotion/affect`
3. `intent`
4. `constraints`
5. UI mode
6. intervention type

## 7. UI modes and interventions

Canonical states do not directly equal UI modes.

Examples:
- `CALM_BROWSING` -> `STANDARD`
- `DEEP_RESEARCH` -> `RESEARCH_MODE`
- `PRICE_SENSITIVE` -> `PRICE_ALERT_MODE`
- `REASSURANCE_SEEKING` -> `NEGOTIATOR_MODE`
- `FRUSTRATED` -> `DESIGN_OXYGEN`
- `OVERWHELMED` -> `SPOTLIGHT_MODE`
- `DECISION_READY` -> `EXPRESS_LANE`

Typical intervention types:
- `none`
- `research_assist`
- `price_reassurance`
- `value_reassurance`
- `friction_relief`
- `focus_guidance`
- `express_checkout`

The local-vs-global adaptation principle is documented in `adaptive_ui_outcome_contract.md`:
- most state changes should adapt only the active zone
- global changes are reserved mainly for frustrated or overloaded states

## 8. Rules vs ML in the current codebase

This repo is not purely ML-driven.

### What is mostly rule-based today

In the extension pipeline:
- `featureExtractor.js` is deterministic
- `pageContextExtractor.js` is deterministic
- `reasonCodeEngine.js` is deterministic
- `stateClassifier.js` is a weighted heuristic score engine
- `rulesResolver.js` is deterministic
- `adaptationMapper.js` is deterministic
- `hysteresisGuard.js` is deterministic

In the live MVP:
- `demo/live-mvp.js` uses a threshold FSM and tie-break logic
- this is strongly rule-based by design

### Where ML exists today

#### A. SDK/demo ONNX state model path

The simpler SDK engine in `sdk/src/engine.js` can optionally load an ONNX model and let ML override rules if ML confidence is higher.

Relevant files:
- `sdk/src/engine.js`
- `demo/assets/model.onnx`
- `demo/assets/model.onnx.gz`
- `ml/train.py`

This path is useful for packaged demos and prototype model inference, but it is not the full extension intelligence stack.

#### B. Extension online policy model

`chrome-extension/background.js` contains a real online policy model.

It does not directly predict canonical state.
It predicts policy/action preference:
- `SILENT`
- `OBSERVE`
- `INTERVENE`

It works as a lightweight linear softmax policy with:
- per-action weights
- epsilon exploration
- confidence thresholds
- online updates based on reward

Key behavior:
- cold start uses heuristic bootstrap when `trained_samples < minSamplesForModelOnly`
- after enough samples, model logits + softmax drive policy choice
- learning updates are applied online from observed rewards

This means:
- state inference is still mostly rules/scores
- policy selection has a real learning component

Legacy artifact note:
- `chrome-extension/model-seed.json` still uses an older action schema such as `default`, `show_price_tools`, `simplify_layout`
- the current v2 online policy model in `chrome-extension/background.js` uses `SILENT`, `OBSERVE`, `INTERVENE`
- background installation currently seeds from `PolicyModel.defaultModel()`, not from `chrome-extension/model-seed.json`

#### C. Offline policy training

`ml/train_offline_policy.py` trains an offline seed compatible with the extension online model.

Input:
- real logged sessions from Supabase or CSV export

Output:
- offline seed model
- metrics JSON

#### D. Synthetic state model training

`ml/train.py` trains RF and MLP models from synthetic samples for the simpler 15-feature state classification path.

Outputs include:
- `emotionui_model.onnx`
- `emotionui_mlp_fp32.onnx`
- `emotionui_mlp_int8.onnx`
- `emotionui_rf50_slim.onnx`
- `emotionui_rf100.onnx`

Important reality check:
- these synthetic models are not the same thing as the current extension state inference path
- current high-accuracy tuning work in the MVP is mainly coming from rules, thresholds, and semantic contracts

## 9. Chrome extension config reference

Primary config source:
- `chrome-extension/config.js`

### `collector`
Controls low-level event capture.

Important keys:
- inactivity timeout
- rage click detection window, distance, cooldown, max per session
- mouse jitter windows and thresholds
- dwell threshold
- price hover minimum ms
- exit intent threshold
- target bucket limits
- section switch stability/debounce
- policy history gap
- event log size

### `feature`
Controls normalization and behavior windowing.

Important keys:
- max clicks per minute
- max section switches per minute
- max reading speed index
- max exposure count
- stable signal minimum session seconds
- max price hover events
- max cart intent events

### `pageContext`
Controls DOM scanning limits and sticky detection thresholds.

### `pdpGate`
Controls whether a page is treated as a valid product page.

Important keys:
- `minTrackableScore`
- `minUnsureScore`
- `maxListingPenaltyForTrackable`
- scan limits for action/listing nodes

### `state`
Currently mainly holds minimum state confidence.

### `hysteresis`
Controls anti-flicker behavior.

Important keys:
- minimum mode dwell
- required stable hits
- min confidence delta
- force confidence delta
- cold start observe/intervene delays
- commercial-to-research promotion allowances
- max history

### `cooldown`
Contains per-domain dismiss cooldown logic.

### `attribution`
Defines reward windows for observe/intervene attribution.

### `decision`
Thresholds used by rulesResolver and decision mapping.

Examples:
- negotiation strong score
- research strong score
- spotlight strong score
- price hover minimum
- price dwell minimum
- CTA intent minimum
- spec dwell research seconds

### `spa`
SPA route handling:
- enabled
- route debounce

### `policy`
Online learning model config.

Keys:
- epsilon exploration
- softmax temperature
- min confidence observe/intervene
- min samples before model-only trust
- learning rate
- L2 regularization

### `compliance`
Safety/compliance flags:
- `euSafeMode`
- `biometricInputsEnabled`
- public tag/tracker naming

### `rewards`
Reward weights for policy learning.

Examples:
- wishlist
- review read
- fast bounce penalty
- intervention closed penalty

### `reasonCodes`
Reason code engine config:
- severity weights
- max reason codes
- max constraint tags
- delta scales
- routing keywords
- per-code windowing/inhibitors/context routing

## 10. PDP gate behavior

`pdpGate.js` tries to prevent tracking/adaptation on non-product pages.

It blocks or downgrades:
- cart
- checkout
- payment
- account/login/register
- wishlist
- search/category/catalog
- support/help
- certain blocked hosts

Signals used:
- URL path shape
- DOM readiness
- structured product markers
- action density
- listing penalties
- PDP-specific text/action patterns

Possible verdicts:
- `TRACKABLE_PDP`
- `UNSURE`
- `NOT_PDP`

## 11. Policy model and reward loop

Implemented mainly in `chrome-extension/background.js`.

### Policy actions
- `SILENT`
- `OBSERVE`
- `INTERVENE`

### Feature vector used by online policy model
- `scrolledPercentage`
- `clickRate`
- `sectionSwitchRate`
- `averageReadingSpeed`
- `reviewFocusRatio`
- `specFocusRatio`
- `researchCoverage`
- `reversalRate`
- `rageClicks`
- `mouseJitter`
- `deadClickRate`
- `exitIntentSignal`
- `priceHoverSignal`
- `cartIntentSignal`
- `checkoutSignal`
- `cartAbandonSignal`
- `purchaseCompleteSignal`
- `policyExposure`
- `wishlistSignal`
- `interventionClosed`
- `reviewReadLong`
- `bounceRisk`

### Rewards
Positive:
- wishlist
- add to cart
- checkout started
- purchase completed
- long review read
- intervention accepted
- timely intervention bonus

Negative:
- cart abandon without checkout/purchase
- prolonged price checking with no checkout
- fast bounce
- intervention closed

Rewards are clipped to `[-1, 1]`.

### Learning behavior
- if policy is still cold, use heuristic bootstrap
- once enough samples exist, use logits + softmax
- learn from reward by adjusting chosen-action weights and softly penalizing others

## 12. Demo and live MVP behavior

### `demo/live-mvp.html`
Commerce-style product page with explicit adaptive zones and slots.

Zones used in the current contract:
- overview
- variants
- purchase
- research
- compare
- benefits
- services

### `demo/live-mvp.js`
Contains:
- live design tokens
- local adaptive layout logic
- zone-aware adaptation
- scenario injection buttons
- local threshold snapshot builder
- threshold-based state FSM
- tie-break logic
- inspector panel
- session/timeline JSON export

Important implementation reality:
- the live MVP is intentionally more inspectable than the extension
- it is used as a tuning harness for transition feel and localized UI behavior

## 13. SDK behavior

The SDK is an earlier, simplified packaged implementation.

Layers:
1. `sdk/src/sensory.js` - browser event capture
2. `sdk/src/engine.js` - rule-based classifier plus optional ONNX model
3. `sdk/src/tokens.js` - CSS variable themes
4. `sdk/src/layout.js` - DOM insert/hide/show logic
5. `sdk/src/ur.js` - transparency widget

`sdk/src/index.js` orchestrates these layers and optionally posts final session payloads to Supabase.

This path is useful when embedding EmotionUI as a lightweight library, but it is less behaviorally rich than the extension runtime.

## 14. Storage and analytics

Supabase schema lives in:
- `supabase/schema.sql`
- `supabase/migrate_v2.sql`

Main table:
- `sessions`

Stored categories:
- identifiers and timestamps
- raw behavioral signals
- outcome and session time
- classified state/action/confidence
- click/hover targets
- funnel stage
- scroll depth/speed
- price time
- form errors
- user_type / traffic_source
- full `outcome_detail` JSONB payload

`outcome_detail.policy` is the main debug envelope and includes:
- policy source
- confidence
- action probabilities
- state metadata
- reason codes/families
- page context
- PDP gate diagnostics
- mode transitions
- attribution context
- derived and normalized metrics
- stability info

## 15. Popup, operator controls, and observability

`chrome-extension/popup.js` exposes runtime state for debugging:
- enable/disable tracking
- open live side panel
- reset current mode
- reset learning model
- clean training start

Displayed debug values include:
- current state
- affect and intent tags
- constraint tags
- reason codes
- previous state/mode
- resolved mode
- intervention type
- funnel stage
- ML source and samples
- baseline status
- PDP gate verdict
- derived score summary
- active section
- cooldown state

## 16. Compliance and safety posture

The project positions itself as behavioral-state adaptive UI, not biometric emotion recognition.

Current safety/compliance posture:
- processing is intended to happen on-device during browsing
- biometric inputs are disabled in EU-safe mode in the extension config
- transparency widget exists in the SDK and analogous visibility exists in demos
- user can reset/suppress modes
- intervention logic is stabilized by hysteresis and cooldown
- non-PDP surfaces should be rejected by the PDP gate

## 17. Existing related docs inside the repo

Use these when tuning semantics or rollout behavior:
- `adaptive_ui_outcome_contract.md`
- `semantic_contract_matrix.md`
- `final_state_mode_intervention_matrix.md`
- `implementation_todo_round1_round2.md`
- `backlog_7_improvements.md`
- `llm_feedback.md`

## 18. Current implementation truth table

If you need the shortest honest summary of the repo:

- SDK path:
  - simple rules first
  - optional ONNX state model

- Extension path:
  - deterministic behavior extraction
  - deterministic semantic state inference
  - deterministic mapping and stability
  - real online policy model for `SILENT/OBSERVE/INTERVENE`

- Live MVP path:
  - deterministic threshold/state pacing
  - localized adaptive UI tuning surface

So, today, EmotionUI is best described as:
- rule-first behavioral intelligence
- ML-assisted policy selection
- optional ML state-model experiments in demo/SDK assets

It is not yet a fully end-to-end ML-first state inference system.

## 19. What should be treated as source of truth

When files disagree, use this order:

1. `chrome-extension/config.js`
2. `chrome-extension/pipeline/*.js`
3. `chrome-extension/content.js`
4. `chrome-extension/background.js`
5. `adaptive_ui_outcome_contract.md`
6. `semantic_contract_matrix.md`
7. `demo/live-mvp.js`
8. `README.md`

Rationale:
- extension runtime is the richest and most current implementation
- MVP is intentionally tuned for iteration and may diverge
- README and older SDK files are useful, but they are not always the newest behavior source
