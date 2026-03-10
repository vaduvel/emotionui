(() => {
  const config = window.EMOTIONUI_CONFIG || {};
  const complianceConfig = config.compliance || {};
  const EARLY_DENY_HOST_PATTERNS = [
    /(^|\.)figma\.com$/i,
    /(^|\.)claude\.ai$/i,
    /(^|\.)chatgpt\.com$/i,
    /(^|\.)openai\.com$/i,
    /(^|\.)kaggle\.com$/i
  ];

  const currentHost = String(window.location.hostname || "").replace(/^www\./i, "");
  if (EARLY_DENY_HOST_PATTERNS.some((pattern) => pattern.test(currentHost))) {
    return;
  }

  const DataCollector = window.EmotionUIDataCollector;
  const FeatureExtractor = window.EmotionUIFeatureExtractor;
  const PageContextExtractor = window.EmotionUIPageContextExtractor;
  const CanonicalStates = window.EmotionUICanonicalStates;
  const StateContract = window.EmotionUIStateContract;
  const ReasonCodeEngine = window.EmotionUIReasonCodeEngine;
  const PdpGate = window.EmotionUIPdpGate;
  const StateClassifier = window.EmotionUIStateClassifier;
  const AdaptationMapper = window.EmotionUIAdaptationMapper;
  const RulesResolver = window.EmotionUIRulesResolver;
  const PolicyClient = window.EmotionUIPolicyClient;
  const OutcomeLogger = window.EmotionUIOutcomeLogger;
  const HysteresisGuard = window.EmotionUIHysteresisGuard;
  const ActionResolver = window.EmotionUIActionResolver;

  if (!DataCollector || !FeatureExtractor || !PageContextExtractor || !CanonicalStates || !StateContract || !ReasonCodeEngine || !PdpGate || !StateClassifier || !AdaptationMapper || !RulesResolver || !PolicyClient || !OutcomeLogger || !HysteresisGuard || !ActionResolver) {
    return;
  }
  const biometricInputsEnabled = Boolean(complianceConfig.biometricInputsEnabled);
  const defaultAffectTag = CanonicalStates.AFFECT_TAGS?.CALM || CanonicalStates.EMOTION_TAGS?.CALM || "CALM";

  const PAGE_CONTEXT_KEYS = [
    "hasPrimaryPrice",
    "hasDiscountSignal",
    "hasStickyPurchaseCta",
    "hasUrgencySignal",
    "hasInstallmentSignal",
    "hasReviewDensitySignal",
    "hasSpecTableSignal",
    "hasTrustSignal",
    "hasVariantChoices",
    "hasCompareAction",
    "hasShippingSignal",
    "hasWarrantySignal",
    "hasPromoCluster"
  ];
  const PAGE_CONTEXT_METRIC_KEYS = [
    "primaryActionCount",
    "secondaryActionCount",
    "variantOptionCount",
    "reviewAnchorCount",
    "promoBlockCount",
    "infoBlockCount",
    "pageDensityScore"
  ];

  const createCollector = () => new DataCollector(config.collector || {});
  let collector = createCollector();
  const extractor = new FeatureExtractor(config.feature || {});
  const pageContextExtractor = new PageContextExtractor(config.pageContext || {});
  const reasonCodeEngine = new ReasonCodeEngine(config.reasonCodes || {});
  const pdpGate = new PdpGate(config.pdpGate || {});
  const stateClassifier = new StateClassifier(config.state || {});
  const adaptationMapper = new AdaptationMapper(config.mapping || {});
  const rulesResolver = new RulesResolver(config || {});
  const hysteresisGuard = new HysteresisGuard(config.hysteresis || {});
  const policyClient = new PolicyClient();
  const resolver = new ActionResolver(config.ui || {}, {
    onInterventionClosed: (decisionMeta = {}) => {
      collector.registerInterventionClosed();
      setDomainDismissCooldown(collector.getRawSnapshot().site, decisionMeta).catch(() => {});
      updatePopupStats().catch(() => {});
    },
    onInterventionCta: (decisionMeta = {}) => {
      collector.registerInterventionAccepted(decisionMeta);
      updatePopupStats().catch(() => {});
    }
  });

  let enabled = true;
  let pageTrackable = true;
  let started = false;
  let saved = false;
  let decisionTimer = null;
  let statsTimer = null;
  let routeChangeTimer = null;
  let pdpGateRetryTimer = null;
  let pdpGateRetryCount = 0;

  let lastFeaturePack = null;
  let lastPdpGate = createDefaultPdpGate();
  let lastPageContext = createDefaultPageContext();
  let lastStateClassification = createDefaultStateClassification();
  let lastDecision = createColdDecision();
  const USER_PROFILE_KEY = "emotionui_user_profile_v1";
  const PRODUCT_HISTORY_KEY = "emotionui_product_history_v1";
  const DOMAIN_DISMISS_COOLDOWN_KEY = "emotionui_domain_dismiss_cooldown_v1";
  const PRODUCT_REENTRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  let currentRouteFingerprint = getRouteFingerprint();
  let sessionProfile = {
    userType: "unknown",
    totalVisits: 1,
    trafficSource: "direct",
    visitIndexForProduct: 1,
    sessionReentryCount: 0,
    historicalCartAbandons: 0,
    isReentry: false
  };

  function createDefaultPageContext() {
    return {
      summary: Object.fromEntries(PAGE_CONTEXT_KEYS.map((key) => [key, false])),
      metrics: Object.fromEntries(PAGE_CONTEXT_METRIC_KEYS.map((key) => [key, 0])),
      hints: [],
      coverage: 0
    };
  }

  function createDefaultPdpGate() {
    return {
      verdict: "UNSURE",
      trackable: false,
      score: 0,
      reasons: ["uninitialized"],
      metrics: {}
    };
  }

  function clearPdpGateRetry() {
    clearTimeout(pdpGateRetryTimer);
    pdpGateRetryTimer = null;
    pdpGateRetryCount = 0;
  }

  function shouldRetryPdpGate(gate) {
    if (!gate || gate.verdict !== "UNSURE") return false;
    const metrics = gate.metrics || {};
    const reasons = Array.isArray(gate.reasons) ? gate.reasons : [];
    return Boolean(
      metrics.productPathStrong ||
      metrics.strongPdpCandidate ||
      Number(gate.score || 0) >= 0.5 ||
      reasons.some((reason) => /dom_loading|wait_for_signals|interactive/i.test(String(reason || "")))
    );
  }

  function schedulePdpGateRetry(trigger = "unsure_gate") {
    if (pdpGateRetryTimer || pdpGateRetryCount >= 10) return;
    const delayMs = Math.min(2500, 600 + (pdpGateRetryCount * 250));
    pdpGateRetryTimer = setTimeout(() => {
      pdpGateRetryTimer = null;
      pdpGateRetryCount += 1;
      lastPdpGate = pdpGate.evaluate();
      pageTrackable = Boolean(lastPdpGate.trackable);

      if (pageTrackable) {
        clearPdpGateRetry();
        if (enabled) startTracking();
        else updatePopupStats().catch(() => {});
        return;
      }

      if (shouldRetryPdpGate(lastPdpGate)) {
        schedulePdpGateRetry(`${trigger}_retry`);
      } else {
        clearPdpGateRetry();
      }

      updatePopupStats().catch(() => {});
    }, delayMs);
  }

  function createDefaultStateClassification() {
    return {
      label: CanonicalStates.DEFAULT_LABEL || "CALM_BROWSING",
      primary_state: CanonicalStates.DEFAULT_LABEL || "CALM_BROWSING",
      confidence: 0,
      scores: CanonicalStates.createEmptyScores ? CanonicalStates.createEmptyScores() : {},
      reasons: [],
      emotion_tag: defaultAffectTag,
      affect_tag: defaultAffectTag,
      intent_tag: CanonicalStates.INTENT_TAGS?.EXPLORING || "EXPLORING",
      constraint_tags: [],
      emotion_scores: CanonicalStates.createEmptyEmotionScores ? CanonicalStates.createEmptyEmotionScores() : {},
      intent_scores: CanonicalStates.createEmptyIntentScores ? CanonicalStates.createEmptyIntentScores() : {},
      constraint_scores: CanonicalStates.createEmptyConstraintScores ? CanonicalStates.createEmptyConstraintScores() : {},
      reason_codes: [],
      reason_families: []
    };
  }

  function createColdDecision(reason = "init") {
    return {
      policy: "SILENT",
      confidence: 1,
      source: "cold_start",
      reason,
      policy_probs: { SILENT: 1, OBSERVE: 0, INTERVENE: 0 },
      exploration: false,
      model_version: 1,
      trained_samples: 0,
      abstained: false,
      resolved_mode: "STANDARD",
      resolved_mode_reason: reason,
      resolved_source: "cold_start",
      resolved_rule_id: null,
      intervention_type: "none",
      previous_mode: null,
      previous_rule_id: null,
      was_override: false,
      override_from: null,
      override_to: null,
      override_reason: "none",
      blocked_reason: "none",
      hysteresis_reason: "init",
      time_since_last_mode_change_ms: 0,
      pending_candidate_hits: 0,
      dismiss_cooldown_active: false,
      dismiss_cooldown_until: 0,
      dismiss_cooldown_remaining_ms: 0,
      mode_history: [],
      state_label: CanonicalStates.DEFAULT_LABEL || "CALM_BROWSING",
      primary_state: CanonicalStates.DEFAULT_LABEL || "CALM_BROWSING",
      state_confidence: 0,
      state_scores: CanonicalStates.createEmptyScores ? CanonicalStates.createEmptyScores() : {},
      state_reasons: [],
      emotion_tag: defaultAffectTag,
      affect_tag: defaultAffectTag,
      intent_tag: CanonicalStates.INTENT_TAGS?.EXPLORING || "EXPLORING",
      constraint_tags: [],
      emotion_scores: CanonicalStates.createEmptyEmotionScores ? CanonicalStates.createEmptyEmotionScores() : {},
      intent_scores: CanonicalStates.createEmptyIntentScores ? CanonicalStates.createEmptyIntentScores() : {},
      constraint_scores: CanonicalStates.createEmptyConstraintScores ? CanonicalStates.createEmptyConstraintScores() : {},
      reason_codes: [],
      reason_families: [],
      pdp_gate_verdict: "UNSURE",
      pdp_gate_score: 0,
      pdp_gate_reasons: ["cold_start"],
      pdp_gate_metrics: {},
      page_context: createDefaultPageContext().summary,
      page_context_metrics: createDefaultPageContext().metrics,
      page_context_hints: [],
      page_context_coverage: 0,
      mapped_mode: "STANDARD",
      mapped_intervention_type: "none",
      mapper_reasons: [],
      state_contract_key: CanonicalStates.DEFAULT_LABEL || "CALM_BROWSING",
      state_contract_mode: "STANDARD",
      state_contract_intervention_type: "none",
      state_contract_reason_families: [],
      decision_timestamp: Date.now(),
      time_since_page_load_ms: 0
    };
  }

  function round(value, digits = 3) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Number(n.toFixed(digits));
  }

  function normalizeText(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function getRouteFingerprint(url = window.location.href) {
    try {
      const parsed = new URL(url, window.location.origin);
      return `${parsed.origin}${parsed.pathname}${parsed.search}`;
    } catch {
      return `${window.location.origin}${window.location.pathname}${window.location.search}`;
    }
  }

  function normalizePageContextValue(pageContext = {}) {
    const incomingSummary = (pageContext.summary && typeof pageContext.summary === "object")
      ? pageContext.summary
      : (pageContext && typeof pageContext === "object" ? pageContext : {});
    const incomingMetrics = (pageContext.metrics && typeof pageContext.metrics === "object")
      ? pageContext.metrics
      : {};
    const summary = {};
    for (const key of PAGE_CONTEXT_KEYS) {
      summary[key] = Boolean(incomingSummary[key]);
    }
    const metrics = {};
    for (const key of PAGE_CONTEXT_METRIC_KEYS) {
      metrics[key] = round(incomingMetrics[key] || 0);
    }
    const hints = PAGE_CONTEXT_KEYS.filter((key) => summary[key]);
    const coverage = round(hints.length / PAGE_CONTEXT_KEYS.length);
    return { summary, metrics, hints, coverage };
  }

  const outcomeLogger = new OutcomeLogger(config || {}, {
    getResolvedDecision: (...args) => getResolvedDecision(...args),
    normalizePageContextValue: (value) => normalizePageContextValue(value),
    inferFunnelStage: (rawSnapshot) => inferFunnelStage(rawSnapshot)
  });

  const FALLBACK_FEATURE_PACK = { normalized: {}, derived: {}, context: {} };
  const FALLBACK_PAGE_CONTEXT = normalizePageContextValue({});
  const FALLBACK_REASON_ANALYSIS = { primary_score_adjustments: {}, top_reason_codes: [], families: [], emotion_tag: "CALM", affect_tag: "CALM", intent_tag: "EXPLORING", constraint_tags: [], emotion_scores: {}, intent_scores: {}, constraint_scores: {} };
  const FALLBACK_STATE_CLASSIFICATION = { label: "CALM_BROWSING", primary_state: "CALM_BROWSING", confidence: 0, scores: {}, reasons: [], emotion_tag: "CALM", affect_tag: "CALM", intent_tag: "EXPLORING", constraint_tags: [], reason_codes: [], reason_families: [] };

  function computeLiveBundle() {
    const rawSnapshot = decorateSnapshotWithProfile(collector.getRawSnapshot());

    let featurePack = FALLBACK_FEATURE_PACK;
    try { featurePack = extractor.extract(rawSnapshot); } catch (e) { /* bad DOM state — use fallback */ }

    let pageContext = FALLBACK_PAGE_CONTEXT;
    try { pageContext = normalizePageContextValue(pageContextExtractor.extract()); } catch (e) { /* bad DOM state — use fallback */ }

    let reasonAnalysis = FALLBACK_REASON_ANALYSIS;
    try { reasonAnalysis = reasonCodeEngine.analyze(rawSnapshot, featurePack, pageContext, lastStateClassification); } catch (e) { /* use fallback */ }

    let stateClassification = FALLBACK_STATE_CLASSIFICATION;
    try { stateClassification = stateClassifier.classify(rawSnapshot, featurePack, pageContext, reasonAnalysis); } catch (e) { /* use fallback */ }

    return { rawSnapshot, featurePack, pageContext, stateClassification, reasonAnalysis };
  }

  function isContextInvalidatedError(error) {
    const msg = String(error?.message || error || "").toLowerCase();
    return msg.includes("extension context invalidated") || msg.includes("context invalidated");
  }

  function hasRuntimeAccess() {
    try {
      return typeof chrome !== "undefined" && Boolean(chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  function teardownOnContextInvalidation() {
    clearInterval(decisionTimer);
    clearInterval(statsTimer);
    clearTimeout(routeChangeTimer);
    decisionTimer = null;
    statsTimer = null;
    routeChangeTimer = null;
    started = false;
    enabled = false;
  }

  function swallowContextInvalidation(error, fallback = null) {
    if (isContextInvalidatedError(error)) {
      teardownOnContextInvalidation();
      return fallback;
    }
    throw error;
  }

  async function safeRuntimeSendMessage(message) {
    if (!hasRuntimeAccess()) return null;
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      if (isContextInvalidatedError(error)) {
        teardownOnContextInvalidation();
      }
      return null;
    }
  }

  policyClient.sendMessage = safeRuntimeSendMessage;

  async function safeStorageGet(keys, fallback = {}) {
    if (!hasRuntimeAccess()) return fallback;
    try {
      const value = await chrome.storage.local.get(keys);
      if (!value || typeof value !== "object") return fallback;
      return value;
    } catch (error) {
      if (isContextInvalidatedError(error)) {
        teardownOnContextInvalidation();
      }
      return fallback;
    }
  }

  async function safeStorageSet(payload) {
    if (!hasRuntimeAccess()) return false;
    try {
      await chrome.storage.local.set(payload);
      return true;
    } catch (error) {
      if (isContextInvalidatedError(error)) {
        teardownOnContextInvalidation();
      }
      return false;
    }
  }

  async function getDomainDismissCooldown(site) {
    const host = String(site || window.location.hostname || "").replace(/^www\./, "");
    if (!host) return { active: false, until: 0, remainingMs: 0 };

    const state = await safeStorageGet([DOMAIN_DISMISS_COOLDOWN_KEY], {});
    const map = (state[DOMAIN_DISMISS_COOLDOWN_KEY] && typeof state[DOMAIN_DISMISS_COOLDOWN_KEY] === "object")
      ? state[DOMAIN_DISMISS_COOLDOWN_KEY]
      : {};
    const now = Date.now();
    const until = Number(map[host]?.until || 0);

    if (until <= now) {
      if (map[host]) {
        delete map[host];
        await safeStorageSet({ [DOMAIN_DISMISS_COOLDOWN_KEY]: map });
      }
      return { active: false, until: 0, remainingMs: 0 };
    }

    return {
      active: true,
      until,
      remainingMs: Math.max(0, until - now)
    };
  }

  async function setDomainDismissCooldown(site, decisionMeta = {}) {
    const host = String(site || window.location.hostname || "").replace(/^www\./, "");
    if (!host) return;

    const state = await safeStorageGet([DOMAIN_DISMISS_COOLDOWN_KEY], {});
    const map = (state[DOMAIN_DISMISS_COOLDOWN_KEY] && typeof state[DOMAIN_DISMISS_COOLDOWN_KEY] === "object")
      ? state[DOMAIN_DISMISS_COOLDOWN_KEY]
      : {};
    const until = Date.now() + Number((config.cooldown && config.cooldown.dismissDomainMs) || 180000);

    map[host] = {
      until,
      last_mode: String(decisionMeta.resolved_mode || decisionMeta.mode || "STANDARD"),
      last_type: String(decisionMeta.intervention_type || "none")
    };

    await safeStorageSet({ [DOMAIN_DISMISS_COOLDOWN_KEY]: map });

    lastDecision = {
      ...lastDecision,
      dismiss_cooldown_active: true,
      dismiss_cooldown_until: until,
      dismiss_cooldown_remaining_ms: Math.max(0, until - Date.now())
    };
  }

  window.addEventListener("unhandledrejection", (event) => {
    if (!isContextInvalidatedError(event?.reason)) return;
    event.preventDefault();
    teardownOnContextInvalidation();
  });

  function inferTrafficSource() {
    const params = new URLSearchParams(window.location.search || "");
    const utmSource = normalizeText(params.get("utm_source"));
    if (utmSource) return utmSource;
    if (params.has("gclid")) return "google_ads";
    if (params.has("fbclid")) return "facebook_ads";

    const ref = String(document.referrer || "");
    if (!ref) return "direct";

    try {
      const host = normalizeText(new URL(ref).hostname).replace(/^www\./, "");
      const currentHost = normalizeText(window.location.hostname).replace(/^www\./, "");
      if (!host || host === currentHost) return "direct";
      if (/(google|bing|duckduckgo|yahoo|yandex)/.test(host)) return "search";
      if (/(facebook|instagram|tiktok|twitter|x\.com|linkedin|pinterest|reddit)/.test(host)) return "social";
      if (/(mail|newsletter|sendgrid|klaviyo)/.test(host)) return "email";
      return "referral";
    } catch {
      return "referral";
    }
  }

  async function loadSessionProfile(productId) {
    const safeProductId = String(productId || "unknown");
    const state = await safeStorageGet([USER_PROFILE_KEY, PRODUCT_HISTORY_KEY], {});
    const userProfile = (state[USER_PROFILE_KEY] && typeof state[USER_PROFILE_KEY] === "object")
      ? state[USER_PROFILE_KEY]
      : { total_sessions: 0 };
    const productHistory = (state[PRODUCT_HISTORY_KEY] && typeof state[PRODUCT_HISTORY_KEY] === "object")
      ? state[PRODUCT_HISTORY_KEY]
      : {};

    const existing = (productHistory[safeProductId] && typeof productHistory[safeProductId] === "object")
      ? productHistory[safeProductId]
      : { visits: 0, reentries: 0, last_visit_ts: 0, cart_abandons: 0 };

    const now = Date.now();
    const isReentry = Number(existing.last_visit_ts || 0) > 0 && (now - Number(existing.last_visit_ts || 0)) < PRODUCT_REENTRY_WINDOW_MS;

    sessionProfile = {
      userType: Number(userProfile.total_sessions || 0) > 0 ? "returning" : "new",
      totalVisits: Number(existing.visits || 0) + 1,
      trafficSource: inferTrafficSource(),
      visitIndexForProduct: Number(existing.visits || 0) + 1,
      sessionReentryCount: Number(existing.reentries || 0) + (isReentry ? 1 : 0),
      historicalCartAbandons: Number(existing.cart_abandons || 0),
      isReentry
    };
  }

  async function persistSessionProfile(rawSnapshot, payload) {
    const safeProductId = String(payload?.product_id || rawSnapshot?.productId || "unknown");
    const state = await safeStorageGet([USER_PROFILE_KEY, PRODUCT_HISTORY_KEY], {});
    const userProfile = (state[USER_PROFILE_KEY] && typeof state[USER_PROFILE_KEY] === "object")
      ? state[USER_PROFILE_KEY]
      : { total_sessions: 0 };
    const productHistory = (state[PRODUCT_HISTORY_KEY] && typeof state[PRODUCT_HISTORY_KEY] === "object")
      ? state[PRODUCT_HISTORY_KEY]
      : {};
    const existing = (productHistory[safeProductId] && typeof productHistory[safeProductId] === "object")
      ? productHistory[safeProductId]
      : { visits: 0, reentries: 0, last_visit_ts: 0, cart_abandons: 0 };

    const currentSessionCartAbandons = Math.max(
      0,
      Number(rawSnapshot?.cartAbandons || 0) - Number(sessionProfile.historicalCartAbandons || 0)
    );
    const abandonedThisSession = currentSessionCartAbandons > 0 &&
      !Boolean(rawSnapshot?.outcomes?.checkout_started) &&
      !Boolean(rawSnapshot?.outcomes?.purchase_completed);

    const nextHistory = {
      ...productHistory,
      [safeProductId]: {
        visits: Math.max(Number(existing.visits || 0) + 1, Number(sessionProfile.totalVisits || 1)),
        reentries: Number(existing.reentries || 0) + (sessionProfile.isReentry ? 1 : 0),
        last_visit_ts: Date.now(),
        cart_abandons: Number(existing.cart_abandons || 0) + (abandonedThisSession ? 1 : 0)
      }
    };

    const nextUserProfile = {
      ...userProfile,
      total_sessions: Number(userProfile.total_sessions || 0) + 1
    };

    await safeStorageSet({
      [USER_PROFILE_KEY]: nextUserProfile,
      [PRODUCT_HISTORY_KEY]: nextHistory
    });
  }

  function decorateSnapshotWithProfile(rawSnapshot) {
    const decorated = { ...rawSnapshot };
    decorated.totalVisits = Number(sessionProfile.totalVisits || rawSnapshot.totalVisits || 1);
    decorated.userType = sessionProfile.userType || "unknown";
    decorated.trafficSource = sessionProfile.trafficSource || "direct";
    decorated.visitIndexForProduct = Number(sessionProfile.visitIndexForProduct || decorated.totalVisits || 1);
    decorated.sessionReentryCount = Number(sessionProfile.sessionReentryCount || 0);
    decorated.cartAbandons = Number(rawSnapshot.cartAbandons || 0) + Number(sessionProfile.historicalCartAbandons || 0);
    return decorated;
  }

  function refreshPdpGate() {
    lastPdpGate = pdpGate.evaluate();
    return lastPdpGate;
  }

  function evaluateMvpRules(rawSnapshot, featurePack, pageContext = {}, stateClassification = {}) {
    return rulesResolver.evaluate(rawSnapshot, featurePack, pageContext, stateClassification);
  }

  function mapResolvedUi(decision, rawSnapshot, featurePack, pageContext = lastPageContext, stateClassification = lastStateClassification) {
    const ruleEvaluation = evaluateMvpRules(rawSnapshot, featurePack, pageContext, stateClassification);
    const mapped = adaptationMapper.map({
      policy: decision.policy,
      confidence: decision.confidence,
      rawSnapshot,
      featurePack,
      pageContext,
      stateClassification,
      ruleWinner: ruleEvaluation.winner,
      previousDecision: lastDecision,
      pdpGate: lastPdpGate
    });

    return {
      mode: mapped.mode || "STANDARD",
      reason: mapped.reason || decision.reason || "mapper_default",
      source: mapped.source || "adaptation_mapper",
      rule_id: ruleEvaluation.winner?.ruleId || null,
      confidence: Number(mapped.confidence || decision.confidence || 0),
      all_rules: ruleEvaluation.matched,
      intervention_type: mapped.intervention_type || "none",
      mapper_reasons: Array.isArray(mapped.reasons) ? mapped.reasons : [],
      state_contract_key: mapped.state_contract_key || stateClassification.primary_state || stateClassification.label || null,
      state_contract_mode: mapped.state_contract_mode || mapped.mode || "STANDARD",
      state_contract_intervention_type: mapped.state_contract_intervention_type || mapped.intervention_type || "none",
      state_contract_reason_families: Array.isArray(mapped.state_contract_reason_families) ? mapped.state_contract_reason_families : []
    };
  }

  function getResolvedDecision(decision, rawSnapshot, featurePack, pageContext = lastPageContext, stateClassification = lastStateClassification) {
    if (decision && decision.mapped_mode) {
      return {
        mode: decision.mapped_mode,
        reason: decision.resolved_mode_reason || decision.reason || "policy_decision",
        source: decision.resolved_source || decision.source || "adaptation_mapper",
        rule_id: decision.resolved_rule_id || decision.rule_id || null,
        confidence: Number(decision.confidence || 0),
        all_rules: Array.isArray(decision.all_rules) ? decision.all_rules : [],
        intervention_type: decision.mapped_intervention_type || decision.intervention_type || "none",
        mapper_reasons: Array.isArray(decision.mapper_reasons) ? decision.mapper_reasons : [],
        state_contract_key: decision.state_contract_key || decision.primary_state || decision.state_label || null,
        state_contract_mode: decision.state_contract_mode || decision.mapped_mode || "STANDARD",
        state_contract_intervention_type: decision.state_contract_intervention_type || decision.mapped_intervention_type || decision.intervention_type || "none",
        state_contract_reason_families: Array.isArray(decision.state_contract_reason_families) ? decision.state_contract_reason_families : []
      };
    }
    return mapResolvedUi(decision, rawSnapshot, featurePack, pageContext, stateClassification);
  }

  function finalizeDecisionEnvelope(decision, rawSnapshot, featurePack, pageContext, stateClassification, extra = {}) {
    const resolved = mapResolvedUi(decision, rawSnapshot, featurePack, pageContext, stateClassification);
    const previousResolved = getResolvedDecision(lastDecision, rawSnapshot, featurePack, lastPageContext, lastStateClassification);
    const normalizedPageContext = normalizePageContextValue(pageContext);

    return {
      ...decision,
      policy: String(decision.policy || "SILENT").toUpperCase(),
      resolved_mode: resolved.mode,
      resolved_mode_reason: resolved.reason,
      resolved_source: resolved.source,
      resolved_rule_id: resolved.rule_id,
      mode: resolved.mode,
      rule_id: resolved.rule_id,
      all_rules: resolved.all_rules,
      intervention_type: resolved.intervention_type,
      mapped_mode: resolved.mode,
      mapped_intervention_type: resolved.intervention_type,
      mapper_reasons: resolved.mapper_reasons,
      state_contract_key: resolved.state_contract_key || stateClassification.primary_state || stateClassification.label,
      state_contract_mode: resolved.state_contract_mode || resolved.mode,
      state_contract_intervention_type: resolved.state_contract_intervention_type || resolved.intervention_type,
      state_contract_reason_families: Array.isArray(resolved.state_contract_reason_families) ? resolved.state_contract_reason_families : [],
      state_label: stateClassification.label,
      primary_state: stateClassification.primary_state || stateClassification.label,
      state_confidence: Number(stateClassification.confidence || 0),
      state_scores: stateClassification.scores || {},
      state_reasons: stateClassification.reasons || [],
      emotion_tag: stateClassification.emotion_tag || defaultAffectTag,
      affect_tag: stateClassification.affect_tag || stateClassification.emotion_tag || defaultAffectTag,
      intent_tag: stateClassification.intent_tag || (CanonicalStates.INTENT_TAGS?.EXPLORING || "EXPLORING"),
      constraint_tags: Array.isArray(stateClassification.constraint_tags) ? stateClassification.constraint_tags : [],
      emotion_scores: stateClassification.emotion_scores || {},
      affect_scores: stateClassification.affect_scores || stateClassification.emotion_scores || {},
      intent_scores: stateClassification.intent_scores || {},
      constraint_scores: stateClassification.constraint_scores || {},
      reason_codes: Array.isArray(stateClassification.reason_codes) ? stateClassification.reason_codes : [],
      reason_families: Array.isArray(stateClassification.reason_families) ? stateClassification.reason_families : [],
      pdp_gate_verdict: String(lastPdpGate.verdict || "UNSURE"),
      pdp_gate_score: Number(lastPdpGate.score || 0),
      pdp_gate_reasons: Array.isArray(lastPdpGate.reasons) ? lastPdpGate.reasons : [],
      pdp_gate_metrics: lastPdpGate.metrics || {},
      page_context: normalizedPageContext.summary,
      page_context_metrics: normalizedPageContext.metrics,
      page_context_hints: normalizedPageContext.hints,
      page_context_coverage: Number(normalizedPageContext.coverage || 0),
      previous_mode: previousResolved.mode || null,
      previous_state: lastDecision.state_label || lastStateClassification.label || null,
      previous_rule_id: previousResolved.rule_id || null,
      decision_timestamp: Date.now(),
      time_since_page_load_ms: Math.max(0, Date.now() - Number(rawSnapshot.pageStartTs || Date.now())),
      was_override: Boolean(extra.was_override),
      override_from: extra.override_from ?? null,
      override_to: extra.override_to ?? null,
      override_reason: extra.override_reason || "none"
    };
  }

  function buildAttributionContext(rawSnapshot, decision) {
    return outcomeLogger.buildAttributionContext(rawSnapshot, decision);
  }

  function inferFunnelStage(rawSnapshot) {
    return rulesResolver.inferFunnelStage(rawSnapshot);
  }

  function applySafetyPolicyOverride(decision, featurePack) {
    return rulesResolver.applySafetyPolicyOverride(decision, featurePack);
  }

  function buildPolicyDebug(rawSnapshot, featurePack, decision) {
    const pageContextValue = decision.page_context
      ? {
          summary: decision.page_context,
          metrics: decision.page_context_metrics || lastPageContext.metrics,
          hints: decision.page_context_hints || [],
          coverage: decision.page_context_coverage || lastPageContext.coverage
        }
      : lastPageContext;
    return outcomeLogger.buildPolicyDebug({
      rawSnapshot,
      featurePack,
      decision,
      lastPdpGate,
      lastStateClassification,
      pageContext: pageContextValue
    });
  }

  async function updatePopupStats() {
    if (!hasRuntimeAccess()) return null;
    try {
      if (!pageTrackable) {
        const stats = {
          rage_clicks: 0,
          state: "STANDARD",
          ml_state: "SILENT",
          resolved_ui_mode: "STANDARD",
          resolved_mode_reason: "page_not_trackable",
          funnel_stage: "non_product_page",
          pdp_gate_verdict: lastPdpGate.verdict || "UNSURE",
          pdp_gate_score: Number(lastPdpGate.score || 0),
          pdp_gate_reasons: Array.isArray(lastPdpGate.reasons) ? lastPdpGate.reasons : [],
          biometric_inputs_enabled: biometricInputsEnabled,
          confidence: 1,
          ml_source: "rules_filter",
          ml_samples: Number(lastDecision.trained_samples || 0),
          ml_abstained: false,
          stability_blocked_reason: "page_not_trackable",
          state_label: CanonicalStates.DEFAULT_LABEL || "CALM_BROWSING",
          primary_state: CanonicalStates.DEFAULT_LABEL || "CALM_BROWSING",
          affect_tag: defaultAffectTag,
          intent_tag: CanonicalStates.INTENT_TAGS?.EXPLORING || "EXPLORING",
          constraint_tags: [],
          reason_codes: [],
          previous_state: lastDecision.previous_state || "-",
          intervention_type: "none",
          mapped_mode: "STANDARD",
          mapped_intervention_type: "none",
          mapper_reasons: [],
          state_contract_key: CanonicalStates.DEFAULT_LABEL || "CALM_BROWSING",
          state_contract_mode: "STANDARD",
          state_contract_intervention_type: "none",
          state_contract_reason_families: [],
          experiment_variant: lastDecision.experiment_variant || "adaptive",
          experiment_runtime_mode: lastDecision.experiment_runtime_mode || "adaptive",
          experiment_key: lastDecision.experiment_key || null,
          challenger_policy: lastDecision.challenger_policy || null,
          challenger_confidence: Number(lastDecision.challenger_confidence || 0),
          challenger_source: lastDecision.challenger_source || null,
          baseline_active: false,
          suppressed_modes: [],
          derived_scores: { f: 0, h: 0, r: 0, p: 0 },
          info_zone_unique_count: 0,
          info_zone_dwell_sec: 0,
          revisit_intent_score: 0,
          chaotic_scroll_burst_count: 0,
          reversal_with_dwell_ratio: 0,
          page_context_coverage: Number(lastPageContext.coverage || 0),
          page_density_score: Number(lastPageContext.metrics?.pageDensityScore || 0),
          active_section: "none",
          was_ui_contaminated: false,
          filtered_extension_ui_event_count: 0
        };
        await policyClient.updateStats(stats);
        return stats;
      }

      const { rawSnapshot, featurePack } = computeLiveBundle();
      const decision = lastDecision;
      const resolved = getResolvedDecision(decision, rawSnapshot, featurePack, lastPageContext, lastStateClassification);
      const attribution = buildAttributionContext(rawSnapshot, decision);

      const stats = {
        rage_clicks: Math.round(rawSnapshot.rageClicks || 0),
        mouse_jitter: round(rawSnapshot.mouseJitter || 0),
        exit_intent: Math.round(rawSnapshot.exitIntent || 0),
        dead_clicks: Math.round(rawSnapshot.deadClicks || 0),
        cart_add_remove: Math.round(rawSnapshot.cartAddRemove || 0),
        price_hover: Math.round(rawSnapshot.priceHover || 0),
        direct_checkout: Boolean(rawSnapshot.directCheckout),
        time_on_price: round((rawSnapshot.timeOnPriceMs || 0) / 1000, 3),
        state: resolved.mode,
        ml_state: decision.policy,
        resolved_ui_mode: resolved.mode,
        resolved_mode_reason: resolved.reason || decision.reason || "policy_decision",
        pdp_gate_verdict: decision.pdp_gate_verdict || lastPdpGate.verdict || "UNSURE",
        pdp_gate_score: Number(decision.pdp_gate_score || lastPdpGate.score || 0),
        pdp_gate_reasons: Array.isArray(decision.pdp_gate_reasons) ? decision.pdp_gate_reasons : (lastPdpGate.reasons || []),
        funnel_stage: inferFunnelStage(rawSnapshot),
        biometric_inputs_enabled: biometricInputsEnabled,
        confidence: decision.confidence,
        ml_source: decision.source || "policy_model",
        ml_samples: decision.trained_samples || 0,
        ml_abstained: Boolean(decision.abstained),
        stability_blocked_reason: decision.blocked_reason || decision.reason || "none",
        state_label: decision.state_label || lastStateClassification.label,
        primary_state: decision.primary_state || lastStateClassification.primary_state || decision.state_label || lastStateClassification.label || "-",
        affect_tag: decision.affect_tag || decision.emotion_tag || lastStateClassification.affect_tag || lastStateClassification.emotion_tag || "-",
        intent_tag: decision.intent_tag || lastStateClassification.intent_tag || "-",
        constraint_tags: Array.isArray(decision.constraint_tags) ? decision.constraint_tags : (lastStateClassification.constraint_tags || []),
        reason_codes: Array.isArray(decision.reason_codes) ? decision.reason_codes : (lastStateClassification.reason_codes || []),
        previous_state: decision.previous_state || "-",
        intervention_type: decision.intervention_type || "none",
        mapped_mode: decision.mapped_mode || resolved.mode,
        mapped_intervention_type: decision.mapped_intervention_type || resolved.intervention_type || "none",
        mapper_reasons: Array.isArray(decision.mapper_reasons) ? decision.mapper_reasons : [],
        state_contract_key: decision.state_contract_key || lastStateClassification.primary_state || lastStateClassification.label || "-",
        state_contract_mode: decision.state_contract_mode || decision.mapped_mode || resolved.mode,
        state_contract_intervention_type: decision.state_contract_intervention_type || decision.mapped_intervention_type || resolved.intervention_type || "none",
        state_contract_reason_families: Array.isArray(decision.state_contract_reason_families) ? decision.state_contract_reason_families : [],
        experiment_variant: decision.experiment_variant || "adaptive",
        experiment_runtime_mode: decision.experiment_runtime_mode || "adaptive",
        experiment_key: decision.experiment_key || null,
        challenger_policy: decision.challenger_policy || null,
        challenger_confidence: Number(decision.challenger_confidence || 0),
        challenger_source: decision.challenger_source || null,
        previous_mode: decision.previous_mode || null,
        override_reason: decision.override_reason || "none",
        dismiss_cooldown_active: Boolean(decision.dismiss_cooldown_active),
        dismiss_cooldown_remaining_ms: Number(decision.dismiss_cooldown_remaining_ms || 0),
        exposure_delay_ms: Number(attribution.exposure_delay_ms || 0),
        reward_window_ms: Number(attribution.reward_window_ms || 0),
        baseline_active: featurePack.context.sessionDurationSec >= ((config.feature && config.feature.minSessionSecondsForStableSignals) || 5),
        suppressed_modes: [],
        derived_scores: {
          f: featurePack.derived.friction_score,
          h: featurePack.derived.hesitation_score,
          r: featurePack.derived.research_depth_score,
          p: featurePack.derived.purchase_momentum_score
        },
        info_zone_unique_count: Number(featurePack.context.visitedCount || 0),
        info_zone_dwell_sec: Number(featurePack.context.infoZoneDwellSec || 0),
        revisit_intent_score: round((featurePack.normalized.sectionSwitchRate + featurePack.normalized.reviewFocusRatio) / 2),
        chaotic_scroll_burst_count: Math.round((rawSnapshot.scrollReversals || 0) >= 4 ? 1 : 0),
        reversal_with_dwell_ratio: round(featurePack.normalized.reviewFocusRatio),
        page_context_coverage: Number(decision.page_context_coverage || lastPageContext.coverage || 0),
        page_density_score: Number(decision.page_context_metrics?.pageDensityScore || lastPageContext.metrics?.pageDensityScore || 0),
        active_section: String(featurePack.context.activeSection || "none"),
        was_ui_contaminated: Number(rawSnapshot.extensionUi?.filteredEvents || 0) > 0,
        filtered_extension_ui_event_count: Number(rawSnapshot.extensionUi?.filteredEvents || 0)
      };

      await policyClient.updateStats(stats);
      return stats;
    } catch (error) {
      return swallowContextInvalidation(error, null);
    }
  }

  async function requestPolicyDecision() {
    if (!hasRuntimeAccess()) return { rawSnapshot: null, featurePack: null, decision: lastDecision };
    try {
      if (!pageTrackable) {
        lastPageContext = createDefaultPageContext();
        lastStateClassification = createDefaultStateClassification();
        lastDecision = {
          ...createColdDecision("page_not_trackable"),
          trained_samples: Number(lastDecision.trained_samples || 0),
          model_version: Number(lastDecision.model_version || 1),
          source: "rules_filter",
          primary_state: CanonicalStates.DEFAULT_LABEL || "CALM_BROWSING",
          pdp_gate_verdict: lastPdpGate.verdict || "UNSURE",
          pdp_gate_score: Number(lastPdpGate.score || 0),
          pdp_gate_reasons: Array.isArray(lastPdpGate.reasons) ? lastPdpGate.reasons : [],
          pdp_gate_metrics: lastPdpGate.metrics || {}
        };
        hysteresisGuard.reset();
        resolver.resetToSilent();
        return { rawSnapshot: null, featurePack: null, decision: lastDecision };
      }

      const { rawSnapshot, featurePack, pageContext, stateClassification } = computeLiveBundle();
      const cooldownInfo = await getDomainDismissCooldown(rawSnapshot.site);
      const previousResolved = getResolvedDecision(lastDecision, rawSnapshot, featurePack, pageContext, stateClassification);

      lastFeaturePack = featurePack;
      lastPageContext = pageContext;
      lastStateClassification = stateClassification;

      const decidePayload = {
        type: "EMOTIONUI_POLICY_DECIDE",
        features: featurePack.normalized,
        context: {
          sessionId: rawSnapshot.sessionId,
          sessionDurationSec: featurePack.context.sessionDurationSec,
          site: rawSnapshot.site,
          productId: rawSnapshot.productId,
          totalVisits: Number(rawSnapshot.totalVisits || 1),
          cartAbandons: Number(rawSnapshot.cartAbandons || 0),
          priceHover: Number(rawSnapshot.priceHover || 0),
          directCheckout: Boolean(rawSnapshot.directCheckout),
          primaryState: stateClassification.primary_state || stateClassification.label,
          stateLabel: stateClassification.label,
          stateConfidence: Number(stateClassification.confidence || 0),
          affectTag: stateClassification.affect_tag || stateClassification.emotion_tag,
          intentTag: stateClassification.intent_tag,
          constraintTags: stateClassification.constraint_tags || [],
          reasonCodes: stateClassification.reason_codes || [],
          pageContextSummary: pageContext.summary,
          pageContextCoverage: Number(pageContext.coverage || 0),
          pdpGateVerdict: lastPdpGate.verdict || "UNSURE",
          pdpGateScore: Number(lastPdpGate.score || 0),
          previousMode: previousResolved.mode,
          previousPolicy: String(lastDecision.policy || "SILENT").toUpperCase(),
          recentModeHistory: Array.isArray(lastDecision.mode_history) ? lastDecision.mode_history.slice(-4) : [],
          domainCooldownActive: Boolean(cooldownInfo.active)
        }
      };

      const decisionResult = await policyClient.decide(decidePayload.features, decidePayload.context);
      let decision = decisionResult || null;

      if (!decision || !decision.policy) {
        decision = {
          policy: "SILENT",
          confidence: 0,
          reason: "decision_unavailable",
          source: "fallback",
          policy_probs: { SILENT: 1, OBSERVE: 0, INTERVENE: 0 },
          exploration: false,
          model_version: 1,
          trained_samples: 0,
          abstained: true
        };
      }

      const modelPolicy = String(decision.policy || "SILENT").toUpperCase();
      const safetyAdjusted = applySafetyPolicyOverride({
        ...decision,
        policy: modelPolicy
      }, featurePack);
      const safetyOverrode =
        String(safetyAdjusted.policy || modelPolicy).toUpperCase() !== modelPolicy ||
        String(safetyAdjusted.reason || "") !== String(decision.reason || "") ||
        String(safetyAdjusted.source || "") !== String(decision.source || "");

      let candidate = finalizeDecisionEnvelope(
        safetyAdjusted,
        rawSnapshot,
        featurePack,
        pageContext,
        stateClassification,
        {
          was_override: safetyOverrode,
          override_from: safetyOverrode ? modelPolicy : null,
          override_to: safetyOverrode ? String(safetyAdjusted.policy || modelPolicy).toUpperCase() : null,
          override_reason: safetyOverrode ? String(safetyAdjusted.reason || "safety_override") : "none"
        }
      );

      candidate = {
        ...candidate,
        dismiss_cooldown_active: Boolean(cooldownInfo.active),
        dismiss_cooldown_until: Number(cooldownInfo.until || 0),
        dismiss_cooldown_remaining_ms: Number(cooldownInfo.remainingMs || 0)
      };

      if (candidate.policy === "INTERVENE" && candidate.mapped_mode === "RESEARCH_MODE") {
        candidate = {
          ...candidate,
          policy: "OBSERVE",
          reason: "research_mode_intervene_downgraded_to_observe",
          source: `${candidate.source || "adaptation_mapper"}+rules`,
          was_override: true,
          override_from: "INTERVENE",
          override_to: "OBSERVE",
          override_reason: "research_mode_intervene_downgraded_to_observe",
          action: "OBSERVE"
        };
      }

      if (cooldownInfo.active && candidate.policy === "INTERVENE") {
        candidate = {
          ...candidate,
          policy: "OBSERVE",
          reason: "domain_dismiss_cooldown_active",
          source: `${candidate.source || "policy_model"}+cooldown`,
          was_override: true,
          override_from: "INTERVENE",
          override_to: "OBSERVE",
          override_reason: "domain_dismiss_cooldown_active",
          action: "OBSERVE"
        };
      }

      lastDecision = hysteresisGuard.stabilize(candidate);
      if (lastDecision.was_blocked) {
        lastDecision = {
          ...lastDecision,
          was_override: true,
          override_from: candidate.policy,
          override_to: lastDecision.policy,
          override_reason: lastDecision.blocked_reason || "hysteresis_min_dwell"
        };
      }

      collector.registerPolicyDecision(lastDecision);
      resolver.apply(lastDecision);

      return { rawSnapshot, featurePack, decision: lastDecision };
    } catch (error) {
      return swallowContextInvalidation(error, { rawSnapshot: null, featurePack: null, decision: lastDecision });
    }
  }

  function buildSessionPayload(outcomeReason) {
    const { rawSnapshot, featurePack, pageContext, stateClassification } = computeLiveBundle();
    const decision = lastDecision;
    return outcomeLogger.buildSessionPayload({
      outcomeReason,
      rawSnapshot,
      featurePack,
      pageContext,
      stateClassification,
      decision,
      lastPdpGate,
      navigatorUserAgent: navigator.userAgent,
      screenWidth: window.innerWidth
    });
  }

  async function saveSession(outcomeReason, options = {}) {
    const force = Boolean(options.force);
    if ((!enabled && !force) || saved || !pageTrackable || !hasRuntimeAccess()) return;
    try {
      saved = true;

      const payload = buildSessionPayload(outcomeReason);
      const { rawSnapshot, featurePack } = computeLiveBundle();
      const attribution = buildAttributionContext(rawSnapshot, lastDecision);

      await policyClient.learn(
        featurePack.normalized,
        { policy: lastDecision.policy, confidence: lastDecision.confidence },
        {
          outcome: payload.outcome,
          sessionDurationSec: payload.time_on_page_sec,
          outcomeDetail: payload.outcome_detail,
          cartAbandons: payload.cart_abandons,
          timeOnPriceSec: payload.time_on_price,
          directCheckout: payload.direct_checkout,
          attribution,
          decisionMeta: {
            policy: lastDecision.policy,
            resolvedMode: lastDecision.resolved_mode,
            interventionType: lastDecision.intervention_type,
            stateLabel: lastDecision.state_label,
            wasOverride: Boolean(lastDecision.was_override),
            experimentKey: lastDecision.experiment_key || null,
            experimentVariant: lastDecision.experiment_variant || "adaptive",
            experimentRuntimeMode: lastDecision.experiment_runtime_mode || "adaptive",
            experimentConfigVersion: lastDecision.experiment_config_version || null
          }
        }
      );

      await policyClient.saveSession(payload);

      await persistSessionProfile(rawSnapshot, payload).catch(() => {});
    } catch (error) {
      saved = false;
      return swallowContextInvalidation(error, null);
    }
  }

  async function decisionCycle() {
    if (!enabled || !started) return;
    await requestPolicyDecision();
    await updatePopupStats();
  }

  async function handleRouteChange(reason = "spa_navigation") {
    const nextFingerprint = getRouteFingerprint();
    if (nextFingerprint === currentRouteFingerprint) return;
    currentRouteFingerprint = nextFingerprint;

    if (started || pageTrackable) {
      stopTracking(reason);
    } else {
      collector.stop();
    }

    collector = createCollector();
    lastFeaturePack = null;
    lastPageContext = createDefaultPageContext();
    lastStateClassification = createDefaultStateClassification();
    lastDecision = createColdDecision("route_change_reset");
    hysteresisGuard.reset();
    clearPdpGateRetry();
    pageTrackable = refreshPdpGate().trackable;

    await loadSessionProfile(collector.getRawSnapshot().productId).catch(() => {});

    if (enabled) startTracking();
    else updatePopupStats().catch(() => {});
  }

  function installSpaGuard() {
    if (installSpaGuard.installed || !(config.spa && config.spa.enabled !== false)) return;
    installSpaGuard.installed = true;

    const scheduleRouteCheck = (reason) => {
      clearTimeout(routeChangeTimer);
      routeChangeTimer = setTimeout(() => {
        handleRouteChange(reason).catch(() => {});
      }, Number((config.spa && config.spa.routeDebounceMs) || 250));
    };

    for (const methodName of ["pushState", "replaceState"]) {
      const original = window.history[methodName];
      if (typeof original !== "function") continue;

      window.history[methodName] = function wrappedHistoryMethod(...args) {
        const before = getRouteFingerprint();
        const result = original.apply(this, args);
        const after = getRouteFingerprint();
        if (after !== before) {
          scheduleRouteCheck(`spa_${methodName}`);
        }
        return result;
      };
    }

    window.addEventListener("popstate", () => {
      scheduleRouteCheck("spa_popstate");
    }, { passive: true });
  }

  function startTracking() {
    if (started) return;
    pageTrackable = refreshPdpGate().trackable;
    if (!pageTrackable) {
      resolver.resetToSilent();
      if (shouldRetryPdpGate(lastPdpGate)) {
        schedulePdpGateRetry("start_tracking_unsure");
      } else {
        clearPdpGateRetry();
      }
      updatePopupStats().catch(() => {});
      return;
    }
    clearPdpGateRetry();
    loadSessionProfile(collector.getRawSnapshot().productId).catch(() => {});
    started = true;
    saved = false;

    collector.start({
      onInactivity: (reason) => {
        saveSession(reason).catch(() => {});
      }
    });

    clearInterval(decisionTimer);
    clearInterval(statsTimer);

    const decisionTickMs = (config.collector && config.collector.decisionTickMs) || 3000;
    const statsTickMs = (config.collector && config.collector.statsTickMs) || 2500;

    decisionTimer = setInterval(() => {
      decisionCycle().catch(() => {});
    }, decisionTickMs);

    statsTimer = setInterval(() => {
      updatePopupStats().catch(() => {});
    }, statsTickMs);

    decisionCycle().catch(() => {});
  }

  function stopTracking(outcomeReason = "tracker_disabled") {
    if (!started) return;

    saveSession(outcomeReason, { force: true }).catch(() => {});

    started = false;
    collector.stop();
    resolver.resetToSilent();
    clearPdpGateRetry();

    clearInterval(decisionTimer);
    clearInterval(statsTimer);
    decisionTimer = null;
    statsTimer = null;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return;

    if (message.type === "EMOTIONUI_TOGGLE") {
      enabled = !!message.enabled;
      if (enabled) startTracking();
      else stopTracking("tracker_disabled");
      sendResponse({ ok: true, enabled });
      return;
    }

    if (message.type === "EMOTIONUI_MODE_RESET") {
      resolver.resetToSilent();
      hysteresisGuard.reset();
      lastDecision = {
        ...createColdDecision("manual_reset"),
        trained_samples: Number(lastDecision.trained_samples || 0),
        model_version: Number(lastDecision.model_version || 1)
      };

      sendResponse({
        ok: true,
        accepted: true,
        mode: "INTERVENE",
        suppressed: false,
        count: 1,
        reason: "manual_policy_reset"
      });
      updatePopupStats().catch(() => {});
      return;
    }

    if (message.type === "EMOTIONUI_GET_SNAPSHOT") {
      const { rawSnapshot, featurePack } = computeLiveBundle();
      const resolved = getResolvedDecision(lastDecision, rawSnapshot, featurePack, lastPageContext, lastStateClassification);
      const attribution = buildAttributionContext(rawSnapshot, lastDecision);

      sendResponse({
        enabled,
        rage_clicks: Math.round(rawSnapshot.rageClicks || 0),
        mouse_jitter: round(rawSnapshot.mouseJitter || 0),
        exit_intent: Math.round(rawSnapshot.exitIntent || 0),
        dead_clicks: Math.round(rawSnapshot.deadClicks || 0),
        cart_add_remove: Math.round(rawSnapshot.cartAddRemove || 0),
        price_hover: Math.round(rawSnapshot.priceHover || 0),
        direct_checkout: Boolean(rawSnapshot.directCheckout),
        time_on_price: round((rawSnapshot.timeOnPriceMs || 0) / 1000, 3),
        state: resolved.mode,
        ml_state: lastDecision.policy,
        resolved_ui_mode: resolved.mode,
        resolved_mode_reason: resolved.reason || lastDecision.reason || "policy_decision",
        pdp_gate_verdict: lastDecision.pdp_gate_verdict || lastPdpGate.verdict || "UNSURE",
        pdp_gate_score: Number(lastDecision.pdp_gate_score || lastPdpGate.score || 0),
        pdp_gate_reasons: Array.isArray(lastDecision.pdp_gate_reasons) ? lastDecision.pdp_gate_reasons : (lastPdpGate.reasons || []),
        funnel_stage: inferFunnelStage(rawSnapshot),
        biometric_inputs_enabled: biometricInputsEnabled,
        ml_source: lastDecision.source || "policy_model",
        ml_samples: Number(lastDecision.trained_samples || 0),
        ml_abstained: Boolean(lastDecision.abstained),
        stability_blocked_reason: lastDecision.blocked_reason || lastDecision.reason || "none",
        state_label: lastDecision.state_label || lastStateClassification.label,
        primary_state: lastDecision.primary_state || lastStateClassification.primary_state || lastDecision.state_label || lastStateClassification.label || "-",
        affect_tag: lastDecision.affect_tag || lastDecision.emotion_tag || lastStateClassification.affect_tag || lastStateClassification.emotion_tag || "-",
        intent_tag: lastDecision.intent_tag || lastStateClassification.intent_tag || "-",
        constraint_tags: Array.isArray(lastDecision.constraint_tags) ? lastDecision.constraint_tags : (lastStateClassification.constraint_tags || []),
        reason_codes: Array.isArray(lastDecision.reason_codes) ? lastDecision.reason_codes : (lastStateClassification.reason_codes || []),
        intervention_type: lastDecision.intervention_type || "none",
        mapped_mode: lastDecision.mapped_mode || resolved.mode,
        mapped_intervention_type: lastDecision.mapped_intervention_type || resolved.intervention_type || "none",
        mapper_reasons: Array.isArray(lastDecision.mapper_reasons) ? lastDecision.mapper_reasons : [],
        state_contract_key: lastDecision.state_contract_key || lastStateClassification.primary_state || lastStateClassification.label || "-",
        state_contract_mode: lastDecision.state_contract_mode || lastDecision.mapped_mode || resolved.mode,
        state_contract_intervention_type: lastDecision.state_contract_intervention_type || lastDecision.mapped_intervention_type || resolved.intervention_type || "none",
        state_contract_reason_families: Array.isArray(lastDecision.state_contract_reason_families) ? lastDecision.state_contract_reason_families : [],
        previous_mode: lastDecision.previous_mode || null,
        override_reason: lastDecision.override_reason || "none",
        dismiss_cooldown_active: Boolean(lastDecision.dismiss_cooldown_active),
        dismiss_cooldown_remaining_ms: Number(lastDecision.dismiss_cooldown_remaining_ms || 0),
        exposure_delay_ms: Number(attribution.exposure_delay_ms || 0),
        reward_window_ms: Number(attribution.reward_window_ms || 0),
        baseline_active: featurePack.context.sessionDurationSec >= ((config.feature && config.feature.minSessionSecondsForStableSignals) || 5),
        suppressed_modes: [],
        derived_scores: {
          f: featurePack.derived.friction_score,
          h: featurePack.derived.hesitation_score,
          r: featurePack.derived.research_depth_score,
          p: featurePack.derived.purchase_momentum_score
        },
        info_zone_unique_count: Number(featurePack.context.visitedCount || 0),
        info_zone_dwell_sec: Number(featurePack.context.infoZoneDwellSec || 0),
        revisit_intent_score: round((featurePack.normalized.sectionSwitchRate + featurePack.normalized.reviewFocusRatio) / 2),
        chaotic_scroll_burst_count: Math.round((rawSnapshot.scrollReversals || 0) >= 4 ? 1 : 0),
        reversal_with_dwell_ratio: round(featurePack.normalized.reviewFocusRatio),
        page_context_coverage: Number(lastDecision.page_context_coverage || lastPageContext.coverage || 0),
        page_density_score: Number(lastDecision.page_context_metrics?.pageDensityScore || lastPageContext.metrics?.pageDensityScore || 0),
        active_section: String(featurePack.context.activeSection || "none")
      });
      return;
    }

    if (message.type === "EMOTIONUI_CONNECT_WEARABLE") {
      sendResponse({ ok: false, error: "Biometric inputs disabled in EU-safe mode." });
      return;
    }
  });

  async function init() {
    const state = await safeStorageGet(["enabled"], {});
    enabled = state.enabled !== false;
    await loadSessionProfile(collector.getRawSnapshot().productId).catch(() => {});
    pageTrackable = refreshPdpGate().trackable;
    installSpaGuard();

    window.addEventListener("pagehide", () => {
      saveSession("tab_closed").catch(() => {});
    }, { passive: true });

    window.addEventListener("beforeunload", () => {
      saveSession("tab_closed").catch(() => {});
    }, { passive: true });

    document.addEventListener("DOMContentLoaded", () => {
      currentRouteFingerprint = getRouteFingerprint();
      const gate = refreshPdpGate();
      const nextTrackable = Boolean(gate.trackable);
      if (nextTrackable === pageTrackable && gate.verdict !== "UNSURE") return;
      pageTrackable = nextTrackable;

      if (!pageTrackable) {
        if (gate.verdict === "NOT_PDP") {
          stopTracking("page_not_trackable");
          clearPdpGateRetry();
        } else if (shouldRetryPdpGate(gate)) {
          schedulePdpGateRetry("dom_content_loaded_unsure");
        }
      } else if (enabled) {
        startTracking();
      }
      updatePopupStats().catch(() => {});
    }, { once: true, passive: true });

    if (enabled) startTracking();
    else updatePopupStats().catch(() => {});
  }

  init().catch(() => {});
})();
