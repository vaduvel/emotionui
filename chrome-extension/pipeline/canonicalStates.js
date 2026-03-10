(() => {
  const LABELS = Object.freeze({
    CALM_BROWSING: "CALM_BROWSING",
    EXPLORING: "EXPLORING",
    DEEP_RESEARCH: "DEEP_RESEARCH",
    PRICE_SENSITIVE: "PRICE_SENSITIVE",
    REASSURANCE_SEEKING: "REASSURANCE_SEEKING",
    FRUSTRATED: "FRUSTRATED",
    OVERWHELMED: "OVERWHELMED",
    OVERLOADED: "OVERWHELMED",
    DECISION_READY: "DECISION_READY"
  });

  const ORDER = Object.freeze([
    LABELS.CALM_BROWSING,
    LABELS.EXPLORING,
    LABELS.DEEP_RESEARCH,
    LABELS.PRICE_SENSITIVE,
    LABELS.REASSURANCE_SEEKING,
    LABELS.FRUSTRATED,
    LABELS.OVERWHELMED,
    LABELS.DECISION_READY
  ]);

  const DEFAULT_LABEL = LABELS.CALM_BROWSING;

  const AFFECT_TAGS = Object.freeze({
    CALM: "CALM",
    UNCERTAIN: "UNCERTAIN",
    FRUSTRATED: "FRUSTRATED",
    OVERWHELMED: "OVERWHELMED",
    CONFIDENT: "CONFIDENT"
  });

  const EMOTION_TAGS = AFFECT_TAGS;

  const EMOTION_ORDER = Object.freeze([
    AFFECT_TAGS.CALM,
    AFFECT_TAGS.UNCERTAIN,
    AFFECT_TAGS.FRUSTRATED,
    AFFECT_TAGS.OVERWHELMED,
    AFFECT_TAGS.CONFIDENT
  ]);

  const INTENT_TAGS = Object.freeze({
    EXPLORING: "EXPLORING",
    DEEP_RESEARCH: "DEEP_RESEARCH",
    PRICE_EVALUATION: "PRICE_EVALUATION",
    DECISION_READY: "DECISION_READY",
    CHECKOUT_INTENT: "CHECKOUT_INTENT"
  });

  const INTENT_ORDER = Object.freeze([
    INTENT_TAGS.EXPLORING,
    INTENT_TAGS.DEEP_RESEARCH,
    INTENT_TAGS.PRICE_EVALUATION,
    INTENT_TAGS.DECISION_READY,
    INTENT_TAGS.CHECKOUT_INTENT
  ]);

  const CONSTRAINT_TAGS = Object.freeze({
    PRICE_CONSTRAINT: "PRICE_CONSTRAINT",
    TRUST_CONSTRAINT: "TRUST_CONSTRAINT",
    INFO_CONSTRAINT: "INFO_CONSTRAINT",
    FRICTION_CONSTRAINT: "FRICTION_CONSTRAINT",
    COGNITIVE_LOAD_CONSTRAINT: "COGNITIVE_LOAD_CONSTRAINT"
  });

  const CONSTRAINT_ORDER = Object.freeze([
    CONSTRAINT_TAGS.PRICE_CONSTRAINT,
    CONSTRAINT_TAGS.TRUST_CONSTRAINT,
    CONSTRAINT_TAGS.INFO_CONSTRAINT,
    CONSTRAINT_TAGS.FRICTION_CONSTRAINT,
    CONSTRAINT_TAGS.COGNITIVE_LOAD_CONSTRAINT
  ]);

  const DEFAULT_STATE_TAG_MAP = Object.freeze({
    [LABELS.CALM_BROWSING]: {
      emotion_tag: AFFECT_TAGS.CALM,
      affect_tag: AFFECT_TAGS.CALM,
      intent_tag: INTENT_TAGS.EXPLORING,
      constraint_tags: []
    },
    [LABELS.EXPLORING]: {
      emotion_tag: AFFECT_TAGS.CALM,
      affect_tag: AFFECT_TAGS.CALM,
      intent_tag: INTENT_TAGS.EXPLORING,
      constraint_tags: []
    },
    [LABELS.DEEP_RESEARCH]: {
      emotion_tag: AFFECT_TAGS.UNCERTAIN,
      affect_tag: AFFECT_TAGS.UNCERTAIN,
      intent_tag: INTENT_TAGS.DEEP_RESEARCH,
      constraint_tags: [CONSTRAINT_TAGS.INFO_CONSTRAINT]
    },
    [LABELS.PRICE_SENSITIVE]: {
      emotion_tag: AFFECT_TAGS.UNCERTAIN,
      affect_tag: AFFECT_TAGS.UNCERTAIN,
      intent_tag: INTENT_TAGS.PRICE_EVALUATION,
      constraint_tags: [CONSTRAINT_TAGS.PRICE_CONSTRAINT]
    },
    [LABELS.REASSURANCE_SEEKING]: {
      emotion_tag: AFFECT_TAGS.UNCERTAIN,
      affect_tag: AFFECT_TAGS.UNCERTAIN,
      intent_tag: INTENT_TAGS.DEEP_RESEARCH,
      constraint_tags: [CONSTRAINT_TAGS.TRUST_CONSTRAINT]
    },
    [LABELS.FRUSTRATED]: {
      emotion_tag: AFFECT_TAGS.FRUSTRATED,
      affect_tag: AFFECT_TAGS.FRUSTRATED,
      intent_tag: INTENT_TAGS.EXPLORING,
      constraint_tags: [CONSTRAINT_TAGS.FRICTION_CONSTRAINT]
    },
    [LABELS.OVERWHELMED]: {
      emotion_tag: AFFECT_TAGS.OVERWHELMED,
      affect_tag: AFFECT_TAGS.OVERWHELMED,
      intent_tag: INTENT_TAGS.EXPLORING,
      constraint_tags: [CONSTRAINT_TAGS.COGNITIVE_LOAD_CONSTRAINT]
    },
    [LABELS.DECISION_READY]: {
      emotion_tag: AFFECT_TAGS.CONFIDENT,
      affect_tag: AFFECT_TAGS.CONFIDENT,
      intent_tag: INTENT_TAGS.DECISION_READY,
      constraint_tags: []
    }
  });

  function normalizeStateLabel(label) {
    const value = String(label || "").toUpperCase();
    if (value === "OVERLOADED") return LABELS.OVERWHELMED;
    if (ORDER.includes(value)) return value;
    return DEFAULT_LABEL;
  }

  function isKnownState(label) {
    return ORDER.includes(normalizeStateLabel(label));
  }

  function createEmptyScores(order = ORDER) {
    return Object.fromEntries(order.map((label) => [label, 0]));
  }

  function getDefaultTagsForState(label) {
    return DEFAULT_STATE_TAG_MAP[normalizeStateLabel(label)] || DEFAULT_STATE_TAG_MAP[DEFAULT_LABEL];
  }

  window.EmotionUICanonicalStates = {
    LABELS,
    ORDER,
    DEFAULT_LABEL,
    AFFECT_TAGS,
    EMOTION_TAGS,
    EMOTION_ORDER,
    INTENT_TAGS,
    INTENT_ORDER,
    CONSTRAINT_TAGS,
    CONSTRAINT_ORDER,
    DEFAULT_STATE_TAG_MAP,
    normalizeStateLabel,
    isKnownState,
    createEmptyScores,
    createEmptyEmotionScores: () => createEmptyScores(EMOTION_ORDER),
    createEmptyIntentScores: () => createEmptyScores(INTENT_ORDER),
    createEmptyConstraintScores: () => createEmptyScores(CONSTRAINT_ORDER),
    getDefaultTagsForState
  };
})();
