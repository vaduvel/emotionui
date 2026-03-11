# Live MVP UI Adaptation Matrix

Purpose: define exactly how the UI is allowed to adapt for each scenario/state, without repainting the whole product page unnecessarily.

Sources of truth:
- [stateContract.js](/Users/vaduvageorge/Projects/emotionui/chrome-extension/pipeline/stateContract.js)
- [adaptationMapper.js](/Users/vaduvageorge/Projects/emotionui/chrome-extension/pipeline/adaptationMapper.js)
- [live-mvp.js](/Users/vaduvageorge/Projects/emotionui/demo/live-mvp.js)

## Core rule

The page is `local-first`.

- The UI adapts in the zone where the user is active now.
- Abandoned zones should not keep getting upgraded.
- Only `DESIGN_OXYGEN` and `SPOTLIGHT_MODE` are allowed to affect the broader page.

## Zone model

- `overview`: gallery, hero, first impression
- `variants`: storage / memory / color / options
- `purchase`: price rail, CTA rail, finance, delivery, benefits
- `research`: description, specs, reviews, faq
- `compare`: comparison cards and nearby alternatives

## UI primitives

These are the allowed adaptation levers.

- `emphasis`: stronger border, tint, focus ring, zone elevation
- `clarity`: rewrite slot copy, add summary cards, compress wording
- `proof`: reviews, returns, seller, delivery, trust badges
- `price framing`: savings, installments, price history, total value
- `path compression`: shorter next step, fewer clicks, saved details
- `noise reduction`: mute secondary rails, fade upsells, reduce side paths
- `navigation assist`: jump chips, grouped sections, shortcuts

## State -> mode contract

### `CALM_BROWSING` -> `STANDARD`

Goal:
- keep the PDP visually stable
- avoid premature persuasion

Active zones:
- `overview`
- `variants`

UI adaptation:
- no aggressive restyle
- allow only lightweight observe behavior
- keep hero clean and readable
- show no extra persuasion in purchase rail
- no global page changes

What changes:
- subtle focus on hovered/active zone
- optional passive helper copy in local slot

What does not change:
- no CTA boost
- no price framing
- no research band restyle

### `EXPLORING` -> `STANDARD`

Goal:
- support scanning and option discovery
- keep the user free to browse

Active zones:
- `overview`
- `variants`
- `compare`

UI adaptation:
- cluster nearby information without turning it into research mode
- make compare surfaces easier to skim
- make variants easier to switch and understand

What changes:
- clearer grouping of gallery / variant / compare content
- local helper copy that frames trade-offs
- compare cards get clearer difference cues

What does not change:
- no purchase urgency
- no full-page research formatting
- no global suppression

### `DEEP_RESEARCH` -> `RESEARCH_MODE`

Goal:
- reduce reading effort
- make detailed evaluation easier

Active zones:
- `research`
- sometimes `purchase` if user is near CTA but still researching

UI adaptation:
- convert the full research band into an easier-to-scan surface
- keep the current subsection strongest, but support the whole research area
- if the user is in purchase rail while still researching, adapt the purchase rail with answers, not checkout pressure

What changes in `research`:
- summary-first cards at top of section
- quick jump chips: specs / reviews / faq / description
- denser but cleaner tables for specs
- reassurance bullets when reviews are active
- blocker-resolution framing when faq is active

What changes in `purchase` during research:
- financing, returns, delivery, seller, compare-next
- no express checkout push

What does not change:
- abandoned purchase area stays untouched
- no whole-page restyle

### `PRICE_SENSITIVE` -> `PRICE_ALERT_MODE`

Goal:
- answer the value question locally
- reduce price hesitation without forcing checkout

Active zones:
- `purchase`
- `compare`

UI adaptation:
- show savings and monthly framing where the user is currently evaluating
- keep the treatment attached to purchase or compare, not the whole page

What changes:
- savings badge
- monthly installment framing
- pickup / delivery timing
- price history / discount context
- trade-off reminder between base and upgraded config

What does not change:
- no heavy trust narrative unless reassurance signals also exist
- no research-wide restyle
- no global suppression

### `REASSURANCE_SEEKING` -> `NEGOTIATOR_MODE`

Goal:
- resolve trust and validation doubts
- frame value, not just sticker price

Active zones:
- `research`
- `compare`
- `purchase`

UI adaptation:
- inject trust proof and value reassurance in the active zone
- highlight verified reviews, return safety, support quality, seller quality, delivery certainty

What changes:
- trust chips
- verified review highlights
- return / warranty / support proof
- value framing vs cheaper alternatives
- seller confidence and service clarity

What does not change:
- no full checkout acceleration unless intent becomes decision-ready
- no global page suppression

### `DECISION_READY` -> `EXPRESS_LANE`

Goal:
- compress the path to action
- remove unnecessary hesitation near purchase

Active zones:
- primarily `purchase`
- sometimes local checkout-adjacent area

UI adaptation:
- make the next commercial step obvious
- shorten decision path
- surface saved details and quickest route

What changes:
- stronger CTA treatment
- shorter checkout framing
- saved details / pickup / stock clarity
- one-step path cues

What does not change:
- no research zone repaint if the user left it
- no global restyle

### `FRUSTRATED` -> `DESIGN_OXYGEN`

Goal:
- reduce friction fast
- make the page calmer and easier to recover from

Active scope:
- global exception

UI adaptation:
- broader page simplification is allowed
- low-priority content steps back
- primary path and current zone become easier to parse

What changes:
- mute secondary strips
- hide or downplay upsells
- increase readability and spacing
- simplify wording around key actions

What does not change:
- avoid commercial pressure while frustration is active

### `OVERWHELMED` -> `SPOTLIGHT_MODE`

Goal:
- reduce cognitive load
- spotlight the one thing that matters now

Active scope:
- global exception

UI adaptation:
- broader page focus mode is allowed
- secondary surfaces are visually reduced
- the active zone and primary path are spotlighted

What changes:
- spotlight primary action or key reading area
- mute secondary noise
- collapse unnecessary density
- prioritize one path forward

What does not change:
- do not simultaneously promote multiple competing actions

## Scenario-to-zone expectations

This is the practical contract for live MVP behavior.

### If the user is in `overview`

- `CALM_BROWSING`: keep page stable
- `EXPLORING`: improve scan and compareability
- never trigger research-wide UI just because research sections exist on page

### If the user is in `research`

- `DEEP_RESEARCH`: adapt the research band
- `REASSURANCE_SEEKING`: adapt trust and proof inside research
- `DECISION_READY`: do not repaint research unless the user is still there for commerce reasons; otherwise keep express inside purchase

### If the user is in `purchase`

- `PRICE_SENSITIVE`: adapt price/value elements
- `REASSURANCE_SEEKING`: adapt trust/value around purchase
- `DECISION_READY`: activate express path locally

### If the user is in `compare`

- `EXPLORING`: help scanning alternatives
- `PRICE_SENSITIVE`: emphasize cost trade-offs
- `REASSURANCE_SEEKING`: emphasize value and trust trade-offs

## Explicit anti-rules

- Research should not repaint the whole page.
- Decision-ready should not keep adapting a purchase rail the user abandoned.
- Compare should not be treated as generic noise.
- Price-sensitive should not become a full-page discount theme.
- Frustrated and overwhelmed are the only normal reasons to use global adaptation.

## Implementation target

The live MVP should progressively move toward this structure:

1. `state` decides the `mode`
2. `active zone` decides where the adaptation lands
3. `mode + zone` decides which UI primitives are allowed
4. `copy/panel content` is the last layer, not the adaptation definition itself

## Current gaps vs target

- `buildAdaptivePanel()` already contains the copy skeleton for most mode/zone combinations
- `AdaptiveLayout.apply()` already supports local vs global scope
- the next missing step is to make `mode -> zone -> primitives` explicit in code, instead of leaving it implicit in panel copy and CSS tokens
