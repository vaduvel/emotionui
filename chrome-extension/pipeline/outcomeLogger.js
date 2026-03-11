(() => {
  class OutcomeLogger {
    constructor(config = {}, helpers = {}) {
      this.config = {
        attribution: {},
        ...config
      };
      this.helpers = {
        getResolvedDecision: typeof helpers.getResolvedDecision === "function" ? helpers.getResolvedDecision : (() => ({
          mode: "STANDARD",
          reason: "unknown",
          source: "fallback",
          rule_id: null,
          mapper_reasons: [],
          intervention_type: "none"
        })),
        normalizePageContextValue: typeof helpers.normalizePageContextValue === "function" ? helpers.normalizePageContextValue : ((value) => value || {}),
        inferFunnelStage: typeof helpers.inferFunnelStage === "function" ? helpers.inferFunnelStage : (() => "product_view")
      };
    }

    round(value, digits = 3) {
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      return Number(n.toFixed(digits));
    }

    clamp01(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      return Math.max(0, Math.min(1, n));
    }

    max(values = []) {
      let value = 0;
      for (const item of values) {
        const n = Number(item || 0);
        if (n > value) value = n;
      }
      return value;
    }

    normalizePipelineTiming(pipelineTiming = {}) {
      const stages = (pipelineTiming && typeof pipelineTiming.stages === "object" && pipelineTiming.stages)
        ? Object.fromEntries(
            Object.entries(pipelineTiming.stages).map(([key, value]) => [key, this.round(value)])
          )
        : {};
      const worstStageName = String(
        pipelineTiming.worst_stage_name ||
        Object.entries(stages).sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))[0]?.[0] ||
        "none"
      );
      const worstStageMs = this.round(
        pipelineTiming.worst_stage_ms != null
          ? pipelineTiming.worst_stage_ms
          : stages[worstStageName] || 0
      );
      const totalCycleMs = this.round(
        pipelineTiming.total_cycle_ms != null
          ? pipelineTiming.total_cycle_ms
          : Object.values(stages).reduce((acc, value) => acc + (Number(value) || 0), 0)
      );

      return {
        stages,
        total_cycle_ms: totalCycleMs,
        worst_stage_name: worstStageName,
        worst_stage_ms: worstStageMs
      };
    }

    buildPdpGateAudit(decision = {}, lastPdpGate = {}) {
      const fallbackAudit = (lastPdpGate && typeof lastPdpGate.audit === "object") ? lastPdpGate.audit : {};
      const sourceAudit = (decision && typeof decision.pdp_gate_audit === "object") ? decision.pdp_gate_audit : fallbackAudit;
      return {
        host: String(sourceAudit.host || lastPdpGate.metrics?.host || ""),
        path: String(sourceAudit.path || lastPdpGate.metrics?.path || ""),
        document_ready_state: String(sourceAudit.document_ready_state || lastPdpGate.metrics?.documentReadyState || ""),
        verdict: String(sourceAudit.verdict || decision.pdp_gate_verdict || lastPdpGate.verdict || "UNSURE"),
        collection_mode: String(sourceAudit.collection_mode || decision.collection_mode || lastPdpGate.collectionMode || "blocked"),
        score: this.round(sourceAudit.score != null ? sourceAudit.score : (decision.pdp_gate_score || lastPdpGate.score || 0)),
        signal_score: this.round(sourceAudit.signal_score != null ? sourceAudit.signal_score : (decision.pdp_gate_metrics?.signalScore || lastPdpGate.metrics?.signalScore || 0)),
        listing_penalty: this.round(sourceAudit.listing_penalty != null ? sourceAudit.listing_penalty : (decision.pdp_gate_metrics?.listingPenalty || lastPdpGate.metrics?.listingPenalty || 0)),
        signal_reasons: Array.isArray(decision.pdp_gate_signal_reasons) ? decision.pdp_gate_signal_reasons : (Array.isArray(lastPdpGate.signal_reasons) ? lastPdpGate.signal_reasons : []),
        penalty_reasons: Array.isArray(decision.pdp_gate_penalty_reasons) ? decision.pdp_gate_penalty_reasons : (Array.isArray(lastPdpGate.penalty_reasons) ? lastPdpGate.penalty_reasons : [])
      };
    }

    buildSessionQuality({ rawSnapshot = {}, featurePack = {}, decision = {}, stateClassification = {} } = {}) {
      const context = featurePack.context || {};
      const history = Array.isArray(decision.mode_history) ? decision.mode_history : [];
      const transitionCount = Math.max(0, history.length - 1);
      const clicks = Math.max(0, Number(rawSnapshot.clicks || 0));
      const sectionSwitches = Math.max(0, Number(rawSnapshot.sectionSwitches || 0));
      const scrolledPercentage = this.clamp01(
        Number(rawSnapshot.maxScrollPercentage || context.scrolledPercentage || 0)
      );
      const informativeBehaviorScore = this.clamp01(
        0.30 * this.clamp01(Number(context.visitedCount || 0) / 4) +
        0.30 * this.clamp01(Number(context.infoZoneDwellSec || 0) / 45) +
        0.20 * this.clamp01(sectionSwitches / 6) +
        0.20 * this.clamp01(clicks / 18)
      );
      const transitionScore = this.clamp01(transitionCount / 4);
      const interventionScore = Boolean(rawSnapshot?.outcomes?.intervention_accepted)
        ? 1
        : Boolean(rawSnapshot?.outcomes?.intervention_exposed)
          ? (Boolean(rawSnapshot?.outcomes?.intervention_closed) ? 0.35 : 0.7)
          : 0;
      const outcomeScore = this.clamp01(this.max([
        rawSnapshot?.outcomes?.purchase_completed ? 1 : 0,
        rawSnapshot?.outcomes?.checkout_started ? 0.9 : 0,
        rawSnapshot?.outcomes?.added_to_cart ? 0.75 : 0,
        rawSnapshot?.outcomes?.added_to_wishlist ? 0.4 : 0
      ]));
      const durationScore = this.clamp01(Number(context.sessionDurationSec || rawSnapshot.sessionDurationSec || 0) / 60);
      const signalRichnessScore = this.clamp01(
        0.35 * this.clamp01(Number((stateClassification.reason_codes || decision.reason_codes || []).length || 0) / 3) +
        0.30 * this.clamp01(Number((stateClassification.reason_families || decision.reason_families || []).length || 0) / 3) +
        0.20 * scrolledPercentage +
        0.15 * this.clamp01(Number(context.priceHoverCount || 0) / 3)
      );
      const qualityScore = this.round(
        (
          0.28 * transitionScore +
          0.27 * informativeBehaviorScore +
          0.20 * outcomeScore +
          0.12 * interventionScore +
          0.08 * durationScore +
          0.05 * signalRichnessScore
        ) * 100,
        1
      );

      return {
        score: qualityScore,
        factors: {
          transition_count: transitionCount,
          transition_score: this.round(transitionScore),
          informative_behavior_score: this.round(informativeBehaviorScore),
          intervention_score: this.round(interventionScore),
          outcome_score: this.round(outcomeScore),
          duration_score: this.round(durationScore),
          signal_richness_score: this.round(signalRichnessScore),
          active_reason_code_count: Number((stateClassification.reason_codes || decision.reason_codes || []).length || 0),
          state_history_depth: history.length
        }
      };
    }

    buildAttributionContext(rawSnapshot = {}, decision = {}) {
      const now = Date.now();
      const attributionCfg = this.config.attribution || {};
      const history = Array.isArray(rawSnapshot?.policy?.history) ? rawSnapshot.policy.history : [];
      const policy = String(decision?.policy || "SILENT").toUpperCase();
      const rewardWindowMs = policy === "INTERVENE"
        ? Number(attributionCfg.interveneRewardWindowMs || 30000)
        : Number(attributionCfg.observeRewardWindowMs || 45000);
      const latestExposure = [...history].reverse().find((entry) => {
        const entryPolicy = String(entry?.policy || "").toUpperCase();
        if (policy === "INTERVENE") return entryPolicy === "INTERVENE";
        if (policy === "OBSERVE") return entryPolicy === "OBSERVE" || entryPolicy === "INTERVENE";
        return entryPolicy === policy;
      });

      const exposureTs = Number(decision?.decision_timestamp || latestExposure?.ts || rawSnapshot?.pageStartTs || now);
      const exposureDelayMs = Math.max(0, now - exposureTs);
      const withinRewardWindow = exposureDelayMs <= rewardWindowMs;
      const recentExposureCount = history.filter((entry) => (now - Number(entry?.ts || 0)) <= rewardWindowMs).length;
      const interventionExposed = Boolean(rawSnapshot?.outcomes?.intervention_exposed);
      const interventionAccepted = Boolean(rawSnapshot?.outcomes?.intervention_accepted);
      const interventionClosed = Boolean(rawSnapshot?.outcomes?.intervention_closed);
      const positiveOutcome = Boolean(
        rawSnapshot?.outcomes?.added_to_cart ||
        rawSnapshot?.outcomes?.checkout_started ||
        rawSnapshot?.outcomes?.purchase_completed ||
        rawSnapshot?.outcomes?.added_to_wishlist
      );

      let attributionKind = "organic";
      let assistedOutcomeConfidence = 0;
      if (interventionAccepted && positiveOutcome && withinRewardWindow) {
        attributionKind = "assisted";
        assistedOutcomeConfidence = 0.92;
      } else if (interventionExposed && positiveOutcome && withinRewardWindow && !interventionClosed) {
        attributionKind = "assisted_possible";
        assistedOutcomeConfidence = 0.58;
      } else if (interventionClosed && positiveOutcome) {
        attributionKind = "ambiguous_after_dismiss";
        assistedOutcomeConfidence = 0.18;
      } else if (interventionExposed) {
        attributionKind = interventionClosed ? "dismissed" : "exposed_only";
      }

      return {
        exposure_ts: exposureTs,
        exposure_delay_ms: exposureDelayMs,
        reward_window_ms: rewardWindowMs,
        within_reward_window: withinRewardWindow,
        recent_exposure_count: recentExposureCount,
        post_action_outcome_delay_ms: exposureDelayMs,
        attribution_kind: attributionKind,
        assisted_outcome_confidence: this.round(assistedOutcomeConfidence, 3)
      };
    }

    buildPolicyDebug({ rawSnapshot = {}, featurePack = {}, decision = {}, lastPdpGate = {}, lastStateClassification = {}, pageContext = {} } = {}) {
      const resolved = this.helpers.getResolvedDecision(decision, rawSnapshot, featurePack, pageContext, lastStateClassification);
      const attribution = this.buildAttributionContext(rawSnapshot, decision);
      const normalizedPageContext = this.helpers.normalizePageContextValue(decision.page_context || pageContext);
      const pipelineTiming = this.normalizePipelineTiming(decision.pipeline_timing || {});
      const gateAudit = this.buildPdpGateAudit(decision, lastPdpGate);

      return {
        source: decision.source,
        policy: decision.policy,
        confidence: decision.confidence,
        reason: decision.reason,
        experiment_key: decision.experiment_key || null,
        experiment_variant: decision.experiment_variant || "adaptive",
        experiment_runtime_mode: decision.experiment_runtime_mode || "adaptive",
        experiment_config_version: decision.experiment_config_version || null,
        experiment_assignment_bucket: Number(decision.experiment_assignment_bucket || 0),
        shadow_policy: decision.shadow_policy || null,
        shadow_confidence: Number(decision.shadow_confidence || 0),
        shadow_reason: decision.shadow_reason || null,
        shadow_source: decision.shadow_source || null,
        shadow_policy_probs: decision.shadow_policy_probs || {},
        challenger_policy: decision.challenger_policy || null,
        challenger_confidence: Number(decision.challenger_confidence || 0),
        challenger_reason: decision.challenger_reason || null,
        challenger_source: decision.challenger_source || null,
        challenger_policy_probs: decision.challenger_policy_probs || {},
        effective_epsilon: Number(decision.effective_epsilon || 0),
        action_probs: decision.policy_probs,
        exploration: Boolean(decision.exploration),
        model_version: decision.model_version,
        trained_samples: decision.trained_samples,
        abstained: Boolean(decision.abstained),
        resolved_mode: resolved.mode,
        resolved_mode_reason: resolved.reason,
        resolved_rule_id: resolved.rule_id,
        resolved_source: resolved.source,
        intervention_type: decision.intervention_type || resolved.intervention_type || "none",
        mapped_mode: decision.mapped_mode || resolved.mode,
        mapped_intervention_type: decision.mapped_intervention_type || resolved.intervention_type || "none",
        mapper_reasons: Array.isArray(decision.mapper_reasons) ? decision.mapper_reasons : (resolved.mapper_reasons || []),
        state_contract_key: decision.state_contract_key || decision.primary_state || lastStateClassification.primary_state || lastStateClassification.label,
        state_contract_mode: decision.state_contract_mode || decision.mapped_mode || resolved.mode,
        state_contract_intervention_type: decision.state_contract_intervention_type || decision.mapped_intervention_type || resolved.intervention_type || "none",
        state_contract_reason_families: Array.isArray(decision.state_contract_reason_families) ? decision.state_contract_reason_families : [],
        state_label: decision.state_label || lastStateClassification.label,
        primary_state: decision.primary_state || lastStateClassification.primary_state || lastStateClassification.label,
        state_confidence: Number(decision.state_confidence || lastStateClassification.confidence || 0),
        state_scores: decision.state_scores || lastStateClassification.scores || {},
        state_reasons: decision.state_reasons || lastStateClassification.reasons || [],
        affect_tag: decision.affect_tag || decision.emotion_tag || lastStateClassification.affect_tag || lastStateClassification.emotion_tag || "CALM",
        intent_tag: decision.intent_tag || lastStateClassification.intent_tag || "EXPLORING",
        constraint_tags: Array.isArray(decision.constraint_tags) ? decision.constraint_tags : (lastStateClassification.constraint_tags || []),
        affect_scores: decision.affect_scores || decision.emotion_scores || lastStateClassification.affect_scores || lastStateClassification.emotion_scores || {},
        intent_scores: decision.intent_scores || lastStateClassification.intent_scores || {},
        constraint_scores: decision.constraint_scores || lastStateClassification.constraint_scores || {},
        reason_codes: Array.isArray(decision.reason_codes) ? decision.reason_codes : (lastStateClassification.reason_codes || []),
        reason_families: Array.isArray(decision.reason_families) ? decision.reason_families : (lastStateClassification.reason_families || []),
        pair_disambiguators: Array.isArray(decision.pair_disambiguators) ? decision.pair_disambiguators : [],
        user_explanation_title: decision.user_explanation_title || "Why the page adapted",
        user_explanation_summary: decision.user_explanation_summary || null,
        user_explanation_details: Array.isArray(decision.user_explanation_details) ? decision.user_explanation_details : [],
        pdp_gate_verdict: decision.pdp_gate_verdict || lastPdpGate.verdict || "UNSURE",
        pdp_gate_score: Number(decision.pdp_gate_score || lastPdpGate.score || 0),
        pdp_gate_reasons: Array.isArray(decision.pdp_gate_reasons) ? decision.pdp_gate_reasons : (lastPdpGate.reasons || []),
        pdp_gate_signal_reasons: gateAudit.signal_reasons,
        pdp_gate_penalty_reasons: gateAudit.penalty_reasons,
        pdp_gate_metrics: decision.pdp_gate_metrics || lastPdpGate.metrics || {},
        pdp_gate_audit: gateAudit,
        pdp_gate_passive_collect: Boolean(decision.passive_collect || lastPdpGate.passiveCollect),
        collection_mode: decision.collection_mode || (lastPdpGate.collectionMode || (decision.passive_collect ? "unsure_passive" : "trackable")),
        page_context: normalizedPageContext.summary,
        page_context_hints: normalizedPageContext.hints,
        page_context_coverage: Number(normalizedPageContext.coverage || 0),
        page_context_metrics: normalizedPageContext.metrics || {},
        previous_mode: decision.previous_mode ?? null,
        mode_before: decision.previous_mode ?? null,
        mode_after: resolved.mode,
        mode_change_reason: decision.hysteresis_reason || resolved.reason || decision.reason || "unknown",
        previous_state: decision.previous_state ?? null,
        new_state: decision.state_label || lastStateClassification.label,
        previous_rule_id: decision.previous_rule_id ?? null,
        was_override: Boolean(decision.was_override),
        override_from: decision.override_from ?? null,
        override_to: decision.override_to ?? null,
        override_reason: decision.override_reason || "none",
        blocked_reason: decision.blocked_reason || "none",
        hysteresis_reason: decision.hysteresis_reason || "none",
        candidate_mode: decision.candidate_mode || null,
        candidate_policy: decision.candidate_policy || null,
        candidate_rule_id: decision.candidate_rule_id || null,
        pending_candidate_hits: Number(decision.pending_candidate_hits || 0),
        time_since_last_mode_change_ms: Number(decision.time_since_last_mode_change_ms || 0),
        dismiss_cooldown_active: Boolean(decision.dismiss_cooldown_active),
        dismiss_cooldown_until: Number(decision.dismiss_cooldown_until || 0),
        dismiss_cooldown_remaining_ms: Number(decision.dismiss_cooldown_remaining_ms || 0),
        decision_timestamp: Number(decision.decision_timestamp || 0),
        time_since_page_load_ms: Number(decision.time_since_page_load_ms || 0),
        reward_attribution_window_ms: Number(attribution.reward_window_ms || 0),
        exposure_delay_ms: Number(attribution.exposure_delay_ms || 0),
        within_reward_window: Boolean(attribution.within_reward_window),
        recent_exposure_count: Number(attribution.recent_exposure_count || 0),
        post_action_outcome_delay_ms: Number(attribution.post_action_outcome_delay_ms || 0),
        attribution_kind: attribution.attribution_kind,
        assisted_outcome_confidence: Number(attribution.assisted_outcome_confidence || 0),
        pipeline_timing: pipelineTiming,
        stage_timings: pipelineTiming.stages,
        decision_cycle_ms: pipelineTiming.total_cycle_ms,
        worst_stage_name: pipelineTiming.worst_stage_name,
        worst_stage_ms: pipelineTiming.worst_stage_ms,
        was_ui_contaminated: Number(rawSnapshot?.extensionUi?.filteredEvents || 0) > 0,
        filtered_extension_ui_event_count: Number(rawSnapshot?.extensionUi?.filteredEvents || 0),
        extension_ui_event_breakdown: rawSnapshot?.extensionUi || {},
        mode_history: Array.isArray(decision.mode_history) ? decision.mode_history : [],
        session_reentry_count: Number(rawSnapshot.sessionReentryCount || 0),
        visit_index_for_product: Number(rawSnapshot.visitIndexForProduct || 1),
        normalized_features: featurePack.normalized,
        derived_scores: featurePack.derived,
        context_metrics: featurePack.context,
        raw_snapshot_summary: {
          clicks: rawSnapshot.clicks,
          rage_clicks: rawSnapshot.rageClicks,
          mouse_jitter: rawSnapshot.mouseJitter,
          exit_intent: rawSnapshot.exitIntent,
          dwell_events: rawSnapshot.dwellEvents,
          dead_clicks: rawSnapshot.deadClicks,
          scroll_events: rawSnapshot.scrollEvents,
          scroll_reversals: rawSnapshot.scrollReversals,
          max_scroll_percentage: rawSnapshot.maxScrollPercentage,
          price_hover: rawSnapshot.priceHover,
          time_on_price_ms: rawSnapshot.timeOnPriceMs,
          cart_add_remove: rawSnapshot.cartAddRemove,
          direct_checkout: Boolean(rawSnapshot.directCheckout),
          total_visits: Number(rawSnapshot.totalVisits || 1),
          cart_abandons: Number(rawSnapshot.cartAbandons || 0),
          section_switches: rawSnapshot.sectionSwitches,
          section_visits: rawSnapshot.sectionVisits,
          section_dwell_ms: rawSnapshot.sectionDwellMs,
          active_section: rawSnapshot.activeSection || "",
          active_section_age_ms: Number(rawSnapshot.activeSectionAgeMs || 0),
          click_targets: rawSnapshot.clickTargets,
          hover_targets: rawSnapshot.hoverTargets,
          hover_duration_ms_by_target: rawSnapshot.hoverDurationByTargetMs,
          extension_ui: rawSnapshot.extensionUi || {},
          outcomes: rawSnapshot.outcomes
        }
      };
    }

    buildSessionPayload({ outcomeReason, rawSnapshot, featurePack, pageContext, stateClassification, reasonAnalysis, decision, lastPdpGate, navigatorUserAgent, screenWidth } = {}) {
      const resolved = this.helpers.getResolvedDecision(decision, rawSnapshot, featurePack, pageContext, stateClassification);
      const normalizedPageContext = this.helpers.normalizePageContextValue(pageContext);
      const policyDebug = this.buildPolicyDebug({
        rawSnapshot,
        featurePack,
        decision: {
          ...decision,
          page_context: normalizedPageContext.summary,
          page_context_hints: normalizedPageContext.hints,
          page_context_coverage: normalizedPageContext.coverage,
          page_context_metrics: normalizedPageContext.metrics,
          state_label: decision.state_label || stateClassification.label,
          primary_state: decision.primary_state || stateClassification.primary_state || stateClassification.label,
          state_confidence: Number(decision.state_confidence || stateClassification.confidence || 0),
          state_scores: decision.state_scores || stateClassification.scores || {},
          state_reasons: decision.state_reasons || stateClassification.reasons || [],
          state_contract_key: decision.state_contract_key || stateClassification.primary_state || stateClassification.label,
          state_contract_mode: decision.state_contract_mode || decision.mapped_mode || resolved.mode,
          state_contract_intervention_type: decision.state_contract_intervention_type || decision.mapped_intervention_type || resolved.intervention_type || "none",
          state_contract_reason_families: Array.isArray(decision.state_contract_reason_families) ? decision.state_contract_reason_families : [],
          affect_tag: decision.affect_tag || decision.emotion_tag || stateClassification.affect_tag || stateClassification.emotion_tag || "CALM",
          intent_tag: decision.intent_tag || stateClassification.intent_tag || "EXPLORING",
          constraint_tags: Array.isArray(decision.constraint_tags) ? decision.constraint_tags : (stateClassification.constraint_tags || []),
          affect_scores: decision.affect_scores || decision.emotion_scores || stateClassification.affect_scores || stateClassification.emotion_scores || {},
          intent_scores: decision.intent_scores || stateClassification.intent_scores || {},
          constraint_scores: decision.constraint_scores || stateClassification.constraint_scores || {},
          reason_codes: Array.isArray(decision.reason_codes) ? decision.reason_codes : (stateClassification.reason_codes || []),
          reason_families: Array.isArray(decision.reason_families) ? decision.reason_families : (stateClassification.reason_families || []),
          user_explanation_title: decision.user_explanation_title || reasonAnalysis?.user_explanation_title || "Why the page adapted",
          user_explanation_summary: decision.user_explanation_summary || reasonAnalysis?.user_explanation_summary || null,
          user_explanation_details: Array.isArray(decision.user_explanation_details) ? decision.user_explanation_details : (reasonAnalysis?.user_explanation_details || [])
        },
        lastPdpGate,
        lastStateClassification: stateClassification,
        pageContext: normalizedPageContext
      });

      const outcome = outcomeReason || "left";
      const specDwellSec = Math.round((rawSnapshot.sectionDwellMs.specs || 0) / 1000);
      const timeOnPriceSec = this.round((rawSnapshot.timeOnPriceMs || 0) / 1000, 3);
      const sessionQuality = this.buildSessionQuality({
        rawSnapshot,
        featurePack,
        decision,
        stateClassification
      });

      return {
        session_id: rawSnapshot.sessionId,
        product_id: rawSnapshot.productId,
        rage_clicks: Math.round(rawSnapshot.rageClicks || 0),
        mouse_jitter: this.round(rawSnapshot.mouseJitter || 0, 3),
        exit_intent: Math.round(rawSnapshot.exitIntent || 0),
        dwell_events: Math.round(rawSnapshot.dwellEvents || 0),
        scroll_thrash: this.round(rawSnapshot.scrollReversals / Math.max(1, rawSnapshot.scrollEvents), 4),
        dead_clicks: Math.round(rawSnapshot.deadClicks || 0),
        product_views: 1,
        spec_dwell: specDwellSec,
        cart_add_remove: Math.round(rawSnapshot.cartAddRemove || 0),
        price_hover: Math.round(rawSnapshot.priceHover || 0),
        direct_checkout: Boolean(rawSnapshot.directCheckout),
        total_visits: Math.max(1, Math.round(rawSnapshot.totalVisits || 1)),
        cart_abandons: Math.max(0, Math.round(rawSnapshot.cartAbandons || 0)),
        hour: new Date().getHours(),
        mobile: /Mobi|Android/i.test(navigatorUserAgent || ""),
        outcome,
        time_on_page_sec: Math.round(rawSnapshot.sessionDurationSec || 0),
        classified_state: resolved.mode,
        classified_action: decision.policy,
        confidence: Number(decision.confidence || 0),
        user_agent: navigatorUserAgent,
        screen_width: screenWidth,
        session_quality_score: sessionQuality.score,
        click_targets: rawSnapshot.clickTargets || {},
        hover_targets: rawSnapshot.hoverTargets || {},
        funnel_stage: this.helpers.inferFunnelStage(rawSnapshot),
        dropoff_stage: this.helpers.inferFunnelStage(rawSnapshot),
        scroll_depth: Math.round((rawSnapshot.maxScrollPercentage || 0) * 100),
        scroll_speed: rawSnapshot.scrollReversals > 3 ? "fast" : "slow",
        time_on_price: timeOnPriceSec,
        form_errors: 0,
        user_type: rawSnapshot.userType || "unknown",
        traffic_source: rawSnapshot.trafficSource || "direct",
        outcome_detail: {
          added_to_wishlist: Boolean(rawSnapshot.outcomes.added_to_wishlist),
          added_to_cart: Boolean(rawSnapshot.outcomes.added_to_cart),
          checkout_started: Boolean(rawSnapshot.outcomes.checkout_started),
          purchase_completed: Boolean(rawSnapshot.outcomes.purchase_completed),
          cart_abandons: Math.max(0, Math.round(rawSnapshot.cartAbandons || 0)),
          time_on_price: timeOnPriceSec,
          hover_duration_by_target_ms: rawSnapshot.hoverDurationByTargetMs || {},
          intervention_closed: Boolean(rawSnapshot.outcomes.intervention_closed),
          intervention_accepted: Boolean(rawSnapshot.outcomes.intervention_accepted),
          intervention_exposed: Boolean(rawSnapshot.outcomes.intervention_exposed),
          review_dwell_over_10s: Boolean(rawSnapshot.outcomes.review_dwell_over_10s),
          intervention_type: decision.intervention_type || "none",
          session_quality_score: sessionQuality.score,
          session_quality_factors: sessionQuality.factors,
          policy: policyDebug
        }
      };
    }
  }

  window.EmotionUIOutcomeLogger = OutcomeLogger;
})();
