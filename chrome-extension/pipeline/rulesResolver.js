(() => {
  class RulesResolver {
    constructor(config = {}) {
      this.config = {
        decision: {},
        ...config
      };
    }

    evaluate(rawSnapshot, featurePack, pageContext = {}, stateClassification = {}) {
      const decisionCfg = this.config.decision || {};
      const derived = featurePack?.derived || {};
      const normalized = featurePack?.normalized || {};
      const context = featurePack?.context || {};
      const pageSummary = pageContext?.summary || {};
      const stateLabel = String(stateClassification?.label || "");
      const specDwellSec = Number(rawSnapshot?.sectionDwellMs?.specs || 0) / 1000;
      const reviewDwellSec = Number(context?.reviewDwellSec || 0);
      const descriptionDwellSec = Number(context?.descriptionDwellSec || 0);
      const infoZoneDwellSec = Number(context?.infoZoneDwellSec || 0);
      const timeOnPriceSec = Number(context?.timeOnPriceSec || 0);
      const ctaIntentCount = Number(context?.ctaIntentCount || 0);
      const purchaseCtaIntentCount = Number(context?.purchaseCtaIntentCount || 0);
      const priceHoverCount = Number(rawSnapshot?.priceHover || 0);
      const exitIntentCount = Number(rawSnapshot?.exitIntent || 0);
      const cartAbandonCount = Number(rawSnapshot?.cartAbandons || 0);
      const recentPriceEventCount = Number(context?.recentPriceEventCount || 0);
      const recentWishlistCount = Number(context?.recentWishlistCount || 0);
      const recentAddToCartCount = Number(context?.recentAddToCartCount || 0);
      const recentCheckoutCount = Number(context?.recentCheckoutCount || 0);
      const recentCommerceActionCount = Number(context?.recentCommerceActionCount || 0);
      const recentFrictionEventCount = Number(context?.recentFrictionEventCount || 0);
      const visitedCount = Number(context?.visitedCount || 0);
      const reviewVisits = Number(rawSnapshot?.sectionVisits?.reviews || 0);
      const specVisits = Number(rawSnapshot?.sectionVisits?.specs || 0);
      const descriptionVisits = Number(rawSnapshot?.sectionVisits?.description || 0);
      const cartAddRemoveCount = Number(rawSnapshot?.cartAddRemove || context?.cartAddRemoveCount || 0);
      const checkoutStarted = Boolean(rawSnapshot?.outcomes?.checkout_started || rawSnapshot?.directCheckout);
      const addedToCart = Boolean(rawSnapshot?.outcomes?.added_to_cart);
      const totalVisits = Number(rawSnapshot?.totalVisits || 0);
      const ctxFlags = (window.EmotionUIContextFlags?.deriveContextFlags || (() => ({})))(rawSnapshot, featurePack, pageContext);
      const activeSection = ctxFlags.activeSection || String(context?.activeSection || rawSnapshot?.activeSection || "");
      const activeSectionAgeSec = ctxFlags.activeSectionAgeSec || Number(context?.activeSectionAgeSec || 0);
      const activeOverviewSection = ctxFlags.activeOverviewSection ?? /^(gallery|overview|variants)$/.test(activeSection);
      const activeResearchSection = ctxFlags.activeResearchSection ?? /^(reviews|specs|description)$/.test(activeSection);
      const recentCommerceReengage = ctxFlags.recentCommerceReengage ?? (
        recentAddToCartCount >= 1 ||
        recentCheckoutCount >= 1 ||
        (recentWishlistCount >= 1 && recentPriceEventCount >= 1) ||
        recentCommerceActionCount >= 2 ||
        Number(derived.decision_reengagement_score || 0) >= 0.55
      );
      const recentFrustrationBurst = ctxFlags.recentFrustrationBurst ?? (
        recentFrictionEventCount >= 2 ||
        Number(derived.frustration_rebound_score || 0) >= 0.45
      );
      const researchStillActive = ctxFlags.researchStillActive ?? (
        activeResearchSection &&
        activeSectionAgeSec >= 4 &&
        !recentCommerceReengage &&
        !recentFrustrationBurst
      );

      const strongResearch =
        visitedCount >= 2 &&
        Number(derived.research_depth_score || 0) >= Math.max(Number(decisionCfg.researchStrongScore || 0.44), 0.5) &&
        (
          reviewDwellSec >= 12 ||
          specDwellSec >= 12 ||
          descriptionDwellSec >= 12 ||
          infoZoneDwellSec >= 24 ||
          reviewVisits >= 2 ||
          specVisits >= 2 ||
          descriptionVisits >= 2 ||
          (activeResearchSection && activeSectionAgeSec >= 4) ||
          Boolean(rawSnapshot?.outcomes?.review_dwell_over_10s)
        ) &&
        !recentCommerceReengage;

      const pricingCoolingOff =
        priceHoverCount <= 4 &&
        timeOnPriceSec <= 12 &&
        purchaseCtaIntentCount <= 2;

      const researchDominant =
        visitedCount >= 3 &&
        Number(derived.research_depth_score || 0) >= 0.6 &&
        infoZoneDwellSec >= 36 &&
        (
          reviewDwellSec >= 25 ||
          specDwellSec >= 15 ||
          descriptionDwellSec >= 15 ||
          specVisits >= 3 ||
          descriptionVisits >= 2 ||
          (reviewVisits + specVisits + descriptionVisits) >= 5 ||
          (activeResearchSection && activeSectionAgeSec >= 5)
        ) &&
        Number(derived.purchase_momentum_score || 0) < 0.56 &&
        Number(derived.express_checkout_score || 0) < 0.2 &&
        purchaseCtaIntentCount <= 1;

      const hardCommerceSignals =
        checkoutStarted ||
        addedToCart ||
        cartAddRemoveCount >= 1 ||
        Number(derived.purchase_momentum_score || 0) >= 0.58 ||
        Number(derived.express_checkout_score || 0) >= 0.42;

      const researchRegain =
        strongResearch &&
        !hardCommerceSignals &&
        (
          pricingCoolingOff ||
          researchDominant ||
          Number(derived.negotiation_pressure_score || 0) <= 0.24
        );

      const strongNegotiation =
        Number(derived.negotiation_pressure_score || 0) >= Number(decisionCfg.negotiationStrongScore || 0.28) ||
        (priceHoverCount >= Number(decisionCfg.priceHoverMin || 2) && timeOnPriceSec >= Number(decisionCfg.priceDwellSecMin || 4)) ||
        (priceHoverCount >= 1 && purchaseCtaIntentCount >= Number(decisionCfg.ctaIntentMin || 2)) ||
        stateLabel === "PRICE_SENSITIVE" ||
        stateLabel === "REASSURANCE_SEEKING";

      const matched = [];

      const expressRecent =
        recentCheckoutCount >= 1 ||
        (recentAddToCartCount >= 1 && Number(derived.express_checkout_score || 0) >= 0.32) ||
        (recentCommerceActionCount >= 2 && Number(derived.purchase_momentum_score || 0) >= 0.58);

      if (expressRecent && !researchStillActive) {
        matched.push({ ruleId: "R_EXPRESS", state: "EXPRESS_LANE", weight: 0.96 });
      }

      const priceRuleQualified =
        priceHoverCount >= 3 &&
        timeOnPriceSec >= 6 &&
        (
          cartAbandonCount >= 1 ||
          cartAddRemoveCount >= 1 ||
          purchaseCtaIntentCount >= 3 ||
          Number(derived.purchase_momentum_score || 0) >= 0.58 ||
          (totalVisits >= 2 && Number(derived.negotiation_pressure_score || 0) >= 0.34)
        );

      if (
        (priceRuleQualified || recentCommerceReengage) &&
        !expressRecent &&
        !researchRegain &&
        !researchDominant &&
        !(activeResearchSection && activeSectionAgeSec >= 5) &&
        !(activeOverviewSection && recentAddToCartCount === 0 && recentCheckoutCount === 0 && recentPriceEventCount === 0)
      ) {
        matched.push({ ruleId: "R_PRICE", state: "PRICE_ALERT_MODE", weight: recentCommerceReengage ? 0.92 : 0.90 });
      }

      if (
        (
          Number(rawSnapshot?.rageClicks || 0) >= 4 ||
          recentFrustrationBurst ||
          (Number(rawSnapshot?.mouseJitter || 0) >= 5 && Number(normalized.reversalRate || 0) >= 0.35)
        ) &&
        !(activeOverviewSection && !recentFrustrationBurst)
      ) {
        matched.push({ ruleId: "R_FRUSTRATION", state: "DESIGN_OXYGEN", weight: (recentFrustrationBurst && !researchStillActive) ? 0.95 : (recentFrustrationBurst ? 0.91 : 0.85) });
      }

      if (researchRegain) {
        matched.push({ ruleId: "R_RESEARCH_REGAIN", state: "RESEARCH_MODE", weight: researchDominant ? 0.95 : 0.89 });
      }

      const hesitantByPriceAndIntent =
        (priceHoverCount >= Number(decisionCfg.priceHoverMin || 2) && timeOnPriceSec >= Number(decisionCfg.priceDwellSecMin || 4)) ||
        (priceHoverCount >= 2 && purchaseCtaIntentCount >= 2) ||
        (purchaseCtaIntentCount >= 4 && timeOnPriceSec >= 3);
      const hesitantByExit =
        exitIntentCount >= 1 && (priceHoverCount >= 1 || purchaseCtaIntentCount >= 2 || cartAbandonCount >= 1);
      const hesitantByDerived =
        Number(derived.negotiation_pressure_score || 0) >= Math.max(Number(decisionCfg.negotiationStrongScore || 0.28), 0.34) ||
        (pageSummary.hasDiscountSignal && purchaseCtaIntentCount >= 2 && priceHoverCount >= 2);

      if (!researchDominant && !(activeResearchSection && activeSectionAgeSec >= 5) && (hesitantByPriceAndIntent || hesitantByExit || hesitantByDerived || cartAbandonCount >= 1 || recentCommerceReengage)) {
        matched.push({ ruleId: "R_HESITANT", state: "NEGOTIATOR_MODE", weight: (recentCommerceReengage && !researchStillActive) ? 0.9 : (strongNegotiation ? 0.86 : 0.81) });
      }

      if (
        !recentCommerceReengage &&
        !strongNegotiation &&
        (
          specDwellSec >= Number(decisionCfg.specDwellResearchSec || 10) ||
          descriptionDwellSec >= Number(decisionCfg.specDwellResearchSec || 10) ||
          Number(rawSnapshot?.sectionVisits?.specs || 0) >= 3 ||
          Number(rawSnapshot?.sectionVisits?.description || 0) >= 2 ||
          visitedCount >= 3 ||
          Number(derived.research_depth_score || 0) >= Number(decisionCfg.researchStrongScore || 0.44) ||
          (activeResearchSection && activeSectionAgeSec >= 4) ||
          stateLabel === "DEEP_RESEARCH"
        )
      ) {
        matched.push({ ruleId: "R_RESEARCH", state: "RESEARCH_MODE", weight: 0.77 });
      }

      if (
        !recentCommerceReengage &&
        !strongNegotiation &&
        (
          Number(rawSnapshot?.dwellEvents || 0) >= 6 ||
          Number(rawSnapshot?.deadClicks || 0) >= 4 ||
          (
            Number(derived.hesitation_score || 0) >= Number(decisionCfg.spotlightStrongScore || 0.34) &&
            Number(normalized.reversalRate || 0) >= 0.08
          ) ||
          stateLabel === "OVERLOADED" ||
          stateLabel === "FRUSTRATED"
        )
      ) {
        matched.push({ ruleId: "R_CONFUSED", state: "SPOTLIGHT_MODE", weight: 0.79 });
      }

      matched.sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0));
      return { winner: matched[0] || null, matched };
    }

    inferFunnelStage(rawSnapshot = {}) {
      const outcomes = rawSnapshot?.outcomes || {};
      const researchVisits =
        Number(rawSnapshot?.sectionVisits?.specs || 0) +
        Number(rawSnapshot?.sectionVisits?.reviews || 0) +
        Number(rawSnapshot?.sectionVisits?.description || 0);
      const reviewDwellSec = Number(rawSnapshot?.sectionDwellMs?.reviews || 0) / 1000;
      const specDwellSec = Number(rawSnapshot?.sectionDwellMs?.specs || 0) / 1000;
      const descriptionDwellSec = Number(rawSnapshot?.sectionDwellMs?.description || 0) / 1000;
      const strongResearch = researchVisits >= 2 || reviewDwellSec >= 10 || specDwellSec >= 10 || descriptionDwellSec >= 10;
      if (outcomes.purchase_completed) return "purchase";
      if (outcomes.checkout_started || rawSnapshot?.directCheckout) return "checkout";
      if (outcomes.added_to_cart) return "cart";
      if (strongResearch) return "research";
      if (outcomes.added_to_wishlist) return "wishlist";
      if (outcomes.intervention_exposed) return "intervention_exposed";
      if ((rawSnapshot?.sectionVisits?.specs || 0) > 0 || (rawSnapshot?.sectionVisits?.reviews || 0) > 0 || (rawSnapshot?.sectionVisits?.description || 0) > 0) return "research";
      return "product_view";
    }

    applySafetyPolicyOverride(decision = {}, featurePack = {}) {
      const decisionCfg = this.config.decision || {};
      const incoming = { ...decision };
      const d = featurePack?.derived || {};
      const n = featurePack?.normalized || {};
      const ctx = featurePack?.context || {};

      const strongFriction = Number(d.friction_score || 0) >= 0.5;
      const strongHesitation = Number(d.hesitation_score || 0) >= 0.45;
      const strongResearch = Number(d.research_depth_score || 0) >= Number(decisionCfg.researchStrongScore || 0.44);
      const highCoverage = Number(n.researchCoverage || 0) >= 0.45;
      const highReversal = Number(n.reversalRate || 0) >= 0.5;
      const safetyCtxFlags = (window.EmotionUIContextFlags?.deriveContextFlags || (() => ({})))(null, featurePack, {});
      const activeSection = safetyCtxFlags.activeSection || String(ctx.activeSection || "");
      const activeSectionAgeSec = safetyCtxFlags.activeSectionAgeSec || Number(ctx.activeSectionAgeSec || 0);
      const recentCommerceReengage = safetyCtxFlags.recentCommerceReengage ?? (
        Number(ctx.recentAddToCartCount || 0) >= 1 ||
        Number(ctx.recentCheckoutCount || 0) >= 1 ||
        (Number(ctx.recentWishlistCount || 0) >= 1 && Number(ctx.recentPriceEventCount || 0) >= 1) ||
        Number(ctx.recentCommerceActionCount || 0) >= 2 ||
        Number(d.decision_reengagement_score || 0) >= 0.55
      );
      const recentFrustrationBurst = safetyCtxFlags.recentFrustrationBurst ?? (
        Number(ctx.recentFrictionEventCount || 0) >= 2 ||
        Number(d.frustration_rebound_score || 0) >= 0.45
      );
      const researchStillActive = safetyCtxFlags.researchStillActive ?? (
        /^(reviews|specs|description)$/.test(activeSection) &&
        activeSectionAgeSec >= 4 &&
        !recentCommerceReengage &&
        !recentFrustrationBurst
      );
      const negotiationObserveUpgradeScore = Number(decisionCfg.negotiationObserveUpgradeScore || 0.24);
      const strongNegotiation = Number(d.negotiation_pressure_score || 0) >= negotiationObserveUpgradeScore ||
        (Number(ctx.priceHoverCount || 0) >= Number(decisionCfg.priceHoverMin || 2) && Number(ctx.timeOnPriceSec || 0) >= Number(decisionCfg.priceDwellSecMin || 4)) ||
        (Number(ctx.purchaseCtaIntentCount || 0) >= Number(decisionCfg.ctaIntentMin || 2) && Number(ctx.priceHoverCount || 0) >= 1) ||
        (Number(ctx.exitIntentCount || 0) >= 1 && (Number(ctx.cartAbandons || 0) >= 1 || Number(ctx.priceHoverCount || 0) >= 2));
      const negotiationReadyForIntervene =
        strongNegotiation &&
        Number(d.purchase_momentum_score || 0) >= 0.16 &&
        Number(d.hesitation_score || 0) < 0.42;
      const expressCheckout = Number(d.express_checkout_score || 0) >= 0.55 || Number(n.checkoutSignal || 0) >= 0.8;
      const lowSampleOrCold = Number(incoming.trained_samples || 0) < Number(((this.config.policy && this.config.policy.minSamplesForModelOnly) || 80));
      const modelSaysSilent = String(incoming.policy || "SILENT").toUpperCase() === "SILENT";
      const modelSaysObserve = String(incoming.policy || "SILENT").toUpperCase() === "OBSERVE";

      if (modelSaysSilent && (strongFriction || strongHesitation || strongResearch || highCoverage || highReversal || strongNegotiation || expressCheckout)) {
        const upgraded = (strongFriction || strongHesitation || negotiationReadyForIntervene || expressCheckout) ? "INTERVENE" : "OBSERVE";
        return {
          ...incoming,
          policy: upgraded,
          reason: lowSampleOrCold ? "safety_override_cold_start" : "safety_override_signal_strength",
          source: `${incoming.source || "policy_model"}+rules`,
          confidence: Math.max(Number(incoming.confidence || 0), upgraded === "INTERVENE" ? 0.52 : 0.4),
          abstained: false
        };
      }

      if (
        modelSaysObserve &&
        (negotiationReadyForIntervene || Number(d.decision_reengagement_score || 0) >= 0.52) &&
        !expressCheckout &&
        (!strongResearch || !researchStillActive) &&
        (!highCoverage || Number(d.decision_reengagement_score || 0) >= 0.72)
      ) {
        return {
          ...incoming,
          policy: "INTERVENE",
          reason: lowSampleOrCold ? "safety_upgrade_observe_to_intervene_negotiation_cold_start" : "safety_upgrade_observe_to_intervene_negotiation",
          source: `${incoming.source || "policy_model"}+rules`,
          confidence: Math.max(Number(incoming.confidence || 0), 0.52),
          abstained: false
        };
      }

      const sessionDurationSec = Number(ctx.sessionDurationSec || 0);
      if (sessionDurationSec < 3) {
        return {
          ...incoming,
          policy: "SILENT",
          reason: "safety_downgrade_too_early",
          source: `${incoming.source || "policy_model"}+rules`
        };
      }
      if (String(incoming.policy || "").toUpperCase() === "INTERVENE" && sessionDurationSec < 6) {
        return {
          ...incoming,
          policy: "OBSERVE",
          reason: "safety_downgrade_short_session",
          source: `${incoming.source || "policy_model"}+rules`
        };
      }

      if (String(incoming.policy || "").toUpperCase() === "INTERVENE" && strongResearch && !strongNegotiation && Number(d.purchase_momentum_score || 0) < 0.14) {
        return {
          ...incoming,
          policy: "OBSERVE",
          reason: "safety_research_intervene_downgraded_to_observe",
          source: `${incoming.source || "policy_model"}+rules`
        };
      }

      return incoming;
    }
  }

  window.EmotionUIRulesResolver = RulesResolver;
})();
