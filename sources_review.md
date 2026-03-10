# Round 6 Source Review

Date: 2026-03-10
Scope: `llm_feedback.md` round 6
Status: first-pass due diligence from official repos/docs

## Bottom line

Most of round 6 is not direct implementation guidance for EmotionUI. It is a mix of:

- high-value source scouting
- conceptual validation
- workflow advice for external due diligence

Only a subset is worth active integration work in the current codebase.

## High-ROI shortlist

These are the sources that are realistically useful for the current EmotionUI architecture.

| Source | Relevance | Best fit in EmotionUI | Direct reuse now | Main risk | Verdict |
| --- | --- | --- | --- | --- | --- |
| `rrweb` | 5/5 | replay model, DOM mutation recording patterns, session viewer | medium | old release cadence on core repo, not a drop-in fit for current pipeline | review deeply |
| `simplebandit` | 5/5 | challenger policy for `background.js` | high | archived on 2025-06-02 | prototype only |
| `GrowthBook` | 4/5 | cohorts, flags, experiment protocol | medium | platform is much larger than current need | borrow patterns |
| `Flagsmith` | 4/5 | remote config, rollout, segmentation | medium | external control plane may be overkill for MVP | borrow patterns |
| `TA3/web-user-behaviour` | 4/5 | telemetry gap analysis for `dataCollector.js` | low-medium | generic tracker, noisy defaults | mine event coverage only |
| `OpenReplay` | 3/5 | replay/logging/privacy architecture | low-medium | heavy platform, multi-service | architectural inspiration |
| `PostHog` | 3/5 | analytics + flags + experiments reporting | low-medium | large mixed-license platform, heavy self-host stack | architectural inspiration |

## Source notes

### 1. rrweb

Official:

- https://github.com/rrweb-io/rrweb
- https://www.rrweb.io/

Why it matters:

- It is purpose-built for browser record/replay.
- It already splits the problem into snapshot, incremental mutation capture, and replay UI.
- That maps well to EmotionUI's session export and future replay/debug surface.

Where it fits:

- `chrome-extension/pipeline/outcomeLogger.js`
- `demo/admin.html`
- any future session replay viewer or timeline visualizer

What to reuse:

- event model ideas
- replay format concepts
- privacy/sanitization boundaries
- incremental DOM mutation strategy

What not to do:

- do not replace the whole EmotionUI logger with rrweb
- do not add a heavy recorder dependency before deciding the replay product shape

### 2. thoughtworks/simplebandit

Official:

- https://github.com/thoughtworks/simplebandit

Why it matters:

- It is the closest technical match to the current policy layer in `chrome-extension/background.js`.
- It uses online logistic regression with softmax exploration, which is conceptually close to your current `SILENT / OBSERVE / INTERVENE` policy direction.
- It is TS/JS-first, which means it fits browser-side or lightweight service-side experimentation much better than Python recommenders.

Where it fits:

- `chrome-extension/background.js`
- `chrome-extension/config.js`
- any future challenger-policy interface

What to reuse:

- action selection framing
- online learning structure
- serialization shape for model state

Main warning:

- the repo is archived, so it is a pattern source, not a long-term dependency

### 3. GrowthBook

Official:

- https://github.com/growthbook/growthbook
- https://www.growthbook.io/

Why it matters:

- Feature flags + experiments + gradual rollout maps directly to the workstream around adaptive-vs-control comparisons.
- It is useful for experiment design, cohorting, and rollout discipline even if you never adopt the platform.

Where it fits:

- live experiment protocol
- cohort assignment
- intervention exposure logging
- challenger rollout strategy

What to reuse:

- experiment vocabulary
- rollout patterns
- targeting/segmentation concepts
- reporting expectations for experiments

What not to do:

- do not try to integrate the full platform into the MVP

### 4. Flagsmith

Official:

- https://github.com/Flagsmith/flagsmith
- https://www.flagsmith.com/open-source

Why it matters:

- It is strong for remote config and feature flags, which are exactly the missing operational layer for safe experimentation on EmotionUI.
- It is more directly useful for runtime config control than most recommender repos in round 6.

Where it fits:

- adaptive runtime flags
- cohort gates
- environment-level config snapshots
- safe rollout of new interventions

What to reuse:

- remote config patterns
- default flag strategies
- environment segmentation

### 5. TA3/web-user-behaviour

Official:

- https://github.com/TA3/web-user-behaviour

Why it matters:

- It is the only round-6 source directly relevant to collector breadth.
- It explicitly includes `touchEvents`, `visibilitychange`, keyboard, form, media, and periodic processing.

Where it fits:

- `chrome-extension/pipeline/dataCollector.js`

What to reuse:

- telemetry coverage checklist
- mobile/touch event handling ideas
- optional processing cadence ideas

Main warning:

- this is a generic tracker, not an e-commerce intent system
- many tracked dimensions would be noise if copied directly

### 6. OpenReplay

Official:

- https://github.com/openreplay/openreplay
- https://www.openreplay.com/

Why it matters:

- Strong reference for session replay architecture, developer tooling, privacy controls, and low-footprint tracking claims.
- Useful if EmotionUI grows from JSON export into a proper replay/debug product.

Where it fits:

- replay/debug tooling
- privacy handling
- event + technical diagnostics correlation

Main warning:

- it is a large multi-service platform, far beyond current MVP needs

### 7. PostHog

Official:

- https://github.com/PostHog/posthog
- https://github.com/PostHog/posthog.com

Why it matters:

- It is the best reference for combining analytics, feature flags, experimentation, and session replay in one product workflow.
- It is especially useful for reporting and experiment readout expectations.

Where it fits:

- product analytics framing
- exposure/outcome dashboards
- feature-flag driven experimentation

Main warning:

- huge platform, mixed licensing around some parts, and far too broad to adopt wholesale

## Low direct-reuse group

These are valid sources, but mostly for offline modeling or conceptual support, not for immediate code reuse inside the current extension/runtime.

| Source family | Why low direct reuse |
| --- | --- |
| `Microsoft Recommenders`, `RecBole`, `LightFM`, `TFRS`, `OpenRec`, `PredictionIO`, `Surprise` | mostly server-side or offline recommender/training stacks, not browser-side stateful UI adaptation |
| `Transformers4Rec`, `Mcformer` | useful only if EmotionUI adds a real offline sequence model pipeline |
| academic papers and thesis | strong conceptual validation, weak implementation leverage |
| `Amazon EQA taxonomy`, `Snowplow Signals`, `AdaptUI`, `Dynamic Yield`, `A2UI` | useful for framing, taxonomy, or architecture language, but not immediate drop-in code |
| `Magento`, `OpenCart`, `Shopware`, `Algolia InstantSearch` | product recommendation or storefront tooling, not close to the extension runtime problem |

## What I can execute from round 6 right now

### Directly executable now

- create and maintain this review file
- do technical due diligence on shortlisted sources
- map each source to specific EmotionUI files and workstreams
- prototype source-inspired internal changes without adopting the full external platform

### Good next implementation candidates

1. `TA3/web-user-behaviour` inspired telemetry gap patch
   - add touch/visibility coverage ideas into `chrome-extension/pipeline/dataCollector.js`

2. `simplebandit` inspired challenger policy interface
   - add a clean challenger abstraction in `chrome-extension/background.js`
   - keep the current policy as baseline and add a shadow challenger path

3. `GrowthBook` / `Flagsmith` inspired experiment structure
   - add cohort assignment and config version fields to the session payload
   - prepare `control / adaptive / challenger` reporting

4. `rrweb` inspired replay surface
   - define a future replay format or viewer for exported session JSON

## Recommended execution order

### P1

- telemetry gap patch inspired by `TA3/web-user-behaviour`
- challenger policy abstraction inspired by `simplebandit`
- experiment logging/cohort protocol inspired by `GrowthBook` and `Flagsmith`

### P2

- replay/debug viewer inspired by `rrweb`
- impact reporting patterns inspired by `PostHog` and `OpenReplay`

### P3

- any offline ML exploration inspired by `RecBole` / `Transformers4Rec`

## Practical rule

Treat round 6 as:

- `~20%` immediate implementation fuel
- `~60%` due diligence and architecture input
- `~20%` conceptual validation only
