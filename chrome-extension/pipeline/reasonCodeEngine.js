(() => {
  const CanonicalStates = window.EmotionUICanonicalStates || {};
  const LABELS = CanonicalStates.LABELS || {};
  const AFFECT_TAGS = CanonicalStates.AFFECT_TAGS || CanonicalStates.EMOTION_TAGS || {};
  const EMOTION_TAGS = AFFECT_TAGS;
  const INTENT_TAGS = CanonicalStates.INTENT_TAGS || {};
  const CONSTRAINT_TAGS = CanonicalStates.CONSTRAINT_TAGS || {};

  class ReasonCodeEngine {
    constructor(config = {}) {
      this.config = {
        severityWeights: { LOW: 1, MED: 2, HIGH: 3 },
        maxReasonCodes: 3,
        maxConstraintTags: 2,
        primaryDeltaScale: 0.06,
        inhibitedDeltaScale: 0.55,
        routedDeltaBoost: 1.15,
        policyKeywords: [],
        ...config
      };
      this.codes = this.mergeCodeDefinitions(this.createDefaultCodes(), config.codes || {});
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

    mergeCodeDefinitions(base = {}, overrides = {}) {
      const merged = { ...base };
      for (const [code, override] of Object.entries(overrides || {})) {
        const current = merged[code] || {};
        merged[code] = {
          ...current,
          ...override,
          deltas: {
            ...(current.deltas || {}),
            ...(override?.deltas || {})
          },
          contextRouting: {
            ...(current.contextRouting || {}),
            ...(override?.contextRouting || {})
          }
        };
      }
      return merged;
    }

    createAccumulator(order = []) {
      return Object.fromEntries((order || []).map((key) => [key, 0]));
    }

    createDefaultCodes() {
      return {
        RAGE_CLICK_CLUSTER: {
          family: "FRICTION",
          severity: "HIGH",
          deltas: {
            primary: { [LABELS.FRUSTRATED]: 3, [LABELS.DEEP_RESEARCH]: -1, [LABELS.CALM_BROWSING]: -1 },
            emotion: { [EMOTION_TAGS.FRUSTRATED]: 3 },
            intent: {},
            constraint: { [CONSTRAINT_TAGS.FRICTION_CONSTRAINT]: 3 }
          }
        },
        DEAD_CLICK_REPEAT: {
          family: "FRICTION",
          severity: "HIGH",
          deltas: {
            primary: { [LABELS.FRUSTRATED]: 3 },
            emotion: { [EMOTION_TAGS.FRUSTRATED]: 2 },
            intent: {},
            constraint: { [CONSTRAINT_TAGS.FRICTION_CONSTRAINT]: 3 }
          }
        },
        NO_PROGRESS_LOOP: {
          family: "FRICTION",
          severity: "MED",
          deltas: {
            primary: { [LABELS.FRUSTRATED]: 2, [LABELS.EXPLORING]: -1 },
            emotion: { [EMOTION_TAGS.FRUSTRATED]: 1, [EMOTION_TAGS.UNCERTAIN]: 1 },
            intent: {},
            constraint: { [CONSTRAINT_TAGS.FRICTION_CONSTRAINT]: 2 }
          }
        },
        RAPID_SCROLL_REVERSALS: {
          family: "LOAD",
          severity: "HIGH",
          deltas: {
            primary: { [LABELS.OVERWHELMED]: 3, [LABELS.CALM_BROWSING]: -1, [LABELS.DEEP_RESEARCH]: -1 },
            emotion: { [EMOTION_TAGS.OVERWHELMED]: 3 },
            intent: {},
            constraint: { [CONSTRAINT_TAGS.COGNITIVE_LOAD_CONSTRAINT]: 3 }
          }
        },
        SECTION_SWITCH_HIGH: {
          family: "LOAD",
          severity: "MED",
          deltas: {
            primary: { [LABELS.OVERWHELMED]: 2, [LABELS.EXPLORING]: -1 },
            emotion: { [EMOTION_TAGS.OVERWHELMED]: 2, [EMOTION_TAGS.UNCERTAIN]: 1 },
            intent: {},
            constraint: { [CONSTRAINT_TAGS.COGNITIVE_LOAD_CONSTRAINT]: 2 }
          }
        },
        BROAD_SECTION_SCAN: {
          family: "NAV",
          severity: "LOW",
          deltas: {
            primary: { [LABELS.EXPLORING]: 2, [LABELS.CALM_BROWSING]: 1 },
            emotion: { [EMOTION_TAGS.CALM]: 1 },
            intent: { [INTENT_TAGS.EXPLORING]: 2 },
            constraint: {}
          }
        },
        STABLE_SCROLL_LINEAR: {
          family: "NAV",
          severity: "LOW",
          deltas: {
            primary: { [LABELS.CALM_BROWSING]: 2 },
            emotion: { [EMOTION_TAGS.CALM]: 2 },
            intent: {},
            constraint: {}
          }
        },
        SPECS_DWELL_HIGH: {
          family: "RESEARCH",
          severity: "MED",
          deltas: {
            primary: { [LABELS.DEEP_RESEARCH]: 3 },
            emotion: { [EMOTION_TAGS.UNCERTAIN]: 1 },
            intent: { [INTENT_TAGS.DEEP_RESEARCH]: 3 },
            constraint: { [CONSTRAINT_TAGS.INFO_CONSTRAINT]: 2 }
          }
        },
        REVIEWS_DWELL_HIGH: {
          family: "RESEARCH",
          severity: "MED",
          deltas: {
            primary: { [LABELS.DEEP_RESEARCH]: 3, [LABELS.REASSURANCE_SEEKING]: 1 },
            emotion: { [EMOTION_TAGS.UNCERTAIN]: 1 },
            intent: { [INTENT_TAGS.DEEP_RESEARCH]: 3 },
            constraint: {
              [CONSTRAINT_TAGS.INFO_CONSTRAINT]: 2,
              [CONSTRAINT_TAGS.TRUST_CONSTRAINT]: 1
            }
          }
        },
        DESCRIPTION_READ_PATTERN: {
          family: "RESEARCH",
          severity: "LOW",
          deltas: {
            primary: { [LABELS.DEEP_RESEARCH]: 2 },
            emotion: {},
            intent: { [INTENT_TAGS.DEEP_RESEARCH]: 2 },
            constraint: { [CONSTRAINT_TAGS.INFO_CONSTRAINT]: 1 }
          }
        },
        SECTION_REVISIT_STRUCTURED: {
          family: "RESEARCH",
          severity: "LOW",
          deltas: {
            primary: { [LABELS.DEEP_RESEARCH]: 2, [LABELS.REASSURANCE_SEEKING]: 1 },
            emotion: { [EMOTION_TAGS.UNCERTAIN]: 1 },
            intent: { [INTENT_TAGS.DEEP_RESEARCH]: 1 },
            constraint: { [CONSTRAINT_TAGS.INFO_CONSTRAINT]: 1 }
          }
        },
        RESEARCH_VALIDATION_LOOP: {
          family: "RESEARCH",
          severity: "MED",
          deltas: {
            primary: { [LABELS.DEEP_RESEARCH]: 3, [LABELS.EXPLORING]: -2, [LABELS.REASSURANCE_SEEKING]: 1 },
            emotion: { [EMOTION_TAGS.UNCERTAIN]: 1 },
            intent: { [INTENT_TAGS.DEEP_RESEARCH]: 3 },
            constraint: { [CONSTRAINT_TAGS.INFO_CONSTRAINT]: 2 }
          }
        },
        TRUST_CONFIRM_LOOP: {
          family: "TRUST",
          severity: "HIGH",
          deltas: {
            primary: { [LABELS.REASSURANCE_SEEKING]: 3, [LABELS.DECISION_READY]: -1 },
            emotion: { [EMOTION_TAGS.UNCERTAIN]: 2 },
            intent: { [INTENT_TAGS.DEEP_RESEARCH]: 2 },
            constraint: { [CONSTRAINT_TAGS.TRUST_CONSTRAINT]: 3 }
          }
        },
        PRICE_TRUST_LOOP: {
          family: "TRUST",
          severity: "HIGH",
          deltas: {
            primary: { [LABELS.REASSURANCE_SEEKING]: 3, [LABELS.PRICE_SENSITIVE]: -1, [LABELS.DECISION_READY]: -1 },
            emotion: { [EMOTION_TAGS.UNCERTAIN]: 2 },
            intent: { [INTENT_TAGS.DEEP_RESEARCH]: 1, [INTENT_TAGS.PRICE_EVALUATION]: 1 },
            constraint: { [CONSTRAINT_TAGS.TRUST_CONSTRAINT]: 2, [CONSTRAINT_TAGS.PRICE_CONSTRAINT]: 1 }
          }
        },
        RETURN_TO_PRICE: {
          family: "PRICE",
          severity: "MED",
          deltas: {
            primary: { [LABELS.PRICE_SENSITIVE]: 3 },
            emotion: { [EMOTION_TAGS.UNCERTAIN]: 1 },
            intent: { [INTENT_TAGS.PRICE_EVALUATION]: 3 },
            constraint: { [CONSTRAINT_TAGS.PRICE_CONSTRAINT]: 2 }
          }
        },
        INSTALLMENT_EVALUATION: {
          family: "PRICE",
          severity: "MED",
          deltas: {
            primary: { [LABELS.PRICE_SENSITIVE]: 2, [LABELS.REASSURANCE_SEEKING]: 1 },
            emotion: { [EMOTION_TAGS.UNCERTAIN]: 1 },
            intent: { [INTENT_TAGS.PRICE_EVALUATION]: 2 },
            constraint: { [CONSTRAINT_TAGS.PRICE_CONSTRAINT]: 2 }
          }
        },
        VARIANT_PRICE_COMPARISON: {
          family: "PRICE",
          severity: "MED",
          deltas: {
            primary: { [LABELS.PRICE_SENSITIVE]: 3, [LABELS.REASSURANCE_SEEKING]: -1 },
            emotion: { [EMOTION_TAGS.UNCERTAIN]: 1 },
            intent: { [INTENT_TAGS.PRICE_EVALUATION]: 3 },
            constraint: { [CONSTRAINT_TAGS.PRICE_CONSTRAINT]: 2 }
          }
        },
        SAVE_WISHLIST: {
          family: "CTA",
          severity: "MED",
          deltas: {
            primary: { [LABELS.REASSURANCE_SEEKING]: 1, [LABELS.DECISION_READY]: 1 },
            emotion: { [EMOTION_TAGS.UNCERTAIN]: 1 },
            intent: { [INTENT_TAGS.DECISION_READY]: 1 },
            constraint: {}
          }
        },
        CTA_REENGAGED: {
          family: "CTA",
          severity: "HIGH",
          deltas: {
            primary: { [LABELS.DECISION_READY]: 4, [LABELS.DEEP_RESEARCH]: -3, [LABELS.PRICE_SENSITIVE]: 1, [LABELS.REASSURANCE_SEEKING]: -1 },
            emotion: { [EMOTION_TAGS.CONFIDENT]: 2, [EMOTION_TAGS.UNCERTAIN]: -1 },
            intent: { [INTENT_TAGS.DECISION_READY]: 3, [INTENT_TAGS.PRICE_EVALUATION]: 1 },
            constraint: {}
          }
        },
        FRICTION_REBOUND: {
          family: "FRICTION",
          severity: "HIGH",
          deltas: {
            primary: { [LABELS.FRUSTRATED]: 4, [LABELS.DEEP_RESEARCH]: -2, [LABELS.CALM_BROWSING]: -2 },
            emotion: { [EMOTION_TAGS.FRUSTRATED]: 3 },
            intent: {},
            constraint: { [CONSTRAINT_TAGS.FRICTION_CONSTRAINT]: 3 }
          }
        },
        FRICTION_ESCAPE_SPIKE: {
          family: "FRICTION",
          severity: "HIGH",
          deltas: {
            primary: { [LABELS.FRUSTRATED]: 3, [LABELS.OVERLOADED]: -1, [LABELS.CALM_BROWSING]: -1 },
            emotion: { [EMOTION_TAGS.FRUSTRATED]: 3 },
            intent: {},
            constraint: { [CONSTRAINT_TAGS.FRICTION_CONSTRAINT]: 3 }
          }
        },
        ADD_TO_CART: {
          family: "CTA",
          severity: "HIGH",
          deltas: {
            primary: { [LABELS.DECISION_READY]: 4, [LABELS.DEEP_RESEARCH]: -3, [LABELS.PRICE_SENSITIVE]: -1, [LABELS.REASSURANCE_SEEKING]: -1 },
            emotion: { [EMOTION_TAGS.CONFIDENT]: 2 },
            intent: { [INTENT_TAGS.DECISION_READY]: 3 },
            constraint: {}
          }
        },
        CHECKOUT_START: {
          family: "CHECKOUT",
          severity: "HIGH",
          deltas: {
            primary: { [LABELS.DECISION_READY]: 3 },
            emotion: { [EMOTION_TAGS.CONFIDENT]: 2 },
            intent: { [INTENT_TAGS.CHECKOUT_INTENT]: 3 },
            constraint: {}
          }
        },
        DIRECT_PATH_LOW_DETOURS: {
          family: "CTA",
          severity: "MED",
          deltas: {
            primary: { [LABELS.DECISION_READY]: 2, [LABELS.CALM_BROWSING]: 1 },
            emotion: { [EMOTION_TAGS.CONFIDENT]: 2 },
            intent: { [INTENT_TAGS.DECISION_READY]: 2 },
            constraint: {}
          }
        },
        COMPARATIVE_RESEARCH: {
          family: "RESEARCH",
          severity: "MED",
          deltas: {
            primary: { [LABELS.DEEP_RESEARCH]: 2, [LABELS.PRICE_SENSITIVE]: 1, [LABELS.CALM_BROWSING]: -1 },
            emotion: { [EMOTION_TAGS.UNCERTAIN]: 2 },
            intent: { [INTENT_TAGS.PRICE_EVALUATION]: 2, [INTENT_TAGS.DEEP_RESEARCH]: 1 },
            constraint: { [CONSTRAINT_TAGS.INFO_CONSTRAINT]: 1, [CONSTRAINT_TAGS.PRICE_CONSTRAINT]: 1 }
          }
        },
        OVERLOAD_SCAN_PATTERN: {
          family: "LOAD",
          severity: "HIGH",
          deltas: {
            primary: { [LABELS.OVERLOADED]: 3, [LABELS.FRUSTRATED]: -1, [LABELS.DEEP_RESEARCH]: -1 },
            emotion: { [EMOTION_TAGS.OVERWHELMED]: 3 },
            intent: {},
            constraint: { [CONSTRAINT_TAGS.COGNITIVE_LOAD_CONSTRAINT]: 3 }
          }
        }
      };
    }

    describeReasonCode(code = "") {
      const messages = {
        RAGE_CLICK_CLUSTER: "We noticed repeated failed clicks, so the page can shift toward a clearer next step.",
        DEAD_CLICK_REPEAT: "You clicked on elements that did not move the flow forward, so friction relief becomes more relevant.",
        NO_PROGRESS_LOOP: "You have been active without real progress, so the experience can simplify the next move.",
        RAPID_SCROLL_REVERSALS: "You are scanning back and forth quickly, so the page can reduce reading load.",
        SECTION_SWITCH_HIGH: "You switched sections often, so the page can narrow the focus.",
        BROAD_SECTION_SCAN: "You are surveying the product broadly, so light guidance is more useful than a full assist.",
        STABLE_SCROLL_LINEAR: "Your browsing looks steady and calm, so the experience stays lightweight.",
        SPECS_DWELL_HIGH: "You spent time in specifications, so technical details deserve easier access.",
        REVIEWS_DWELL_HIGH: "You spent time in reviews, so validation content matters right now.",
        DESCRIPTION_READ_PATTERN: "You are reading the description closely, so explanatory content should stay easy to scan.",
        SECTION_REVISIT_STRUCTURED: "You returned to the same detail areas, so the page can support deeper validation.",
        RESEARCH_VALIDATION_LOOP: "You keep returning to key product details, so research support should stay close.",
        TRUST_CONFIRM_LOOP: "You are checking trust and validation signals before deciding, so reassurance should stay visible.",
        PRICE_TRUST_LOOP: "You are bouncing between price and trust cues, so reassurance matters more than speed.",
        RETURN_TO_PRICE: "You returned to price details, so value comparison is likely active.",
        INSTALLMENT_EVALUATION: "You are evaluating financing or installment options, so value framing becomes relevant.",
        VARIANT_PRICE_COMPARISON: "You are comparing variants against price, so value differences should stay visible.",
        SAVE_WISHLIST: "You saved the product for later, so soft reassurance is more appropriate than pressure.",
        CTA_REENGAGED: "You came back to the purchase path, so the page can shorten the route forward.",
        FRICTION_REBOUND: "Friction has reappeared after earlier progress, so the next step may need simplification.",
        FRICTION_ESCAPE_SPIKE: "Your recent signals look more like frustration than overload, so friction relief is prioritized.",
        ADD_TO_CART: "You added the product to cart, so decision support can become more direct.",
        CHECKOUT_START: "You started checkout, so acceleration becomes appropriate.",
        DIRECT_PATH_LOW_DETOURS: "You followed a short path with few detours, so a faster route fits.",
        COMPARATIVE_RESEARCH: "You are comparing options, so research guidance should stay active.",
        OVERLOAD_SCAN_PATTERN: "You are scanning many sections quickly without clear commitment, so the page should reduce cognitive load."
      };
      return messages[String(code || "").toUpperCase()] || "The current page behavior suggests a local adaptation is useful.";
    }

    buildUserExplanation({ topReasonCodes = [], raw = {}, featurePack = {}, pageContext = {}, stateClassification = {} } = {}) {
      const codes = Array.isArray(topReasonCodes) ? topReasonCodes.filter(Boolean) : [];
      const primaryCode = codes[0] || "";
      const secondaryCode = codes[1] || "";
      const summary = primaryCode
        ? this.describeReasonCode(primaryCode)
        : "The page adapted to match the signals you are giving right now.";
      const label = String(stateClassification?.label || stateClassification?.primary_state || "").toUpperCase();
      const activeSection = String(featurePack?.context?.activeSection || raw?.activeSection || "this area").replace(/_/g, " ");
      const summaryMap = {
        DEEP_RESEARCH: `You are validating details in ${activeSection}, so research shortcuts and structured information stay easier to reach.`,
        REASSURANCE_SEEKING: `You are looking for reassurance in ${activeSection}, so trust and validation cues stay more visible.`,
        PRICE_SENSITIVE: `You are evaluating value in ${activeSection}, so price and offer clarity stay more prominent.`,
        DECISION_READY: `You are showing strong purchase intent, so the page keeps the next step short and visible.`,
        FRUSTRATED: `Your recent interactions suggest friction, so the page shifts toward clearer recovery paths.`,
        OVERLOADED: `Your recent interactions suggest cognitive overload, so the page reduces secondary noise.`,
        EXPLORING: `You are still exploring, so the page stays lightweight and locally guided.`
      };

      return {
        title: "Why the page adapted",
        summary: summaryMap[label] || summary,
        details: [summary, secondaryCode ? this.describeReasonCode(secondaryCode) : ""].filter(Boolean).slice(0, 2)
      };
    }

    detect(raw = {}, featurePack = {}, pageContext = {}) {
      const normalized = featurePack.normalized || {};
      const derived = featurePack.derived || {};
      const context = featurePack.context || {};
      const summary = pageContext.summary || {};
      const sectionDwellMs = raw.sectionDwellMs || {};
      const sectionVisits = raw.sectionVisits || {};
      const eventLog = Array.isArray(raw.eventLog) ? raw.eventLog : [];
      const clicks = Number(raw.clicks || 0);
      const progressSignals =
        (raw.outcomes?.added_to_cart ? 1 : 0) +
        (raw.outcomes?.checkout_started ? 1 : 0) +
        (raw.outcomes?.added_to_wishlist ? 1 : 0) +
        (raw.outcomes?.purchase_completed ? 1 : 0);
      const maxSectionDwellSec = Math.max(
        Number(sectionDwellMs.gallery || 0),
        Number(sectionDwellMs.description || 0),
        Number(sectionDwellMs.specs || 0),
        Number(sectionDwellMs.reviews || 0),
        Number(sectionDwellMs.faq || 0)
      ) / 1000;
      const recentWishlistCount = Number(context.recentWishlistCount || 0);
      const recentAddToCartCount = Number(context.recentAddToCartCount || 0);
      const recentCheckoutCount = Number(context.recentCheckoutCount || 0);
      const recentCommerceActionCount = Number(context.recentCommerceActionCount || 0);
      const recentPriceEventCount = Number(context.recentPriceEventCount || 0);
      const recentDeadClickCount = Number(context.recentDeadClickCount || 0);
      const recentFrictionEventCount = Number(context.recentFrictionEventCount || 0);
      const recentResearchSwitchCount = Number(context.recentResearchSwitchCount || 0);
      const sessionCommerceMemorySignal = Number(normalized.sessionCommerceMemorySignal || context.sessionCommerceMemorySignal || 0);
      const visitedCount = Number(context.visitedCount || 0);
      const reviewDwellSec = Number(context.reviewDwellSec || 0);
      const descriptionDwellSec = Number(context.descriptionDwellSec || 0);
      const infoZoneDwellSec = Number(context.infoZoneDwellSec || 0);
      const specDwellSec = Number(sectionDwellMs.specs || 0) / 1000;
      const activeSection = String(context.activeSection || raw.activeSection || "");
      const activeResearchSection = /^(reviews|specs|description|faq)$/.test(activeSection);
      const activeOverviewSection = /^(gallery|overview|variants)$/.test(activeSection);
      const compareEventCount = (() => {
        if (!eventLog.length) return 0;
        const latestTs = Number(eventLog[eventLog.length - 1]?.ts || Date.now());
        const minTs = latestTs - 20000;
        return eventLog.filter((e) => {
          const ts = Number(e?.ts || 0);
          return ts >= minTs && ["compare_view", "compare_price_check"].includes(String(e?.type || ""));
        }).length;
      })();
      const recentVariantEventCount = (() => {
        const clickTargets = Object.entries(raw.clickTargets || {});
        const hoverTargets = Object.entries(raw.hoverTargets || {});
        return [...clickTargets, ...hoverTargets].reduce((count, [key, value]) => (
          /(variant|capacity|color|culoare|storage|size|marime|ram|gb|tb)/i.test(String(key || ""))
            ? count + Number(value || 0)
            : count
        ), 0);
      })();
      const timeOnPriceSec = Number(context.timeOnPriceSec || 0);
      const overviewBrowsingOnly =
        activeOverviewSection &&
        recentAddToCartCount === 0 &&
        recentCheckoutCount === 0 &&
        recentFrictionEventCount === 0 &&
        Number(normalized.recentPriceSignal || 0) < 0.35;
      const recentCommitmentSignals =
        recentAddToCartCount >= 1 ||
        recentCheckoutCount >= 1 ||
        (recentWishlistCount >= 1 && Number(normalized.recentPriceSignal || 0) >= 0.5);

      return {
        RAGE_CLICK_CLUSTER: Number(raw.rageClicks || 0) >= 2 || Number(normalized.rageClicks || 0) >= 0.33,
        DEAD_CLICK_REPEAT:
          recentDeadClickCount >= 2 ||
          (
            !overviewBrowsingOnly &&
            recentFrictionEventCount >= 1 &&
            (
              Number(raw.deadClicks || 0) >= 3 ||
              Number(normalized.deadClickRate || 0) >= 0.18
            )
          ),
        NO_PROGRESS_LOOP:
          Number(context.sessionDurationSec || 0) >= 30 &&
          clicks >= 8 &&
          progressSignals === 0 &&
          Number(context.sectionSwitchPerMinute || 0) >= 4,
        RAPID_SCROLL_REVERSALS:
          Number(raw.scrollReversals || 0) >= 4 ||
          Number(normalized.reversalRate || 0) >= 0.08,
        SECTION_SWITCH_HIGH:
          Number(normalized.sectionSwitchRate || 0) >= 0.65 &&
          Number(context.visitedCount || 0) >= 3,
        BROAD_SECTION_SCAN:
          Number(context.visitedCount || 0) >= 2 &&
          Number(context.averageSectionDwellSec || 0) >= 4 &&
          Number(context.averageSectionDwellSec || 0) <= 18 &&
          Number(derived.friction_score || 0) < 0.22,
        STABLE_SCROLL_LINEAR:
          Number(normalized.scrolledPercentage || 0) >= 0.2 &&
          Number(normalized.reversalRate || 0) <= 0.02 &&
          Number(derived.friction_score || 0) < 0.18,
        SPECS_DWELL_HIGH: Number(sectionDwellMs.specs || 0) >= 10000,
        REVIEWS_DWELL_HIGH: Number(context.reviewDwellSec || 0) >= 12,
        DESCRIPTION_READ_PATTERN: Number(context.descriptionDwellSec || 0) >= 10,
        SECTION_REVISIT_STRUCTURED:
          (Number(sectionVisits.specs || 0) >= 2 || Number(sectionVisits.reviews || 0) >= 2) &&
          Number(normalized.reversalRate || 0) < 0.08,
        RESEARCH_VALIDATION_LOOP:
          recentCommerceActionCount === 0 &&
          (
            (Number(sectionVisits.specs || 0) >= 2 && reviewDwellSec >= 8) ||
            (Number(sectionVisits.reviews || 0) >= 2 && specDwellSec >= 8) ||
            (recentResearchSwitchCount >= 2 && infoZoneDwellSec >= 28)
          ),
        TRUST_CONFIRM_LOOP:
          Boolean(summary.hasTrustSignal) &&
          (Number(context.reviewDwellSec || 0) >= 12 || Number(context.descriptionDwellSec || 0) >= 10) &&
          Number(raw.priceHover || 0) >= 1 &&
          (Number(sectionVisits.reviews || 0) >= 2 || Number(sectionVisits.description || 0) >= 2) &&
          (activeResearchSection || recentResearchSwitchCount >= 1),
        PRICE_TRUST_LOOP:
          Number(timeOnPriceSec || 0) >= 3 &&
          recentPriceEventCount >= 2 &&
          Boolean(summary.hasTrustSignal) &&
          (
            reviewDwellSec >= 10 ||
            descriptionDwellSec >= 10 ||
            Number(sectionVisits.reviews || 0) >= 2 ||
            Number(sectionVisits.description || 0) >= 2
          ),
        RETURN_TO_PRICE:
          (
            Number(context.timeOnPriceSec || 0) >= 5 &&
            Number(raw.priceHover || 0) >= 2
          ) ||
          (
            Number(context.timeOnPriceSec || 0) >= 3 &&
            recentPriceEventCount >= 2 &&
            !activeOverviewSection
          ),
        INSTALLMENT_EVALUATION:
          Boolean(summary.hasInstallmentSignal) &&
          Number(context.timeOnPriceSec || 0) >= 4,
        VARIANT_PRICE_COMPARISON:
          Boolean(summary.hasVariantChoices) &&
          (
            activeSection === "variants" ||
            activeOverviewSection ||
            recentVariantEventCount >= 2
          ) &&
          (
            recentPriceEventCount >= 1 ||
            timeOnPriceSec >= 3 ||
            Number(normalized.recentPriceSignal || 0) >= 0.45
          ) &&
          recentCommerceActionCount === 0,
        SAVE_WISHLIST:
          recentWishlistCount >= 1 &&
          !overviewBrowsingOnly &&
          (
            Number(normalized.recentPriceSignal || 0) >= 0.35 ||
            timeOnPriceSec >= 4 ||
            recentAddToCartCount >= 1 ||
            recentCheckoutCount >= 1
          ),
        CTA_REENGAGED:
          Number(normalized.recentDecisionSignal || 0) >= 0.65 ||
          Number(context.recentAddToCartCount || 0) >= 1 ||
          Number(context.recentCheckoutCount || 0) >= 1 ||
          (
            Number(context.recentWishlistCount || 0) >= 1 &&
            Number(context.recentPriceEventCount || 0) >= 1 &&
            !overviewBrowsingOnly
          ) ||
          (
            !activeResearchSection &&
            !activeOverviewSection &&
            recentCommerceActionCount >= 2 &&
            Number(context.purchaseCtaIntentCount || 0) >= 1
          ),
        FRICTION_REBOUND:
          Number(normalized.recentFrictionSignal || 0) >= 0.55 ||
          Number(context.recentRageCount || 0) >= 1 ||
          Number(context.recentDeadClickCount || 0) >= 2,
        FRICTION_ESCAPE_SPIKE:
          (
            Number(context.recentRageCount || 0) >= 1 ||
            Number(context.recentDeadClickCount || 0) >= 2 ||
            Number(normalized.exitIntentSignal || 0) >= 0.45
          ) &&
          Number(normalized.sectionSwitchRate || 0) < 0.5,
        ADD_TO_CART:
          recentAddToCartCount >= 1 ||
          (
            Number(normalized.recentDecisionSignal || 0) >= 0.8 &&
            Number(context.purchaseCtaIntentCount || 0) >= 1 &&
            !overviewBrowsingOnly
          ),
        CHECKOUT_START:
          recentCheckoutCount >= 1 ||
          (
            Boolean(context.directCheckout) &&
            Number(normalized.recentDecisionSignal || 0) >= 0.9
          ),
        DIRECT_PATH_LOW_DETOURS:
          (recentAddToCartCount >= 1 || recentCheckoutCount >= 1 || recentCommitmentSignals) &&
          Number(normalized.sectionSwitchRate || 0) <= 0.3 &&
          Number(normalized.reversalRate || 0) <= 0.03 &&
          maxSectionDwellSec <= 18,
        COMPARATIVE_RESEARCH:
          compareEventCount >= 2 &&
          Number(context.sessionDurationSec || 0) >= 15 &&
          (
            Number(context.timeOnPriceSec || 0) >= 3 ||
            Number(raw.priceHover || 0) >= 1 ||
            Number(normalized.priceHoverSignal || 0) >= 0.2
          ) &&
          recentCommerceActionCount === 0,
        OVERLOAD_SCAN_PATTERN:
          Number(normalized.sectionSwitchRate || 0) >= 0.55 &&
          Number(normalized.reversalRate || 0) >= 0.08 &&
          visitedCount >= 3 &&
          Number(context.recentRageCount || 0) === 0 &&
          recentDeadClickCount <= 1 &&
          recentCommerceActionCount === 0
      };
    }

    applyDeltas(target, deltas = {}, scale = 1) {
      for (const [key, delta] of Object.entries(deltas || {})) {
        if (!key || !Number.isFinite(Number(delta))) continue;
        target[key] = Number(target[key] || 0) + Number(delta || 0) * Number(scale || 1);
      }
    }

    matchesPolicyKeywords(raw = {}, definition = {}) {
      const keywords = Array.isArray(definition?.contextRouting?.policyKeywords)
        ? definition.contextRouting.policyKeywords
        : Array.isArray(this.config.policyKeywords)
          ? this.config.policyKeywords
          : [];
      if (!keywords.length) return false;

      const haystack = JSON.stringify({
        clickTargets: raw.clickTargets || {},
        hoverTargets: raw.hoverTargets || {}
      }).toLowerCase();
      return keywords.some((keyword) => haystack.includes(String(keyword || "").toLowerCase()));
    }

    matchesPageHints(pageContext = {}, definition = {}) {
      const hints = Array.isArray(definition?.contextRouting?.pageHints) ? definition.contextRouting.pageHints : [];
      if (!hints.length) return false;
      const summary = pageContext.summary || {};
      return hints.some((hint) => Boolean(summary[String(hint || "")]));
    }

    getDeltaScale(code, definition, detectedFlags = {}, raw = {}, pageContext = {}) {
      let scale = 1;
      const inhibitors = Array.isArray(definition?.inhibitors) ? definition.inhibitors : [];
      if (inhibitors.some((inhibitor) => Boolean(detectedFlags[String(inhibitor || "")]))) {
        scale *= Number(this.config.inhibitedDeltaScale || 0.55);
      }
      if (this.matchesPageHints(pageContext, definition) || this.matchesPolicyKeywords(raw, definition)) {
        scale *= Number(this.config.routedDeltaBoost || 1.15);
      }
      return scale;
    }

    rankEntries(entries = {}, max = 1) {
      return Object.entries(entries)
        .filter(([, value]) => Number(value || 0) > 0)
        .sort((a, b) => Number(b[1]) - Number(a[1]) || String(a[0]).localeCompare(String(b[0])))
        .slice(0, max);
    }

    analyze(raw = {}, featurePack = {}, pageContext = {}, stateClassification = {}) {
      const detectedFlags = this.detect(raw, featurePack, pageContext);
      const primaryScores = this.createAccumulator(CanonicalStates.ORDER || []);
      const emotionScores = this.createAccumulator(CanonicalStates.EMOTION_ORDER || []);
      const intentScores = this.createAccumulator(CanonicalStates.INTENT_ORDER || []);
      const constraintScores = this.createAccumulator(CanonicalStates.CONSTRAINT_ORDER || []);
      const detected = [];

      for (const [code, active] of Object.entries(detectedFlags)) {
        if (!active) continue;
        const definition = this.codes[code];
        if (!definition) continue;
        const deltaScale = this.getDeltaScale(code, definition, detectedFlags, raw, pageContext);

        this.applyDeltas(primaryScores, definition.deltas?.primary, deltaScale);
        this.applyDeltas(emotionScores, definition.deltas?.emotion, deltaScale);
        this.applyDeltas(intentScores, definition.deltas?.intent, deltaScale);
        this.applyDeltas(constraintScores, definition.deltas?.constraint, deltaScale);

        detected.push({
          code,
          family: definition.family,
          severity: definition.severity,
          weight: this.round(
            Number(this.config.severityWeights?.[String(definition.severity || "LOW").toUpperCase()] || 1) * deltaScale
          ),
          scale: this.round(deltaScale),
          inhibitors: Array.isArray(definition.inhibitors) ? definition.inhibitors : [],
          context_routed: deltaScale > 1
        });
      }

      detected.sort((a, b) => Number(b.weight) - Number(a.weight) || String(a.code).localeCompare(String(b.code)));

      const fallbackTags = CanonicalStates.getDefaultTagsForState
        ? CanonicalStates.getDefaultTagsForState(stateClassification.label)
        : { emotion_tag: AFFECT_TAGS.CALM, affect_tag: AFFECT_TAGS.CALM, intent_tag: INTENT_TAGS.EXPLORING, constraint_tags: [] };
      const topEmotion = this.rankEntries(emotionScores, 1)[0]?.[0] || fallbackTags.affect_tag || fallbackTags.emotion_tag || AFFECT_TAGS.CALM;
      const topIntent = this.rankEntries(intentScores, 1)[0]?.[0] || fallbackTags.intent_tag || INTENT_TAGS.EXPLORING;
      const topConstraints = this.rankEntries(constraintScores, Number(this.config.maxConstraintTags || 2))
        .map(([key]) => key);
      const explanation = this.buildUserExplanation({
        topReasonCodes: detected.slice(0, Number(this.config.maxReasonCodes || 3)).map((item) => item.code),
        raw,
        featurePack,
        pageContext,
        stateClassification
      });

      return {
        detected,
        top_reason_codes: detected.slice(0, Number(this.config.maxReasonCodes || 3)).map((item) => item.code),
        pair_disambiguators: detected
          .map((item) => item.code)
          .filter((code) => /RESEARCH_VALIDATION_LOOP|PRICE_TRUST_LOOP|VARIANT_PRICE_COMPARISON|OVERLOAD_SCAN_PATTERN|FRICTION_ESCAPE_SPIKE/.test(String(code || ""))),
        primary_score_adjustments: Object.fromEntries(
          Object.entries(primaryScores).map(([key, value]) => [key, this.round(Number(value || 0) * Number(this.config.primaryDeltaScale || 0.04))])
        ),
        emotion_scores: Object.fromEntries(
          Object.entries(emotionScores).map(([key, value]) => [key, this.round(value)])
        ),
        intent_scores: Object.fromEntries(
          Object.entries(intentScores).map(([key, value]) => [key, this.round(value)])
        ),
        constraint_scores: Object.fromEntries(
          Object.entries(constraintScores).map(([key, value]) => [key, this.round(value)])
        ),
        emotion_tag: topEmotion,
        affect_tag: topEmotion,
        intent_tag: topIntent,
        constraint_tags: topConstraints.length ? topConstraints : (fallbackTags.constraint_tags || []),
        families: [...new Set(detected.map((item) => item.family))],
        user_explanation_title: explanation.title,
        user_explanation_summary: explanation.summary,
        user_explanation_details: explanation.details
      };
    }
  }

  window.EmotionUIReasonCodeEngine = ReasonCodeEngine;
})();
