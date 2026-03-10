(() => {
  const CanonicalStates = window.EmotionUICanonicalStates || {};
  const StateContract = window.EmotionUIStateContract || {};
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
  const getStateDefinition = typeof StateContract.getStateDefinition === "function"
    ? StateContract.getStateDefinition.bind(StateContract)
    : (() => null);
  const getModeDefinition = typeof StateContract.getModeDefinition === "function"
    ? StateContract.getModeDefinition.bind(StateContract)
    : ((mode) => ({
        key: String(mode || "STANDARD").toUpperCase(),
        family: "neutral",
        default_intervention_type: "none",
        commercial: false
      }));

  class AdaptationMapper {
    constructor(config = {}) {
      this.config = {
        ...config
      };
    }

    map(input = {}) {
      const policy = String(input.policy || "SILENT").toUpperCase();
      const ruleWinner = input.ruleWinner || null;
      const featurePack = input.featurePack || {};
      const pageContext = input.pageContext || {};
      const stateClassification = input.stateClassification || {};
      const rawSnapshot = input.rawSnapshot || {};
      const stateLabel = String(stateClassification.label || LABELS.CALM_BROWSING).toUpperCase();
      const derived = featurePack.derived || {};
      const normalized = featurePack.normalized || {};
      const context = featurePack.context || {};
      const summary = pageContext.summary || {};
      const contract = getStateDefinition(stateLabel);

      if (policy === "SILENT") {
        return {
          mode: "STANDARD",
          intervention_type: "none",
          reason: "policy_silent",
          source: "adaptation_mapper",
          reasons: ["policy_silent"],
          confidence: Number(input.confidence || 0),
          state_contract_key: contract?.primary_state || stateLabel,
          state_contract_mode: contract?.default_mode || "STANDARD",
          state_contract_intervention_type: contract?.default_intervention_type || "none",
          state_contract_reason_families: Array.isArray(contract?.reason_families) ? contract.reason_families : []
        };
      }

      const baseMapping = this.mapStateLabel(stateLabel, summary, context, derived, normalized, rawSnapshot, input, contract);

      if (ruleWinner && ruleWinner.ruleId) {
        const mapped = this.applyRuleOverride(baseMapping, ruleWinner, stateLabel, summary, featurePack, rawSnapshot, input, contract);
        if (!mapped) return baseMapping;
        return {
          ...mapped,
          source: "adaptation_mapper+rule",
          reason: `${ruleWinner.ruleId}_mapped`,
          reasons: [`rule:${ruleWinner.ruleId}`, ...mapped.reasons],
          confidence: Number(ruleWinner.weight || input.confidence || 0),
          state_contract_key: contract?.primary_state || stateLabel,
          state_contract_mode: contract?.default_mode || "STANDARD",
          state_contract_intervention_type: contract?.default_intervention_type || "none",
          state_contract_reason_families: Array.isArray(contract?.reason_families) ? contract.reason_families : []
        };
      }

      return baseMapping;
    }

    mapStateLabel(stateLabel, summary, context, derived, normalized, rawSnapshot, input = {}, contract = null) {
      const reasons = [];
      const policy = String(input.policy || "SILENT").toUpperCase();
      const constraintTags = Array.isArray(input.stateClassification?.constraint_tags)
        ? input.stateClassification.constraint_tags
        : [];
      const defaultMode = contract?.default_mode || "STANDARD";
      const defaultIntervention = contract?.default_intervention_type || "none";
      const recentDecisionSignal = Number(normalized.recentDecisionSignal || 0);
      const recentFrictionSignal = Number(normalized.recentFrictionSignal || 0);
      const recentAddToCartCount = Number(context.recentAddToCartCount || 0);
      const recentCheckoutCount = Number(context.recentCheckoutCount || 0);
      const recentWishlistCount = Number(context.recentWishlistCount || 0);
      const recentCommerceActionCount = Number(context.recentCommerceActionCount || 0);
      const purchaseCtaIntentCount = Number(context.purchaseCtaIntentCount || 0);
      const recentFrictionEventCount = Number(context.recentFrictionEventCount || 0);
      const sessionCommerceMemorySignal = Number(normalized.sessionCommerceMemorySignal || context.sessionCommerceMemorySignal || 0);
      const activeSection = String(context.activeSection || rawSnapshot.activeSection || "");
      const activeSectionAgeSec = Number(context.activeSectionAgeSec || 0);
      const activeOverviewSection = /^(gallery|overview|variants)$/.test(activeSection);
      const recentCommerceReengage =
        recentDecisionSignal >= 0.55 ||
        recentAddToCartCount >= 1 ||
        recentCheckoutCount >= 1 ||
        (recentWishlistCount >= 1 && Number(normalized.recentPriceSignal || 0) >= 0.5) ||
        (purchaseCtaIntentCount >= 1 && Number(normalized.recentPriceSignal || 0) >= 0.45) ||
        (!activeOverviewSection && recentCommerceActionCount >= 2);
      const recentFrustrationBurst =
        recentFrictionSignal >= 0.55 ||
        recentFrictionEventCount >= 2;
      const researchStillActive =
        /^(reviews|specs|description)$/.test(activeSection) &&
        activeSectionAgeSec >= 4 &&
        !recentCommerceReengage &&
        !recentFrustrationBurst;
      const overviewBrowsingOnly =
        activeOverviewSection &&
        recentAddToCartCount === 0 &&
        recentCheckoutCount === 0 &&
        purchaseCtaIntentCount === 0 &&
        Number(normalized.recentPriceSignal || 0) < 0.35;

      switch (stateLabel) {
        case LABELS.DECISION_READY:
          reasons.push("state_decision_ready");
          if (overviewBrowsingOnly) {
            reasons.push("overview_browsing_only");
            return this.result("STANDARD", "none", reasons, input, contract);
          }
          if (Number(derived.express_checkout_score || 0) >= 0.3 || Number(normalized.checkoutSignal || 0) >= 0.4 || Boolean(rawSnapshot.directCheckout)) {
            reasons.push("express_signal_present");
            return this.result("EXPRESS_LANE", "express_checkout", reasons, input, contract);
          }
          return this.result("NEGOTIATOR_MODE", "value_reassurance", reasons, input, contract);
        case LABELS.PRICE_SENSITIVE:
          reasons.push("state_price_sensitive");
          return this.result("PRICE_ALERT_MODE", "price_reassurance", reasons, input, contract);
        case LABELS.REASSURANCE_SEEKING:
          reasons.push("state_reassurance_seeking");
          if (constraintTags.includes("TRUST_CONSTRAINT") && !summary.hasDiscountSignal && !summary.hasInstallmentSignal) {
            reasons.push("trust_constraint_dominant");
            return this.result(defaultMode, defaultIntervention, reasons, input, contract);
          }
          return this.result(
            "NEGOTIATOR_MODE",
            summary.hasDiscountSignal || summary.hasInstallmentSignal ? "price_reassurance" : "value_reassurance",
            reasons,
            input,
            contract
          );
        case LABELS.DEEP_RESEARCH:
          reasons.push("state_deep_research");
          if (
            !researchStillActive &&
            (
              recentCheckoutCount >= 1 ||
              recentAddToCartCount >= 1 ||
              recentDecisionSignal >= 0.75 ||
              (
                sessionCommerceMemorySignal >= 0.7 &&
                (
                  Number(derived.purchase_momentum_score || 0) >= 0.56 ||
                  Number(derived.express_checkout_score || 0) >= 0.32 ||
                  Number(context.purchaseCtaIntentCount || 0) >= 2
                )
              )
            )
          ) {
            reasons.push("recent_decision_reengage");
            if (recentCheckoutCount >= 1 || Number(derived.express_checkout_score || 0) >= 0.28) {
              return this.result("EXPRESS_LANE", "express_checkout", reasons, input, contract);
            }
            return this.result("NEGOTIATOR_MODE", (recentWishlistCount >= 1 || sessionCommerceMemorySignal >= 0.7) ? "value_reassurance" : "price_reassurance", reasons, input, contract);
          }
          if (!researchStillActive && (recentFrictionSignal >= 0.55 || recentFrictionEventCount >= 2)) {
            reasons.push("recent_friction_rebound");
            return this.result("DESIGN_OXYGEN", "friction_relief", reasons, input, contract);
          }
          return this.result("RESEARCH_MODE", "research_assist", reasons, input, contract);
        case LABELS.EXPLORING:
          reasons.push("state_exploring");
          if (!researchStillActive && (recentAddToCartCount >= 1 || recentCheckoutCount >= 1 || recentCommerceActionCount >= 2)) {
            reasons.push("exploring_recent_commerce_reengage");
            return this.result("NEGOTIATOR_MODE", "value_reassurance", reasons, input, contract);
          }
          if (
            Number(context.visitedCount || 0) >= 2 &&
            (
              Number(normalized.reviewFocusRatio || 0) >= 0.15 ||
              Number(normalized.specFocusRatio || 0) >= 0.15
            )
          ) {
            reasons.push("info_zones_actively_used");
            return this.result("RESEARCH_MODE", "research_assist", reasons, input, contract);
          }
          return this.result(defaultMode, defaultIntervention, reasons, input, contract);
        case LABELS.FRUSTRATED:
          reasons.push("state_frustrated");
          return this.result("DESIGN_OXYGEN", "friction_relief", reasons, input, contract);
        case LABELS.OVERLOADED:
          reasons.push("state_overloaded");
          return this.result("SPOTLIGHT_MODE", "focus_guidance", reasons, input, contract);
        default:
          reasons.push("state_calm_browsing");
          return this.result(defaultMode, policy === "INTERVENE" ? "focus_guidance" : defaultIntervention, reasons, input, contract);
      }
    }

    applyRuleOverride(baseMapping, ruleWinner, stateLabel, pageSummary, featurePack = {}, rawSnapshot = {}, input = {}, contract = null) {
      const derived = featurePack.derived || {};
      const context = featurePack.context || {};
      const reviewDwellSec = Number(context.reviewDwellSec || 0);
      const specDwellSec = Number(rawSnapshot?.sectionDwellMs?.specs || 0) / 1000;
      const descriptionDwellSec = Number(context.descriptionDwellSec || 0);
      const infoZoneDwellSec = Number(context.infoZoneDwellSec || 0);
      const activeSection = String(context.activeSection || rawSnapshot.activeSection || "");
      const recentCheckoutCount = Number(context.recentCheckoutCount || 0);
      const recentAddToCartCount = Number(context.recentAddToCartCount || 0);
      const recentWishlistCount = Number(context.recentWishlistCount || 0);
      const recentPriceEventCount = Number(context.recentPriceEventCount || 0);
      const recentCommerceActionCount = Number(context.recentCommerceActionCount || 0);
      const recentDecisionSignal = Number(featurePack?.normalized?.recentDecisionSignal || 0);
      const recentPriceSignal = Number(featurePack?.normalized?.recentPriceSignal || 0);
      const recentFrictionSignal = Number(featurePack?.normalized?.recentFrictionSignal || 0);
      const researchStrong =
        Number(derived.research_depth_score || 0) >= 0.6 &&
        (
          stateLabel === LABELS.DEEP_RESEARCH ||
          reviewDwellSec >= 18 ||
          specDwellSec >= 12 ||
          descriptionDwellSec >= 12 ||
          infoZoneDwellSec >= 36 ||
          /^(reviews|specs|description)$/.test(activeSection)
        );
      const researchMapped = baseMapping.mode === "RESEARCH_MODE";
      const activeOverviewSection = /^(gallery|overview|variants)$/.test(activeSection);
      const recentCommerceReengage =
        recentCheckoutCount >= 1 ||
        recentAddToCartCount >= 1 ||
        (recentWishlistCount >= 1 && recentPriceEventCount >= 1) ||
        recentCommerceActionCount >= 2 ||
        recentDecisionSignal >= 0.65;
      const overviewBrowsingOnly =
        activeOverviewSection &&
        recentAddToCartCount === 0 &&
        recentCheckoutCount === 0 &&
        recentPriceSignal < 0.35 &&
        recentFrictionSignal < 0.45;

      switch (String(ruleWinner.ruleId || "")) {
        case "R_EXPRESS":
          if (
            !recentCommerceReengage ||
            (researchMapped && !recentCheckoutCount && !recentAddToCartCount)
          ) {
            return null;
          }
          return this.mapRuleWinner(ruleWinner, stateLabel, pageSummary);
        case "R_FRUSTRATION":
          if (overviewBrowsingOnly) {
            return null;
          }
          return this.mapRuleWinner(ruleWinner, stateLabel, pageSummary);
        case "R_RESEARCH_REGAIN":
          return this.mapRuleWinner(ruleWinner, stateLabel, pageSummary);
        case "R_RESEARCH":
          return researchMapped
            ? null
            : this.mapRuleWinner(ruleWinner, stateLabel, pageSummary);
        case "R_PRICE":
          if (recentCheckoutCount >= 1 || recentAddToCartCount >= 1) {
            return null;
          }
          if (overviewBrowsingOnly) {
            return null;
          }
          return this.mapRuleWinner(ruleWinner, stateLabel, pageSummary);
        case "R_HESITANT":
          if (researchMapped || researchStrong) {
            return null;
          }
          if (overviewBrowsingOnly && recentPriceSignal < 0.45) {
            return null;
          }
          return this.mapRuleWinner(ruleWinner, stateLabel, pageSummary);
        case "R_CONFUSED":
          if (researchMapped && researchStrong) {
            return null;
          }
          return this.mapRuleWinner(ruleWinner, stateLabel, pageSummary);
        default:
          return this.mapRuleWinner(ruleWinner, stateLabel, pageSummary);
      }
    }

    mapRuleWinner(ruleWinner, stateLabel, pageSummary) {
      switch (String(ruleWinner.ruleId || "")) {
        case "R_EXPRESS":
          return { mode: "EXPRESS_LANE", intervention_type: "express_checkout", reasons: ["rule_express"] };
        case "R_PRICE":
          return { mode: "PRICE_ALERT_MODE", intervention_type: "price_reassurance", reasons: ["rule_price"] };
        case "R_HESITANT":
          return {
            mode: stateLabel === LABELS.REASSURANCE_SEEKING ? "NEGOTIATOR_MODE" : "PRICE_ALERT_MODE",
            intervention_type: pageSummary.hasDiscountSignal || pageSummary.hasInstallmentSignal ? "price_reassurance" : "value_reassurance",
            reasons: ["rule_hesitant"]
          };
        case "R_FRUSTRATION":
          return { mode: "DESIGN_OXYGEN", intervention_type: "friction_relief", reasons: ["rule_frustration"] };
        case "R_CONFUSED":
          return { mode: "SPOTLIGHT_MODE", intervention_type: "focus_guidance", reasons: ["rule_confused"] };
        case "R_RESEARCH":
        case "R_RESEARCH_REGAIN":
          return { mode: "RESEARCH_MODE", intervention_type: "research_assist", reasons: ["rule_research"] };
        default:
          return { mode: "STANDARD", intervention_type: "none", reasons: ["rule_unknown_fallback"] };
      }
    }

    result(mode, interventionType, reasons, input = {}, contract = null) {
      const modeDefinition = getModeDefinition(mode);
      return {
        mode,
        intervention_type: interventionType,
        reason: "state_mapper",
        source: "adaptation_mapper",
        reasons,
        confidence: Number(input.confidence || input.stateClassification?.confidence || 0),
        state_contract_key: contract?.primary_state || String(input.stateClassification?.label || ""),
        state_contract_mode: contract?.default_mode || modeDefinition.key,
        state_contract_intervention_type: contract?.default_intervention_type || modeDefinition.default_intervention_type || interventionType,
        state_contract_reason_families: Array.isArray(contract?.reason_families) ? contract.reason_families : []
      };
    }
  }

  window.EmotionUIAdaptationMapper = AdaptationMapper;
})();
