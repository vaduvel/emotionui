(() => {
  const CanonicalStates = window.EmotionUICanonicalStates || {};
  const LABELS = CanonicalStates.LABELS || {
    CALM_BROWSING: "CALM_BROWSING",
    EXPLORING: "EXPLORING",
    DEEP_RESEARCH: "DEEP_RESEARCH",
    PRICE_SENSITIVE: "PRICE_SENSITIVE",
    REASSURANCE_SEEKING: "REASSURANCE_SEEKING",
    FRUSTRATED: "FRUSTRATED",
    OVERLOADED: "OVERLOADED",
    DECISION_READY: "DECISION_READY"
  };
  const ORDER = CanonicalStates.ORDER || Object.values(LABELS);
  const DEFAULT_LABEL = CanonicalStates.DEFAULT_LABEL || LABELS.CALM_BROWSING;
  const AFFECT_TAGS = CanonicalStates.AFFECT_TAGS || CanonicalStates.EMOTION_TAGS || {
    CALM: "CALM",
    UNCERTAIN: "UNCERTAIN",
    FRUSTRATED: "FRUSTRATED",
    OVERWHELMED: "OVERWHELMED",
    CONFIDENT: "CONFIDENT"
  };
  const EMOTION_TAGS = AFFECT_TAGS;
  const INTENT_TAGS = CanonicalStates.INTENT_TAGS || {
    EXPLORING: "EXPLORING",
    DEEP_RESEARCH: "DEEP_RESEARCH",
    PRICE_EVALUATION: "PRICE_EVALUATION",
    DECISION_READY: "DECISION_READY",
    CHECKOUT_INTENT: "CHECKOUT_INTENT"
  };

  class StateClassifier {
    constructor(config = {}) {
      this.config = {
        minimumConfidence: 0.36,
        ...config
      };
    }

    clamp01(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      return Math.max(0, Math.min(1, n));
    }

    round(value, digits = 3) {
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      return Number(n.toFixed(digits));
    }

    buildReasons(label, raw, featurePack, pageContext) {
      const ctx = featurePack?.context || {};
      const derived = featurePack?.derived || {};
      const normalized = featurePack?.normalized || {};
      const summary = pageContext?.summary || {};

      switch (label) {
        case LABELS.DECISION_READY:
          return [
            ctx.directCheckout ? "direct_checkout_signal" : "",
            Number(derived.express_checkout_score || 0) >= 0.28 ? "express_checkout_score_high" : "",
            Number(derived.purchase_momentum_score || 0) >= 0.32 ? "purchase_momentum_high" : "",
            Number(normalized.cartIntentSignal || 0) >= 0.45 ? "cart_intent_high" : ""
          ].filter(Boolean);
        case LABELS.PRICE_SENSITIVE:
          return [
            Number(ctx.timeOnPriceSec || 0) >= 5 ? "price_dwell_high" : "",
            Number(ctx.priceHoverCount || 0) >= 2 ? "price_hover_repeat" : "",
            summary.hasDiscountSignal ? "discount_signal_present" : "",
            summary.hasInstallmentSignal ? "installment_signal_present" : ""
          ].filter(Boolean);
        case LABELS.REASSURANCE_SEEKING:
          return [
            Number(ctx.reviewDwellSec || 0) >= 10 ? "review_dwell_long" : "",
            summary.hasTrustSignal ? "trust_signal_present" : "",
            summary.hasReviewDensitySignal ? "review_density_present" : "",
            Number(normalized.cartIntentSignal || 0) >= 0.2 ? "cart_interest_present" : ""
          ].filter(Boolean);
        case LABELS.DEEP_RESEARCH:
          return [
            Number(derived.research_depth_score || 0) >= 0.38 ? "research_depth_high" : "",
            Number(ctx.reviewDwellSec || 0) >= 10 ? "review_dwell_long" : "",
            Number(raw?.sectionDwellMs?.specs || 0) >= 10000 ? "spec_dwell_long" : "",
            summary.hasSpecTableSignal ? "spec_table_present" : ""
          ].filter(Boolean);
        case LABELS.EXPLORING:
          return [
            Number(ctx.visitedCount || 0) >= 2 ? "multiple_info_zones" : "",
            Number(normalized.scrolledPercentage || 0) >= 0.18 ? "page_scrolled" : "",
            Number(normalized.clickRate || 0) >= 0.12 ? "light_interaction" : ""
          ].filter(Boolean);
        case LABELS.FRUSTRATED:
          return [
            Number(derived.friction_score || 0) >= 0.28 ? "friction_high" : "",
            Number(raw.rageClicks || 0) >= 2 ? "rage_clicks_present" : "",
            Number(raw.mouseJitter || 0) >= 4 ? "mouse_jitter_active" : "",
            Number(ctx.deadClicks || 0) >= 2 ? "dead_clicks_present" : ""
          ].filter(Boolean);
        case LABELS.OVERLOADED:
          return [
            Number(derived.hesitation_score || 0) >= 0.24 ? "hesitation_high" : "",
            Number(normalized.sectionSwitchRate || 0) >= 0.45 ? "section_switching_high" : "",
            Number(normalized.reversalRate || 0) >= 0.08 ? "scroll_reversal_active" : ""
          ].filter(Boolean);
        default:
          return [
            summary.hasPrimaryPrice ? "product_context_visible" : "",
            Number(featurePack?.normalized?.bounceRisk || 0) < 1 ? "stable_session" : ""
          ].filter(Boolean);
      }
    }

    classify(raw = {}, featurePack = {}, pageContext = {}, reasonAnalysis = {}) {
      const normalized = featurePack?.normalized || {};
      const derived = featurePack?.derived || {};
      const context = featurePack?.context || {};
      const summary = pageContext?.summary || {};
      const reviewDwellSec = Number(context.reviewDwellSec || 0);
      const specDwellSec = Number(raw?.sectionDwellMs?.specs || 0) / 1000;
      const descriptionDwellSec = Number(context.descriptionDwellSec || 0);
      const infoZoneDwellSec = Number(context.infoZoneDwellSec || 0);
      const visitedCount = Number(context.visitedCount || 0);
      const activeSection = String(context.activeSection || raw?.activeSection || "");
      const activeSectionAgeSec = Number(context.activeSectionAgeSec || 0);
      const activeResearchSection = /^(reviews|specs|description)$/.test(activeSection);
      const recentDecisionSignal = Number(normalized.recentDecisionSignal || 0);
      const recentPriceSignal = Number(normalized.recentPriceSignal || 0);
      const recentResearchSignal = Number(normalized.recentResearchSignal || 0);
      const recentFrictionSignal = Number(normalized.recentFrictionSignal || 0);
      const sessionCommerceMemorySignal = Number(normalized.sessionCommerceMemorySignal || context.sessionCommerceMemorySignal || 0);
      const recentAddToCartCount = Number(context.recentAddToCartCount || 0);
      const recentCheckoutCount = Number(context.recentCheckoutCount || 0);
      const recentWishlistCount = Number(context.recentWishlistCount || 0);
      const recentCommerceActionCount = Number(context.recentCommerceActionCount || 0);
      const purchaseCtaIntentCount = Number(context.purchaseCtaIntentCount || 0);
      const recentResearchSwitchCount = Number(context.recentResearchSwitchCount || 0);
      const recentFrictionEventCount = Number(context.recentFrictionEventCount || 0);
      const activeOverviewSection = /^(gallery|overview|variants)$/.test(activeSection);
      const recentCommerceDormant =
        recentAddToCartCount === 0 &&
        recentCheckoutCount === 0 &&
        recentCommerceActionCount === 0 &&
        recentDecisionSignal < 0.45 &&
        recentPriceSignal < 0.45;
      const recentCommerceReengage =
        recentDecisionSignal >= 0.55 ||
        recentAddToCartCount >= 1 ||
        recentCheckoutCount >= 1 ||
        (recentWishlistCount >= 1 && recentPriceSignal >= 0.5) ||
        (purchaseCtaIntentCount >= 1 && recentPriceSignal >= 0.45) ||
        (!activeOverviewSection && recentCommerceActionCount >= 2);
      const researchResurgence =
        recentCommerceDormant &&
        (
          (activeResearchSection && activeSectionAgeSec >= 1.5) ||
          recentResearchSignal >= 0.5 ||
          recentResearchSwitchCount >= 2 ||
          reviewDwellSec >= 24 ||
          specDwellSec >= 16 ||
          descriptionDwellSec >= 16 ||
          infoZoneDwellSec >= 56
        );
      const recentFrustrationBurst =
        recentFrictionSignal >= 0.55 ||
        recentFrictionEventCount >= 2;
      const recentCommitmentReengage =
        recentAddToCartCount >= 1 ||
        recentCheckoutCount >= 1 ||
        recentDecisionSignal >= 0.75 ||
        (recentWishlistCount >= 1 && recentPriceSignal >= 0.5) ||
        (purchaseCtaIntentCount >= 1 && recentPriceSignal >= 0.45) ||
        (!activeOverviewSection && recentCommerceActionCount >= 2) ||
        (
          !researchResurgence &&
          sessionCommerceMemorySignal >= 0.66 &&
          (
            Number(derived.purchase_momentum_score || 0) >= 0.56 ||
            Number(derived.express_checkout_score || 0) >= 0.32 ||
            purchaseCtaIntentCount >= 2
          )
        );
      const overviewBrowsingOnly =
        activeOverviewSection &&
        recentAddToCartCount === 0 &&
        recentCheckoutCount === 0 &&
        purchaseCtaIntentCount === 0 &&
        recentPriceSignal < 0.35 &&
        recentFrictionEventCount === 0;
      const galleryBrowsingActive =
        activeSection === "gallery" &&
        activeSectionAgeSec >= 3 &&
        !recentFrustrationBurst &&
        !recentCommerceReengage &&
        recentResearchSignal < 0.35;
      const researchStillActive =
        activeResearchSection &&
        activeSectionAgeSec >= 4 &&
        !recentCommerceReengage &&
        !recentFrustrationBurst;
      const researchDominant =
        visitedCount >= 3 &&
        Number(derived.research_depth_score || 0) >= 0.58 &&
        (
          reviewDwellSec >= 20 ||
          specDwellSec >= 12 ||
          descriptionDwellSec >= 12 ||
          infoZoneDwellSec >= 36 ||
          (activeResearchSection && activeSectionAgeSec >= 4) ||
          Number(normalized.reviewReadLong || 0) >= 1
        ) &&
        !recentCommerceReengage;

      const scores = {
        [LABELS.DECISION_READY]: this.clamp01(
          0.34 * Number(derived.purchase_momentum_score || 0) +
          0.28 * Number(derived.express_checkout_score || 0) +
          0.14 * Number(normalized.cartIntentSignal || 0) +
          0.14 * Number(normalized.checkoutSignal || 0) +
          0.10 * (summary.hasPrimaryPrice ? 1 : 0) +
          0.24 * recentDecisionSignal +
          0.08 * recentPriceSignal +
          0.14 * sessionCommerceMemorySignal +
          0.06 * (recentCommerceActionCount >= 1 ? 1 : 0) +
          0.20 * (recentAddToCartCount >= 1 ? 1 : 0) +
          0.16 * (recentCheckoutCount >= 1 ? 1 : 0) +
          0.08 * (recentWishlistCount >= 1 ? 1 : 0) -
          0.10 * (researchStillActive ? 1 : 0) -
          0.32 * (researchResurgence ? 1 : 0) -
          0.34 * (overviewBrowsingOnly ? 1 : 0)
        ),
        [LABELS.PRICE_SENSITIVE]: this.clamp01(
          0.34 * Number(derived.negotiation_pressure_score || 0) +
          0.22 * Number(normalized.priceHoverSignal || 0) +
          0.14 * (summary.hasDiscountSignal ? 1 : 0) +
          0.12 * (summary.hasInstallmentSignal ? 1 : 0) +
          0.10 * (Number(context.timeOnPriceSec || 0) >= 5 ? 1 : 0) +
          0.08 * Number(normalized.cartAbandonSignal || 0) -
          0.10 * (researchDominant ? 1 : 0) +
          0.18 * recentPriceSignal +
          0.10 * sessionCommerceMemorySignal +
          0.10 * (recentWishlistCount >= 1 ? 1 : 0) +
          0.10 * (!researchStillActive && recentCommerceReengage ? 1 : 0) -
          0.22 * (overviewBrowsingOnly ? 1 : 0)
        ),
        [LABELS.REASSURANCE_SEEKING]: this.clamp01(
          0.28 * Number(derived.research_depth_score || 0) +
          0.18 * Number(normalized.reviewFocusRatio || 0) +
          0.16 * Number(normalized.priceHoverSignal || 0) +
          0.14 * (summary.hasTrustSignal ? 1 : 0) +
          0.12 * (summary.hasReviewDensitySignal ? 1 : 0) +
          0.12 * Number(normalized.cartIntentSignal || 0) -
          0.08 * (researchDominant ? 1 : 0)
        ),
        [LABELS.DEEP_RESEARCH]: this.clamp01(
          0.42 * Number(derived.research_depth_score || 0) +
          0.20 * Number(normalized.reviewFocusRatio || 0) +
          0.12 * Number(normalized.specFocusRatio || 0) +
          0.10 * Number(normalized.researchCoverage || 0) +
          0.08 * (summary.hasSpecTableSignal ? 1 : 0) +
          0.08 * (summary.hasReviewDensitySignal ? 1 : 0) +
          0.08 * (reviewDwellSec >= 20 ? 1 : 0) +
          0.06 * (specDwellSec >= 12 ? 1 : 0) +
          0.05 * (descriptionDwellSec >= 12 ? 1 : 0) +
          0.05 * (infoZoneDwellSec >= 36 ? 1 : 0) +
          0.05 * (activeResearchSection && activeSectionAgeSec >= 4 ? 1 : 0) +
          0.06 * (visitedCount >= 3 ? 1 : 0) +
          0.28 * (researchResurgence ? 1 : 0) +
          0.10 * recentResearchSignal -
          0.10 * sessionCommerceMemorySignal -
          0.32 * (recentCommerceReengage && !researchStillActive ? 1 : 0) -
          0.18 * (recentCommitmentReengage && !researchStillActive ? 1 : 0) -
          0.16 * (recentFrustrationBurst && !researchStillActive ? 1 : 0) -
          0.16 * recentDecisionSignal
        ),
        [LABELS.EXPLORING]: this.clamp01(
          0.22 * Number(normalized.researchCoverage || 0) +
          0.18 * Number(normalized.scrolledPercentage || 0) +
          0.16 * Number(normalized.clickRate || 0) +
          0.16 * Number(normalized.sectionSwitchRate || 0) +
          0.12 * (summary.hasPrimaryPrice ? 1 : 0) +
          0.16 * (1 - Number(normalized.bounceRisk || 0)) +
          0.14 * (galleryBrowsingActive ? 1 : 0) -
          0.16 * (researchDominant ? 1 : 0)
        ),
        [LABELS.FRUSTRATED]: this.clamp01(
          0.40 * Number(derived.friction_score || 0) +
          0.18 * Number(normalized.deadClickRate || 0) +
          0.16 * Number(normalized.mouseJitter || 0) +
          0.14 * Number(normalized.rageClicks || 0) +
          0.12 * Number(normalized.reversalRate || 0) +
          0.26 * recentFrictionSignal +
          0.08 * Number(derived.frustration_rebound_score || 0) +
          0.20 * (recentFrustrationBurst ? 1 : 0) -
          0.24 * (overviewBrowsingOnly ? 1 : 0)
        ),
        [LABELS.OVERLOADED]: this.clamp01(
          0.34 * Number(derived.hesitation_score || 0) +
          0.18 * Number(normalized.sectionSwitchRate || 0) +
          0.16 * Number(normalized.reversalRate || 0) +
          0.14 * Number(normalized.exitIntentSignal || 0) +
          0.12 * Number(normalized.deadClickRate || 0) +
          0.10 * Number(normalized.mouseJitter || 0) +
          0.14 * recentFrictionSignal -
          0.12 * sessionCommerceMemorySignal
        ),
        [LABELS.CALM_BROWSING]: this.clamp01(
          0.28 * (1 - Number(derived.friction_score || 0)) +
          0.22 * (1 - Number(derived.hesitation_score || 0)) +
          0.18 * (1 - Number(normalized.bounceRisk || 0)) +
          0.14 * Number(normalized.scrolledPercentage || 0) +
          0.10 * (summary.hasPrimaryPrice ? 1 : 0) +
          0.08 * (1 - Number(normalized.deadClickRate || 0)) -
          0.10 * (researchDominant ? 1 : 0) -
          0.12 * recentDecisionSignal -
          0.10 * recentFrictionSignal
        )
      };

      const primaryAdjustments = reasonAnalysis?.primary_score_adjustments || {};
      for (const stateLabel of ORDER) {
        scores[stateLabel] = this.clamp01(Number(scores[stateLabel] || 0) + Number(primaryAdjustments[stateLabel] || 0));
      }

      if (recentCommitmentReengage && !researchStillActive && !researchResurgence) {
        scores[LABELS.DECISION_READY] = this.clamp01(
          Number(scores[LABELS.DECISION_READY] || 0) +
          (recentAddToCartCount >= 1 ? 0.18 : 0) +
          (recentCheckoutCount >= 1 ? 0.22 : 0) +
          (recentWishlistCount >= 1 ? 0.08 : 0) +
          (sessionCommerceMemorySignal >= 0.66 ? 0.12 : 0)
        );
        scores[LABELS.PRICE_SENSITIVE] = this.clamp01(
          Number(scores[LABELS.PRICE_SENSITIVE] || 0) +
          (recentPriceSignal >= 0.5 ? 0.08 : 0) +
          (sessionCommerceMemorySignal >= 0.6 ? 0.06 : 0)
        );
        scores[LABELS.DEEP_RESEARCH] = this.clamp01(Number(scores[LABELS.DEEP_RESEARCH] || 0) - 0.18);
      }

      if (researchResurgence) {
        scores[LABELS.DEEP_RESEARCH] = this.clamp01(Number(scores[LABELS.DEEP_RESEARCH] || 0) + 0.16);
        scores[LABELS.REASSURANCE_SEEKING] = this.clamp01(Number(scores[LABELS.REASSURANCE_SEEKING] || 0) + 0.08);
        scores[LABELS.DECISION_READY] = this.clamp01(Number(scores[LABELS.DECISION_READY] || 0) - 0.24);
        scores[LABELS.PRICE_SENSITIVE] = this.clamp01(Number(scores[LABELS.PRICE_SENSITIVE] || 0) - 0.08);
      }

      if (recentFrustrationBurst && !researchStillActive) {
        scores[LABELS.FRUSTRATED] = this.clamp01(Number(scores[LABELS.FRUSTRATED] || 0) + 0.16);
        scores[LABELS.DEEP_RESEARCH] = this.clamp01(Number(scores[LABELS.DEEP_RESEARCH] || 0) - 0.10);
        scores[LABELS.CALM_BROWSING] = this.clamp01(Number(scores[LABELS.CALM_BROWSING] || 0) - 0.12);
      }

      if (overviewBrowsingOnly) {
        scores[LABELS.DECISION_READY] = this.clamp01(Number(scores[LABELS.DECISION_READY] || 0) - 0.16);
        scores[LABELS.PRICE_SENSITIVE] = this.clamp01(Number(scores[LABELS.PRICE_SENSITIVE] || 0) - 0.12);
        scores[LABELS.FRUSTRATED] = this.clamp01(Number(scores[LABELS.FRUSTRATED] || 0) - 0.16);
      }

      if (galleryBrowsingActive) {
        scores[LABELS.EXPLORING] = this.clamp01(Number(scores[LABELS.EXPLORING] || 0) + 0.10);
        scores[LABELS.FRUSTRATED] = this.clamp01(Number(scores[LABELS.FRUSTRATED] || 0) - 0.14);
        scores[LABELS.OVERWHELMED] = this.clamp01(Number(scores[LABELS.OVERWHELMED] || 0) - 0.10);
        scores[LABELS.DEEP_RESEARCH] = this.clamp01(Number(scores[LABELS.DEEP_RESEARCH] || 0) - 0.08);
      }

      const ranked = Object.entries(scores)
        .sort((a, b) => Number(b[1]) - Number(a[1]) || ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]));

      let topLabel = ranked[0]?.[0] || DEFAULT_LABEL;
      let topConfidence = Number(ranked[0]?.[1] || 0);

      if (
        topLabel === LABELS.CALM_BROWSING &&
        researchStillActive &&
        Number(scores[LABELS.DEEP_RESEARCH] || 0) >= topConfidence - 0.08
      ) {
        topLabel = LABELS.DEEP_RESEARCH;
        topConfidence = Number(scores[topLabel] || topConfidence);
      }

      if (
        topLabel === LABELS.CALM_BROWSING &&
        recentCommitmentReengage &&
        !researchResurgence &&
        !researchStillActive &&
        (
          Number(scores[LABELS.DECISION_READY] || 0) >= topConfidence - 0.08 ||
          Number(scores[LABELS.PRICE_SENSITIVE] || 0) >= topConfidence - 0.08
        )
      ) {
        topLabel =
          Number(scores[LABELS.DECISION_READY] || 0) >= Number(scores[LABELS.PRICE_SENSITIVE] || 0)
            ? LABELS.DECISION_READY
            : LABELS.PRICE_SENSITIVE;
        topConfidence = Number(scores[topLabel] || topConfidence);
      }

      if (
        topLabel === LABELS.CALM_BROWSING &&
        recentFrustrationBurst &&
        !researchStillActive &&
        Number(scores[LABELS.FRUSTRATED] || 0) >= topConfidence - 0.08
      ) {
        topLabel = LABELS.FRUSTRATED;
        topConfidence = Number(scores[topLabel] || topConfidence);
      }

      if (
        topLabel === LABELS.DEEP_RESEARCH &&
        recentCommitmentReengage &&
        !researchResurgence &&
        !researchStillActive &&
        (
          recentAddToCartCount >= 1 ||
          recentCheckoutCount >= 1 ||
          sessionCommerceMemorySignal >= 0.7 ||
          Number(scores[LABELS.DECISION_READY] || 0) >= Number(scores[LABELS.DEEP_RESEARCH] || 0) - 0.08
        )
      ) {
        topLabel = recentCheckoutCount >= 1
          ? LABELS.DECISION_READY
          : (
            Number(scores[LABELS.DECISION_READY] || 0) >= Number(scores[LABELS.PRICE_SENSITIVE] || 0)
              ? LABELS.DECISION_READY
              : LABELS.PRICE_SENSITIVE
          );
        topConfidence = Number(scores[topLabel] || topConfidence);
      } else if (
        topLabel === LABELS.DEEP_RESEARCH &&
        recentFrustrationBurst &&
        !researchStillActive &&
        Number(scores[LABELS.FRUSTRATED] || 0) >= Math.max(0.34, Number(scores[LABELS.DEEP_RESEARCH] || 0) - 0.1)
      ) {
        topLabel = LABELS.FRUSTRATED;
        topConfidence = Number(scores[topLabel] || topConfidence);
      }

      const label = topConfidence >= Number(this.config.minimumConfidence || 0.36) ? topLabel : DEFAULT_LABEL;
      const fallbackConfidence = Number(scores[DEFAULT_LABEL] || 0);
      const fallbackTags = CanonicalStates.getDefaultTagsForState
        ? CanonicalStates.getDefaultTagsForState(label)
        : {
            emotion_tag: AFFECT_TAGS.CALM,
            affect_tag: AFFECT_TAGS.CALM,
            intent_tag: INTENT_TAGS.EXPLORING,
            constraint_tags: []
          };
      const reasonCodes = Array.isArray(reasonAnalysis?.top_reason_codes) ? reasonAnalysis.top_reason_codes : [];
      const baseReasons = this.buildReasons(label, raw, featurePack, pageContext);

      // For FRUSTRATED state: inherit the reason code engine's intent_tag if it conveys more than EXPLORING.
      // This preserves the user's pre-frustration intent (e.g., DEEP_RESEARCH friction → still a research intent).
      const frustratedIntentInheritance =
        label === LABELS.FRUSTRATED &&
        reasonAnalysis?.intent_tag &&
        reasonAnalysis.intent_tag !== INTENT_TAGS.EXPLORING
          ? reasonAnalysis.intent_tag
          : null;
      const resolvedIntentTag = frustratedIntentInheritance
        || reasonAnalysis?.intent_tag
        || fallbackTags.intent_tag
        || INTENT_TAGS.EXPLORING;

      return {
        label,
        primary_state: label,
        confidence: this.round(label === topLabel ? topConfidence : fallbackConfidence),
        scores: Object.fromEntries(ORDER.map((stateLabel) => [stateLabel, this.round(scores[stateLabel] || 0)])),
        reasons: [...baseReasons, ...reasonCodes.map((code) => `reason:${String(code || "").toLowerCase()}`)].slice(0, 6),
        emotion_tag: reasonAnalysis?.emotion_tag || fallbackTags.emotion_tag || AFFECT_TAGS.CALM,
        affect_tag: reasonAnalysis?.affect_tag || reasonAnalysis?.emotion_tag || fallbackTags.affect_tag || fallbackTags.emotion_tag || AFFECT_TAGS.CALM,
        intent_tag: resolvedIntentTag,
        constraint_tags: Array.isArray(reasonAnalysis?.constraint_tags) && reasonAnalysis.constraint_tags.length
          ? reasonAnalysis.constraint_tags
          : (fallbackTags.constraint_tags || []),
        emotion_scores: reasonAnalysis?.emotion_scores || (CanonicalStates.createEmptyEmotionScores ? CanonicalStates.createEmptyEmotionScores() : {}),
        intent_scores: reasonAnalysis?.intent_scores || (CanonicalStates.createEmptyIntentScores ? CanonicalStates.createEmptyIntentScores() : {}),
        constraint_scores: reasonAnalysis?.constraint_scores || (CanonicalStates.createEmptyConstraintScores ? CanonicalStates.createEmptyConstraintScores() : {}),
        reason_codes: reasonCodes,
        reason_families: Array.isArray(reasonAnalysis?.families) ? reasonAnalysis.families : []
      };
    }
  }

  window.EmotionUIStateClassifier = StateClassifier;
})();
