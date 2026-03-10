(() => {
  const CanonicalStates = window.EmotionUICanonicalStates || {};
  const LABELS = CanonicalStates.LABELS || {};
  const AFFECT_TAGS = CanonicalStates.AFFECT_TAGS || CanonicalStates.EMOTION_TAGS || {};
  const EMOTION_TAGS = AFFECT_TAGS;
  const INTENT_TAGS = CanonicalStates.INTENT_TAGS || {};
  const CONSTRAINT_TAGS = CanonicalStates.CONSTRAINT_TAGS || {};

  const UI_MODES = Object.freeze({
    STANDARD: {
      key: "STANDARD",
      family: "neutral",
      default_intervention_type: "none",
      commercial: false
    },
    RESEARCH_MODE: {
      key: "RESEARCH_MODE",
      family: "research",
      default_intervention_type: "research_assist",
      commercial: false
    },
    PRICE_ALERT_MODE: {
      key: "PRICE_ALERT_MODE",
      family: "price",
      default_intervention_type: "price_reassurance",
      commercial: true
    },
    NEGOTIATOR_MODE: {
      key: "NEGOTIATOR_MODE",
      family: "reassurance",
      default_intervention_type: "value_reassurance",
      commercial: true
    },
    DESIGN_OXYGEN: {
      key: "DESIGN_OXYGEN",
      family: "friction",
      default_intervention_type: "friction_relief",
      commercial: false
    },
    SPOTLIGHT_MODE: {
      key: "SPOTLIGHT_MODE",
      family: "focus",
      semantic_mode: "OVERWHELMED_MODE",
      default_intervention_type: "focus_guidance",
      commercial: false
    },
    EXPRESS_LANE: {
      key: "EXPRESS_LANE",
      family: "checkout",
      default_intervention_type: "express_checkout",
      commercial: true
    }
  });

  const STATE_DEFINITIONS = Object.freeze({
    [LABELS.CALM_BROWSING]: {
      primary_state: LABELS.CALM_BROWSING,
      emotion_tag: AFFECT_TAGS.CALM,
      affect_tag: AFFECT_TAGS.CALM,
      intent_tag: INTENT_TAGS.EXPLORING,
      constraint_tags: [],
      default_mode: UI_MODES.STANDARD.key,
      default_intervention_type: UI_MODES.STANDARD.default_intervention_type,
      reason_families: ["NAV"]
    },
    [LABELS.EXPLORING]: {
      primary_state: LABELS.EXPLORING,
      emotion_tag: AFFECT_TAGS.CALM,
      affect_tag: AFFECT_TAGS.CALM,
      intent_tag: INTENT_TAGS.EXPLORING,
      constraint_tags: [],
      default_mode: UI_MODES.STANDARD.key,
      default_intervention_type: UI_MODES.STANDARD.default_intervention_type,
      reason_families: ["NAV", "RESEARCH"]
    },
    [LABELS.DEEP_RESEARCH]: {
      primary_state: LABELS.DEEP_RESEARCH,
      emotion_tag: AFFECT_TAGS.UNCERTAIN,
      affect_tag: AFFECT_TAGS.UNCERTAIN,
      intent_tag: INTENT_TAGS.DEEP_RESEARCH,
      constraint_tags: [CONSTRAINT_TAGS.INFO_CONSTRAINT],
      default_mode: UI_MODES.RESEARCH_MODE.key,
      default_intervention_type: UI_MODES.RESEARCH_MODE.default_intervention_type,
      reason_families: ["RESEARCH", "TRUST"]
    },
    [LABELS.PRICE_SENSITIVE]: {
      primary_state: LABELS.PRICE_SENSITIVE,
      emotion_tag: AFFECT_TAGS.UNCERTAIN,
      affect_tag: AFFECT_TAGS.UNCERTAIN,
      intent_tag: INTENT_TAGS.PRICE_EVALUATION,
      constraint_tags: [CONSTRAINT_TAGS.PRICE_CONSTRAINT],
      default_mode: UI_MODES.PRICE_ALERT_MODE.key,
      default_intervention_type: UI_MODES.PRICE_ALERT_MODE.default_intervention_type,
      reason_families: ["PRICE", "CTA"]
    },
    [LABELS.REASSURANCE_SEEKING]: {
      primary_state: LABELS.REASSURANCE_SEEKING,
      emotion_tag: AFFECT_TAGS.UNCERTAIN,
      affect_tag: AFFECT_TAGS.UNCERTAIN,
      intent_tag: INTENT_TAGS.DEEP_RESEARCH,
      constraint_tags: [CONSTRAINT_TAGS.TRUST_CONSTRAINT],
      default_mode: UI_MODES.NEGOTIATOR_MODE.key,
      default_intervention_type: UI_MODES.NEGOTIATOR_MODE.default_intervention_type,
      reason_families: ["TRUST", "RESEARCH"]
    },
    [LABELS.FRUSTRATED]: {
      primary_state: LABELS.FRUSTRATED,
      emotion_tag: AFFECT_TAGS.FRUSTRATED,
      affect_tag: AFFECT_TAGS.FRUSTRATED,
      intent_tag: INTENT_TAGS.EXPLORING,
      constraint_tags: [CONSTRAINT_TAGS.FRICTION_CONSTRAINT],
      default_mode: UI_MODES.DESIGN_OXYGEN.key,
      default_intervention_type: UI_MODES.DESIGN_OXYGEN.default_intervention_type,
      reason_families: ["FRICTION", "NAV"]
    },
    [LABELS.OVERWHELMED]: {
      primary_state: LABELS.OVERWHELMED,
      emotion_tag: AFFECT_TAGS.OVERWHELMED,
      affect_tag: AFFECT_TAGS.OVERWHELMED,
      intent_tag: INTENT_TAGS.EXPLORING,
      constraint_tags: [CONSTRAINT_TAGS.COGNITIVE_LOAD_CONSTRAINT],
      default_mode: UI_MODES.SPOTLIGHT_MODE.key,
      default_intervention_type: UI_MODES.SPOTLIGHT_MODE.default_intervention_type,
      reason_families: ["LOAD", "NAV"]
    },
    [LABELS.DECISION_READY]: {
      primary_state: LABELS.DECISION_READY,
      emotion_tag: AFFECT_TAGS.CONFIDENT,
      affect_tag: AFFECT_TAGS.CONFIDENT,
      intent_tag: INTENT_TAGS.DECISION_READY,
      constraint_tags: [],
      default_mode: UI_MODES.EXPRESS_LANE.key,
      default_intervention_type: UI_MODES.EXPRESS_LANE.default_intervention_type,
      reason_families: ["CTA", "CHECKOUT"]
    }
  });

  function normalizeLabel(label) {
    if (typeof CanonicalStates.normalizeStateLabel === "function") {
      return CanonicalStates.normalizeStateLabel(label);
    }
    return String(label || LABELS.CALM_BROWSING).toUpperCase();
  }

  function getStateDefinition(label) {
    const normalized = normalizeLabel(label);
    return STATE_DEFINITIONS[normalized] || STATE_DEFINITIONS[LABELS.CALM_BROWSING] || null;
  }

  function getModeDefinition(mode) {
    return UI_MODES[String(mode || "STANDARD").toUpperCase()] || UI_MODES.STANDARD;
  }

  window.EmotionUIStateContract = {
    UI_MODES,
    STATE_DEFINITIONS,
    getStateDefinition,
    getModeDefinition
  };
})();
