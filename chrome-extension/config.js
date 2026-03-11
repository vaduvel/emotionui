(() => {
  const CONFIG = Object.freeze({
    collector: {
      inactivityTimeoutMs: 30000,
      statsTickMs: 2500,
      decisionTickMs: 3000,
      rageWindowMs: 1000,
      rageMinClicks: 3,
      rageMaxDistancePx: 80,
      rageCooldownMs: 1400,
      rageMaxPerSession: 14,
      jitterWindowMs: 500,
      jitterThresholdPx: 100,
      jitterMinGapMs: 800,
      dwellThresholdMs: 3000,
      priceHoverMinMs: 700,
      exitIntentThresholdPx: 12,
      maxTargetBuckets: 28,
      maxHoverTargetBuckets: 20,
      priceAnchorReselectMs: 6000,
      minSectionSwitchGapMs: 800,
      minSectionDwellBeforeViewportSwitchMs: 550,
      viewportSectionStabilityCount: 2,
      policyHistoryMinGapMs: 9000,
      maxEventLog: 120,
      reviewRewardDwellMs: 10000
    },
    feature: {
      maxClicksPerMinute: 45,
      maxSectionSwitchPerMinute: 12,
      maxReadingSpeedIndex: 6,
      maxExposureCount: 8,
      minSessionSecondsForStableSignals: 5,
      maxPriceHoverEvents: 4,
      maxCartIntentEvents: 5,
      recentSignalWindowMs: 15000,
      recentResearchWindowMs: 15000,
      recentFrictionWindowMs: 15000,
      decisionSignalHalfLifeMs: 18000,
      priceSignalHalfLifeMs: 16000,
      researchSignalHalfLifeMs: 22000,
      frictionSignalHalfLifeMs: 9000,
      commerceMemoryFullStrengthMs: 30000,
      commerceMemoryDecayWindowMs: 120000,
      commerceMemoryFloor: 0.45
    },
    pageContext: {
      textNodeScanLimit: 350,
      stickyBottomThresholdPx: 96,
      stickyRightThresholdPx: 56
    },
    pdpGate: {
      minTrackableScore: 0.68,
      minUnsureScore: 0.42,
      maxListingPenaltyForTrackable: 0.34,
      actionNodeScanLimit: 160,
      listingNodeScanLimit: 240,
      passiveCollectOnUnsure: true
    },
    state: {
      minimumConfidence: 0.36
    },
    hysteresis: {
      minModeDwellMs: 9000,
      minModeDwellMsByMode: {
        DESIGN_OXYGEN: 3500,
        SPOTLIGHT_MODE: 4500,
        EXPRESS_LANE: 3000
      },
      requiredStableHits: 2,
      requiredStableHitsByMode: {
        DESIGN_OXYGEN: 1,
        SPOTLIGHT_MODE: 1,
        EXPRESS_LANE: 1
      },
      minConfidenceDelta: 0.06,
      minConfidenceDeltaByMode: {
        DESIGN_OXYGEN: 0.03,
        SPOTLIGHT_MODE: 0.04,
        EXPRESS_LANE: 0.04
      },
      forceConfidenceDelta: 0.12,
      recoveryHoldMsByMode: {
        DESIGN_OXYGEN: 8000,
        SPOTLIGHT_MODE: 9000
      },
      coldStartObserveMs: 5000,
      coldStartInterveneMs: 6500,
      commercialToResearchDwellMs: 3500,
      commercialToResearchMaxConfidenceDrop: 0.08,
      maxHistory: 10
    },
    cooldown: {
      dismissDomainMs: 180000
    },
    attribution: {
      observeRewardWindowMs: 45000,
      interveneRewardWindowMs: 30000,
      rewardDecayStartMs: 10000,
      minRewardMultiplier: 0.35
    },
    decision: {
      negotiationStrongScore: 0.28,
      negotiationObserveUpgradeScore: 0.24,
      researchStrongScore: 0.44,
      spotlightStrongScore: 0.34,
      priceHoverMin: 2,
      priceDwellSecMin: 4,
      ctaIntentMin: 2,
      specDwellResearchSec: 10
    },
    spa: {
      enabled: true,
      routeDebounceMs: 250
    },
    policy: {
      epsilon: 0.08,
      softmaxTemperature: 1.1,
      minConfidenceObserve: 0.34,
      minConfidenceIntervene: 0.5,
      minSamplesForModelOnly: 80,
      learningRate: 0.04,
      l2: 0.0003
    },
    experiment: {
      enabled: true,
      key: "policy_runtime_v1",
      configVersion: "2026-03-10",
      salt: "emotionui_policy_runtime_v1",
      variants: [
        { key: "adaptive", weight: 0.8, runtime: "adaptive" },
        { key: "control", weight: 0.15, runtime: "control" },
        { key: "challenger_shadow", weight: 0.05, runtime: "adaptive_shadow" }
      ]
    },
    challenger: {
      enabled: true,
      key: "simplebandit_shadow_v1",
      softmaxTemperature: 0.95,
      minConfidenceObserve: 0.34,
      minConfidenceIntervene: 0.46
    },
    compliance: {
      euSafeMode: true,
      biometricInputsEnabled: false,
      publicTagName: "affect",
      publicTrackerName: "Adaptive State Tracker"
    },
    rewards: {
      wishlist: 0.1,
      reviewRead: 0.2,
      fastBounce: -0.5,
      interventionClosed: -0.5
    },
    reasonCodes: {
      severityWeights: { LOW: 1, MED: 2, HIGH: 3 },
      maxReasonCodes: 3,
      maxConstraintTags: 2,
      primaryDeltaScale: 0.06,
      inhibitedDeltaScale: 0.55,
      routedDeltaBoost: 1.15,
      policyKeywords: [
        "garantie",
        "garantii",
        "retur",
        "return",
        "livrare",
        "transport",
        "plata",
        "payment",
        "seller",
        "vanzator",
        "despre",
        "about",
        "suport",
        "support",
        "contact",
        "autentic",
        "original"
      ],
      codes: {
        RAGE_CLICK_CLUSTER: {
          windowSec: 10,
          inhibitors: ["DIRECT_PATH_LOW_DETOURS", "CTA_REENGAGED"]
        },
        DEAD_CLICK_REPEAT: {
          windowSec: 20,
          inhibitors: ["DIRECT_PATH_LOW_DETOURS"]
        },
        NO_PROGRESS_LOOP: {
          windowSec: 60,
          inhibitors: ["DIRECT_PATH_LOW_DETOURS"]
        },
        RAPID_SCROLL_REVERSALS: {
          windowSec: 15,
          inhibitors: ["STABLE_SCROLL_LINEAR", "DIRECT_PATH_LOW_DETOURS"]
        },
        SECTION_SWITCH_HIGH: {
          windowSec: 20,
          inhibitors: ["STABLE_SCROLL_LINEAR"]
        },
        BROAD_SECTION_SCAN: {
          windowSec: 30,
          contextRouting: {
            pageHints: ["hasSpecTableSignal", "hasReviewDensitySignal"]
          }
        },
        STABLE_SCROLL_LINEAR: {
          windowSec: 30,
          contextRouting: {
            pageHints: ["hasSpecTableSignal", "hasReviewDensitySignal"]
          }
        },
        SPECS_DWELL_HIGH: {
          windowSec: 60,
          inhibitors: ["CTA_REENGAGED", "ADD_TO_CART", "CHECKOUT_START"],
          contextRouting: {
            pageHints: ["hasSpecTableSignal"],
            policyKeywords: ["specificatii", "specs", "tech"]
          }
        },
        REVIEWS_DWELL_HIGH: {
          windowSec: 60,
          inhibitors: ["ADD_TO_CART", "CHECKOUT_START"],
          contextRouting: {
            pageHints: ["hasReviewDensitySignal", "hasTrustSignal"],
            policyKeywords: ["review", "recenzii", "rating"]
          }
        },
        DESCRIPTION_READ_PATTERN: {
          windowSec: 45,
          inhibitors: ["CTA_REENGAGED"],
          contextRouting: {
            policyKeywords: ["descriere", "details", "about"]
          }
        },
        SECTION_REVISIT_STRUCTURED: {
          windowSec: 60,
          inhibitors: ["DIRECT_PATH_LOW_DETOURS"],
          contextRouting: {
            pageHints: ["hasSpecTableSignal", "hasReviewDensitySignal"]
          }
        },
        TRUST_CONFIRM_LOOP: {
          windowSec: 60,
          inhibitors: ["ADD_TO_CART", "CHECKOUT_START"],
          contextRouting: {
            pageHints: ["hasTrustSignal"],
            policyKeywords: ["garantie", "retur", "seller", "autentic"]
          }
        },
        RETURN_TO_PRICE: {
          windowSec: 30,
          inhibitors: ["CHECKOUT_START"],
          contextRouting: {
            pageHints: ["hasPrimaryPrice", "hasDiscountSignal"],
            policyKeywords: ["pret", "reducere", "discount", "price"]
          }
        },
        INSTALLMENT_EVALUATION: {
          windowSec: 30,
          inhibitors: ["ADD_TO_CART", "CHECKOUT_START"],
          contextRouting: {
            pageHints: ["hasInstallmentSignal"],
            policyKeywords: ["rate", "financing", "voucher"]
          }
        },
        SAVE_WISHLIST: {
          windowSec: 20,
          inhibitors: ["CHECKOUT_START"]
        },
        CTA_REENGAGED: {
          windowSec: 20,
          contextRouting: {
            pageHints: ["hasPrimaryPrice", "hasDiscountSignal"]
          }
        },
        FRICTION_REBOUND: {
          windowSec: 20,
          inhibitors: ["DIRECT_PATH_LOW_DETOURS", "CHECKOUT_START"]
        },
        ADD_TO_CART: {
          windowSec: 20,
          contextRouting: {
            pageHints: ["hasPrimaryPrice"]
          }
        },
        CHECKOUT_START: {
          windowSec: 20,
          contextRouting: {
            pageHints: ["hasPrimaryPrice"]
          }
        },
        DIRECT_PATH_LOW_DETOURS: {
          windowSec: 45,
          inhibitors: ["RAGE_CLICK_CLUSTER", "DEAD_CLICK_REPEAT", "FRICTION_REBOUND"]
        }
      }
    },
    ui: {
      observeBadgeText: "Adaptive UI: Observing",
      interveneTitle: "Need a quicker path?",
      interveneBody: "We can simplify this page based on your navigation.",
      interveneCta: "Apply assist",
      interveneDismiss: "Dismiss",
      interventionTypes: {
        research_assist: {
          observeBadgeText: "Adaptive UI: Research assist",
          title: "Want the key details first?",
          body: "We can condense specs, reviews, and FAQs into a shorter path.",
          cta: "Show highlights"
        },
        value_reassurance: {
          observeBadgeText: "Adaptive UI: Value check",
          title: "Need help validating the price?",
          body: "We can surface guarantees, returns, and value signals before you decide.",
          cta: "Show value proof"
        },
        price_reassurance: {
          observeBadgeText: "Adaptive UI: Price check",
          title: "Want a quick price-confidence check?",
          body: "We can highlight discounts, delivery, and return coverage on this product.",
          cta: "Review value"
        },
        friction_relief: {
          observeBadgeText: "Adaptive UI: Friction relief",
          title: "Need a clearer path?",
          body: "We can simplify the page and keep the most important actions visible.",
          cta: "Simplify page"
        },
        focus_guidance: {
          observeBadgeText: "Adaptive UI: Focus guidance",
          title: "Too much happening here?",
          body: "We can spotlight the next best actions and reduce navigation noise.",
          cta: "Focus actions"
        },
        express_checkout: {
          observeBadgeText: "Adaptive UI: Express path",
          title: "Ready to move faster?",
          body: "We can keep checkout and purchase actions upfront.",
          cta: "Open fast path"
        }
      }
    },
    mapping: {
      policyToState: {
        SILENT: "STANDARD",
        OBSERVE: "RESEARCH_MODE",
        INTERVENE: "NEGOTIATOR_MODE"
      }
    }
  });

  window.EMOTIONUI_CONFIG = CONFIG;
})();
