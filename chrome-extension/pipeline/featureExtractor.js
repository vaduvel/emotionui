(() => {
  class FeatureExtractor {
    constructor(config = {}) {
      this.config = {
        maxClicksPerMinute: 45,
        maxSectionSwitchPerMinute: 12,
        maxReadingSpeedIndex: 6,
        maxExposureCount: 8,
        maxPriceHoverEvents: 4,
        maxCartIntentEvents: 5,
        minSessionSecondsForStableSignals: 5,
        recentSignalWindowMs: 15000,
        recentResearchWindowMs: 15000,
        recentFrictionWindowMs: 15000,
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

    sum(values = {}) {
      return Object.values(values).reduce((acc, v) => acc + (Number(v) || 0), 0);
    }

    sumMapMatches(values = {}, pattern) {
      if (!values || typeof values !== "object" || !(pattern instanceof RegExp)) return 0;
      let total = 0;
      for (const [key, value] of Object.entries(values)) {
        if (!pattern.test(String(key || ""))) continue;
        total += Number(value || 0);
      }
      return total;
    }

    max(values = []) {
      let value = 0;
      for (const item of values) {
        const n = Number(item || 0);
        if (n > value) value = n;
      }
      return value;
    }

    countRecentEvents(events = [], windowMs = 0, matcher = null) {
      if (!Array.isArray(events) || !events.length || !windowMs) return 0;
      const latestTs = Number(events[events.length - 1]?.ts || Date.now());
      const minTs = latestTs - Number(windowMs || 0);
      let total = 0;
      for (const event of events) {
        const ts = Number(event?.ts || 0);
        if (!ts || ts < minTs) continue;
        if (typeof matcher === "function" && !matcher(event)) continue;
        total += 1;
      }
      return total;
    }

    computeHalfLifeDecay(ageMs = 0, halfLifeMs = 0) {
      const safeAgeMs = Math.max(0, Number(ageMs || 0));
      const safeHalfLifeMs = Math.max(1, Number(halfLifeMs || 1));
      return Math.pow(0.5, safeAgeMs / safeHalfLifeMs);
    }

    scoreRecentEvents(events = [], options = {}) {
      if (!Array.isArray(events) || !events.length) return 0;
      const {
        referenceTs = Date.now(),
        halfLifeMs = this.config.recentSignalWindowMs,
        matcher = null,
        weightFn = null,
        aggregate = "max",
        cap = 1
      } = options;

      let maxScore = 0;
      let sumScore = 0;

      for (const event of events) {
        const ts = Number(event?.ts || 0);
        if (!ts) continue;
        if (typeof matcher === "function" && !matcher(event)) continue;
        const weight = typeof weightFn === "function" ? Number(weightFn(event) || 0) : 1;
        if (weight <= 0) continue;
        const ageMs = Math.max(0, Number(referenceTs || 0) - ts);
        const score = this.computeHalfLifeDecay(ageMs, halfLifeMs) * weight;
        if (score > maxScore) maxScore = score;
        sumScore += score;
      }

      if (aggregate === "sum") {
        return this.clamp01(Math.min(Number(cap || 1), sumScore));
      }
      return this.clamp01(Math.min(Number(cap || 1), maxScore));
    }

    nonZeroKeys(values = {}) {
      return Object.entries(values)
        .filter(([, v]) => Number(v) > 0)
        .map(([k]) => k);
    }

    extract(raw = {}) {
      const sessionDurationSec = Math.max(1, Number(raw.sessionDurationSec || 0));
      const sessionMinutes = Math.max(1 / 60, sessionDurationSec / 60);
      const sectionDwellMs = raw.sectionDwellMs || {};
      const sectionVisits = raw.sectionVisits || {};

      const sectionDwellTotalMs = this.sum(sectionDwellMs);
      const sectionDwellTotalSec = sectionDwellTotalMs / 1000;
      const visitedSections = this.nonZeroKeys(sectionVisits);
      const visitedCount = visitedSections.length;
      const sectionSwitches = Number(raw.sectionSwitches || 0);
      const clicks = Number(raw.clicks || 0);
      const scrollEvents = Number(raw.scrollEvents || 0);
      const scrollReversals = Number(raw.scrollReversals || 0);
      const mouseJitter = Number(raw.mouseJitter || 0);
      const deadClicks = Number(raw.deadClicks || 0);
      const exitIntent = Number(raw.exitIntent || 0);
      const dwellEvents = Number(raw.dwellEvents || 0);
      const cartAddRemove = Number(raw.cartAddRemove || 0);
      const priceHover = Number(raw.priceHover || 0);
      const timeOnPriceMs = Number(raw.timeOnPriceMs || 0);
      const cartAbandons = Number(raw.cartAbandons || 0);
      const directCheckout = Boolean(raw.directCheckout || raw.outcomes?.checkout_started);
      const purchaseCompleted = Boolean(raw.outcomes?.purchase_completed);
      const exposureCount = (raw.policy && Array.isArray(raw.policy.history)) ? raw.policy.history.length : 0;
      const hoverDurationMsTotal = this.sum(raw.hoverDurationByTargetMs || {});
      const eventLog = Array.isArray(raw.eventLog) ? raw.eventLog : [];
      const purchaseCtaPattern = /(add to cart|buy now|checkout|adauga in cos|cumpara|comanda|finalizeaza|plaseaza)/i;
      const wishlistPattern = /(wishlist|favorite|favourite|salveaza)/i;
      // Cap hover-based intent at conservative limits — related product carousels on sites
      // like Dedeman can produce 40+ hover signals from passive mouse movement. Click-based
      // signals are uncapped since those reflect real intent.
      const purchaseCtaIntentCount =
        this.sumMapMatches(raw.clickTargets || {}, purchaseCtaPattern) +
        Math.min(6, this.sumMapMatches(raw.hoverTargets || {}, purchaseCtaPattern));
      const wishlistIntentCount =
        this.sumMapMatches(raw.clickTargets || {}, wishlistPattern) +
        Math.min(4, this.sumMapMatches(raw.hoverTargets || {}, wishlistPattern));
      const ctaIntentCount = purchaseCtaIntentCount + wishlistIntentCount;
      const recentPriceEventCount = this.countRecentEvents(
        eventLog,
        this.config.recentSignalWindowMs,
        (event) => ["price_hover", "price_interaction_click"].includes(String(event?.type || ""))
      );
      const recentWishlistCount = this.countRecentEvents(
        eventLog,
        this.config.recentSignalWindowMs,
        (event) => String(event?.type || "") === "wishlist_toggle"
      );
      const recentAddToCartCount = this.countRecentEvents(
        eventLog,
        this.config.recentSignalWindowMs,
        (event) => String(event?.type || "") === "add_to_cart"
      );
      const recentCheckoutCount = this.countRecentEvents(
        eventLog,
        this.config.recentSignalWindowMs,
        (event) => String(event?.type || "") === "checkout_started"
      );
      const recentResearchSwitchCount = this.countRecentEvents(
        eventLog,
        this.config.recentResearchWindowMs,
        (event) => String(event?.type || "") === "section_switch" && /^(reviews|specs|description)$/.test(String(event?.section || ""))
      );
      const recentRageCount = this.countRecentEvents(
        eventLog,
        this.config.recentFrictionWindowMs,
        (event) => String(event?.type || "") === "rage_click"
      );
      const recentDeadClickCount = this.countRecentEvents(
        eventLog,
        this.config.recentFrictionWindowMs,
        (event) => String(event?.type || "") === "dead_click"
      );
      const recentJitterCount = this.countRecentEvents(
        eventLog,
        this.config.recentFrictionWindowMs,
        (event) => String(event?.type || "") === "mouse_jitter"
      );
      const recentCompareViewCount = this.countRecentEvents(
        eventLog,
        this.config.recentSignalWindowMs,
        (event) => ["compare_view", "compare_price_check"].includes(String(event?.type || ""))
      );
      const commerceEventTypes = ["add_to_cart", "checkout_started", "wishlist_toggle"];
      const referenceTs = Math.max(
        Date.now(),
        Number(eventLog[eventLog.length - 1]?.ts || 0),
        Number(raw.pageStartTs || 0)
      );
      const recentAddToCartDecayScore = this.scoreRecentEvents(eventLog, {
        referenceTs,
        halfLifeMs: this.config.decisionSignalHalfLifeMs,
        matcher: (event) => String(event?.type || "") === "add_to_cart"
      });
      const recentCheckoutDecayScore = this.scoreRecentEvents(eventLog, {
        referenceTs,
        halfLifeMs: this.config.decisionSignalHalfLifeMs,
        matcher: (event) => String(event?.type || "") === "checkout_started"
      });
      const recentWishlistDecayScore = this.scoreRecentEvents(eventLog, {
        referenceTs,
        halfLifeMs: this.config.decisionSignalHalfLifeMs,
        matcher: (event) => String(event?.type || "") === "wishlist_toggle"
      });
      const recentPriceDecayScore = this.scoreRecentEvents(eventLog, {
        referenceTs,
        halfLifeMs: this.config.priceSignalHalfLifeMs,
        matcher: (event) => ["price_hover", "price_interaction_click"].includes(String(event?.type || "")),
        aggregate: "sum"
      });
      const recentResearchDecayScore = this.scoreRecentEvents(eventLog, {
        referenceTs,
        halfLifeMs: this.config.researchSignalHalfLifeMs,
        matcher: (event) => String(event?.type || "") === "section_switch" && /^(reviews|specs|description)$/.test(String(event?.section || "")),
        aggregate: "sum"
      });
      const recentRageDecayScore = this.scoreRecentEvents(eventLog, {
        referenceTs,
        halfLifeMs: this.config.frictionSignalHalfLifeMs,
        matcher: (event) => String(event?.type || "") === "rage_click"
      });
      const recentDeadClickDecayScore = this.scoreRecentEvents(eventLog, {
        referenceTs,
        halfLifeMs: this.config.frictionSignalHalfLifeMs,
        matcher: (event) => String(event?.type || "") === "dead_click",
        aggregate: "sum"
      });
      const recentJitterDecayScore = this.scoreRecentEvents(eventLog, {
        referenceTs,
        halfLifeMs: this.config.frictionSignalHalfLifeMs,
        matcher: (event) => String(event?.type || "") === "mouse_jitter",
        aggregate: "sum",
        cap: 0.9
      });
      const recentCommerceActionDecayScore = this.scoreRecentEvents(eventLog, {
        referenceTs,
        halfLifeMs: this.config.decisionSignalHalfLifeMs,
        matcher: (event) => commerceEventTypes.includes(String(event?.type || "")),
        aggregate: "sum"
      });
      const recentCompareViewDecayScore = this.scoreRecentEvents(eventLog, {
        referenceTs,
        halfLifeMs: this.config.priceSignalHalfLifeMs,
        matcher: (event) => ["compare_view", "compare_price_check"].includes(String(event?.type || "")),
        aggregate: "sum",
        cap: 0.8
      });
      const recentCommerceActionCount = recentWishlistCount + recentAddToCartCount + recentCheckoutCount;
      const recentFrictionEventCount = recentRageCount + recentDeadClickCount + recentJitterCount;
      const lastCommerceEvent = eventLog.length
        ? [...eventLog].reverse().find((e) => commerceEventTypes.includes(String(e?.type || "")))
        : null;
      const msSinceLastCommerce = lastCommerceEvent && lastCommerceEvent.ts
        ? Math.max(0, referenceTs - Number(lastCommerceEvent.ts))
        : null;
      // Full strength for a short period, then decays to a configurable floor.
      const commerceMemoryDecay = msSinceLastCommerce === null
        ? 1.0
        : msSinceLastCommerce < Number(this.config.commerceMemoryFullStrengthMs || 30000)
          ? 1.0
          : Math.max(
            Number(this.config.commerceMemoryFloor || 0.45),
            1.0 - (
              msSinceLastCommerce - Number(this.config.commerceMemoryFullStrengthMs || 30000)
            ) / Math.max(1, Number(this.config.commerceMemoryDecayWindowMs || 120000))
          );
      const sessionCommerceMemorySignal = this.clamp01(this.max([
        directCheckout ? 1 : 0,
        raw.outcomes?.checkout_started ? 0.9 : 0,
        raw.outcomes?.added_to_cart ? 0.78 : 0,
        Math.min(0.72, (cartAddRemove / Math.max(1, this.config.maxCartIntentEvents)) * 0.72),
        Math.min(0.48, (purchaseCtaIntentCount / 6) * 0.48),
        Math.min(0.30, (wishlistIntentCount / 4) * 0.30)
      ]) * commerceMemoryDecay);
      const recentDecisionSignalCount = this.clamp01(this.max([
        recentAddToCartCount >= 1 ? 1 : 0,
        recentCheckoutCount >= 1 ? 1 : 0,
        (recentWishlistCount >= 1 && recentPriceEventCount >= 1) ? 0.8 : 0,
        (recentAddToCartCount + recentCheckoutCount) / 2
      ]));
      const recentDecisionSignalDecay = this.clamp01(this.max([
        recentAddToCartDecayScore,
        recentCheckoutDecayScore,
        (recentWishlistDecayScore >= 0.2 && recentPriceDecayScore >= 0.2)
          ? Math.min(recentWishlistDecayScore, recentPriceDecayScore) * 0.88
          : 0,
        this.clamp01(recentAddToCartDecayScore + (0.85 * recentCheckoutDecayScore))
      ]));
      const recentDecisionSignal = this.clamp01(this.max([
        recentDecisionSignalDecay,
        recentDecisionSignalCount * 0.65
      ]));
      // Decay price signal when user has since navigated to a non-price section (compare, research, gallery)
      const activeSection = String(raw.activeSection || "");
      const activeSectionAgeMs = Number(raw.activeSectionAgeMs || 0);
      const priceSignalDecay = /^(compare|reviews|specs|description|faq|gallery)$/.test(activeSection) && activeSectionAgeMs >= 5000
        ? Math.max(0.4, 1 - (activeSectionAgeMs - 5000) / 25000)
        : 1.0;
      const recentPriceSignalCount = this.clamp01(this.max([
        recentPriceEventCount / 3,
        (recentPriceEventCount >= 1 && recentCommerceActionCount >= 1) ? 0.75 : 0
      ]));
      const recentPriceSignalDecay = this.clamp01(this.max([
        recentPriceDecayScore,
        (recentPriceDecayScore >= 0.2 && recentCommerceActionDecayScore >= 0.2)
          ? Math.min(recentPriceDecayScore, recentCommerceActionDecayScore) * 0.8
          : 0,
        recentCompareViewDecayScore * 0.7
      ]));
      const recentPriceSignal = this.clamp01(this.max([
        recentPriceSignalDecay,
        recentPriceSignalCount * 0.55
      ]) * priceSignalDecay);
      const recentResearchSignalCount = this.clamp01(this.max([
        recentResearchSwitchCount / 2,
        /^(reviews|specs|description)$/.test(String(raw.activeSection || "")) && Number(raw.activeSectionAgeMs || 0) >= 4000 ? 1 : 0
      ]));
      const activeResearchPresenceSignal = /^(reviews|specs|description)$/.test(activeSection)
        ? this.clamp01(activeSectionAgeMs / 5000)
        : 0;
      const recentResearchSignalDecay = this.clamp01(this.max([
        recentResearchDecayScore,
        activeResearchPresenceSignal
      ]));
      const recentResearchSignal = this.clamp01(this.max([
        recentResearchSignalDecay,
        recentResearchSignalCount * 0.6
      ]));
      const recentFrictionSignalCount = this.clamp01(this.max([
        recentRageCount >= 1 ? 1 : 0,
        recentDeadClickCount / 2,
        recentJitterCount >= 1 ? 0.7 : 0,
        recentFrictionEventCount / 4
      ]));
      const recentFrictionSignalDecay = this.clamp01(this.max([
        recentRageDecayScore,
        recentDeadClickDecayScore,
        recentJitterDecayScore,
        this.clamp01(recentRageDecayScore + (0.45 * recentDeadClickDecayScore) + (0.3 * recentJitterDecayScore))
      ]));
      const recentFrictionSignal = this.clamp01(this.max([
        recentFrictionSignalDecay,
        recentFrictionSignalCount * 0.7
      ]));

      const scrolledPercentage = this.clamp01(Number(raw.maxScrollPercentage || 0));
      const clickRatePerMinute = clicks / sessionMinutes;
      const sectionSwitchPerMinute = sectionSwitches / sessionMinutes;
      const scrollReversalRate = scrollReversals / Math.max(1, scrollEvents);
      const deadClickRate = deadClicks / Math.max(1, clicks);
      const reviewFocusRatio = sectionDwellTotalMs > 0 ? Number(sectionDwellMs.reviews || 0) / sectionDwellTotalMs : 0;
      const specFocusRatio = sectionDwellTotalMs > 0 ? Number(sectionDwellMs.specs || 0) / sectionDwellTotalMs : 0;
      const dampedClickRate = Math.log1p(clickRatePerMinute) / Math.log1p(this.config.maxClicksPerMinute);
      const dampedSwitchRate = Math.log1p(sectionSwitchPerMinute) / Math.log1p(this.config.maxSectionSwitchPerMinute);

      const averageSectionDwellSec = visitedCount > 0 ? (sectionDwellTotalSec / visitedCount) : 0;
      const readingSpeedIndex = averageSectionDwellSec > 0
        ? Math.min(this.config.maxReadingSpeedIndex, 60 / averageSectionDwellSec)
        : 0;

      const normalized = {
        scrolledPercentage: this.clamp01(scrolledPercentage),
        clickRate: this.clamp01(dampedClickRate),
        sectionSwitchRate: this.clamp01(dampedSwitchRate),
        averageReadingSpeed: this.clamp01(readingSpeedIndex / this.config.maxReadingSpeedIndex),
        reviewFocusRatio: this.clamp01(reviewFocusRatio),
        specFocusRatio: this.clamp01(specFocusRatio),
        researchCoverage: this.clamp01(visitedCount / 5),
        reversalRate: this.clamp01(scrollReversalRate),
        rageClicks: this.clamp01(Number(raw.rageClicks || 0) / 6),
        mouseJitter: this.clamp01(mouseJitter / 16),
        deadClickRate: this.clamp01(deadClickRate),
        exitIntentSignal: this.clamp01(exitIntent / 3),
        dwellSignal: this.clamp01(dwellEvents / 6),
        priceHoverSignal: this.clamp01(this.max([
          priceHover / this.config.maxPriceHoverEvents,
          timeOnPriceMs / 15000
        ]) * (recentCompareViewCount >= 1 ? 0.45 : 1.0)),
        cartIntentSignal: this.clamp01(this.max([
          cartAddRemove / this.config.maxCartIntentEvents,
          purchaseCtaIntentCount / (this.config.maxCartIntentEvents * 2)
        ])),
        checkoutSignal: directCheckout ? 1 : 0,
        cartAbandonSignal: this.clamp01(cartAbandons / 3),
        purchaseCompleteSignal: purchaseCompleted ? 1 : 0,
        policyExposure: this.clamp01(Math.log1p(exposureCount) / Math.log1p(this.config.maxExposureCount)),
        wishlistSignal: this.clamp01(
          (raw.outcomes?.added_to_wishlist ? 0.75 : 0) +
          Math.min(0.35, wishlistIntentCount / 6)
        ),
        interventionClosed: raw.outcomes?.intervention_closed ? 1 : 0,
        reviewReadLong: raw.outcomes?.review_dwell_over_10s ? 1 : 0,
        bounceRisk: this.clamp01(1 - sessionDurationSec / this.config.minSessionSecondsForStableSignals),
        recentDecisionSignal: this.round(recentDecisionSignal),
        recentPriceSignal: this.round(recentPriceSignal),
        recentResearchSignal: this.round(recentResearchSignal),
        recentFrictionSignal: this.round(recentFrictionSignal),
        sessionCommerceMemorySignal: this.round(sessionCommerceMemorySignal)
      };

      const derived = {
        friction_score: this.round(this.clamp01(
          0.30 * normalized.rageClicks +
          0.22 * normalized.reversalRate +
          0.16 * normalized.clickRate +
          0.16 * normalized.deadClickRate +
          0.16 * normalized.mouseJitter
        )),
        hesitation_score: this.round(this.clamp01(
          0.24 * normalized.reversalRate +
          0.14 * normalized.sectionSwitchRate +
          0.12 * normalized.interventionClosed +
          0.22 * normalized.exitIntentSignal +
          0.18 * normalized.cartAbandonSignal +
          0.10 * normalized.priceHoverSignal
        )),
        research_depth_score: this.round(this.clamp01(
          0.33 * normalized.researchCoverage +
          0.25 * normalized.reviewFocusRatio +
          0.17 * normalized.specFocusRatio +
          0.10 * normalized.reviewReadLong +
          0.08 * normalized.dwellSignal +
          0.07 * (1 - normalized.bounceRisk)
        )),
        purchase_momentum_score: this.round(this.clamp01(
          0.12 * normalized.wishlistSignal +
          0.28 * normalized.cartIntentSignal +
          0.28 * normalized.checkoutSignal +
          0.12 * normalized.purchaseCompleteSignal +
          0.07 * normalized.reviewReadLong +
          0.05 * normalized.scrolledPercentage +
          0.08 * (1 - normalized.bounceRisk) -
          0.10 * normalized.cartAbandonSignal
        )),
        negotiation_pressure_score: this.round(this.clamp01(
          0.40 * normalized.exitIntentSignal +
          0.30 * normalized.priceHoverSignal +
          0.30 * normalized.cartAbandonSignal
        )),
        express_checkout_score: this.round(this.clamp01(
          0.65 * normalized.checkoutSignal +
          0.25 * normalized.cartIntentSignal +
          0.10 * normalized.purchaseCompleteSignal
        )),
        decision_reengagement_score: this.round(this.clamp01(
          0.45 * normalized.recentDecisionSignal +
          0.20 * normalized.recentPriceSignal +
          0.20 * normalized.cartIntentSignal +
          0.15 * normalized.sessionCommerceMemorySignal
        )),
        frustration_rebound_score: this.round(this.clamp01(
          0.60 * normalized.recentFrictionSignal +
          0.25 * normalized.deadClickRate +
          0.15 * normalized.rageClicks
        ))
      };

      return {
        normalized,
        derived,
        context: {
          sessionDurationSec,
          clickRatePerMinute: this.round(clickRatePerMinute, 3),
          sectionSwitchPerMinute: this.round(sectionSwitchPerMinute, 3),
          averageSectionDwellSec: this.round(averageSectionDwellSec, 3),
          scrolledPercentage: this.round(scrolledPercentage, 3),
          visitedSections,
          visitedCount,
          reviewDwellSec: this.round(Number(sectionDwellMs.reviews || 0) / 1000, 3),
          descriptionDwellSec: this.round(Number(sectionDwellMs.description || 0) / 1000, 3),
          infoZoneDwellSec: this.round((
            Number(sectionDwellMs.reviews || 0) +
            Number(sectionDwellMs.specs || 0) +
            Number(sectionDwellMs.description || 0)
          ) / 1000, 3),
          scrollReversalRate: this.round(scrollReversalRate, 3),
          policyExposureCount: exposureCount,
          mouseJitter: this.round(mouseJitter, 3),
          deadClicks: Math.round(deadClicks),
          deadClickRate: this.round(deadClickRate, 3),
          exitIntentCount: Math.round(exitIntent),
          dwellEvents: Math.round(dwellEvents),
          priceHoverCount: Math.round(priceHover),
          timeOnPriceSec: this.round(timeOnPriceMs / 1000, 3),
          cartAddRemoveCount: Math.round(cartAddRemove),
          ctaIntentCount: Math.round(ctaIntentCount),
          purchaseCtaIntentCount: Math.round(purchaseCtaIntentCount),
          wishlistIntentCount: Math.round(wishlistIntentCount),
          recentPriceEventCount: Math.round(recentPriceEventCount),
          recentWishlistCount: Math.round(recentWishlistCount),
          recentAddToCartCount: Math.round(recentAddToCartCount),
          recentCheckoutCount: Math.round(recentCheckoutCount),
          recentCommerceActionCount: Math.round(recentCommerceActionCount),
          recentDecisionSignalCount: this.round(recentDecisionSignalCount),
          recentDecisionSignalDecay: this.round(recentDecisionSignalDecay),
          recentPriceSignalCount: this.round(recentPriceSignalCount),
          recentPriceSignalDecay: this.round(recentPriceSignalDecay),
          recentResearchSignalCount: this.round(recentResearchSignalCount),
          recentResearchSignalDecay: this.round(recentResearchSignalDecay),
          recentFrictionSignalCount: this.round(recentFrictionSignalCount),
          recentFrictionSignalDecay: this.round(recentFrictionSignalDecay),
          recentCommerceActionDecay: this.round(recentCommerceActionDecayScore),
          recentPriceDecay: this.round(recentPriceDecayScore),
          recentResearchDecay: this.round(recentResearchDecayScore),
          recentFrictionDecay: this.round(this.max([
            recentRageDecayScore,
            recentDeadClickDecayScore,
            recentJitterDecayScore
          ])),
          sessionCommerceMemorySignal: this.round(sessionCommerceMemorySignal),
          commerceMemoryDecay: this.round(commerceMemoryDecay),
          msSinceLastCommerce: msSinceLastCommerce !== null ? Math.round(msSinceLastCommerce) : null,
          recentResearchSwitchCount: Math.round(recentResearchSwitchCount),
          recentRageCount: Math.round(recentRageCount),
          recentDeadClickCount: Math.round(recentDeadClickCount),
          recentJitterCount: Math.round(recentJitterCount),
          recentAddToCartDecay: this.round(recentAddToCartDecayScore),
          recentCheckoutDecay: this.round(recentCheckoutDecayScore),
          recentWishlistDecay: this.round(recentWishlistDecayScore),
          recentRageDecay: this.round(recentRageDecayScore),
          recentDeadClickDecay: this.round(recentDeadClickDecayScore),
          recentJitterDecay: this.round(recentJitterDecayScore),
          recentFrictionEventCount: Math.round(recentFrictionEventCount),
          cartAbandons: Math.round(cartAbandons),
          directCheckout,
          purchaseCompleted,
          clickTargetCount: Object.keys(raw.clickTargets || {}).length,
          hoverTargetCount: Object.keys(raw.hoverTargets || {}).length,
          averageHoverDurationSec: this.round(hoverDurationMsTotal / Math.max(1, Object.keys(raw.hoverTargets || {}).length) / 1000, 3),
          totalVisits: Number(raw.totalVisits || 1),
          activeSection: String(raw.activeSection || ""),
          activeSectionAgeSec: this.round(Number(raw.activeSectionAgeMs || 0) / 1000, 3)
        }
      };
    }
  }

  window.EmotionUIFeatureExtractor = FeatureExtractor;
})();
