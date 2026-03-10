const DEFAULT_STATE = {
  enabled: true
};

const runtimeApi = (typeof chrome !== "undefined" && chrome && chrome.runtime) ? chrome.runtime : null;
const storageLocalApi = (typeof chrome !== "undefined" && chrome && chrome.storage && chrome.storage.local) ? chrome.storage.local : null;
const tabsApi = (typeof chrome !== "undefined" && chrome && chrome.tabs) ? chrome.tabs : null;

const tabStats = new Map();
const POLICY_MODEL_KEY = "emotionui_policy_model_v2";
const TRAINING_META_KEY = "emotionui_training_meta_v1";
const POLICY_ACTIONS = ["SILENT", "OBSERVE", "INTERVENE"];

const CONFIG = {
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
      { key: "adaptive", weight: 1, runtime: "adaptive" },
      { key: "control", weight: 0, runtime: "control" },
      { key: "challenger_shadow", weight: 0, runtime: "adaptive_shadow" }
    ]
  },
  rewards: {
    wishlist: 0.1,
    addToCart: 0.12,
    checkoutStarted: 0.22,
    purchaseCompleted: 0.75,
    reviewRead: 0.2,
    interventionAccepted: 0.08,
    timelyInterventionBonus: 0.06,
    cartAbandon: -0.25,
    prolongedPriceNoCheckout: -0.08,
    fastBounce: -0.5,
    interventionClosed: -0.5,
    rewardDecayStartMs: 10000,
    minRewardMultiplier: 0.35
  }
};

const FEATURE_KEYS = [
  "scrolledPercentage",
  "clickRate",
  "sectionSwitchRate",
  "averageReadingSpeed",
  "reviewFocusRatio",
  "specFocusRatio",
  "researchCoverage",
  "reversalRate",
  "rageClicks",
  "mouseJitter",
  "deadClickRate",
  "exitIntentSignal",
  "priceHoverSignal",
  "cartIntentSignal",
  "checkoutSignal",
  "cartAbandonSignal",
  "purchaseCompleteSignal",
  "policyExposure",
  "wishlistSignal",
  "interventionClosed",
  "reviewReadLong",
  "bounceRisk"
];

const DEFAULT_CANONICAL_STATE = "CALM_BROWSING";

const SB_URL = "https://tmhymprkpbxvqhxofxvy.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtaHltcHJrcGJ4dnFoeG9meHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTY3MzQsImV4cCI6MjA4ODEzMjczNH0.yoL-3aCD2iTBRnmFwZQG5LDe0to7WBbGYBCcnYXcjvI";
const SUPABASE_REQUEST_TIMEOUT_MS = 12000;
const SUPABASE_LOG_THROTTLE_MS = 45000;
const supabaseErrorLogState = {
  lastKey: "",
  lastTs: 0,
  suppressed: 0
};

function buildSupabaseErrorKey(result = {}) {
  const status = String(result.status || "network");
  const message = String(result.error || "unknown").slice(0, 140);
  return `${status}:${message}`;
}

function logSupabaseFailure(result = {}) {
  const now = Date.now();
  const key = buildSupabaseErrorKey(result);
  const repeated = key === supabaseErrorLogState.lastKey;
  const withinThrottle = (now - supabaseErrorLogState.lastTs) < SUPABASE_LOG_THROTTLE_MS;

  if (repeated && withinThrottle) {
    supabaseErrorLogState.suppressed += 1;
    return;
  }

  const suppressed = supabaseErrorLogState.suppressed;
  supabaseErrorLogState.lastKey = key;
  supabaseErrorLogState.lastTs = now;
  supabaseErrorLogState.suppressed = 0;

  const suffix = suppressed > 0 ? ` (suppressed ${suppressed} similar errors)` : "";
  console.warn(
    `[Adaptive State Tracker] Supabase insert warning:${suffix}`,
    result.status || "no_status",
    result.error || "unknown"
  );
}

class RewardCalculator {
  constructor(config = {}) {
    this.config = {
      wishlist: 0.1,
      addToCart: 0.12,
      checkoutStarted: 0.22,
      purchaseCompleted: 0.75,
      reviewRead: 0.2,
      interventionAccepted: 0.08,
      timelyInterventionBonus: 0.06,
      cartAbandon: -0.25,
      prolongedPriceNoCheckout: -0.08,
      fastBounce: -0.5,
      interventionClosed: -0.5,
      rewardDecayStartMs: 10000,
      minRewardMultiplier: 0.35,
      ...config
    };
  }

  compute(context = {}) {
    const outcomeDetail = context.outcomeDetail || {};
    const attribution = (context.attribution && typeof context.attribution === "object") ? context.attribution : {};
    const decisionMeta = (context.decisionMeta && typeof context.decisionMeta === "object") ? context.decisionMeta : {};
    const duration = Number(context.sessionDurationSec || 0);
    const cartAbandons = Number(
      context.cartAbandons ??
      outcomeDetail.cart_abandons ??
      0
    );
    const timeOnPriceSec = Number(
      context.timeOnPriceSec ??
      outcomeDetail.time_on_price ??
      0
    );
    const chosenPolicy = String(decisionMeta.policy || "SILENT").toUpperCase();
    const exposureDelayMs = Number(attribution.exposure_delay_ms || 0);
    const rewardWindowMs = Number(attribution.reward_window_ms || 0);

    let reward = 0;
    if (outcomeDetail.added_to_wishlist) reward += this.config.wishlist;
    if (outcomeDetail.added_to_cart) reward += this.config.addToCart;
    if (outcomeDetail.checkout_started) reward += this.config.checkoutStarted;
    if (outcomeDetail.purchase_completed) reward += this.config.purchaseCompleted;
    if (outcomeDetail.review_dwell_over_10s) reward += this.config.reviewRead;
    if (outcomeDetail.intervention_accepted) reward += this.config.interventionAccepted;
    if (cartAbandons > 0 && !outcomeDetail.checkout_started && !outcomeDetail.purchase_completed) {
      reward += this.config.cartAbandon;
    }
    if (timeOnPriceSec >= 12 && !outcomeDetail.checkout_started && !outcomeDetail.purchase_completed) {
      reward += this.config.prolongedPriceNoCheckout;
    }
    if (duration > 0 && duration < 5) reward += this.config.fastBounce;
    if (outcomeDetail.intervention_closed) reward += this.config.interventionClosed;

    const positiveOutcome =
      Boolean(outcomeDetail.added_to_wishlist) ||
      Boolean(outcomeDetail.added_to_cart) ||
      Boolean(outcomeDetail.checkout_started) ||
      Boolean(outcomeDetail.purchase_completed) ||
      Boolean(outcomeDetail.review_dwell_over_10s) ||
      Boolean(outcomeDetail.intervention_accepted);

    if ((chosenPolicy === "INTERVENE" || chosenPolicy === "OBSERVE") && rewardWindowMs > 0 && reward > 0) {
      const decayStartMs = Number(this.config.rewardDecayStartMs || 10000);
      const minMultiplier = Number(this.config.minRewardMultiplier || 0.35);

      let multiplier = 1;
      if (exposureDelayMs > rewardWindowMs) {
        multiplier = minMultiplier;
      } else if (exposureDelayMs > decayStartMs) {
        const span = Math.max(1, rewardWindowMs - decayStartMs);
        const progress = Math.max(0, Math.min(1, (exposureDelayMs - decayStartMs) / span));
        multiplier = 1 - (progress * (1 - minMultiplier));
      }

      reward *= multiplier;
    }

    if ((chosenPolicy === "INTERVENE" || chosenPolicy === "OBSERVE") && positiveOutcome && rewardWindowMs > 0 && exposureDelayMs <= rewardWindowMs) {
      reward += this.config.timelyInterventionBonus;
    }

    return Math.max(-1, Math.min(1, Number(reward.toFixed(4))));
  }
}

function hashStringToUnitInterval(value = "") {
  const input = String(value || "");
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function normalizeExperimentVariants(variants = []) {
  if (!Array.isArray(variants)) return [];
  return variants
    .map((variant) => ({
      key: String(variant?.key || "").trim(),
      weight: Math.max(0, Number(variant?.weight || 0)),
      runtime: String(variant?.runtime || "adaptive").trim() || "adaptive"
    }))
    .filter((variant) => variant.key && variant.weight > 0);
}

function assignExperimentVariant(context = {}, config = CONFIG.experiment) {
  const enabled = config?.enabled !== false;
  const experimentKey = String(config?.key || "policy_runtime_v1");
  const configVersion = String(config?.configVersion || "v1");
  const normalizedVariants = normalizeExperimentVariants(config?.variants || []);
  const defaultVariant = normalizedVariants[0] || { key: "adaptive", weight: 1, runtime: "adaptive" };
  const subjectKey = String(
    context?.sessionId ||
    `${context?.site || "site"}:${context?.productId || "product"}`
  );
  const bucket = hashStringToUnitInterval(`${config?.salt || experimentKey}:${configVersion}:${subjectKey}`);

  if (!enabled || !normalizedVariants.length) {
    return {
      enabled,
      experiment_key: experimentKey,
      experiment_variant: defaultVariant.key,
      experiment_runtime_mode: defaultVariant.runtime,
      experiment_config_version: configVersion,
      experiment_assignment_bucket: bucket
    };
  }

  const totalWeight = normalizedVariants.reduce((sum, variant) => sum + variant.weight, 0) || 1;
  let cursor = 0;
  let winner = normalizedVariants[normalizedVariants.length - 1];
  for (const variant of normalizedVariants) {
    cursor += variant.weight / totalWeight;
    if (bucket <= cursor) {
      winner = variant;
      break;
    }
  }

  return {
    enabled,
    experiment_key: experimentKey,
    experiment_variant: winner.key,
    experiment_runtime_mode: winner.runtime,
    experiment_config_version: configVersion,
    experiment_assignment_bucket: bucket
  };
}

function applyExperimentDecision(baseDecision, experiment = {}) {
  const decision = {
    ...baseDecision,
    experiment_key: experiment.experiment_key || null,
    experiment_variant: experiment.experiment_variant || "adaptive",
    experiment_runtime_mode: experiment.experiment_runtime_mode || "adaptive",
    experiment_config_version: experiment.experiment_config_version || "v1",
    experiment_assignment_bucket: Number(experiment.experiment_assignment_bucket || 0)
  };

  if (String(experiment.experiment_runtime_mode || "").toLowerCase() !== "control") {
    return decision;
  }

  return {
    ...decision,
    source: `${baseDecision.source || "policy_model"}+experiment_control`,
    policy: "SILENT",
    confidence: 1,
    reason: "experiment_control_forced_silent",
    exploration: false,
    abstained: true,
    shadow_policy: String(baseDecision.policy || "SILENT").toUpperCase(),
    shadow_confidence: Number(baseDecision.confidence || 0),
    shadow_reason: baseDecision.reason || "unknown",
    shadow_source: baseDecision.source || "policy_model",
    shadow_policy_probs: baseDecision.policy_probs || {},
    policy_probs: {
      SILENT: 1,
      OBSERVE: 0,
      INTERVENE: 0
    }
  };
}

class PolicyModel {
  static newWeights() {
    const weights = { b: 0 };
    for (const key of FEATURE_KEYS) weights[key] = 0;
    return weights;
  }

  static defaultModel() {
    const actions = {};
    for (const action of POLICY_ACTIONS) actions[action] = PolicyModel.newWeights();

    return {
      version: 2,
      trained_samples: 0,
      running_reward: 0,
      actions
    };
  }

  static ensureShape(model) {
    const fallback = PolicyModel.defaultModel();
    if (!model || typeof model !== "object") return fallback;

    const safe = {
      version: Number(model.version || fallback.version),
      trained_samples: Number(model.trained_samples || 0),
      running_reward: Number(model.running_reward || 0),
      actions: {}
    };

    const srcActions = model.actions && typeof model.actions === "object" ? model.actions : {};
    for (const action of POLICY_ACTIONS) {
      const src = srcActions[action];
      safe.actions[action] = { ...PolicyModel.newWeights(), ...(src && typeof src === "object" ? src : {}) };
      if (typeof safe.actions[action].b !== "number") safe.actions[action].b = 0;
    }

    return safe;
  }

  static clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  static normalizeFeatures(raw = {}) {
    const features = {};
    for (const key of FEATURE_KEYS) {
      features[key] = PolicyModel.clamp01(Number(raw[key] || 0));
    }
    return features;
  }

  static linear(weights, x) {
    let z = Number(weights.b || 0);
    for (const [key, value] of Object.entries(x)) {
      z += Number(weights[key] || 0) * value;
    }
    return z;
  }

  static softmax(scores, temperature = 1) {
    const entries = Object.entries(scores);
    const temp = Math.max(0.05, Number(temperature) || 1);
    const vals = entries.map(([, v]) => Number(v) / temp);
    const maxVal = Math.max(...vals);
    const exps = vals.map((v) => Math.exp(v - maxVal));
    const sum = exps.reduce((acc, value) => acc + value, 0) || 1;

    const probs = {};
    for (let i = 0; i < entries.length; i += 1) {
      probs[entries[i][0]] = exps[i] / sum;
    }
    return probs;
  }

  static chooseWithExploration(sortedEntries, epsilon) {
    const explore = Math.random() < epsilon;
    if (!explore) return { policy: sortedEntries[0][0], exploration: false };

    const randomPolicy = POLICY_ACTIONS[Math.floor(Math.random() * POLICY_ACTIONS.length)] || "SILENT";
    return { policy: randomPolicy, exploration: true };
  }

  static heuristicBootstrapDecision(rawFeatures = {}, decisionContext = {}) {
    const research = Number(rawFeatures.researchCoverage || 0);
    const reviewFocus = Number(rawFeatures.reviewFocusRatio || 0);
    const specFocus = Number(rawFeatures.specFocusRatio || 0);
    const reversal = Number(rawFeatures.reversalRate || 0);
    const rage = Number(rawFeatures.rageClicks || 0);
    const mouseJitter = Number(rawFeatures.mouseJitter || 0);
    const deadClickRate = Number(rawFeatures.deadClickRate || 0);
    const exitIntent = Number(rawFeatures.exitIntentSignal || 0);
    const priceHover = Number(rawFeatures.priceHoverSignal || 0);
    const cartIntent = Number(rawFeatures.cartIntentSignal || 0);
    const checkoutSignal = Number(rawFeatures.checkoutSignal || 0);
    const cartAbandon = Number(rawFeatures.cartAbandonSignal || 0);
    const purchaseComplete = Number(rawFeatures.purchaseCompleteSignal || 0);
    const bounce = Number(rawFeatures.bounceRisk || 0);
    const interventionClosed = Number(rawFeatures.interventionClosed || 0);
    const stateLabel = String(decisionContext.stateLabel || "").toUpperCase();
    const stateConfidence = Number(decisionContext.stateConfidence || 0);
    const pageContext = (decisionContext.pageContextSummary && typeof decisionContext.pageContextSummary === "object")
      ? decisionContext.pageContextSummary
      : {};
    const domainCooldownActive = Boolean(decisionContext.domainCooldownActive);

    if (purchaseComplete >= 0.95) {
      return {
        policy: "SILENT",
        confidence: 0.72,
        reason: "heuristic_purchase_completed_silent",
        policy_probs: { SILENT: 0.74, OBSERVE: 0.17, INTERVENE: 0.09 }
      };
    }

    if (!domainCooldownActive && stateLabel === "DECISION_READY" && stateConfidence >= 0.45 && (checkoutSignal >= 0.35 || cartIntent >= 0.35)) {
      return {
        policy: "INTERVENE",
        confidence: 0.63,
        reason: "heuristic_state_decision_ready",
        policy_probs: { SILENT: 0.14, OBSERVE: 0.22, INTERVENE: 0.64 }
      };
    }

    if (
      !domainCooldownActive &&
      /^(PRICE_SENSITIVE|REASSURANCE_SEEKING)$/.test(stateLabel) &&
      stateConfidence >= 0.44 &&
      (priceHover >= 0.25 || cartIntent >= 0.25 || pageContext.hasDiscountSignal || pageContext.hasInstallmentSignal)
    ) {
      return {
        policy: "INTERVENE",
        confidence: 0.59,
        reason: "heuristic_state_price_reassurance",
        policy_probs: { SILENT: 0.17, OBSERVE: 0.24, INTERVENE: 0.59 }
      };
    }

    if (stateLabel === "DEEP_RESEARCH" && stateConfidence >= 0.42 && (research >= 0.25 || reviewFocus >= 0.25 || specFocus >= 0.25)) {
      return {
        policy: "OBSERVE",
        confidence: 0.5,
        reason: "heuristic_state_deep_research",
        policy_probs: { SILENT: 0.23, OBSERVE: 0.52, INTERVENE: 0.25 }
      };
    }

    if (stateLabel === "EXPLORING" && stateConfidence >= 0.42 && research >= 0.16 && bounce < 1) {
      return {
        policy: "OBSERVE",
        confidence: 0.49,
        reason: "heuristic_state_exploring",
        policy_probs: { SILENT: 0.24, OBSERVE: 0.51, INTERVENE: 0.25 }
      };
    }

    if (!domainCooldownActive && /^(OVERLOADED|FRUSTRATED)$/.test(stateLabel) && stateConfidence >= 0.45 && interventionClosed < 0.8 && bounce < 1) {
      return {
        policy: "INTERVENE",
        confidence: 0.58,
        reason: "heuristic_state_navigation_distress",
        policy_probs: { SILENT: 0.17, OBSERVE: 0.25, INTERVENE: 0.58 }
      };
    }

    if (checkoutSignal >= 0.8 && cartAbandon < 0.35 && bounce < 1) {
      return {
        policy: "INTERVENE",
        confidence: 0.64,
        reason: "heuristic_express_checkout_intervene",
        policy_probs: { SILENT: 0.13, OBSERVE: 0.21, INTERVENE: 0.66 }
      };
    }

    if ((exitIntent >= 0.45 && (priceHover >= 0.4 || cartAbandon >= 0.35)) || (priceHover >= 0.55 && cartAbandon >= 0.4)) {
      return {
        policy: "INTERVENE",
        confidence: 0.61,
        reason: "heuristic_hesitant_price_sensitive_intervene",
        policy_probs: { SILENT: 0.15, OBSERVE: 0.23, INTERVENE: 0.62 }
      };
    }

    if ((rage >= 0.5 || reversal >= 0.55 || deadClickRate >= 0.35 || mouseJitter >= 0.55) && interventionClosed < 0.8 && bounce < 1) {
      return {
        policy: "INTERVENE",
        confidence: 0.56,
        reason: "heuristic_bootstrap_intervene",
        policy_probs: { SILENT: 0.18, OBSERVE: 0.24, INTERVENE: 0.58 }
      };
    }

    if (research >= 0.38 || reviewFocus >= 0.3 || specFocus >= 0.3) {
      return {
        policy: "OBSERVE",
        confidence: 0.48,
        reason: "heuristic_bootstrap_observe",
        policy_probs: { SILENT: 0.24, OBSERVE: 0.52, INTERVENE: 0.24 }
      };
    }

    if (cartIntent >= 0.35 || priceHover >= 0.3 || exitIntent >= 0.3) {
      return {
        policy: "OBSERVE",
        confidence: 0.42,
        reason: "heuristic_purchase_interest_observe",
        policy_probs: { SILENT: 0.28, OBSERVE: 0.45, INTERVENE: 0.27 }
      };
    }

    return {
      policy: "SILENT",
      confidence: 0.6,
      reason: "heuristic_bootstrap_silent",
      policy_probs: { SILENT: 0.66, OBSERVE: 0.24, INTERVENE: 0.1 }
    };
  }

  static decide(model, rawFeatures, config = CONFIG.policy, decisionContext = {}) {
    const safeModel = PolicyModel.ensureShape(model);
    const x = PolicyModel.normalizeFeatures(rawFeatures);

    if (safeModel.trained_samples < Number(config.minSamplesForModelOnly || 80)) {
      const heuristic = PolicyModel.heuristicBootstrapDecision(rawFeatures || {}, decisionContext || {});
      return {
        source: "policy_model_v2_bootstrap",
        policy: heuristic.policy,
        confidence: Number((heuristic.confidence || 0).toFixed(4)),
        reason: heuristic.reason,
        policy_probs: heuristic.policy_probs,
        exploration: false,
        abstained: false,
        state: decisionContext.stateLabel || DEFAULT_CANONICAL_STATE,
        action: heuristic.policy,
        state_label: decisionContext.stateLabel || DEFAULT_CANONICAL_STATE,
        state_confidence: Number(decisionContext.stateConfidence || 0),
        previous_mode: decisionContext.previousMode || null,
        page_context_summary: decisionContext.pageContextSummary || {},
        domain_cooldown_active: Boolean(decisionContext.domainCooldownActive)
      };
    }

    const logits = {};
    for (const action of POLICY_ACTIONS) {
      logits[action] = PolicyModel.linear(safeModel.actions[action], x);
    }

    const probs = PolicyModel.softmax(logits, config.softmaxTemperature);
    const ranked = Object.entries(probs).sort((a, b) => b[1] - a[1]);
    const topPolicy = ranked[0]?.[0] || "SILENT";
    const topConfidence = Number(ranked[0]?.[1] || 0);

    let { policy, exploration } = PolicyModel.chooseWithExploration(ranked, Number(config.epsilon || 0));
    let reason = exploration ? "epsilon_exploration" : "policy_argmax";

    if (policy === "INTERVENE" && topConfidence < Number(config.minConfidenceIntervene || 0.5)) {
      policy = "OBSERVE";
      reason = "intervene_low_confidence_downgraded_to_observe";
    }

    if (policy === "OBSERVE" && topConfidence < Number(config.minConfidenceObserve || 0.34)) {
      policy = "SILENT";
      reason = "observe_low_confidence_downgraded_to_silent";
    }

    const confidence = Number((probs[policy] || topConfidence || 0).toFixed(4));

    return {
      source: "policy_model_v2",
      policy,
      confidence,
      reason,
      policy_probs: probs,
      exploration,
      abstained: policy === "SILENT" && topPolicy !== "SILENT",
      state: decisionContext.stateLabel || DEFAULT_CANONICAL_STATE,
      action: policy,
      state_label: decisionContext.stateLabel || DEFAULT_CANONICAL_STATE,
      state_confidence: Number(decisionContext.stateConfidence || 0),
      previous_mode: decisionContext.previousMode || null,
      page_context_summary: decisionContext.pageContextSummary || {},
      domain_cooldown_active: Boolean(decisionContext.domainCooldownActive)
    };
  }

  static learn(model, rawFeatures, chosenPolicy, reward, config = CONFIG.policy) {
    const safeModel = PolicyModel.ensureShape(model);
    const x = PolicyModel.normalizeFeatures(rawFeatures);
    const decision = PolicyModel.decide(safeModel, x, { ...config, epsilon: 0 });

    const policy = POLICY_ACTIONS.includes(chosenPolicy) ? chosenPolicy : "SILENT";
    const chosenProb = Number(decision.policy_probs[policy] || 0.001);
    const target = PolicyModel.clamp01((Number(reward || 0) + 1) / 2);
    const lr = Number(config.learningRate || 0.04);
    const l2 = Number(config.l2 || 0.0003);

    const chosenWeights = safeModel.actions[policy];
    const chosenError = target - chosenProb;

    chosenWeights.b += lr * chosenError;
    for (const [key, value] of Object.entries(x)) {
      const current = Number(chosenWeights[key] || 0);
      chosenWeights[key] = current + lr * ((chosenError * value) - (l2 * current));
    }

    for (const action of POLICY_ACTIONS) {
      if (action === policy) continue;
      const weights = safeModel.actions[action];
      const prob = Number(decision.policy_probs[action] || 0);
      const softPenalty = 0 - prob;
      weights.b += (lr * 0.2) * softPenalty;
      for (const [key, value] of Object.entries(x)) {
        const current = Number(weights[key] || 0);
        weights[key] = current + (lr * 0.2) * ((softPenalty * value) - (l2 * current));
      }
    }

    safeModel.trained_samples += 1;
    safeModel.running_reward = Number((safeModel.running_reward * 0.97 + Number(reward || 0) * 0.03).toFixed(4));

    return safeModel;
  }
}

const rewardCalculator = new RewardCalculator(CONFIG.rewards);

function createTrainingMeta() {
  return {
    run_id: `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    started_at: new Date().toISOString()
  };
}

function ensureTrainingMeta(meta) {
  const runId = String(meta?.run_id || "").trim();
  const startedAt = String(meta?.started_at || "").trim();
  if (!runId || !startedAt) {
    return createTrainingMeta();
  }
  return { run_id: runId, started_at: startedAt };
}

async function getTrainingMeta() {
  if (!storageLocalApi) return createTrainingMeta();
  const res = await storageLocalApi.get([TRAINING_META_KEY]);
  const safe = ensureTrainingMeta(res[TRAINING_META_KEY]);
  if (!res[TRAINING_META_KEY] || safe.run_id !== res[TRAINING_META_KEY].run_id || safe.started_at !== res[TRAINING_META_KEY].started_at) {
    await storageLocalApi.set({ [TRAINING_META_KEY]: safe });
  }
  return safe;
}

async function setTrainingMeta(meta) {
  const safe = ensureTrainingMeta(meta);
  if (!storageLocalApi) return safe;
  await storageLocalApi.set({ [TRAINING_META_KEY]: safe });
  return safe;
}

function enrichSessionPayload(payload, trainingMeta) {
  if (!payload || typeof payload !== "object") return payload;

  const safePayload = { ...payload };
  const safeOutcomeDetail = safePayload.outcome_detail && typeof safePayload.outcome_detail === "object"
    ? { ...safePayload.outcome_detail }
    : {};
  const safePolicy = safeOutcomeDetail.policy && typeof safeOutcomeDetail.policy === "object"
    ? { ...safeOutcomeDetail.policy }
    : {};

  safePolicy.training_run_id = trainingMeta.run_id;
  safePolicy.training_started_at = trainingMeta.started_at;
  safePolicy.clean_training_scope = "local_reset";

  safeOutcomeDetail.policy = safePolicy;
  safePayload.outcome_detail = safeOutcomeDetail;
  return safePayload;
}

async function saveSessionToSupabase(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Missing payload." };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${SB_URL}/rest/v1/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        Prefer: "return=minimal"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: await res.text()
      };
    }

    return { ok: true, session_id: payload.session_id || null };
  } catch (error) {
    clearTimeout(timeoutId);
    const name = String(error?.name || "");
    const isAbort = name === "AbortError";
    return {
      ok: false,
      status: isAbort ? "timeout" : "network_error",
      error: isAbort
        ? `Request timeout after ${SUPABASE_REQUEST_TIMEOUT_MS}ms`
        : (error?.message || String(error))
    };
  }
}

async function getPolicyModel() {
  if (!storageLocalApi) return PolicyModel.defaultModel();
  const res = await storageLocalApi.get([POLICY_MODEL_KEY]);
  return PolicyModel.ensureShape(res[POLICY_MODEL_KEY] || PolicyModel.defaultModel());
}

async function setPolicyModel(model) {
  if (!storageLocalApi) return;
  await storageLocalApi.set({ [POLICY_MODEL_KEY]: PolicyModel.ensureShape(model) });
}

if (runtimeApi && runtimeApi.onInstalled && storageLocalApi) {
  runtimeApi.onInstalled.addListener(async () => {
    const current = await storageLocalApi.get(["enabled", POLICY_MODEL_KEY, TRAINING_META_KEY]);
    if (typeof current.enabled !== "boolean") {
      await storageLocalApi.set(DEFAULT_STATE);
    }
    if (!current[POLICY_MODEL_KEY]) {
      await storageLocalApi.set({ [POLICY_MODEL_KEY]: PolicyModel.defaultModel() });
    }
    if (!current[TRAINING_META_KEY]) {
      await storageLocalApi.set({ [TRAINING_META_KEY]: createTrainingMeta() });
    }
  });
}

if (tabsApi && tabsApi.onRemoved) {
  tabsApi.onRemoved.addListener((tabId) => {
    tabStats.delete(tabId);
  });
}

if (runtimeApi && runtimeApi.onMessage) {
runtimeApi.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === "EMOTIONUI_GET_ENABLED") {
    if (!storageLocalApi) {
      sendResponse({ enabled: true });
      return true;
    }
    storageLocalApi.get(["enabled"]).then((res) => {
      sendResponse({ enabled: res.enabled !== false });
    });
    return true;
  }

  if (message.type === "EMOTIONUI_SET_ENABLED") {
    const enabled = !!message.enabled;
    if (!storageLocalApi) {
      sendResponse({ ok: false, error: "storage_unavailable" });
      return true;
    }
    storageLocalApi.set({ enabled }).then(() => {
      sendResponse({ ok: true, enabled });
      if (!tabsApi || !tabsApi.query) return;
      tabsApi.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id && /^https?:/i.test(tab.url || "")) {
            tabsApi.sendMessage(tab.id, { type: "EMOTIONUI_TOGGLE", enabled }).catch(() => {});
          }
        }
      });
    });
    return true;
  }

  if (message.type === "EMOTIONUI_UPDATE_STATS") {
    if (sender.tab && typeof sender.tab.id === "number") {
      tabStats.set(sender.tab.id, {
        ...message.stats,
        updatedAt: Date.now()
      });
    }
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "EMOTIONUI_GET_TAB_STATS") {
    const tabId = message.tabId;
    sendResponse({ stats: tabStats.get(tabId) || null });
    return;
  }

  if (message.type === "EMOTIONUI_SAVE_SESSION") {
    (async () => {
      const trainingMeta = await getTrainingMeta();
      const payload = enrichSessionPayload(message.payload, trainingMeta);
      const result = await saveSessionToSupabase(payload);
      if (!result.ok) {
        logSupabaseFailure(result);
      }
      sendResponse({
        ...result,
        training_run_id: trainingMeta.run_id,
        training_started_at: trainingMeta.started_at
      });
    })();
    return true;
  }

  if (message.type === "EMOTIONUI_POLICY_DECIDE") {
    getPolicyModel().then((model) => {
      const baseDecision = PolicyModel.decide(model, message.features || {}, CONFIG.policy, message.context || {});
      const experiment = assignExperimentVariant(message.context || {}, CONFIG.experiment);
      const decision = applyExperimentDecision(baseDecision, experiment);
      sendResponse({
        ...decision,
        model_version: model.version || 2,
        trained_samples: model.trained_samples || 0
      });
    });
    return true;
  }

  if (message.type === "EMOTIONUI_POLICY_LEARN") {
    getPolicyModel().then(async (model) => {
      const reward = rewardCalculator.compute(message.context || {});
      const experimentRuntimeMode = String(
        message?.context?.decisionMeta?.experimentRuntimeMode ||
        message?.decision?.experiment_runtime_mode ||
        "adaptive"
      ).toLowerCase();
      if (experimentRuntimeMode === "control") {
        sendResponse({
          ok: true,
          reward,
          trained_samples: model.trained_samples || 0,
          running_reward: model.running_reward || 0,
          skipped_training: true,
          skipped_reason: "experiment_control_holdout"
        });
        return;
      }
      const chosenPolicy = message?.decision?.policy || "SILENT";
      const updated = PolicyModel.learn(model, message.features || {}, chosenPolicy, reward, CONFIG.policy);
      await setPolicyModel(updated);

      sendResponse({
        ok: true,
        reward,
        trained_samples: updated.trained_samples || 0,
        running_reward: updated.running_reward || 0
      });
    });
    return true;
  }

  if (message.type === "EMOTIONUI_POLICY_RESET") {
    setPolicyModel(PolicyModel.defaultModel()).then(() => {
      sendResponse({ ok: true, trained_samples: 0, running_reward: 0 });
    }).catch((error) => {
      sendResponse({ ok: false, error: error?.message || String(error) });
    });
    return true;
  }

  if (message.type === "EMOTIONUI_GET_TRAINING_META") {
    getTrainingMeta().then((meta) => {
      sendResponse({ ok: true, ...meta });
    }).catch((error) => {
      sendResponse({ ok: false, error: error?.message || String(error) });
    });
    return true;
  }

  if (message.type === "EMOTIONUI_CLEAN_START") {
    (async () => {
      try {
        const meta = await setTrainingMeta(createTrainingMeta());
        await setPolicyModel(PolicyModel.defaultModel());
        tabStats.clear();

        sendResponse({
          ok: true,
          trained_samples: 0,
          running_reward: 0,
          training_run_id: meta.run_id,
          training_started_at: meta.started_at
        });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  if (message.type === "EMOTIONUI_OPEN_SIDE_PANEL") {
    (async () => {
      try {
        if (chrome.sidePanel && typeof chrome.sidePanel.open === "function") {
          const target = {};
          if (Number.isFinite(Number(message.windowId))) {
            target.windowId = Number(message.windowId);
          } else if (Number.isFinite(Number(message.tabId))) {
            target.tabId = Number(message.tabId);
          }

          if (Object.keys(target).length === 0) {
            const tabs = tabsApi ? await tabsApi.query({ active: true, currentWindow: true }) : [];
            const active = tabs[0];
            if (active?.windowId) target.windowId = active.windowId;
            if (!target.windowId && active?.id) target.tabId = active.id;
          }

          await chrome.sidePanel.open(target);
          sendResponse({ ok: true, sidePanel: true });
          return;
        }

        if (!runtimeApi || !tabsApi) {
          sendResponse({ ok: false, error: "panel_apis_unavailable" });
          return;
        }
        const url = runtimeApi.getURL("popup.html#live");
        await tabsApi.create({ url });
        sendResponse({ ok: true, fallbackTab: true });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  // Compatibility endpoint for older tooling.
  if (message.type === "EMOTIONUI_ML_STATUS") {
    getPolicyModel().then((model) => {
      sendResponse({
        trained_samples: model.trained_samples || 0,
        version: model.version || 2,
        running_reward: model.running_reward || 0
      });
    });
    return true;
  }
});
}
