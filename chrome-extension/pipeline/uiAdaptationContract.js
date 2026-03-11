(() => {
  const CanonicalStates = window.EmotionUICanonicalStates || {};
  const LABELS = CanonicalStates.LABELS || {
    CALM_BROWSING: "CALM_BROWSING",
    EXPLORING: "EXPLORING",
    DEEP_RESEARCH: "DEEP_RESEARCH",
    PRICE_SENSITIVE: "PRICE_SENSITIVE",
    REASSURANCE_SEEKING: "REASSURANCE_SEEKING",
    FRUSTRATED: "FRUSTRATED",
    OVERWHELMED: "OVERWHELMED",
    DECISION_READY: "DECISION_READY"
  };

  const INTERVENTION_LEVELS = Object.freeze({
    SILENT: "SILENT",
    EMPHASIS: "EMPHASIS",
    ASSIST: "ASSIST",
    ACCELERATE: "ACCELERATE"
  });

  const PRIORITY_SCENARIOS = Object.freeze({
    RESEARCH_HEAVY: {
      key: "RESEARCH_HEAVY",
      need: "clarity",
      states: [LABELS.DEEP_RESEARCH],
      target_modes: ["RESEARCH_MODE"]
    },
    VALUE_CLARITY: {
      key: "VALUE_CLARITY",
      need: "value_explained",
      states: [LABELS.PRICE_SENSITIVE, LABELS.REASSURANCE_SEEKING],
      target_modes: ["PRICE_ALERT_MODE", "NEGOTIATOR_MODE"]
    },
    DECISION_ACCELERATION: {
      key: "DECISION_ACCELERATION",
      need: "frictionless_action",
      states: [LABELS.DECISION_READY],
      target_modes: ["EXPRESS_LANE"]
    }
  });

  const STATE_UI_CONTRACT = Object.freeze({
    [LABELS.CALM_BROWSING]: {
      primary_state: LABELS.CALM_BROWSING,
      user_need: "orientation",
      intervention_level: INTERVENTION_LEVELS.SILENT,
      priority_scenario_key: null,
      operational_stage: "supporting",
      allowed_clusters: ["overview", "variants"],
      allowed_zones: ["overview", "variants"],
      allowed_primitives: ["local_focus_hint"],
      forbidden_patterns: ["checkout_push", "price_takeover", "global_relayout"]
    },
    [LABELS.EXPLORING]: {
      primary_state: LABELS.EXPLORING,
      user_need: "wayfinding",
      intervention_level: INTERVENTION_LEVELS.EMPHASIS,
      priority_scenario_key: null,
      operational_stage: "supporting",
      allowed_clusters: ["overview", "variants", "compare"],
      allowed_zones: ["overview", "variants", "compare"],
      allowed_primitives: ["quick_nav", "section_emphasis", "compare_scaffold"],
      forbidden_patterns: ["checkout_push", "price_takeover", "global_relayout"]
    },
    [LABELS.DEEP_RESEARCH]: {
      primary_state: LABELS.DEEP_RESEARCH,
      user_need: "clarity",
      intervention_level: INTERVENTION_LEVELS.ASSIST,
      priority_scenario_key: PRIORITY_SCENARIOS.RESEARCH_HEAVY.key,
      operational_stage: "priority",
      allowed_clusters: ["research", "purchase"],
      allowed_zones: ["research", "description", "specs", "reviews", "faq", "purchase"],
      allowed_primitives: ["quick_nav", "summary_cards", "review_highlights", "spec_summary", "trust_facts"],
      forbidden_patterns: ["checkout_push", "fake_urgency", "global_relayout"]
    },
    [LABELS.PRICE_SENSITIVE]: {
      primary_state: LABELS.PRICE_SENSITIVE,
      user_need: "value_explained",
      intervention_level: INTERVENTION_LEVELS.ASSIST,
      priority_scenario_key: PRIORITY_SCENARIOS.VALUE_CLARITY.key,
      operational_stage: "priority",
      allowed_clusters: ["purchase", "compare"],
      allowed_zones: ["purchase", "compare", "services", "benefits"],
      allowed_primitives: ["price_clarity", "installments", "shipping_return_clarity", "value_comparison"],
      forbidden_patterns: ["fake_urgency", "global_relayout", "research_takeover"]
    },
    [LABELS.REASSURANCE_SEEKING]: {
      primary_state: LABELS.REASSURANCE_SEEKING,
      user_need: "trust",
      intervention_level: INTERVENTION_LEVELS.ASSIST,
      priority_scenario_key: PRIORITY_SCENARIOS.VALUE_CLARITY.key,
      operational_stage: "priority",
      allowed_clusters: ["research", "purchase", "compare"],
      allowed_zones: ["research", "reviews", "faq", "purchase", "compare", "benefits"],
      allowed_primitives: ["trust_rail", "review_quotes", "return_warranty_clarity", "seller_confidence"],
      forbidden_patterns: ["fake_urgency", "discount_blast", "global_relayout"]
    },
    [LABELS.FRUSTRATED]: {
      primary_state: LABELS.FRUSTRATED,
      user_need: "recovery",
      intervention_level: INTERVENTION_LEVELS.ASSIST,
      priority_scenario_key: null,
      operational_stage: "supporting",
      allowed_clusters: ["research", "purchase", "compare"],
      allowed_zones: ["research", "purchase", "compare", "overview"],
      allowed_primitives: ["help_strip", "blocker_highlight", "recovery_shortcuts", "declutter"],
      forbidden_patterns: ["checkout_push", "promo_blast", "fake_urgency"]
    },
    [LABELS.OVERWHELMED]: {
      primary_state: LABELS.OVERWHELMED,
      user_need: "simplification",
      intervention_level: INTERVENTION_LEVELS.ASSIST,
      priority_scenario_key: null,
      operational_stage: "supporting",
      allowed_clusters: ["research", "purchase", "compare", "overview"],
      allowed_zones: ["research", "purchase", "compare", "overview"],
      allowed_primitives: ["declutter", "summary_cards", "focus_mode", "chunking"],
      forbidden_patterns: ["promo_blast", "multi_action_push", "visual_noise_increase"]
    },
    [LABELS.DECISION_READY]: {
      primary_state: LABELS.DECISION_READY,
      user_need: "frictionless_action",
      intervention_level: INTERVENTION_LEVELS.ACCELERATE,
      priority_scenario_key: PRIORITY_SCENARIOS.DECISION_ACCELERATION.key,
      operational_stage: "priority",
      allowed_clusters: ["purchase", "variants"],
      allowed_zones: ["purchase", "variants", "services", "benefits"],
      allowed_primitives: ["buy_box_compression", "sticky_cta", "selected_variant_summary", "checkout_shortcuts"],
      forbidden_patterns: ["research_takeover", "global_relayout", "promo_spam"]
    }
  });

  function normalizeState(label) {
    return String(label || LABELS.CALM_BROWSING).toUpperCase();
  }

  function getStateUiContract(label) {
    const normalized = normalizeState(label);
    return STATE_UI_CONTRACT[normalized] || STATE_UI_CONTRACT[LABELS.CALM_BROWSING];
  }

  function getPriorityScenarioForState(label) {
    return getStateUiContract(label)?.priority_scenario_key || null;
  }

  window.EmotionUIUiAdaptationContract = {
    INTERVENTION_LEVELS,
    PRIORITY_SCENARIOS,
    STATE_UI_CONTRACT,
    getStateUiContract,
    getPriorityScenarioForState
  };
})();
