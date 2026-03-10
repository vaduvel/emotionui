const LIVE_TOKEN_SETS = {
  STANDARD: {
    "--emo-bg": "#ffffff",
    "--emo-bg-secondary": "#f8f9fa",
    "--emo-text": "#1a1a2e",
    "--emo-text-secondary": "#6c757d",
    "--emo-accent": "#4361ee",
    "--emo-accent-hover": "#3a56d4",
    "--emo-border": "#dee2e6",
    "--emo-radius": "8px",
    "--emo-shadow": "0 2px 8px rgba(0,0,0,0.08)",
    "--emo-shadow-lg": "0 8px 24px rgba(0,0,0,0.12)",
    "--emo-spacing": "1rem",
    "--emo-spacing-lg": "2rem",
    "--emo-font-size": "1rem",
    "--emo-font-size-lg": "1.25rem",
    "--emo-line-height": "1.6",
    "--emo-transition": "0.55s cubic-bezier(0.4, 0, 0.2, 1)",
    "--emo-cta-bg": "#4361ee",
    "--emo-cta-text": "#ffffff",
    "--emo-cta-size": "1rem",
    "--emo-cta-padding": "0.75rem 2rem",
    "--emo-cta-radius": "8px",
    "--emo-cta-shadow": "0 4px 12px rgba(67, 97, 238, 0.3)",
    "--emo-panel-opacity": "1",
    "--emo-layout-gap": "2rem",
    "--emo-highlight": "transparent",
    "--emo-banner-bg": "transparent",
    "--emo-banner-text": "transparent"
  },
  EXPRESS_LANE: {
    "--emo-bg-secondary": "#f0fdf4",
    "--emo-accent": "#16a34a",
    "--emo-accent-hover": "#15803d",
    "--emo-cta-bg": "#16a34a",
    "--emo-cta-shadow": "0 6px 16px rgba(22, 163, 74, 0.35)",
    "--emo-banner-bg": "#f0fdf4",
    "--emo-banner-text": "#15803d"
  },
  PRICE_ALERT_MODE: {
    "--emo-bg-secondary": "#fffbeb",
    "--emo-accent": "#d97706",
    "--emo-accent-hover": "#b45309",
    "--emo-cta-bg": "#d97706",
    "--emo-cta-shadow": "0 4px 14px rgba(217, 119, 6, 0.3)",
    "--emo-banner-bg": "#fffbeb",
    "--emo-banner-text": "#92400e",
    "--emo-highlight": "rgba(217, 119, 6, 0.08)"
  },
  DESIGN_OXYGEN: {
    "--emo-bg": "#fafbfc",
    "--emo-bg-secondary": "#f0f4ff",
    "--emo-accent": "#6366f1",
    "--emo-accent-hover": "#4f46e5",
    "--emo-radius": "12px",
    "--emo-shadow": "0 1px 4px rgba(0,0,0,0.04)",
    "--emo-spacing": "1.5rem",
    "--emo-spacing-lg": "3rem",
    "--emo-font-size": "1.05rem",
    "--emo-line-height": "1.8",
    "--emo-cta-bg": "#6366f1",
    "--emo-cta-size": "1.1rem",
    "--emo-cta-padding": "1rem 2.5rem",
    "--emo-cta-radius": "12px",
    "--emo-cta-shadow": "0 4px 16px rgba(99, 102, 241, 0.25)",
    "--emo-layout-gap": "3rem",
    "--emo-banner-bg": "#f0f4ff",
    "--emo-banner-text": "#4338ca"
  },
  NEGOTIATOR_MODE: {
    "--emo-bg-secondary": "#f8fafc",
    "--emo-accent": "#0891b2",
    "--emo-accent-hover": "#0e7490",
    "--emo-cta-bg": "#0891b2",
    "--emo-cta-shadow": "0 4px 14px rgba(8, 145, 178, 0.3)",
    "--emo-shadow": "0 2px 12px rgba(0,0,0,0.06)",
    "--emo-banner-bg": "#ecfeff",
    "--emo-banner-text": "#155e75",
    "--emo-highlight": "rgba(8, 145, 178, 0.06)"
  },
  RESEARCH_MODE: {
    "--emo-bg-secondary": "#f5f3ff",
    "--emo-accent": "#7c3aed",
    "--emo-accent-hover": "#6d28d9",
    "--emo-font-size": "0.95rem",
    "--emo-line-height": "1.7",
    "--emo-cta-bg": "#7c3aed",
    "--emo-cta-size": "0.95rem",
    "--emo-cta-padding": "0.75rem 1.75rem",
    "--emo-cta-shadow": "0 4px 12px rgba(124, 58, 237, 0.25)",
    "--emo-banner-bg": "#f5f3ff",
    "--emo-banner-text": "#5b21b6",
    "--emo-layout-gap": "1.5rem"
  },
  SPOTLIGHT_MODE: {
    "--emo-bg-secondary": "#fff7ed",
    "--emo-accent": "#ea580c",
    "--emo-accent-hover": "#c2410c",
    "--emo-radius": "10px",
    "--emo-cta-bg": "#ea580c",
    "--emo-cta-size": "1.15rem",
    "--emo-cta-padding": "1rem 2.5rem",
    "--emo-cta-radius": "10px",
    "--emo-cta-shadow": "0 6px 18px rgba(234, 88, 12, 0.35)",
    "--emo-shadow": "0 4px 16px rgba(234, 88, 12, 0.1)",
    "--emo-highlight": "rgba(234, 88, 12, 0.08)",
    "--emo-banner-bg": "#fff7ed",
    "--emo-banner-text": "#9a3412"
  }
};

class DesignTokens {
  constructor(root = document.documentElement) {
    this.root = root;
    this.currentState = "STANDARD";
  }

  apply(state) {
    const merged = { ...LIVE_TOKEN_SETS.STANDARD, ...(LIVE_TOKEN_SETS[state] || {}) };
    Object.entries(merged).forEach(([prop, value]) => {
      this.root.style.setProperty(prop, value);
    });
    this.root.setAttribute("data-emotion-state", state);
    this.currentState = state;
  }

  reset() {
    this.apply("STANDARD");
  }
}

function getZoneTheme(mode) {
  const standard = LIVE_TOKEN_SETS.STANDARD || {};
  const modeTokens = LIVE_TOKEN_SETS[mode] || {};
  return {
    accent: modeTokens["--emo-accent"] || standard["--emo-accent"] || "#4361ee",
    accentHover: modeTokens["--emo-accent-hover"] || standard["--emo-accent-hover"] || "#3a56d4",
    bgSecondary: modeTokens["--emo-bg-secondary"] || standard["--emo-bg-secondary"] || "#f8f9fa",
    chipBorder: `${modeTokens["--emo-accent"] || standard["--emo-accent"] || "#4361ee"}2e`,
    badgeBg: `${modeTokens["--emo-accent"] || standard["--emo-accent"] || "#4361ee"}1f`,
    softFill: mode === "STANDARD"
      ? "rgba(248, 250, 252, 0.95)"
      : `${modeTokens["--emo-accent"] || standard["--emo-accent"] || "#4361ee"}14`,
    shadow: modeTokens["--emo-shadow-lg"] || modeTokens["--emo-shadow"] || standard["--emo-shadow-lg"] || "0 8px 24px rgba(0,0,0,0.12)"
  };
}

const LIVE_ADAPTATIONS = {
  STANDARD: { bodyClass: "emo-standard", scope: "local", globalQuietSelectors: [], globalMutedSelectors: [] },
  EXPRESS_LANE: { bodyClass: "emo-express", scope: "local", globalQuietSelectors: [], globalMutedSelectors: [] },
  PRICE_ALERT_MODE: { bodyClass: "emo-price", scope: "local", globalQuietSelectors: [], globalMutedSelectors: [] },
  NEGOTIATOR_MODE: { bodyClass: "emo-negotiator", scope: "local", globalQuietSelectors: [], globalMutedSelectors: [] },
  RESEARCH_MODE: { bodyClass: "emo-research", scope: "local", globalQuietSelectors: [], globalMutedSelectors: [] },
  DESIGN_OXYGEN: {
    bodyClass: "emo-oxygen",
    scope: "global",
    globalQuietSelectors: [".product-upsells"],
    globalMutedSelectors: [".commerce-signal-strip", ".product-secondary-info"]
  },
  SPOTLIGHT_MODE: {
    bodyClass: "emo-spotlight",
    scope: "global",
    globalQuietSelectors: [".product-upsells"],
    globalMutedSelectors: [".product-secondary-info"]
  }
};

class AdaptiveLayout {
  constructor(container) {
    this.container = container;
    this.hiddenNodes = [];
    this.mutedNodes = [];
    this.zoneNodes = this.collectNodes("data-adaptive-zone");
    this.slotNodes = this.collectNodes("data-adaptive-slot");
  }

  collectNodes(attribute) {
    const map = new Map();
    this.container?.querySelectorAll(`[${attribute}]`).forEach((node) => {
      const key = String(node.getAttribute(attribute) || "");
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(node);
    });
    return map;
  }

  applyBodyClass(bodyClass) {
    document.body.className = document.body.className.replace(/emo-\S+/g, "").trim();
    document.body.classList.add(bodyClass);
  }

  muteSelectors(selectors = []) {
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        if (this.mutedNodes.includes(node)) return;
        this.mutedNodes.push(node);
        node.classList.add("is-muted");
      });
    });
  }

  hideSelectors(selectors = []) {
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        this.hiddenNodes.push({ node, prevDisplay: node.style.display });
        node.style.display = "none";
      });
    });
  }

  setZoneState(zone, className) {
    (this.zoneNodes.get(zone) || []).forEach((node) => node.classList.add(className));
  }

  applyZoneTheme(zone, mode) {
    const theme = getZoneTheme(mode);
    (this.zoneNodes.get(zone) || []).forEach((node) => {
      node.classList.add("has-local-adaptation");
      node.dataset.zoneMode = mode;
      node.style.setProperty("--zone-accent", theme.accent);
      node.style.setProperty("--zone-accent-hover", theme.accentHover);
      node.style.setProperty("--zone-bg-secondary", theme.bgSecondary);
      node.style.setProperty("--zone-border-strong", theme.chipBorder);
      node.style.setProperty("--zone-chip-border", theme.chipBorder);
      node.style.setProperty("--zone-soft-badge", theme.badgeBg);
      node.style.setProperty("--zone-soft-fill", theme.softFill);
      node.style.setProperty("--zone-shadow", theme.shadow);
    });
  }

  renderSlot(slotKey, panel) {
    if (!panel) return;
    (this.slotNodes.get(slotKey) || []).forEach((node) => {
      node.innerHTML = `
        <div class="adaptive-slot-header">
          <span class="adaptive-slot-eyebrow">${panel.eyebrow}</span>
          <span class="adaptive-chip">${panel.scope}</span>
        </div>
        <div class="adaptive-slot-title">${panel.title}</div>
        <div class="adaptive-slot-copy">${panel.copy}</div>
        ${panel.chips?.length ? `<div class="adaptive-chip-row">${panel.chips.map((chip) => `<span class="adaptive-chip">${chip}</span>`).join("")}</div>` : ""}
        ${panel.note ? `<div class="adaptive-note">${panel.note}</div>` : ""}
      `;
      node.classList.add("is-visible");
    });
  }

  apply(decision = {}) {
    this.reset();
    const mode = String(decision.resolved_mode || decision.mode || "STANDARD");
    const adaptation = LIVE_ADAPTATIONS[mode] || LIVE_ADAPTATIONS.STANDARD;
    const focus = resolveVisualFocus(decision.raw_snapshot_summary || {}, decision);

    this.applyBodyClass(adaptation.bodyClass);
    if (mode !== "STANDARD") {
      this.setZoneState(focus.zone, "is-emphasized");
    }
    if (adaptation.scope === "local") {
      this.applyZoneTheme(focus.zone, mode);
    }
    this.hideSelectors(adaptation.globalQuietSelectors);
    this.muteSelectors(adaptation.globalMutedSelectors);
    this.renderSlot(focus.zone, buildAdaptivePanel(mode, focus, decision));

    document.body.dataset.activeZone = focus.zone;
    document.body.dataset.activeCluster = focus.cluster;
    document.body.dataset.activeMode = mode;
    if (this.container) {
      this.container.setAttribute("data-active-zone", focus.zone);
      this.container.setAttribute("data-active-cluster", focus.cluster);
      this.container.setAttribute("data-active-mode", mode);
    }
  }

  reset() {
    this.hiddenNodes.forEach(({ node, prevDisplay }) => {
      node.style.display = prevDisplay || "";
    });
    this.hiddenNodes = [];
    this.mutedNodes.forEach((node) => node.classList.remove("is-muted"));
    this.mutedNodes = [];
    this.zoneNodes.forEach((nodes) => nodes.forEach((node) => {
      node.classList.remove("is-emphasized", "is-muted", "has-local-adaptation");
      delete node.dataset.zoneMode;
      node.style.removeProperty("--zone-accent");
      node.style.removeProperty("--zone-accent-hover");
      node.style.removeProperty("--zone-bg-secondary");
      node.style.removeProperty("--zone-border-strong");
      node.style.removeProperty("--zone-chip-border");
      node.style.removeProperty("--zone-soft-badge");
      node.style.removeProperty("--zone-soft-fill");
      node.style.removeProperty("--zone-shadow");
    }));
    this.slotNodes.forEach((nodes) => nodes.forEach((node) => {
      node.innerHTML = "";
      node.classList.remove("is-visible");
    }));
    delete document.body.dataset.activeZone;
    delete document.body.dataset.activeCluster;
    delete document.body.dataset.activeMode;
    this.container?.removeAttribute("data-active-zone");
    this.container?.removeAttribute("data-active-cluster");
    this.container?.removeAttribute("data-active-mode");
    this.applyBodyClass("emo-standard");
  }
}

class URWidget {
  constructor() {
    this.widget = null;
    this.onReset = () => {};
    this.onDetails = () => {};
  }

  init({ onReset, onDetails } = {}) {
    this.onReset = onReset || (() => {});
    this.onDetails = onDetails || (() => {});
    this.widget = document.getElementById("ur-widget");
    if (!this.widget) return;
    this.widget.querySelector("[data-ur-reset]")?.addEventListener("click", () => this.onReset());
    this.widget.querySelector("[data-ur-details]")?.addEventListener("click", () => this.onDetails());
  }

  update(result) {
    if (!this.widget) return;
    if (!result || result.state === "STANDARD") {
      this.hide();
      return;
    }
    const label = this.widget.querySelector("[data-ur-label]");
    const desc = this.widget.querySelector("[data-ur-desc]");
    if (label) label.textContent = `Adapted: ${result.label}`;
    if (desc) desc.textContent = result.description;
    this.widget.classList.add("is-visible");
  }

  hide() {
    this.widget?.classList.remove("is-visible");
  }
}

const CONFIG = window.EMOTIONUI_CONFIG || {};
const Collector = window.EmotionUIDataCollector;
const PageContextExtractor = window.EmotionUIPageContextExtractor;
const FeatureExtractor = window.EmotionUIFeatureExtractor;
const ReasonCodeEngine = window.EmotionUIReasonCodeEngine;
const StateClassifier = window.EmotionUIStateClassifier;
const AdaptationMapper = window.EmotionUIAdaptationMapper;
const RulesResolver = window.EmotionUIRulesResolver;
const HysteresisGuard = window.EmotionUIHysteresisGuard;
const OutcomeLogger = window.EmotionUIOutcomeLogger;
const StateContract = window.EmotionUIStateContract || {};
const SUPABASE_URL = "https://tmhymprkpbxvqhxofxvy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtaHltcHJrcGJ4dnFoeG9meHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTY3MzQsImV4cCI6MjA4ODEzMjczNH0.yoL-3aCD2iTBRnmFwZQG5LDe0to7WBbGYBCcnYXcjvI";
const LIVE_MVP_PRODUCT_ID = "LIVE_MVP_APPLE_MAC_MINI";

const SIGNAL_ROWS = [
  { key: "clicks", label: "Clicks" },
  { key: "priceHover", label: "Price hover" },
  { key: "timeOnPriceMs", label: "Time on price", format: (value) => `${Math.round(Number(value || 0) / 1000)}s` },
  { key: "rageClicks", label: "Rage clicks" },
  { key: "deadClicks", label: "Dead clicks" },
  { key: "mouseJitter", label: "Mouse jitter" },
  { key: "scrollReversals", label: "Scroll reversals" },
  { key: "sectionSwitches", label: "Section switches" },
  { key: "cartAddRemove", label: "Cart toggles" },
  { key: "cartAbandons", label: "Cart abandons" },
  { key: "activeSection", label: "Active section", format: (value) => value || "none" },
  { key: "activeSectionAgeMs", label: "Section age", format: (value) => `${Math.round(Number(value || 0) / 1000)}s` }
];

const SCENARIOS = {
  frustrated: (runtime) => {
    injectFrictionBurst(runtime, { rage: 4, dead: 3, jitter: 2, reversals: 6 });
    runtime.collector.raw.sectionVisits.reviews += 1;
    runtime.collector.raw.sectionDwellMs.reviews += 8000;
    runtime.collector.switchSection("reviews", "scenario");
  },
  "price-sensitive": (runtime) => {
    injectPricePass(runtime, { hovers: 4, hoverMs: 9000, wishlist: true });
    runtime.collector.raw.cartAbandons += 1;
  },
  hesitant: (runtime) => {
    injectPricePass(runtime, { hovers: 3, hoverMs: 7000, wishlist: true });
    runtime.collector.raw.exitIntent += 1;
    runtime.collector.pushEvent("exit_intent", {});
  },
  researcher: (runtime) => {
    runtime.collector.raw.sectionVisits.specs += 2;
    runtime.collector.raw.sectionDwellMs.specs += 14000;
    runtime.collector.raw.sectionVisits.reviews += 2;
    runtime.collector.raw.sectionDwellMs.reviews += 18000;
    runtime.collector.switchSection("reviews", "scenario");
  },
  confused: (runtime) => {
    runtime.collector.raw.sectionVisits.gallery += 1;
    runtime.collector.raw.sectionVisits.description += 1;
    runtime.collector.raw.sectionVisits.reviews += 1;
    runtime.collector.raw.sectionSwitches += 6;
    injectFrictionBurst(runtime, { rage: 1, dead: 2, jitter: 2, reversals: 4 });
  },
  express: (runtime) => {
    runtime.collector.raw.outcomes.added_to_cart = true;
    runtime.collector.raw.outcomes.checkout_started = true;
    runtime.collector.raw.directCheckout = true;
    runtime.collector.raw.cartAddRemove += 1;
    runtime.collector.pushEvent("add_to_cart", { target: "scenario" });
    runtime.collector.pushEvent("checkout_started", { target: "scenario" });
  },
  night: (runtime) => {
    runtime.collector.raw.totalVisits = 1;
    runtime.collector.raw.sectionVisits.description += 1;
    runtime.collector.raw.sectionDwellMs.description += 8000;
    runtime.collector.switchSection("description", "scenario");
  },
  neutral: () => {}
};

const SCENARIO_FOCUS = {
  frustrated: "reviews",
  "price-sensitive": "purchase",
  hesitant: "purchase",
  researcher: "reviews",
  confused: "description",
  express: "purchase",
  night: "description",
  neutral: "overview"
};

let runtime = null;
let tokens = null;
let layout = null;
let ur = null;
let evaluationTimer = null;
let lastDecision = null;
let sectionButtons = [];
let sectionHoverTimer = null;
let zoneDwellTimer = null;
let scheduledEvaluationTimer = null;
let priceHoverStartTs = 0;
let lastBundle = null;
let sessionTimeline = [];

const LIVE_MVP_PACING = {
  sectionHoverDelayMs: 1400,
  zoneDwellDelayMs: 1800,
  purchaseDwellDelayMs: 1350,
  compareDwellDelayMs: 1450,
  overviewDwellDelayMs: 1750,
  evaluationDebounceMs: 380,
  tickIntervalMs: 1200,
  manualPriceHoverMs: 4500
};

const LIVE_INTENT_THRESHOLDS = Object.freeze({
  observeOverviewDwellMs: 1200,
  exploreMinSessionSec: 2,
  exploreTieBreakMinSessionSec: 6,
  researchSectionDwellMs: 2200,
  researchClusterDwellMs: 3500,
  researchInfoZoneDwellSec: 8,
  exploreOverviewScroll: 0.45,
  exploreOverviewVisits: 3,
  exploreTieBreakScroll: 0.22,
  exploreTieBreakVisits: 2,
  exploreTieBreakResearchSignalMax: 0.35,
  priceHoverMs: 2000,
  priceHoverCount: 2,
  favoriteCountForPrice: 1,
  priceEventCountForPrice: 1,
  addToCartForDecision: 1,
  checkoutForDecision: 1,
  decisionRecentSignalThreshold: 0.58,
  priceRecentSignalThreshold: 0.45,
  commerceMemoryAssistThreshold: 0.88,
  rageClicksForFrustration: 2,
  deadClicksForFrustration: 2,
  frictionEventsForFrustration: 3,
  overwhelmedSwitchCount: 5,
  overwhelmedResearchVisits: 3,
  overwhelmedHesitationScore: 0.34,
  overwhelmedFrictionSignal: 0.72,
  overwhelmedDerivedFrictionScore: 0.16,
  overwhelmedResearchHesitationScore: 0.42,
  overwhelmedResearchFrictionScore: 0.18,
  commerceRecencyDropThreshold: 0.2,
  researchRecencyRiseThreshold: 0.45
});

const LIVE_MVP_MODE_COOLDOWN = Object.freeze({
  localMs: 1700,
  globalMs: 2700
});

const ZONE_META = {
  overview: { label: "Overview", cluster: "overview" },
  variants: { label: "Variants", cluster: "variants" },
  purchase: { label: "Purchase rail", cluster: "purchase" },
  research: { label: "Research area", cluster: "research" },
  description: { label: "Description", cluster: "research" },
  specs: { label: "Specs", cluster: "research" },
  reviews: { label: "Reviews", cluster: "research" },
  faq: { label: "FAQ", cluster: "research" },
  compare: { label: "Compare", cluster: "compare" },
  services: { label: "Services", cluster: "purchase" },
  benefits: { label: "Trust & delivery", cluster: "purchase" }
};

let visualFocus = {
  zone: "overview",
  source: "init",
  ts: Date.now()
};

function normalizeZone(zone) {
  const key = String(zone || "").trim().toLowerCase();
  return ZONE_META[key] ? key : "";
}

function getZoneMeta(zone) {
  return ZONE_META[normalizeZone(zone)] || ZONE_META.description;
}

function zoneFromSection(section) {
  const key = String(section || "").trim().toLowerCase();
  return ["description", "specs", "reviews", "faq"].includes(key) ? key : "";
}

function collapseZoneForPresentation(zone, mode = "STANDARD") {
  const normalized = normalizeZone(zone);
  if (!normalized) return "";
  if (mode === "RESEARCH_MODE" && ["description", "specs", "reviews", "faq", "research"].includes(normalized)) {
    return "research";
  }
  return normalized;
}

function setVisualFocus(zone, source = "interaction") {
  const currentMode = String(lastDecision?.resolved_mode || "STANDARD");
  const normalized = collapseZoneForPresentation(zone, currentMode);
  if (!normalized) return;
  visualFocus = {
    zone: normalized,
    source,
    ts: Date.now()
  };
  document.body.dataset.visualZone = normalized;
  document.body.dataset.visualCluster = getZoneMeta(normalized).cluster;
}

function clearZoneDwellTimer() {
  window.clearTimeout(zoneDwellTimer);
  zoneDwellTimer = null;
}

function armZoneDwell(callback, delayMs = LIVE_MVP_PACING.zoneDwellDelayMs) {
  clearZoneDwellTimer();
  zoneDwellTimer = window.setTimeout(() => {
    zoneDwellTimer = null;
    callback?.();
  }, Math.max(0, Number(delayMs || 0)));
}

function resolveVisualFocus(raw = {}, decision = {}) {
  const mode = String(decision.resolved_mode || decision.mode || "STANDARD");
  const explicitFocus = collapseZoneForPresentation(visualFocus.zone, mode);
  const activeSectionZone = zoneFromSection(decision?.context_metrics?.activeSection || raw.activeSection);
  const fallbackZone =
    mode === "RESEARCH_MODE"
      ? "research"
      : /^(PRICE_ALERT_MODE|NEGOTIATOR_MODE|EXPRESS_LANE)$/.test(mode)
        ? "purchase"
        : "overview";
  const zone = explicitFocus || collapseZoneForPresentation(activeSectionZone, mode) || fallbackZone;
  const meta = getZoneMeta(zone);
  const detailZone = activeSectionZone || (["description", "specs", "reviews", "faq"].includes(explicitFocus) ? explicitFocus : "");

  return {
    zone,
    label: meta.label,
    cluster: meta.cluster,
    detailZone,
    detailLabel: detailZone ? getZoneMeta(detailZone).label : meta.label,
    source: visualFocus.source || "derived"
  };
}

function buildAdaptivePanel(mode, focus, decision = {}) {
  const reasonCodes = Array.isArray(decision.reason_codes) && decision.reason_codes.length
    ? decision.reason_codes.slice(0, 2).join(" · ")
    : "state-driven adaptation";
  const scope = `${focus.label}`;

  if (mode === "STANDARD" && String(decision.policy || "SILENT") === "OBSERVE" && /^(overview|variants)$/.test(focus.zone)) {
    return {
      eyebrow: "Observe",
      scope,
      title: focus.zone === "variants"
        ? "Variant changes stay lightweight until intent becomes explicit"
        : "The hero zone stays calm while the user visually scans the product",
      copy: focus.zone === "variants"
        ? "Storage and memory choices remain easy to compare without forcing commerce or research UI too early."
        : "Images, hero benefits, and the first impression stay clean until the user moves into research or purchase behavior.",
      chips: focus.zone === "variants" ? ["Storage", "Memory", "Compare later"] : ["Visual scan", "Utility preview", "No pressure"],
      note: reasonCodes
    };
  }

  if (mode === "STANDARD" && String(decision.policy || "SILENT") === "OBSERVE" && focus.zone === "compare") {
    return {
      eyebrow: "Compare observe",
      scope,
      title: "Alternative products stay grouped as hesitation, not research",
      copy: "The compare area stays lightweight while the user weighs nearby options. This keeps comparison local and avoids repainting the research surface or purchase rail prematurely.",
      chips: ["Shortlist", "Trade-offs", "Not research yet"],
      note: reasonCodes
    };
  }

  switch (mode) {
    case "RESEARCH_MODE":
      if (focus.zone === "research" && focus.detailZone === "specs") {
        return {
          eyebrow: "Research area",
          scope,
          title: "The full research surface shifts into spec-friendly mode",
          copy: "Instead of styling only a small spec block, the entire research area becomes easier to scan while the current focus stays on specifications, ports, memory ceiling, and trade-offs.",
          chips: ["Ports first", "Memory ceiling", "Display support"],
          note: reasonCodes
        };
      }
      if (focus.zone === "research" && focus.detailZone === "reviews") {
        return {
          eyebrow: "Research area",
          scope,
          title: "The full research surface shifts into reassurance mode",
          copy: "Reviews drive the current research pass, but the whole research area stays aligned so the UI feels contextual, not like a hover effect jumping between tiny sections.",
          chips: ["Verified buyers", "Noise & thermals", "Storage regret risk"],
          note: reasonCodes
        };
      }
      if (focus.zone === "purchase") {
        return {
          eyebrow: "Research near purchase",
          scope,
          title: "The purchase rail shifts into answer-first mode",
          copy: "The user is near CTAs, but still behaves like a researcher. Financing, delivery, returns, and the next comparison step stay in the purchase area without transforming abandoned sections.",
          chips: ["Rate breakdown", "Return policy", "Compare storage"],
          note: reasonCodes
        };
      }
      if (focus.zone === "research" && focus.detailZone === "faq") {
        return {
          eyebrow: "Research area",
          scope,
          title: "The research surface pivots into blocker-resolution mode",
          copy: "FAQ is the current active subsection, but the adaptation stays on the entire research band so the user feels one coherent assistance layer.",
          chips: ["Upgrade limits", "Monthly rate", "Display support"],
          note: reasonCodes
        };
      }
      return {
        eyebrow: "Research area",
        scope,
        title: focus.detailZone === "description"
          ? "The full research surface shifts into explanation mode"
          : "Research assistance stays stable across the whole information area",
        copy: focus.detailZone === "description"
          ? "Description is leading the current pass, but the whole research area stays easier to parse so the UI feels intentional and persistent, not section-fragmented."
          : "Once the user is in research, the whole information band becomes easier to navigate while the current subsection still gets the strongest emphasis.",
        chips: ["What matters first", "Jump to specs", "Jump to reviews"],
        note: reasonCodes
      };
    case "NEGOTIATOR_MODE":
      return {
        eyebrow: "Localized value reassurance",
        scope,
        title: focus.zone === "purchase"
          ? "The purchase rail gets value reassurance instead of a full-page restyle"
          : focus.zone === "compare"
            ? "Comparison becomes the hesitation resolver, not a generic upsell strip"
          : "Value cues are injected into the current zone, not the abandoned checkout rail",
        copy: focus.zone === "compare"
          ? "Comparison cards now highlight total value, not just sticker price. This keeps the negotiation treatment where the user is actively weighing options."
          : "Financing, price history, return coverage, and trade-off framing appear in the zone the user is using right now, so the page stays context-aware.",
        chips: ["Price drop context", "Monthly rate", "30-day return"],
        note: reasonCodes
      };
    case "PRICE_ALERT_MODE":
      return {
        eyebrow: "Localized price focus",
        scope,
        title: focus.zone === "compare"
          ? "Price sensitivity is handled inside comparison, where it matters"
          : "Price reassurance stays close to the active evaluation zone",
        copy: "Discount framing, financing, and trade-off clarity stay in the area the user is touching now. Other sections remain visually stable until they become active.",
        chips: ["400 lei saved", "283 lei / month", "Pickup tomorrow"],
        note: reasonCodes
      };
    case "EXPRESS_LANE":
      return {
        eyebrow: "Localized express path",
        scope,
        title: focus.zone === "purchase"
          ? "The fast path activates only inside the purchase rail"
          : "Express intent is visible here without forcing the whole page into checkout mode",
        copy: "Quick checkout cues, saved details, and the shortest next step stay attached to the active zone so the UI does not keep pushing abandoned CTA areas.",
        chips: ["Saved details", "1-step checkout", "Pickup in stock"],
        note: reasonCodes
      };
    case "DESIGN_OXYGEN":
      return {
        eyebrow: "Global friction relief",
        scope,
        title: "Noise is reduced across the page while the current zone stays readable",
        copy: "This is one of the global exceptions. Low-priority blocks fade back, the active zone remains stable, and the page becomes easier to parse during frustration.",
        chips: ["Less noise", "Fewer side paths", "Calmer focus"],
        note: reasonCodes
      };
    case "SPOTLIGHT_MODE":
      return {
        eyebrow: "Global focus mode",
        scope,
        title: "Decision-critical surfaces stay prominent during overload",
        copy: "This mode is allowed to affect the broader page because overload is a global readability problem. Secondary offers step back until confidence recovers.",
        chips: ["Primary action first", "Secondary noise reduced", "Reading effort lowered"],
        note: reasonCodes
      };
    default:
      return null;
  }
}

function createRuntime() {
  const collector = new Collector({
    ...(CONFIG.collector || {}),
    dwellThresholdMs: Math.max(6500, Number(CONFIG.collector?.dwellThresholdMs || 0)),
    priceHoverMinMs: Math.max(5000, Number(CONFIG.collector?.priceHoverMinMs || 0)),
    jitterThresholdPx: Math.max(95, Number(CONFIG.collector?.jitterThresholdPx || 0)),
    jitterMinGapMs: Math.max(1400, Number(CONFIG.collector?.jitterMinGapMs || 0)),
    minSectionSwitchGapMs: Math.max(1400, Number(CONFIG.collector?.minSectionSwitchGapMs || 0))
  });
  const baseSwitchSection = collector.switchSection.bind(collector);
  collector.switchSection = (nextSection, reason = "auto") => {
    if (reason === "hover") return;
    return baseSwitchSection(nextSection, reason);
  };
  collector.startHoverTracking = () => {};
  collector.finalizeHoverTracking = () => {};
  collector.sampleActiveHover = () => {};
  collector.updateMouseJitter = () => {};

  return {
    collector,
    pageContextExtractor: new PageContextExtractor(CONFIG.pageContext || {}),
    featureExtractor: new FeatureExtractor(CONFIG.feature || {}),
    reasonCodeEngine: new ReasonCodeEngine(CONFIG.reasonCodes || {}),
    stateClassifier: new StateClassifier(CONFIG.state || {}),
    adaptationMapper: new AdaptationMapper(CONFIG.mapping || {}),
    rulesResolver: new RulesResolver(CONFIG),
    hysteresis: new HysteresisGuard(CONFIG.hysteresis || {})
  };
}

function derivePolicy({ stateClassification, featurePack, ruleWinner, rulesResolver }) {
  const primaryState = String(stateClassification.primary_state || stateClassification.label || "CALM_BROWSING").toUpperCase();
  const confidence = Number(stateClassification.confidence || 0);
  const derived = featurePack?.derived || {};
  const context = featurePack?.context || {};
  const activeSection = String(context.activeSection || "");
  const activeSectionAgeSec = Number(context.activeSectionAgeSec || 0);
  const activeOverviewSection = /^(gallery|overview|variants)$/.test(activeSection);
  const activeResearchSection = /^(reviews|specs|description|faq)$/.test(activeSection);
  const sessionDurationSec = Number(context.sessionDurationSec || 0);

  let candidate = {
    policy: "SILENT",
    confidence: Math.max(confidence, 0.34),
    reason: "live_mvp_neutral",
    source: "live_mvp_heuristic",
    trained_samples: 0,
    abstained: false
  };

  if (primaryState === "DEEP_RESEARCH" || primaryState === "EXPLORING") {
    candidate = {
      ...candidate,
      policy: "OBSERVE",
      confidence: Math.max(confidence, 0.42),
      reason: "live_mvp_research_or_explore"
    };
  } else if (primaryState === "PRICE_SENSITIVE" || primaryState === "REASSURANCE_SEEKING") {
    candidate = {
      ...candidate,
      policy: "OBSERVE",
      confidence: Math.max(confidence, 0.48),
      reason: "live_mvp_commerce_eval"
    };
  } else if (primaryState === "DECISION_READY" || primaryState === "FRUSTRATED" || primaryState === "OVERLOADED") {
    candidate = {
      ...candidate,
      policy: "INTERVENE",
      confidence: Math.max(confidence, 0.56),
      reason: "live_mvp_action_state"
    };
  }

  if (
    primaryState === "CALM_BROWSING" &&
    activeOverviewSection &&
    sessionDurationSec >= 2 &&
    activeSectionAgeSec >= 1.2 &&
    Number(derived.friction_score || 0) < 0.2 &&
    Number(derived.research_depth_score || 0) < 0.45 &&
    Number(derived.purchase_momentum_score || 0) < 0.24
  ) {
    candidate = {
      ...candidate,
      policy: "OBSERVE",
      confidence: Math.max(confidence, 0.4),
      reason: "live_mvp_observe_overview"
    };
  }

  if (
    primaryState === "CALM_BROWSING" &&
    activeResearchSection &&
    sessionDurationSec >= 4 &&
    activeSectionAgeSec >= 2.4
  ) {
    candidate = {
      ...candidate,
      policy: "OBSERVE",
      confidence: Math.max(confidence, 0.42),
      reason: "live_mvp_observe_research_entry"
    };
  }

  if (ruleWinner?.ruleId === "R_EXPRESS" || Number(derived.express_checkout_score || 0) >= 0.55) {
    candidate.policy = "INTERVENE";
    candidate.confidence = Math.max(candidate.confidence, 0.62);
    candidate.reason = "live_mvp_express_rule";
  }

  return rulesResolver.applySafetyPolicyOverride(candidate, featurePack);
}

function makeUrPayload(decision) {
  const mode = String(decision.resolved_mode || decision.mode || "STANDARD");
  const interventionType = String(decision.intervention_type || "none");
  const focus = resolveVisualFocus(decision.raw_snapshot_summary || {}, decision);
  const label = `${decision.primary_state || decision.state_label || "CALM_BROWSING"} → ${mode}`;
  const reasonCodes = Array.isArray(decision.reason_codes) && decision.reason_codes.length
    ? decision.reason_codes.slice(0, 3).join(", ")
    : "No strong driver";

  return {
    state: mode,
    label,
    description: `${interventionType === "none" ? "Passive adaptation" : interventionType} · ${focus.label} · ${reasonCodes}`
  };
}

function applyDecision(decision) {
  const mode = String(decision.resolved_mode || decision.mode || "STANDARD");
  const adaptation = LIVE_ADAPTATIONS[mode] || LIVE_ADAPTATIONS.STANDARD;
  tokens.apply(adaptation.scope === "global" ? mode : "STANDARD");
  layout.apply(decision);
  ur.update(makeUrPayload(decision));

  if (mode === "STANDARD") {
    ur.hide();
  }
}

function getStatePolicy(stateLabel, zoneCluster = "overview") {
  switch (String(stateLabel || "").toUpperCase()) {
    case "DEEP_RESEARCH":
    case "PRICE_SENSITIVE":
    case "REASSURANCE_SEEKING":
      return "OBSERVE";
    case "DECISION_READY":
    case "FRUSTRATED":
    case "OVERWHELMED":
      return "INTERVENE";
    case "EXPLORING":
      return /^(overview|variants|compare)$/.test(zoneCluster) ? "OBSERVE" : "SILENT";
    case "CALM_BROWSING":
    default:
      return /^(overview|variants)$/.test(zoneCluster) ? "OBSERVE" : "SILENT";
  }
}

function getMvpZone(raw = {}, decision = {}) {
  const activeSection = String(raw.activeSection || decision?.context_metrics?.activeSection || "");
  const explicitZone = normalizeZone(visualFocus.zone || "");
  const collapsedExplicitZone = ["description", "specs", "reviews", "faq"].includes(explicitZone)
    ? "research"
    : explicitZone;
  const sectionZone = collapseZoneForPresentation(zoneFromSection(activeSection), "RESEARCH_MODE");
  const zone = normalizeZone(collapsedExplicitZone || sectionZone || "overview") || "overview";
  const meta = getZoneMeta(zone);
  return {
    zone,
    cluster: meta.cluster,
    label: meta.label,
    activeSection
  };
}

function buildThresholdSnapshot(raw = {}, decision = {}) {
  const context = decision.context_metrics || {};
  const normalized = decision.normalized_features || {};
  const derived = decision.derived_scores || {};
  const zoneInfo = getMvpZone(raw, decision);
  const researchDwellMs =
    Number(raw.sectionDwellMs?.description || 0) +
    Number(raw.sectionDwellMs?.specs || 0) +
    Number(raw.sectionDwellMs?.reviews || 0) +
    Number(raw.sectionDwellMs?.faq || 0);
  const activeSectionAgeMs = Number(raw.activeSectionAgeMs || 0);
  const recentWishlistCount = Number(context.recentWishlistCount || 0);
  const recentAddToCartCount = Number(context.recentAddToCartCount || 0);
  const recentCheckoutCount = Number(context.recentCheckoutCount || 0);
  const recentPriceEventCount = Number(context.recentPriceEventCount || 0);
  const recentResearchSwitchCount = Number(context.recentResearchSwitchCount || 0);
  const purchaseCtaIntentCount = Number(context.purchaseCtaIntentCount || 0);
  const recentRageCount = Number(context.recentRageCount || 0);
  const recentDeadClickCount = Number(context.recentDeadClickCount || 0);
  const recentFrictionEventCount = Number(context.recentFrictionEventCount || 0);
  const sectionSwitches = Number(raw.sectionSwitches || 0);
  const scrollReversals = Number(raw.scrollReversals || 0);
  const visitedCount = Number(context.visitedCount || 0);
  const sessionDurationSec = Number(context.sessionDurationSec || 0);
  const infoZoneDwellSec = Number(context.infoZoneDwellSec || 0);
  const priceHoverCount = Number(raw.priceHover || 0);
  const timeOnPriceMs = Number(raw.timeOnPriceMs || 0);
  const recentDecisionSignal = Number(normalized.recentDecisionSignal || 0);
  const recentPriceSignal = Number(normalized.recentPriceSignal || 0);
  const recentResearchSignal = Number(normalized.recentResearchSignal || 0);
  const recentFrictionSignal = Number(normalized.recentFrictionSignal || 0);
  const sessionCommerceMemorySignal = Number(normalized.sessionCommerceMemorySignal || 0);
  const scrolledPercentage = Number(raw.maxScrollPercentage || context.scrolledPercentage || 0);
  const frictionScore = Number(derived.friction_score || 0);
  const hesitationScore = Number(derived.hesitation_score || 0);
  const pageDensity = zoneInfo.cluster === "compare" || zoneInfo.cluster === "research" ? 1 : 0;
  const activeResearch = zoneInfo.cluster === "research";
  const activeOverview = zoneInfo.cluster === "overview";
  const activePurchase = zoneInfo.cluster === "purchase" || zoneInfo.cluster === "variants";
  const activeCompare = zoneInfo.cluster === "compare";
  const commerceDormant =
    recentAddToCartCount === 0 &&
    recentCheckoutCount === 0 &&
    recentDecisionSignal < LIVE_INTENT_THRESHOLDS.commerceRecencyDropThreshold &&
    recentPriceSignal < LIVE_INTENT_THRESHOLDS.priceRecentSignalThreshold;

  const decisionReadyRaw =
    recentAddToCartCount >= LIVE_INTENT_THRESHOLDS.addToCartForDecision ||
    recentCheckoutCount >= LIVE_INTENT_THRESHOLDS.checkoutForDecision ||
    (
      activePurchase &&
      recentDecisionSignal >= LIVE_INTENT_THRESHOLDS.decisionRecentSignalThreshold
    ) ||
    (
      activePurchase &&
      recentWishlistCount >= 1 &&
      recentPriceEventCount >= 1 &&
      recentDecisionSignal >= 0.4
    ) ||
    (
      activePurchase &&
      !commerceDormant &&
      sessionCommerceMemorySignal >= LIVE_INTENT_THRESHOLDS.commerceMemoryAssistThreshold &&
      purchaseCtaIntentCount >= 2
    );
  const priceReadyRaw =
    (
      recentWishlistCount >= LIVE_INTENT_THRESHOLDS.favoriteCountForPrice &&
      recentPriceEventCount >= LIVE_INTENT_THRESHOLDS.priceEventCountForPrice
    ) ||
    (
      (activePurchase || activeCompare) &&
      recentPriceSignal >= LIVE_INTENT_THRESHOLDS.priceRecentSignalThreshold
    ) ||
    (
      (activePurchase || activeCompare) &&
      !commerceDormant &&
      (
        recentPriceEventCount >= LIVE_INTENT_THRESHOLDS.priceEventCountForPrice ||
        (timeOnPriceMs >= LIVE_INTENT_THRESHOLDS.priceHoverMs && priceHoverCount >= LIVE_INTENT_THRESHOLDS.priceHoverCount)
      )
    );
  const researchReadyRaw =
    activeResearch &&
    (
      (
        recentResearchSignal >= LIVE_INTENT_THRESHOLDS.researchRecencyRiseThreshold &&
        recentDecisionSignal <= LIVE_INTENT_THRESHOLDS.commerceRecencyDropThreshold
      ) ||
      activeSectionAgeMs >= LIVE_INTENT_THRESHOLDS.researchSectionDwellMs ||
      researchDwellMs >= LIVE_INTENT_THRESHOLDS.researchClusterDwellMs ||
      infoZoneDwellSec >= LIVE_INTENT_THRESHOLDS.researchInfoZoneDwellSec
    );
  const frustrationReadyRaw =
    recentRageCount >= LIVE_INTENT_THRESHOLDS.rageClicksForFrustration ||
    recentDeadClickCount >= LIVE_INTENT_THRESHOLDS.deadClicksForFrustration ||
    recentFrictionEventCount >= LIVE_INTENT_THRESHOLDS.frictionEventsForFrustration;
  const sustainedOverloadSignal =
    hesitationScore >= LIVE_INTENT_THRESHOLDS.overwhelmedHesitationScore ||
    frictionScore >= LIVE_INTENT_THRESHOLDS.overwhelmedDerivedFrictionScore ||
    recentFrictionSignal >= LIVE_INTENT_THRESHOLDS.overwhelmedFrictionSignal ||
    recentDeadClickCount >= LIVE_INTENT_THRESHOLDS.deadClicksForFrustration ||
    recentRageCount >= 1;
  const researchOverloadGuard =
    researchReadyRaw &&
    hesitationScore < LIVE_INTENT_THRESHOLDS.overwhelmedResearchHesitationScore &&
    frictionScore < LIVE_INTENT_THRESHOLDS.overwhelmedResearchFrictionScore &&
    recentDeadClickCount < LIVE_INTENT_THRESHOLDS.deadClicksForFrustration &&
    recentRageCount === 0;
  const overwhelmedReadyRaw =
    !activeOverview &&
    !decisionReadyRaw &&
    pageDensity >= 1 &&
    sectionSwitches >= LIVE_INTENT_THRESHOLDS.overwhelmedSwitchCount &&
    visitedCount >= LIVE_INTENT_THRESHOLDS.overwhelmedResearchVisits &&
    sustainedOverloadSignal &&
    !researchOverloadGuard;

  const exploringReadyRaw =
    activeOverview &&
    sessionDurationSec >= LIVE_INTENT_THRESHOLDS.exploreMinSessionSec &&
    !decisionReadyRaw &&
    !researchReadyRaw &&
    !priceReadyRaw &&
    !frustrationReadyRaw &&
    !overwhelmedReadyRaw &&
    (
      scrolledPercentage >= LIVE_INTENT_THRESHOLDS.exploreOverviewScroll ||
      visitedCount >= LIVE_INTENT_THRESHOLDS.exploreOverviewVisits
    );

  const observeReadyRaw =
    activeOverview &&
    activeSectionAgeMs >= LIVE_INTENT_THRESHOLDS.observeOverviewDwellMs &&
    !exploringReadyRaw &&
    !researchReadyRaw &&
    !priceReadyRaw &&
    !decisionReadyRaw &&
    !frustrationReadyRaw &&
    !overwhelmedReadyRaw;

  return {
    zone: zoneInfo.zone,
    zone_cluster: zoneInfo.cluster,
    zone_label: zoneInfo.label,
    active_section: zoneInfo.activeSection || "none",
    active_section_age_ms: activeSectionAgeMs,
    favorite_count: recentWishlistCount,
    add_to_cart_count: recentAddToCartCount,
    buy_now_count: recentCheckoutCount,
    price_hover_count: priceHoverCount,
    time_on_price_ms: timeOnPriceMs,
    research_dwell_ms: researchDwellMs,
    info_zone_dwell_sec: infoZoneDwellSec,
    rage_count: recentRageCount,
    dead_click_count: recentDeadClickCount,
    friction_event_count: recentFrictionEventCount,
    section_switches: sectionSwitches,
    scroll_reversals: scrollReversals,
    visited_count: visitedCount,
    session_duration_sec: sessionDurationSec,
    recent_decision_signal: Number(normalized.recentDecisionSignal || 0),
    recent_price_signal: Number(normalized.recentPriceSignal || 0),
    recent_research_signal: Number(normalized.recentResearchSignal || 0),
    recent_friction_signal: Number(normalized.recentFrictionSignal || 0),
    session_commerce_memory_signal: Number(normalized.sessionCommerceMemorySignal || 0),
    purchase_cta_intent_count: purchaseCtaIntentCount,
    scrolled_percentage: scrolledPercentage,
    commerce_dormant: commerceDormant,
    exploring_ready: exploringReadyRaw,
    observe_ready: observeReadyRaw,
    research_ready: researchReadyRaw,
    price_ready: priceReadyRaw,
    decision_ready: decisionReadyRaw,
    frustration_ready: frustrationReadyRaw,
    overwhelmed_ready: overwhelmedReadyRaw,
    recent_signal_snapshot: {
      decision: recentDecisionSignal,
      price: recentPriceSignal,
      research: recentResearchSignal,
      friction: recentFrictionSignal,
      commerce_memory: sessionCommerceMemorySignal
    },
    derived_scores: {
      friction_score: Number(derived.friction_score || 0),
      hesitation_score: Number(derived.hesitation_score || 0),
      research_depth_score: Number(derived.research_depth_score || 0),
      purchase_momentum_score: Number(derived.purchase_momentum_score || 0)
    }
  };
}

function resolveThresholdTieBreak(decision = {}, thresholdSnapshot = {}) {
  const mlState = String(decision.primary_state || decision.state_label || "").toUpperCase();
  const confidence = Number(decision.confidence || 0);
  const cluster = String(thresholdSnapshot.zone_cluster || "");

  if (cluster === "purchase" && mlState === "REASSURANCE_SEEKING" && confidence >= 0.62) {
    return { state: "REASSURANCE_SEEKING", reason: "tie_break_reassurance_purchase" };
  }
  if (cluster === "research" && mlState === "REASSURANCE_SEEKING" && confidence >= 0.65) {
    return { state: "REASSURANCE_SEEKING", reason: "tie_break_reassurance_research" };
  }
  if (cluster === "compare" && confidence >= 0.54) {
    return { state: "EXPLORING", reason: "tie_break_compare_exploring" };
  }
  if (
    (cluster === "overview" || cluster === "variants") &&
    confidence >= 0.56 &&
    Number(thresholdSnapshot.session_duration_sec || 0) >= LIVE_INTENT_THRESHOLDS.exploreTieBreakMinSessionSec &&
    Number(thresholdSnapshot.scrolled_percentage || 0) >= LIVE_INTENT_THRESHOLDS.exploreTieBreakScroll &&
    Number(thresholdSnapshot.recent_research_signal || 0) <= LIVE_INTENT_THRESHOLDS.exploreTieBreakResearchSignalMax
  ) {
    return { state: "EXPLORING", reason: "tie_break_light_exploring" };
  }
  return null;
}

function getCooldownForMode(mode = "STANDARD") {
  const scope = LIVE_ADAPTATIONS[String(mode || "STANDARD")]?.scope || "local";
  return scope === "global" ? LIVE_MVP_MODE_COOLDOWN.globalMs : LIVE_MVP_MODE_COOLDOWN.localMs;
}

function chooseThresholdState(decision = {}, thresholdSnapshot = {}) {
  const currentState = String(lastDecision?.primary_state || "CALM_BROWSING").toUpperCase();
  const currentMode = String(lastDecision?.resolved_mode || "STANDARD").toUpperCase();
  const now = Date.now();
  const lastTransitionTs = Number(lastDecision?.transition_ts || 0);
  const inCooldown = lastTransitionTs > 0 && (now - lastTransitionTs) < getCooldownForMode(currentMode);
  const cluster = String(thresholdSnapshot.zone_cluster || "");
  const recentSignals = thresholdSnapshot.recent_signal_snapshot || {};

  let targetState = currentState;
  let transitionReason = "hold_current_state";

  if (currentState === "DEEP_RESEARCH" && thresholdSnapshot.decision_ready) {
    targetState = "DECISION_READY";
    transitionReason = "exit_research_to_decision";
  } else if (currentState === "DEEP_RESEARCH" && thresholdSnapshot.price_ready && !thresholdSnapshot.research_ready) {
    targetState = "PRICE_SENSITIVE";
    transitionReason = "exit_research_to_price";
  } else if (
    currentState === "DECISION_READY" &&
    thresholdSnapshot.exploring_ready &&
    recentSignals.decision <= LIVE_INTENT_THRESHOLDS.commerceRecencyDropThreshold
  ) {
    targetState = "EXPLORING";
    transitionReason = "exit_decision_to_explore";
  } else if (currentState === "PRICE_SENSITIVE" && thresholdSnapshot.research_ready) {
    targetState = "DEEP_RESEARCH";
    transitionReason = "exit_price_to_research";
  } else if (
    currentState === "DECISION_READY" &&
    thresholdSnapshot.research_ready &&
    recentSignals.decision <= LIVE_INTENT_THRESHOLDS.commerceRecencyDropThreshold &&
    recentSignals.research >= LIVE_INTENT_THRESHOLDS.researchRecencyRiseThreshold
  ) {
    targetState = "DEEP_RESEARCH";
    transitionReason = "exit_decision_to_research";
  } else if (currentState === "FRUSTRATED" && !thresholdSnapshot.frustration_ready) {
    if (thresholdSnapshot.research_ready) {
      targetState = "DEEP_RESEARCH";
      transitionReason = "exit_friction_to_research";
    } else if (thresholdSnapshot.observe_ready) {
      targetState = "CALM_BROWSING";
      transitionReason = "exit_friction_to_observe";
    }
  } else if (thresholdSnapshot.decision_ready) {
    targetState = "DECISION_READY";
    transitionReason = "enter_decision_threshold";
  } else if (thresholdSnapshot.frustration_ready && cluster !== "overview") {
    targetState = "FRUSTRATED";
    transitionReason = "enter_friction_threshold";
  } else if (
    thresholdSnapshot.overwhelmed_ready &&
    !(
      thresholdSnapshot.research_ready &&
      Number(thresholdSnapshot.recent_friction_signal || 0) < 0.4 &&
      Number(thresholdSnapshot.derived_scores?.hesitation_score || 0) < 0.42
    )
  ) {
    targetState = "OVERWHELMED";
    transitionReason = "enter_overwhelmed_threshold";
  } else if (thresholdSnapshot.research_ready) {
    targetState = "DEEP_RESEARCH";
    transitionReason = "enter_research_threshold";
  } else if (thresholdSnapshot.exploring_ready) {
    targetState = "EXPLORING";
    transitionReason = "enter_explore_threshold";
  } else if (thresholdSnapshot.price_ready) {
    targetState = "PRICE_SENSITIVE";
    transitionReason = "enter_price_threshold";
  } else if (thresholdSnapshot.observe_ready) {
    targetState = "CALM_BROWSING";
    transitionReason = "enter_observe_threshold";
  } else {
    const tieBreak = resolveThresholdTieBreak(decision, thresholdSnapshot);
    if (tieBreak) {
      targetState = tieBreak.state;
      transitionReason = tieBreak.reason;
    } else if (cluster === "overview" || cluster === "variants") {
      targetState = "CALM_BROWSING";
      transitionReason = "fallback_overview_idle";
    } else if (cluster === "compare") {
      targetState = "EXPLORING";
      transitionReason = "fallback_compare_idle";
    } else {
      targetState = "CALM_BROWSING";
      transitionReason = "fallback_calm";
    }
  }

  if (targetState !== currentState && inCooldown) {
    return {
      state: currentState,
      transitionReason: "cooldown_hold",
      entryThresholdMet: targetState,
      exitThresholdMet: currentState,
      transitionAllowed: false
    };
  }

  return {
    state: targetState,
    transitionReason,
    entryThresholdMet: targetState !== currentState ? targetState : null,
    exitThresholdMet: targetState !== currentState ? currentState : null,
    transitionAllowed: targetState === currentState ? false : true
  };
}

function buildPresentedDecision(baseDecision = {}, raw = {}, thresholdSnapshot = {}, stateResolution = {}) {
  const stateLabel = String(stateResolution.state || "CALM_BROWSING").toUpperCase();
  const definition = StateContract.getStateDefinition(stateLabel) || {};
  const mode = String(definition.default_mode || "STANDARD");
  const policy = getStatePolicy(stateLabel, thresholdSnapshot.zone_cluster);
  const previousState = String(lastDecision?.primary_state || "");
  const previousMode = String(lastDecision?.resolved_mode || "");
  const confidenceFloor = {
    CALM_BROWSING: 0.42,
    EXPLORING: 0.48,
    DEEP_RESEARCH: 0.66,
    PRICE_SENSITIVE: 0.68,
    REASSURANCE_SEEKING: 0.62,
    DECISION_READY: 0.74,
    FRUSTRATED: 0.72,
    OVERWHELMED: 0.68
  }[stateLabel] || 0.45;
  const transitionReason = String(stateResolution.transitionReason || "threshold_fsm");
  const now = Date.now();
  const transitionTs = stateResolution.transitionAllowed || !lastDecision ? now : Number(lastDecision?.transition_ts || now);
  const winningState =
    (thresholdSnapshot.decision_ready && "DECISION_READY") ||
    (thresholdSnapshot.frustration_ready && "FRUSTRATED") ||
    (thresholdSnapshot.overwhelmed_ready && "OVERWHELMED") ||
    (thresholdSnapshot.research_ready && "DEEP_RESEARCH") ||
    (thresholdSnapshot.exploring_ready && "EXPLORING") ||
    (thresholdSnapshot.price_ready && "PRICE_SENSITIVE") ||
    (thresholdSnapshot.observe_ready && "CALM_BROWSING") ||
    stateLabel;

  return {
    ...baseDecision,
    primary_state: stateLabel,
    state_label: stateLabel,
    affect_tag: definition.affect_tag || definition.emotion_tag || "CALM",
    emotion_tag: definition.affect_tag || definition.emotion_tag || "CALM",
    intent_tag: definition.intent_tag || "EXPLORING",
    constraint_tags: Array.isArray(definition.constraint_tags) ? definition.constraint_tags.slice() : [],
    policy,
    resolved_mode: mode,
    mode,
    mapped_mode: mode,
    intervention_type: definition.default_intervention_type || "none",
    mapped_intervention_type: definition.default_intervention_type || "none",
    resolved_source: transitionReason.startsWith("tie_break") ? "mvp_threshold_fsm+ml_tiebreak" : "mvp_threshold_fsm",
    resolved_rule_id: null,
    resolved_mode_reason: transitionReason,
    presentation_reason: transitionReason,
    transition_reason: transitionReason,
    entry_threshold_met: stateResolution.entryThresholdMet,
    exit_threshold_met: stateResolution.exitThresholdMet,
    threshold_debug: {
      ...thresholdSnapshot,
      winning_primary_state: winningState,
      exact_transition_reason: transitionReason
    },
    zone_cluster: thresholdSnapshot.zone_cluster,
    recent_signal_snapshot: thresholdSnapshot.recent_signal_snapshot,
    confidence: Math.max(Number(baseDecision.confidence || 0), confidenceFloor),
    previous_state: previousState || null,
    previous_mode: previousMode || null,
    state_contract_key: stateLabel,
    state_contract_mode: mode,
    state_contract_intervention: definition.default_intervention_type || "none",
    transition_ts: transitionTs,
    presented_at_ts: now
  };
}

function paceLiveDecision(decision, raw = {}) {
  const thresholdSnapshot = buildThresholdSnapshot(raw, decision);
  const stateResolution = chooseThresholdState(decision, thresholdSnapshot);
  return buildPresentedDecision(decision, raw, thresholdSnapshot, stateResolution);
}

function setActionStatus(message, type = "info") {
  const node = document.getElementById("action-status");
  if (!node) return;
  node.textContent = String(message || "");
  node.style.color = type === "error"
    ? "#fca5a5"
    : type === "success"
      ? "#86efac"
      : "#93a4bf";
}

function buildTimelineEntry({ trigger, raw, pageContext, featurePack, stateClassification, decision }) {
  const focus = resolveVisualFocus(raw, decision);
  return {
    ts: Date.now(),
    trigger,
    primary_state: decision.primary_state || stateClassification.primary_state || stateClassification.label,
    affect_tag: decision.affect_tag || stateClassification.affect_tag || stateClassification.emotion_tag || "CALM",
    intent_tag: decision.intent_tag || stateClassification.intent_tag || "EXPLORING",
    constraint_tags: decision.constraint_tags || stateClassification.constraint_tags || [],
    resolved_mode: decision.resolved_mode || "STANDARD",
    intervention_type: decision.intervention_type || "none",
    policy: decision.policy || "SILENT",
    confidence: Number(decision.confidence || 0),
    resolved_rule_id: decision.resolved_rule_id || null,
    reason_codes: decision.reason_codes || [],
    reason_families: decision.reason_families || [],
    active_section: raw.activeSection || "",
    active_section_age_ms: Number(raw.activeSectionAgeMs || 0),
    visual_zone: focus.zone,
    visual_cluster: focus.cluster,
    zone_cluster: decision.zone_cluster || focus.cluster,
    price_hover: Number(raw.priceHover || 0),
    time_on_price_ms: Number(raw.timeOnPriceMs || 0),
    cart_add_remove: Number(raw.cartAddRemove || 0),
    rage_clicks: Number(raw.rageClicks || 0),
    dead_clicks: Number(raw.deadClicks || 0),
    transition_reason: decision.transition_reason || decision.resolved_mode_reason || "threshold_fsm",
    entry_threshold_met: decision.entry_threshold_met || null,
    exit_threshold_met: decision.exit_threshold_met || null,
    threshold_debug: decision.threshold_debug || null,
    recent_signal_snapshot: decision.recent_signal_snapshot || null,
    derived_scores: decision.derived_scores || featurePack.derived || {},
    context_metrics: decision.context_metrics || featurePack.context || {},
    page_context_hints: pageContext.hints || []
  };
}

function pushTimelineEntry(entry) {
  const previous = sessionTimeline[sessionTimeline.length - 1];
  const sameSnapshot = previous &&
    previous.primary_state === entry.primary_state &&
    previous.resolved_mode === entry.resolved_mode &&
    previous.policy === entry.policy &&
    previous.active_section === entry.active_section &&
    JSON.stringify(previous.reason_codes || []) === JSON.stringify(entry.reason_codes || []);
  if (sameSnapshot) return;
  sessionTimeline.push(entry);
  if (sessionTimeline.length > 180) sessionTimeline = sessionTimeline.slice(-180);
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createOutcomeLogger() {
  return new OutcomeLogger(CONFIG, {
    getResolvedDecision: (decision) => ({
      mode: decision?.resolved_mode || "STANDARD",
      reason: decision?.resolved_mode_reason || decision?.presentation_reason || decision?.reason || "live_mvp",
      source: decision?.resolved_source || "live_mvp",
      rule_id: decision?.resolved_rule_id || null,
      mapper_reasons: Array.isArray(decision?.mapper_reasons) ? decision.mapper_reasons : [],
      intervention_type: decision?.intervention_type || "none"
    }),
    normalizePageContextValue: (pageContext) => pageContext || { summary: {}, metrics: {}, hints: [], coverage: 0 },
    inferFunnelStage: (rawSnapshot) => runtime?.rulesResolver?.inferFunnelStage(rawSnapshot) || "product_view"
  });
}

function buildSessionArtifacts(outcomeReason = "live_mvp_export") {
  if (!lastBundle || !runtime) return null;
  const outcomeLogger = createOutcomeLogger();
  const rawSnapshot = {
    ...lastBundle.rawSnapshot,
    productId: lastBundle.rawSnapshot.productId || LIVE_MVP_PRODUCT_ID,
    product_id: lastBundle.rawSnapshot.productId || LIVE_MVP_PRODUCT_ID,
    userType: "demo_user",
    trafficSource: "live_mvp",
    sessionReentryCount: 0,
    visitIndexForProduct: 1
  };
  const payload = outcomeLogger.buildSessionPayload({
    outcomeReason,
    rawSnapshot,
    featurePack: lastBundle.featurePack,
    pageContext: lastBundle.pageContext,
    stateClassification: lastBundle.stateClassification,
    decision: lastBundle.decision,
    lastPdpGate: {
      verdict: "TRACKABLE_PDP",
      score: 1,
      reasons: ["live_mvp_surface"],
      metrics: { host: "live_mvp", path: "demo/live-mvp.html" }
    },
    navigatorUserAgent: navigator.userAgent,
    screenWidth: window.innerWidth
  });
  payload.product_id = LIVE_MVP_PRODUCT_ID;
  payload.outcome_detail.policy.training_run_id = "live_mvp_demo";
  payload.outcome_detail.policy.training_started_at = new Date().toISOString();
  payload.outcome_detail.policy.clean_training_scope = "live_mvp";
  payload.outcome_detail.policy.timeline_length = sessionTimeline.length;
  payload.outcome_detail.policy.live_mvp = true;
  payload.outcome_detail.policy.localized_adaptation = true;
  payload.outcome_detail.policy.visual_focus = visualFocus;
  payload.outcome_detail.policy.zone_cluster = lastBundle.decision.zone_cluster || null;
  payload.outcome_detail.policy.transition_reason = lastBundle.decision.transition_reason || null;
  payload.outcome_detail.policy.entry_threshold_met = lastBundle.decision.entry_threshold_met || null;
  payload.outcome_detail.policy.exit_threshold_met = lastBundle.decision.exit_threshold_met || null;
  payload.outcome_detail.policy.threshold_debug = lastBundle.decision.threshold_debug || null;
  payload.outcome_detail.policy.recent_signal_snapshot = lastBundle.decision.recent_signal_snapshot || null;
  payload.outcome_detail.policy.transition_timeline = sessionTimeline.slice(-60);

  return {
    payload,
    timeline: sessionTimeline,
    lastDecision: lastBundle.decision,
    lastFeaturePack: lastBundle.featurePack,
    lastStateClassification: lastBundle.stateClassification,
    lastPageContext: lastBundle.pageContext,
    rawSnapshot
  };
}

async function sendSessionToSupabase() {
  const artifacts = buildSessionArtifacts("live_mvp_manual_send");
  if (!artifacts) {
    setActionStatus("No live session to send yet.", "error");
    return;
  }

  setActionStatus("Sending session to Supabase...", "info");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "return=minimal"
      },
      body: JSON.stringify(artifacts.payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      setActionStatus(`Supabase failed: ${res.status}`, "error");
      console.warn("Live MVP Supabase insert failed", res.status, errorText);
      return;
    }

    setActionStatus("Session sent to Supabase.", "success");
  } catch (error) {
    setActionStatus("Supabase network error.", "error");
    console.warn("Live MVP Supabase network error", error);
  }
}

function evaluateNow(trigger = "tick") {
  if (!runtime) return;

  const raw = runtime.collector.getRawSnapshot();
  const pageContext = runtime.pageContextExtractor.extract();
  const featurePack = runtime.featureExtractor.extract(raw);
  const baseState = runtime.stateClassifier.classify(raw, featurePack, pageContext, {});
  const reasonAnalysis = runtime.reasonCodeEngine.analyze(raw, featurePack, pageContext, baseState);
  const stateClassification = runtime.stateClassifier.classify(raw, featurePack, pageContext, reasonAnalysis);
  const ruleEvaluation = runtime.rulesResolver.evaluate(raw, featurePack, pageContext, stateClassification);
  const policyDecision = derivePolicy({
    stateClassification,
    featurePack,
    ruleWinner: ruleEvaluation.winner,
    rulesResolver: runtime.rulesResolver
  });
  const mapped = runtime.adaptationMapper.map({
    policy: policyDecision.policy,
    ruleWinner: ruleEvaluation.winner,
    featurePack,
    pageContext,
    stateClassification,
    rawSnapshot: raw,
    confidence: policyDecision.confidence
  });

  const stabilized = runtime.hysteresis.stabilize({
    ...policyDecision,
    ...mapped,
    resolved_mode: mapped.mode,
    resolved_rule_id: ruleEvaluation.winner?.ruleId || null,
    primary_state: stateClassification.primary_state || stateClassification.label,
    state_label: stateClassification.label,
    affect_tag: stateClassification.affect_tag || stateClassification.emotion_tag,
    emotion_tag: stateClassification.affect_tag || stateClassification.emotion_tag,
    intent_tag: stateClassification.intent_tag,
    constraint_tags: stateClassification.constraint_tags || [],
    reason_codes: stateClassification.reason_codes || [],
    reason_families: stateClassification.reason_families || [],
    rule_matches: ruleEvaluation.matched || [],
    derived_scores: featurePack.derived,
    normalized_features: featurePack.normalized,
    context_metrics: featurePack.context,
    page_context: pageContext.summary,
    page_context_hints: pageContext.hints,
    funnel_stage: runtime.rulesResolver.inferFunnelStage(raw),
    pdp_gate_verdict: "TRACKABLE_PDP",
    pdp_gate_score: 1,
    pdp_gate_reasons: ["demo_surface_forced_trackable"],
    raw_snapshot_summary: raw,
    time_since_page_load_ms: Math.max(0, Date.now() - Number(raw.pageStartTs || Date.now())),
    trigger
  });

  const presented = paceLiveDecision(stabilized, raw);

  runtime.collector.registerPolicyDecision({
    policy: presented.policy,
    confidence: presented.confidence
  });

  lastBundle = {
    rawSnapshot: runtime.collector.getRawSnapshot(),
    pageContext,
    featurePack,
    stateClassification,
    decision: presented
  };
  pushTimelineEntry(buildTimelineEntry({
    trigger,
    raw: lastBundle.rawSnapshot,
    pageContext,
    featurePack,
    stateClassification,
    decision: presented
  }));
  lastDecision = presented;
  applyDecision(presented);
  updateSignalPanel(lastBundle.rawSnapshot);
  updateInspector(presented);
}

function scheduleEvaluation(trigger = "event", delayMs = LIVE_MVP_PACING.evaluationDebounceMs) {
  window.clearTimeout(scheduledEvaluationTimer);
  scheduledEvaluationTimer = window.setTimeout(() => {
    scheduledEvaluationTimer = null;
    evaluateNow(trigger);
  }, Math.max(0, Number(delayMs || 0)));
}

function updateSignalPanel(raw) {
  const container = document.getElementById("signal-controls");
  if (!container) return;

  const snapshot = raw || runtime?.collector?.getRawSnapshot() || {};
  container.innerHTML = SIGNAL_ROWS.map((row) => {
    const formatter = row.format || defaultFormat;
    return `
      <div class="signal-row">
        <span class="signal-name">${row.label}</span>
        <span class="signal-value">${formatter(snapshot[row.key])}</span>
      </div>
    `;
  }).join("");
}

function defaultFormat(value) {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) return Number(value).toFixed(2);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value || "0");
}

function updateInspector(decision) {
  const focus = resolveVisualFocus(decision.raw_snapshot_summary || {}, decision);
  document.getElementById("inspector-state").textContent = decision.primary_state || "CALM_BROWSING";
  document.getElementById("inspector-desc").textContent = `${decision.policy || "SILENT"} · ${decision.resolved_mode || "STANDARD"} · ${focus.label}`;
  document.getElementById("inspector-confidence-val").textContent = `${Math.round(Number(decision.confidence || 0) * 100)}%`;
  document.getElementById("inspector-confidence-bar").style.width = `${Math.round(Number(decision.confidence || 0) * 100)}%`;

  const matchesList = document.getElementById("inspector-matches-list");
  const stateScores = Object.entries(decision.scores || decision.state_scores || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 6);

  matchesList.innerHTML = stateScores.map(([key, value]) => `
    <div class="match-item">
      <span class="match-rule">${key}</span>
      <span class="match-weight">${Math.round(Number(value || 0) * 100)}%</span>
    </div>
  `).join("") || '<div style="color:#9ca3af;font-size:12px;">No state scores</div>';

  const rulesList = document.getElementById("inspector-rules-list");
  const ruleMatches = Array.isArray(decision.rule_matches) ? decision.rule_matches : [];
  const reasonCodes = Array.isArray(decision.reason_codes) ? decision.reason_codes : [];
  const winnerRule = decision.resolved_rule_id || "state_mapper";

  rulesList.innerHTML = [
    `
      <div class="rule-item">
        <div class="rule-header">
          <span class="rule-id">Winner</span>
          <span class="rule-status rule-active">${winnerRule}</span>
        </div>
        <div class="rule-state">${decision.hysteresis_reason || "steady_state"}</div>
      </div>
    `,
    ...ruleMatches.slice(0, 4).map((match) => `
      <div class="rule-item">
        <div class="rule-header">
          <span class="rule-id">${match.ruleId}</span>
          <span class="rule-status ${match.ruleId === decision.resolved_rule_id ? "rule-active" : "rule-inactive"}">
            ${Math.round(Number(match.weight || 0) * 100)}%
          </span>
        </div>
        <div class="rule-state">${match.reason || match.mode || "matched"}</div>
      </div>
    `),
    `
      <div class="rule-item">
        <div class="rule-header">
          <span class="rule-id">Transition</span>
          <span class="rule-status rule-active">${decision.transition_reason || "threshold_fsm"}</span>
        </div>
        <div class="rule-state">${decision.zone_cluster || focus.cluster} · ${decision.entry_threshold_met || "hold"}${decision.exit_threshold_met ? ` · exit ${decision.exit_threshold_met}` : ""}</div>
      </div>
    `,
    `
      <div class="rule-item">
        <div class="rule-header">
          <span class="rule-id">Reason codes</span>
          <span class="rule-status rule-inactive">${reasonCodes.length || 0}</span>
        </div>
        <div class="rule-state">${reasonCodes.join(", ") || "none"}</div>
      </div>
    `
  ].join("");

  const thresholdRoot = document.getElementById("inspector-thresholds");
  if (thresholdRoot) {
    const debug = decision.threshold_debug || {};
    const rawMetrics = [
      ["favorite", debug.favorite_count],
      ["add_to_cart", debug.add_to_cart_count],
      ["buy_now", debug.buy_now_count],
      ["price_hover", debug.price_hover_count],
      ["time_on_price", `${Math.round(Number(debug.time_on_price_ms || 0) / 1000)}s`],
      ["research_dwell", `${Math.round(Number(debug.research_dwell_ms || 0) / 1000)}s`],
      ["rage", debug.rage_count],
      ["dead_clicks", debug.dead_click_count],
      ["friction", debug.friction_event_count]
    ];
    const booleans = [
      ["observe_ready", debug.observe_ready],
      ["research_ready", debug.research_ready],
      ["price_ready", debug.price_ready],
      ["decision_ready", debug.decision_ready],
      ["frustration_ready", debug.frustration_ready],
      ["overwhelmed_ready", debug.overwhelmed_ready]
    ];
    thresholdRoot.innerHTML = `
      <div class="threshold-summary">
        <div class="threshold-pill"><strong>Zone</strong><span>${decision.zone_cluster || focus.cluster || "none"}</span></div>
        <div class="threshold-pill"><strong>Winner</strong><span>${debug.winning_primary_state || decision.primary_state || "none"}</span></div>
        <div class="threshold-pill"><strong>Reason</strong><span>${debug.exact_transition_reason || decision.transition_reason || "threshold_fsm"}</span></div>
      </div>
      <div class="threshold-grid">
        ${rawMetrics.map(([label, value]) => `
          <div class="threshold-metric">
            <span>${label}</span>
            <strong>${value ?? 0}</strong>
          </div>
        `).join("")}
      </div>
      <div class="threshold-bool-grid">
        ${booleans.map(([label, value]) => `
          <div class="threshold-bool ${value ? "is-true" : "is-false"}">
            <span>${label}</span>
            <strong>${value ? "true" : "false"}</strong>
          </div>
        `).join("")}
      </div>
    `;
  }

  document.getElementById("inspector-json").textContent = JSON.stringify({
    primary_state: decision.primary_state,
    affect_tag: decision.affect_tag,
    intent_tag: decision.intent_tag,
    constraint_tags: decision.constraint_tags,
    resolved_mode: decision.resolved_mode,
    intervention_type: decision.intervention_type,
    policy: decision.policy,
    resolved_rule_id: decision.resolved_rule_id,
    zone_cluster: decision.zone_cluster,
    transition_reason: decision.transition_reason,
    entry_threshold_met: decision.entry_threshold_met,
    exit_threshold_met: decision.exit_threshold_met,
    reason_codes: decision.reason_codes,
    reason_families: decision.reason_families,
    threshold_debug: decision.threshold_debug,
    recent_signal_snapshot: decision.recent_signal_snapshot,
    visual_focus: focus,
    funnel_stage: decision.funnel_stage,
    page_context: decision.page_context,
    page_context_hints: decision.page_context_hints,
    context_metrics: decision.context_metrics,
    derived_scores: decision.derived_scores
  }, null, 2);
}

function injectPricePass(runtimeRef, { hovers = 3, hoverMs = 7000, wishlist = false } = {}) {
  runtimeRef.collector.raw.priceHover += hovers;
  runtimeRef.collector.raw.timeOnPriceMs += hoverMs;
  runtimeRef.collector.pushEvent("price_hover", { source: "scenario" });
  runtimeRef.collector.pushEvent("price_interaction_click", { source: "scenario" });
  if (wishlist) {
    runtimeRef.collector.raw.outcomes.added_to_wishlist = true;
    runtimeRef.collector.pushEvent("wishlist_toggle", { source: "scenario" });
  }
}

function injectFrictionBurst(runtimeRef, { rage = 2, dead = 2, jitter = 2, reversals = 4 } = {}) {
  runtimeRef.collector.raw.rageClicks += rage;
  runtimeRef.collector.raw.deadClicks += dead;
  runtimeRef.collector.raw.mouseJitter = Math.max(runtimeRef.collector.raw.mouseJitter, jitter * 2);
  runtimeRef.collector.raw.scrollReversals += reversals;
  runtimeRef.collector.raw.scrollEvents += Math.max(reversals * 4, 8);
  for (let index = 0; index < rage; index += 1) runtimeRef.collector.pushEvent("rage_click", { source: "scenario" });
  for (let index = 0; index < dead; index += 1) runtimeRef.collector.pushEvent("dead_click", { source: "scenario" });
  for (let index = 0; index < jitter; index += 1) runtimeRef.collector.pushEvent("mouse_jitter", { source: "scenario" });
  runtimeRef.collector.pushEvent("scroll_reversal", { source: "scenario" });
}

function applyScenario(name) {
  const scenario = SCENARIOS[name];
  if (!scenario || !runtime) return;
  resetAll();
  scenario(runtime);
  setVisualFocus(SCENARIO_FOCUS[name] || "description", `scenario:${name}`);
  evaluateNow(`scenario:${name}`);
}

function bindScenarioButtons() {
  document.querySelectorAll(".scenario-btn").forEach((button) => {
    button.addEventListener("click", () => applyScenario(button.dataset.scenario));
  });
}

function attachProductHelpers() {
  const favorite = document.getElementById("favorite-toggle");
  const addToCart = document.getElementById("add-to-cart");
  const checkout = document.getElementById("buy-now");
  const chips = Array.from(document.querySelectorAll(".variant-chip"));
  const thumbs = Array.from(document.querySelectorAll(".thumb"));
  const galleryPreview = document.getElementById("gallery-preview");
  const priceBlock = document.querySelector(".product-price");
  const overviewSurface = document.querySelector(".product-main");
  const sectionSurfaces = Array.from(document.querySelectorAll("[data-section-surface]"));
  const purchaseCard = document.querySelector(".purchase-card");
  const comparisonCards = Array.from(document.querySelectorAll(".comparison-card"));
  const supportingZones = Array.from(document.querySelectorAll("[data-adaptive-zone='benefits'], [data-adaptive-zone='services']"));
  sectionButtons = Array.from(document.querySelectorAll("[data-section]"));

  const activateSectionButton = (nextSection) => {
    sectionButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.section === nextSection);
    });
  };

  favorite?.addEventListener("click", () => {
    setVisualFocus("purchase", "favorite_click");
    runtime.collector.pushEvent("purchase_focus", { source: "live_mvp", target: "favorite" });
    runtime.collector.raw.outcomes.added_to_wishlist = true;
    runtime.collector.pushEvent("wishlist_toggle", { source: "live_mvp" });
    scheduleEvaluation("favorite_click", 450);
  });

  addToCart?.addEventListener("click", () => {
    setVisualFocus("purchase", "add_to_cart_click");
    runtime.collector.pushEvent("purchase_focus", { source: "live_mvp", target: "add_to_cart" });
    runtime.collector.raw.cartAddRemove += 1;
    runtime.collector.raw.outcomes.added_to_cart = true;
    runtime.collector.pushEvent("add_to_cart", { source: "live_mvp" });
    scheduleEvaluation("add_to_cart_click", 350);
  });

  checkout?.addEventListener("click", () => {
    setVisualFocus("purchase", "checkout_click");
    runtime.collector.pushEvent("purchase_focus", { source: "live_mvp", target: "checkout" });
    runtime.collector.raw.cartAddRemove += 1;
    runtime.collector.raw.outcomes.checkout_started = true;
    runtime.collector.raw.directCheckout = true;
    runtime.collector.pushEvent("checkout_started", { source: "live_mvp" });
    scheduleEvaluation("checkout_click", 300);
  });

  priceBlock?.addEventListener("mouseenter", () => {
    if (visualFocus.zone === "compare") return; // price glance while comparing is compare behavior, not price anxiety
    setVisualFocus("purchase", "price_hover");
    priceHoverStartTs = Date.now();
  });

  priceBlock?.addEventListener("mouseleave", () => {
    if (!priceHoverStartTs) return;
    const durationMs = Math.max(0, Date.now() - priceHoverStartTs);
    priceHoverStartTs = 0;
    if (durationMs < LIVE_MVP_PACING.manualPriceHoverMs) return;
    runtime.collector.raw.priceHover += 1;
    runtime.collector.raw.timeOnPriceMs += durationMs;
    runtime.collector.pushEvent("price_hover", { source: "live_mvp_manual", durationMs });
    scheduleEvaluation("price_hover_manual", 650);
  });

  priceBlock?.addEventListener("click", () => {
    if (visualFocus.zone === "compare") {
      // clicking price while comparing is a compare-zone action, not a standalone price signal
      runtime.collector.pushEvent("compare_price_check", { source: "live_mvp", from_zone: "compare" });
      scheduleEvaluation("compare_price_check", 500);
      return;
    }
    setVisualFocus("purchase", "price_block_click");
    runtime.collector.pushEvent("purchase_focus", { source: "live_mvp", target: "price_block" });
    runtime.collector.raw.timeOnPriceMs += 800;
    runtime.collector.pushEvent("price_interaction_click", { source: "live_mvp" });
    scheduleEvaluation("price_block_click", 500);
  });

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      setVisualFocus("variants", "variant_click");
      chips.forEach((item) => item.classList.remove("is-active"));
      chip.classList.add("is-active");
      runtime.collector.pushEvent("variant_select", { label: chip.textContent.trim() });
      scheduleEvaluation("variant_click", 700);
    });
  });

  thumbs.forEach((thumb) => {
    thumb.addEventListener("click", () => {
      setVisualFocus("overview", "gallery_click");
      thumbs.forEach((item) => item.classList.remove("is-active"));
      thumb.classList.add("is-active");
      if (galleryPreview) {
        galleryPreview.textContent = String(thumb.dataset.galleryFrame || thumb.textContent || "🖥️").trim();
      }
      runtime.collector.raw.sectionVisits.gallery += 1;
      runtime.collector.switchSection("gallery", "click");
      runtime.collector.pushEvent("gallery_browse", {
        source: "live_mvp",
        frame: String(thumb.dataset.galleryFrame || thumb.textContent || "").trim()
      });
    });
  });

  sectionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextSection = String(button.dataset.section || "");
      const target = document.querySelector(`[data-section-surface="${nextSection}"]`);
      if (nextSection) {
        setVisualFocus("research", "section_click");
        runtime.collector.switchSection(nextSection, "click");
        activateSectionButton(nextSection);
      }
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      scheduleEvaluation(`section_shortcut:${nextSection || "unknown"}`, 1200);
    });
  });

  sectionSurfaces.forEach((surface) => {
    surface.addEventListener("mouseenter", () => {
      const nextSection = String(surface.getAttribute("data-section-surface") || "");
      if (!nextSection) return;
      setVisualFocus("research", "section_hover");
      window.clearTimeout(sectionHoverTimer);
      sectionHoverTimer = window.setTimeout(() => {
        activateSectionButton(nextSection);
      }, LIVE_MVP_PACING.sectionHoverDelayMs);
      armZoneDwell(() => {
        setVisualFocus("research", "section_dwell");
        runtime.collector.switchSection(nextSection, "dwell");
        runtime.collector.pushEvent("section_focus", { source: "live_mvp_dwell", section: nextSection });
        activateSectionButton(nextSection);
        scheduleEvaluation(`section_dwell:${nextSection}`, 900);
      }, LIVE_MVP_PACING.zoneDwellDelayMs);
    });
    surface.addEventListener("mouseleave", () => {
      window.clearTimeout(sectionHoverTimer);
      sectionHoverTimer = null;
      clearZoneDwellTimer();
    });
  });

  purchaseCard?.addEventListener("mouseenter", () => {
    setVisualFocus("purchase", "purchase_hover");
    armZoneDwell(() => {
      setVisualFocus("purchase", "purchase_dwell");
      runtime.collector.pushEvent("purchase_focus", { source: "live_mvp_dwell", target: "purchase_card" });
      scheduleEvaluation("purchase_dwell", 750);
    }, LIVE_MVP_PACING.purchaseDwellDelayMs);
  });
  purchaseCard?.addEventListener("mouseleave", () => clearZoneDwellTimer());

  overviewSurface?.addEventListener("mouseenter", () => {
    setVisualFocus("overview", "overview_hover");
    armZoneDwell(() => {
      setVisualFocus("overview", "overview_dwell");
      runtime.collector.switchSection("gallery", "dwell");
      runtime.collector.pushEvent("overview_focus", { source: "live_mvp_dwell" });
      runtime.collector.pushEvent("gallery_browse", { source: "live_mvp_dwell", frame: "overview" });
      scheduleEvaluation("overview_dwell", 950);
    }, LIVE_MVP_PACING.overviewDwellDelayMs);
  });
  overviewSurface?.addEventListener("mouseleave", () => clearZoneDwellTimer());
  comparisonCards.forEach((card) => {
    card.addEventListener("mouseenter", () => {
      setVisualFocus("compare", "compare_hover");
      armZoneDwell(() => {
        setVisualFocus("compare", "compare_dwell");
        runtime.collector.pushEvent("compare_view", { source: "live_mvp_dwell" });
        scheduleEvaluation("compare_dwell", 800);
      }, LIVE_MVP_PACING.compareDwellDelayMs);
    });
    card.addEventListener("mouseleave", () => clearZoneDwellTimer());
    card.addEventListener("click", () => {
      setVisualFocus("compare", "compare_click");
      runtime.collector.pushEvent("compare_view", { source: "live_mvp" });
      runtime.collector.pushEvent("compare_price_check", { source: "live_mvp" });
      scheduleEvaluation("compare_click", 650);
    });
  });
  supportingZones.forEach((zone) => {
    zone.addEventListener("mouseenter", () => {
      setVisualFocus(String(zone.getAttribute("data-adaptive-zone") || ""), "support_hover");
    });
  });
}

function resetAll() {
  if (evaluationTimer) {
    window.clearInterval(evaluationTimer);
    evaluationTimer = null;
  }
  window.clearTimeout(scheduledEvaluationTimer);
  scheduledEvaluationTimer = null;
  if (runtime?.collector) {
    runtime.collector.stop();
  }
  window.clearTimeout(sectionHoverTimer);
  sectionHoverTimer = null;
  clearZoneDwellTimer();
  priceHoverStartTs = 0;
  lastBundle = null;
  sessionTimeline = [];
  setActionStatus("Session reset.", "info");
  tokens.reset();
  layout.reset();
  ur.hide();
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });

  runtime = createRuntime();
  runtime.hysteresis.reset();
  runtime.collector.start({
    onInactivity: () => evaluateNow("inactivity")
  });
  setVisualFocus("overview", "reset");
  runtime.collector.switchSection("gallery", "init");

  updateSignalPanel(runtime.collector.getRawSnapshot());
  evaluationTimer = window.setInterval(
    () => evaluateNow("tick"),
    Math.max(LIVE_MVP_PACING.tickIntervalMs, Number(CONFIG.collector?.decisionTickMs || 3000))
  );
  evaluateNow("reset");
}

function initUrWidget() {
  ur.init({
    onReset: () => resetAll(),
    onDetails: () => {
      if (lastDecision) {
        console.group("Adaptive State Live MVP");
        console.log("Decision", lastDecision);
        console.groupEnd();
      }
    }
  });
}

function init() {
  tokens = new DesignTokens();
  layout = new AdaptiveLayout(document.getElementById("product-page"));
  ur = new URWidget();

  tokens.apply("STANDARD");
  initUrWidget();
  bindScenarioButtons();
  attachProductHelpers();
  document.getElementById("reset-all")?.addEventListener("click", () => resetAll());
  document.getElementById("export-session")?.addEventListener("click", () => {
    const artifacts = buildSessionArtifacts("live_mvp_export");
    if (!artifacts) {
      setActionStatus("No live session to export yet.", "error");
      return;
    }
    downloadJson(`live-mvp-session-${artifacts.payload.session_id || Date.now()}.json`, artifacts.payload);
    setActionStatus("Session JSON exported.", "success");
  });
  document.getElementById("export-timeline")?.addEventListener("click", () => {
    const artifacts = buildSessionArtifacts("live_mvp_export");
    if (!artifacts) {
      setActionStatus("No timeline to export yet.", "error");
      return;
    }
    downloadJson(`live-mvp-timeline-${artifacts.payload.session_id || Date.now()}.json`, {
      session_id: artifacts.payload.session_id,
      product_id: artifacts.payload.product_id,
      timeline: artifacts.timeline
    });
    setActionStatus("Timeline JSON exported.", "success");
  });
  document.getElementById("send-supabase")?.addEventListener("click", () => {
    sendSessionToSupabase().catch((error) => {
      setActionStatus("Supabase send failed.", "error");
      console.warn("Live MVP sendSessionToSupabase failed", error);
    });
  });
  resetAll();
}

init();
