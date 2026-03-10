(() => {
  /**
   * ContextFlags — shared boolean flag derivation for the pipeline.
   *
   * Computes stable boolean context flags once from (raw, featurePack, pageContext)
   * and exposes them so stateClassifier, reasonCodeEngine, rulesResolver, and
   * adaptationMapper all agree on the same definitions. Eliminates flag drift.
   */

  function deriveContextFlags(raw = {}, featurePack = {}, pageContext = {}) {
    const normalized = featurePack.normalized || {};
    const derived = featurePack.derived || {};
    const context = featurePack.context || {};

    const activeSection = String(context.activeSection || raw.activeSection || "");
    const activeSectionAgeSec = Number(context.activeSectionAgeSec || 0);

    const recentAddToCartCount = Number(context.recentAddToCartCount || 0);
    const recentCheckoutCount = Number(context.recentCheckoutCount || 0);
    const recentWishlistCount = Number(context.recentWishlistCount || 0);
    const recentCommerceActionCount = Number(context.recentCommerceActionCount || 0);
    const recentFrictionEventCount = Number(context.recentFrictionEventCount || 0);
    const purchaseCtaIntentCount = Number(context.purchaseCtaIntentCount || 0);
    const recentPriceEventCount = Number(context.recentPriceEventCount || 0);

    const recentDecisionSignal = Number(normalized.recentDecisionSignal || 0);
    const recentPriceSignal = Number(normalized.recentPriceSignal || 0);
    const recentFrictionSignal = Number(normalized.recentFrictionSignal || 0);

    const activeResearchSection = /^(reviews|specs|description|faq)$/.test(activeSection);
    const activeOverviewSection = /^(gallery|overview|variants)$/.test(activeSection);
    const activeCompareSection = activeSection === "compare";

    const recentCommerceReengage =
      recentDecisionSignal >= 0.55 ||
      recentAddToCartCount >= 1 ||
      recentCheckoutCount >= 1 ||
      (recentWishlistCount >= 1 && recentPriceSignal >= 0.5) ||
      (purchaseCtaIntentCount >= 1 && recentPriceSignal >= 0.45) ||
      (!activeOverviewSection && recentCommerceActionCount >= 2);

    const recentCommerceDormant =
      recentAddToCartCount === 0 &&
      recentCheckoutCount === 0 &&
      recentCommerceActionCount === 0 &&
      recentDecisionSignal < 0.45 &&
      recentPriceSignal < 0.45;

    const recentFrustrationBurst =
      recentFrictionSignal >= 0.55 ||
      recentFrictionEventCount >= 2;

    const researchStillActive =
      activeResearchSection &&
      activeSectionAgeSec >= 4 &&
      !recentCommerceReengage &&
      !recentFrustrationBurst;

    const overviewBrowsingOnly =
      activeOverviewSection &&
      recentAddToCartCount === 0 &&
      recentCheckoutCount === 0 &&
      purchaseCtaIntentCount === 0 &&
      recentPriceSignal < 0.35 &&
      recentFrictionEventCount === 0;

    return {
      activeSection,
      activeSectionAgeSec,
      activeResearchSection,
      activeOverviewSection,
      activeCompareSection,
      recentCommerceReengage,
      recentCommerceDormant,
      recentFrustrationBurst,
      researchStillActive,
      overviewBrowsingOnly
    };
  }

  window.EmotionUIContextFlags = { deriveContextFlags };
})();
