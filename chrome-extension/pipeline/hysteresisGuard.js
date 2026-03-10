(() => {
  class HysteresisGuard {
    constructor(config = {}) {
      this.config = {
        minModeDwellMs: 9000,
        minModeDwellMsByMode: {
          DESIGN_OXYGEN: 4000,
          SPOTLIGHT_MODE: 5000,
          EXPRESS_LANE: 3000
        },
        // Maximum time a mode can stay at INTERVENE without new signals forcing re-entry.
        // Prevents stale friction history locking DESIGN_OXYGEN indefinitely.
        maxModeDurationMs: {
          DESIGN_OXYGEN: 25000,
          SPOTLIGHT_MODE: 30000
        },
        requiredStableHits: 2,
        minConfidenceDelta: 0.06,
        forceConfidenceDelta: 0.12,
        coldStartObserveMs: 5000,
        coldStartInterveneMs: 6500,
        commercialToResearchDwellMs: 3500,
        commercialToResearchMaxConfidenceDrop: 0.08,
        maxHistory: 10,
        ...config
      };

      this.reset();
    }

    round(value, digits = 3) {
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      return Number(n.toFixed(digits));
    }

    makeKey(decision = {}) {
      return [
        String(decision.policy || "SILENT").toUpperCase(),
        String(decision.resolved_mode || decision.mode || "STANDARD"),
        String(decision.resolved_rule_id || decision.rule_id || ""),
        String(decision.intervention_type || "none")
      ].join("|");
    }

    trimHistory() {
      if (this.history.length <= this.config.maxHistory) return;
      this.history = this.history.slice(-this.config.maxHistory);
    }

    reset() {
      this.lastAccepted = null;
      this.pending = null;
      this.history = [];
    }

    snapshotHistory() {
      return this.history.slice(-this.config.maxHistory).map((entry) => ({ ...entry }));
    }

    accept(candidate, meta = {}) {
      const now = Date.now();
      const accepted = {
        ...candidate,
        was_blocked: false,
        blocked_reason: "none",
        pending_candidate_hits: 0,
        time_since_last_mode_change_ms: Math.max(0, Number(meta.timeSinceLastModeChangeMs || 0)),
        previous_mode: meta.previousMode ?? null,
        previous_rule_id: meta.previousRuleId ?? null,
        mode_changed: Boolean(meta.modeChanged),
        hysteresis_reason: meta.reason || "accepted",
        accepted_at: now,
        mode_changed_at: meta.modeChanged ? now : Number(candidate.mode_changed_at || candidate.accepted_at || now)
      };

      this.lastAccepted = accepted;
      this.pending = null;
      this.history.push({
        ts: now,
        mode: accepted.resolved_mode || accepted.mode || "STANDARD",
        policy: accepted.policy || "SILENT",
        reason: accepted.hysteresis_reason
      });
      this.trimHistory();

      return {
        ...accepted,
        mode_history: this.snapshotHistory()
      };
    }

    stabilize(candidate = {}) {
      const now = Date.now();
      const prev = this.lastAccepted;
      const cleanCandidate = {
        ...candidate,
        policy: String(candidate.policy || "SILENT").toUpperCase(),
        resolved_mode: String(candidate.resolved_mode || candidate.mode || "STANDARD"),
        resolved_rule_id: candidate.resolved_rule_id || candidate.rule_id || null
      };

      if (!prev) {
        return this.accept(cleanCandidate, {
          previousMode: null,
          previousRuleId: null,
          modeChanged: true,
          reason: "initial_accept",
          timeSinceLastModeChangeMs: 0
        });
      }

      const prevMode = String(prev.resolved_mode || prev.mode || "STANDARD");
      const prevRuleId = prev.resolved_rule_id || prev.rule_id || null;
      const prevConfidence = Number(prev.confidence || 0);
      const candidateConfidence = Number(cleanCandidate.confidence || 0);
      const timeSincePageLoadMs = Math.max(0, Number(cleanCandidate.time_since_page_load_ms || 0));
      const key = this.makeKey(cleanCandidate);
      const sameKey = key === this.makeKey(prev);
      const timeSinceLastModeChangeMs = Math.max(0, now - Number(prev.mode_changed_at || prev.accepted_at || now));

      if (sameKey) {
        // Check if the current mode has been at INTERVENE longer than its max duration.
        // If so, downgrade policy to OBSERVE — if real friction re-appears the rule engine
        // will re-trigger INTERVENE immediately.
        const maxDurationMap = this.config.maxModeDurationMs || {};
        const maxDuration = Number(maxDurationMap[prevMode] || 0);
        if (
          maxDuration > 0 &&
          timeSinceLastModeChangeMs >= maxDuration &&
          String(cleanCandidate.policy || "").toUpperCase() === "INTERVENE"
        ) {
          const downgraded = { ...cleanCandidate, policy: "OBSERVE" };
          return this.accept(downgraded, {
            previousMode: prevMode,
            previousRuleId: prevRuleId,
            modeChanged: false,
            reason: "max_duration_policy_downgrade",
            timeSinceLastModeChangeMs
          });
        }

        return this.accept(cleanCandidate, {
          previousMode: prevMode,
          previousRuleId: prevRuleId,
          modeChanged: false,
          reason: "steady_state",
          timeSinceLastModeChangeMs
        });
      }

      if (this.pending && this.pending.key === key) {
        this.pending.hits += 1;
      } else {
        this.pending = { key, hits: 1, firstSeenAt: now };
      }

      const margin = candidateConfidence - prevConfidence;
      const targetMode = cleanCandidate.resolved_mode;
      const modeDwellMap = this.config.minModeDwellMsByMode || {};
      const effectiveDwellMs = modeDwellMap[targetMode] != null
        ? Number(modeDwellMap[targetMode])
        : Number(this.config.minModeDwellMs || 9000);
      const dwellSatisfied = timeSinceLastModeChangeMs >= effectiveDwellMs;
      const stableEnough = Number(this.pending.hits || 0) >= Number(this.config.requiredStableHits || 2);
      const confidenceClear = margin >= Number(this.config.minConfidenceDelta || 0.06);
      const commercialToResearchPromotion =
        /^(PRICE_ALERT_MODE|NEGOTIATOR_MODE|EXPRESS_LANE)$/.test(prevMode) &&
        cleanCandidate.resolved_mode === "RESEARCH_MODE" &&
        cleanCandidate.policy === "OBSERVE" &&
        timeSinceLastModeChangeMs >= Number(this.config.commercialToResearchDwellMs || 3500) &&
        candidateConfidence >= Math.max(0.34, prevConfidence - Number(this.config.commercialToResearchMaxConfidenceDrop || 0.08));
      const coldStartObservePromotion =
        prevMode === "STANDARD" &&
        String(prev.policy || "SILENT").toUpperCase() === "SILENT" &&
        cleanCandidate.policy === "OBSERVE" &&
        timeSincePageLoadMs <= Number(this.config.coldStartObserveMs || 5000) &&
        candidateConfidence >= 0.4;
      const coldStartIntervenePromotion =
        prevMode === "STANDARD" &&
        cleanCandidate.policy === "INTERVENE" &&
        timeSincePageLoadMs <= Number(this.config.coldStartInterveneMs || 6500) &&
        candidateConfidence >= 0.52;
      const forceSwitch =
        cleanCandidate.resolved_rule_id === "R_EXPRESS" ||
        cleanCandidate.resolved_rule_id === "R_FRUSTRATION" ||
        candidateConfidence >= (prevConfidence + Number(this.config.forceConfidenceDelta || 0.12));

      if (dwellSatisfied || stableEnough || confidenceClear || forceSwitch || coldStartObservePromotion || coldStartIntervenePromotion || commercialToResearchPromotion) {
        return this.accept(cleanCandidate, {
          previousMode: prevMode,
          previousRuleId: prevRuleId,
          modeChanged: cleanCandidate.resolved_mode !== prevMode || cleanCandidate.policy !== prev.policy,
          reason: coldStartObservePromotion
            ? "cold_start_observe_promotion"
            : coldStartIntervenePromotion
              ? "cold_start_intervene_promotion"
              : commercialToResearchPromotion
                ? "commercial_to_research_regain"
              : forceSwitch
            ? "force_switch"
            : (stableEnough ? "stable_candidate_accept" : (dwellSatisfied ? "min_dwell_elapsed" : "confidence_margin_clear")),
          timeSinceLastModeChangeMs
        });
      }

      return {
        ...prev,
        was_blocked: true,
        blocked_reason: "hysteresis_min_dwell",
        hysteresis_reason: "kept_previous_decision",
        time_since_last_mode_change_ms: timeSinceLastModeChangeMs,
        previous_mode: prevMode,
        previous_rule_id: prevRuleId,
        candidate_mode: cleanCandidate.resolved_mode,
        candidate_policy: cleanCandidate.policy,
        candidate_rule_id: cleanCandidate.resolved_rule_id,
        pending_candidate_hits: Number(this.pending.hits || 1),
        mode_history: this.snapshotHistory()
      };
    }
  }

  window.EmotionUIHysteresisGuard = HysteresisGuard;
})();
