async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function formatStartedAt(value) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString();
}

function setStatus(text) {
  document.getElementById("status").textContent = text || "";
}

function setEnabledUI(enabled) {
  const btn = document.getElementById("toggleBtn");
  btn.textContent = enabled ? "Tracking: ON (click to turn OFF)" : "Tracking: OFF (click to turn ON)";
  btn.style.background = enabled ? "#2d6cdf" : "#6b7280";
}

function setStats(stats) {
  document.getElementById("rageClicks").textContent = String(stats?.rage_clicks ?? "-");
  document.getElementById("mlState").textContent = stats?.ml_state || "-";
  document.getElementById("stateLabel").textContent = stats?.primary_state || stats?.state_label || "-";
  document.getElementById("emotionTag").textContent = stats?.affect_tag || stats?.emotion_tag || "-";
  document.getElementById("intentTag").textContent = stats?.intent_tag || "-";
  document.getElementById("constraintTags").textContent = (stats?.constraint_tags || []).join(", ") || "none";
  document.getElementById("reasonCodes").textContent = (stats?.reason_codes || []).join(", ") || "none";
  document.getElementById("previousState").textContent = stats?.previous_state || "-";
  document.getElementById("resolvedMode").textContent = stats?.resolved_ui_mode || stats?.state || "-";
  document.getElementById("interventionType").textContent = stats?.intervention_type || "-";
  document.getElementById("previousMode").textContent = stats?.previous_mode || "-";
  document.getElementById("resolvedReason").textContent = stats?.resolved_mode_reason || "none";
  document.getElementById("overrideReason").textContent = stats?.override_reason || "none";
  document.getElementById("funnel").textContent = stats?.funnel_stage || "-";
  document.getElementById("mlSource").textContent = stats?.ml_source || "-";
  document.getElementById("mlSamples").textContent = String(stats?.ml_samples ?? 0);
  document.getElementById("mlAbstain").textContent = stats?.ml_abstained ? "Yes" : "No";
  document.getElementById("baseline").textContent = stats?.baseline_active ? "Active" : "Fallback";
  document.getElementById("gateReason").textContent = stats?.stability_blocked_reason || "none";
  document.getElementById("pdpGate").textContent = stats?.pdp_gate_verdict || "-";
  document.getElementById("pdpScore").textContent = String(stats?.pdp_gate_score ?? 0);
  document.getElementById("suppressedModes").textContent = (stats?.suppressed_modes || []).join(", ") || "none";
  const ds = stats?.derived_scores || {};
  document.getElementById("scores").textContent = `${ds.f ?? 0}/${ds.h ?? 0}/${ds.r ?? 0}/${ds.p ?? 0}`;
  document.getElementById("infoZoneUnique").textContent = String(stats?.info_zone_unique_count ?? 0);
  document.getElementById("infoZoneDwell").textContent = String(stats?.info_zone_dwell_sec ?? 0);
  document.getElementById("revisitIntent").textContent = String(stats?.revisit_intent_score ?? 0);
  document.getElementById("chaoticBursts").textContent = String(stats?.chaotic_scroll_burst_count ?? 0);
  document.getElementById("reversalDwellRatio").textContent = String(stats?.reversal_with_dwell_ratio ?? 0);
  document.getElementById("pageDensity").textContent = String(stats?.page_density_score ?? 0);
  document.getElementById("activeSection").textContent = stats?.active_section || "-";
  document.getElementById("uiContamination").textContent = stats?.was_ui_contaminated ? `${stats?.filtered_extension_ui_event_count || 0}` : "No";
  document.getElementById("cooldown").textContent = stats?.dismiss_cooldown_active
    ? `${Math.max(0, Math.round(Number(stats?.dismiss_cooldown_remaining_ms || 0) / 1000))}s`
    : "No";
  document.getElementById("exposureDelay").textContent = `${Math.max(0, Math.round(Number(stats?.exposure_delay_ms || 0)))} ms`;
  document.getElementById("rewardWindow").textContent = `${Math.max(0, Math.round(Number(stats?.reward_window_ms || 0)))} ms`;
  document.getElementById("wearable").textContent = stats?.biometric_inputs_enabled ? "Enabled" : "Disabled";
}

function setTrainingMeta(meta) {
  document.getElementById("trainingRun").textContent = meta?.run_id || "-";
  document.getElementById("trainingStarted").textContent = formatStartedAt(meta?.started_at);
}

async function refresh() {
  const settings = await chrome.storage.local.get(["enabled"]);
  const enabled = settings.enabled !== false;
  setEnabledUI(enabled);

  try {
    const training = await chrome.runtime.sendMessage({ type: "EMOTIONUI_GET_TRAINING_META" });
    if (training?.ok === false) {
      setTrainingMeta(null);
    } else {
      setTrainingMeta(training);
    }
  } catch {
    setTrainingMeta(null);
  }

  const tab = await getActiveTab();
  if (!tab?.id) {
    setStats(null);
    return;
  }

  const res = await chrome.runtime.sendMessage({ type: "EMOTIONUI_GET_TAB_STATS", tabId: tab.id });
  if (res?.stats) {
    setStats(res.stats);
    return;
  }

  try {
    const snap = await chrome.tabs.sendMessage(tab.id, { type: "EMOTIONUI_GET_SNAPSHOT" });
    setStats(snap);
  } catch {
    setStats(null);
  }
}

async function toggleTracking() {
  const settings = await chrome.storage.local.get(["enabled"]);
  const next = settings.enabled === false;
  await chrome.runtime.sendMessage({ type: "EMOTIONUI_SET_ENABLED", enabled: next });
  setEnabledUI(next);
  setStatus(next ? "Tracking enabled" : "Tracking disabled");
  await refresh();
}

async function connectWearable() {
  setStatus("Biometric inputs disabled in EU-safe mode.");
}

async function resetCurrentMode() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    setStatus("No active tab.");
    return;
  }

  try {
    const result = await chrome.tabs.sendMessage(tab.id, { type: "EMOTIONUI_MODE_RESET" });
    if (result?.accepted) {
      setStatus(result.suppressed ? `Mode ${result.mode} suppressed for this session` : `Mode ${result.mode} reset`);
    } else {
      setStatus(result?.reason || "Mode reset not applied");
    }
  } catch {
    setStatus("Mode reset unavailable on this tab.");
  }

  await refresh();
}

async function openLivePanel() {
  const tab = await getActiveTab();
  const tabId = tab?.id;
  const windowId = tab?.windowId;

  try {
    const result = await chrome.runtime.sendMessage({
      type: "EMOTIONUI_OPEN_SIDE_PANEL",
      tabId,
      windowId
    });

    if (result?.ok) {
      setStatus("Live panel opened.");
    } else if (result?.fallbackTab) {
      setStatus("Side panel unavailable. Opened monitor tab.");
    } else {
      setStatus(result?.error || "Could not open live panel.");
    }
  } catch {
    setStatus("Could not open live panel.");
  }
}

async function resetLearningModel() {
  try {
    const result = await chrome.runtime.sendMessage({ type: "EMOTIONUI_POLICY_RESET" });
    if (result?.ok) {
      setStatus("Learning model reset.");
    } else {
      setStatus(result?.error || "Could not reset model.");
    }
  } catch {
    setStatus("Could not reset model.");
  }
  await refresh();
}

async function cleanStartTraining() {
  try {
    const result = await chrome.runtime.sendMessage({ type: "EMOTIONUI_CLEAN_START" });
    if (result?.ok) {
      const shortRun = String(result.training_run_id || "").slice(0, 18);
      setStatus(`Clean start ready (${shortRun || "new run"})`);
    } else {
      setStatus(result?.error || "Could not start clean training run.");
    }
  } catch {
    setStatus("Could not start clean training run.");
  }
  await refresh();
}

document.getElementById("toggleBtn").addEventListener("click", toggleTracking);
document.getElementById("openLivePanelBtn").addEventListener("click", openLivePanel);
document.getElementById("resetModeBtn").addEventListener("click", resetCurrentMode);
document.getElementById("resetModelBtn").addEventListener("click", resetLearningModel);
document.getElementById("cleanStartBtn").addEventListener("click", cleanStartTraining);
const wearableBtn = document.getElementById("wearableBtn");
wearableBtn.disabled = true;
wearableBtn.style.opacity = "0.6";
wearableBtn.style.cursor = "not-allowed";
wearableBtn.addEventListener("click", connectWearable);

refresh().catch(() => {});
setInterval(() => {
  refresh().catch(() => {});
}, 2000);
