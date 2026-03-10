(() => {
  const SECTION_KEYS = ["gallery", "description", "specs", "reviews", "faq"];

  class DataCollector {
    constructor(config = {}) {
      this.config = {
        inactivityTimeoutMs: 30000,
        rageWindowMs: 1000,
        rageMinClicks: 3,
        rageMaxDistancePx: 80,
        rageCooldownMs: 1400,
        rageMaxPerSession: 14,
        jitterWindowMs: 500,
        jitterThresholdPx: 50,
        jitterMinGapMs: 450,
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
        reviewRewardDwellMs: 10000,
        ...config
      };

      this.controller = null;
      this.inactivityTimer = null;
      this.clickLog = [];
      this.mouseTrail = [];
      this.lastScrollY = window.scrollY;
      this.lastScrollDirection = "";
      this.lastRageTs = 0;
      this.lastJitterTs = 0;
      this.lastSectionSwitchTs = 0;
      this.pendingViewportSection = "";
      this.pendingViewportHits = 0;
      this.lastPolicyHistoryTs = 0;
      this.lastPolicyHistoryValue = "SILENT";
      this.activeSection = "";
      this.activeSectionStartTs = 0;
      this.activeHoverKey = "";
      this.activeHoverStartTs = 0;
      this.activeHoverIsPrice = false;
      this.activeHoverDwellFired = false;
      this.hoverTimer = null;
      this.primaryPriceAnchor = null;
      this.lastPriceAnchorTs = 0;
      this.lastDeadClickTs = 0;

      this.raw = this.createInitialState();
    }

    createInitialState() {
      const now = Date.now();
      const sectionDwellMs = {};
      const sectionVisits = {};
      for (const key of SECTION_KEYS) {
        sectionDwellMs[key] = 0;
        sectionVisits[key] = 0;
      }

      return {
        sessionId: `emo_ext_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        pageStartTs: now,
        host: window.location.hostname,
        site: window.location.hostname.replace(/^www\./, ""),
        productId: this.extractProductId(),
        clicks: 0,
        rageClicks: 0,
        mouseJitter: 0,
        exitIntent: 0,
        dwellEvents: 0,
        deadClicks: 0,
        scrollEvents: 0,
        scrollReversals: 0,
        maxScrollY: window.scrollY,
        maxScrollPercentage: 0,
        cartAddRemove: 0,
        priceHover: 0,
        timeOnPriceMs: 0,
        directCheckout: /checkout|payment|order/i.test(window.location.pathname || ""),
        totalVisits: 1,
        cartAbandons: 0,
        sectionSwitches: 0,
        sectionVisits,
        sectionDwellMs,
        clickTargets: {},
        hoverTargets: {},
        hoverDurationByTargetMs: {},
        eventLog: [],
        outcomes: {
          added_to_wishlist: false,
          added_to_cart: false,
          checkout_started: false,
          purchase_completed: this.detectPurchaseCompletionPath(),
          intervention_closed: false,
          intervention_accepted: false,
          intervention_exposed: false,
          review_dwell_over_10s: false
        },
        policy: {
          latest: "SILENT",
          history: []
        },
        extensionUi: {
          filteredEvents: 0,
          clickCount: 0,
          hoverCount: 0,
          lastEventType: ""
        }
      };
    }

    extractProductId() {
      const path = window.location.pathname.split("/").filter(Boolean);
      const slug = path[path.length - 1] || "";
      if (slug && /[a-z0-9]/i.test(slug) && slug.length > 3) return slug.slice(0, 120);

      const title = (document.title || "").trim().toLowerCase();
      return title
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-_]/g, "")
        .slice(0, 120) || "unknown";
    }

    normalizeText(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/[ăâ]/g, "a")
        .replace(/[î]/g, "i")
        .replace(/[șş]/g, "s")
        .replace(/[țţ]/g, "t");
    }

    detectPurchaseCompletionPath() {
      const path = this.normalizeText(`${window.location.pathname || ""} ${(window.location.search || "")}`);
      return /(thank[-_ ]?you|order[-_ ]?(confirm|success|complete)|checkout[-_/](success|complete)|payment[-_/](success|complete)|comanda[-_/](confirmata|plasata)|receipt)/.test(path);
    }

    detectSectionFromElement(el) {
      if (!(el instanceof Element)) return "";

      if (el.closest("img, video, picture, [class*='gallery'], [class*='thumbnail'], [class*='carousel'], [data-gallery]")) {
        return "gallery";
      }

      const textBlob = this.normalizeText([
        el.textContent,
        el.getAttribute("aria-label"),
        el.getAttribute("role"),
        el.id,
        el.className
      ].join(" "));

      if (/review|recenzii|rating|opinii/.test(textBlob)) return "reviews";
      if (/spec|specificatii|technical|detalii tehnice/.test(textBlob)) return "specs";
      if (/faq|intrebari|q&a|question/.test(textBlob)) return "faq";
      if (/descriere|description|overview|detalii/.test(textBlob)) return "description";
      return "";
    }

    detectSectionFromViewport() {
      const points = [0.35, 0.55, 0.75].map((ratio) => {
        return [window.innerWidth * 0.5, window.innerHeight * ratio];
      });

      for (const [x, y] of points) {
        const el = document.elementFromPoint(Math.round(x), Math.round(y));
        const section = this.detectSectionFromElement(el);
        if (section) return section;
      }
      return "";
    }

    detectPrimaryElement(el, options = {}) {
      if (!(el instanceof Element)) return null;
      if (this.isEmotionUiNode(el)) return null;
      const forHover = Boolean(options.forHover);
      const candidate = el.closest(
        "button, a, input, select, textarea, label, [role='button'], [onclick], [data-action], [data-emotion-track], [data-price], [itemprop='price'], [data-testid], [data-test], [aria-label], [title]"
      );
      if (candidate) return candidate;
      if (forHover) {
        if (this.isInteractiveTarget(el) || this.isPriceElement(el)) return el;
        return null;
      }
      return el;
    }

    hasIntentKeyword(blob) {
      return /(price|pret|cost|discount|reducere|oferta|wishlist|favorite|favourite|cart|cos|checkout|buy|cumpara|comanda|review|recenzii|rating|spec|specificatii|faq|intrebari|description|descriere)/.test(blob);
    }

    isRelatedProductContainer(el) {
      if (!(el instanceof Element)) return false;
      return Boolean(el.closest(
        // Romanian e-commerce related/recommended product carousels
        '[class*="colectie"], [class*="recomandat"], [class*="similar"], [class*="asociat"], ' +
        '[class*="aceeasi"], ' +
        // Generic related/recommend containers
        '[class*="related"], [class*="recommend"], [class*="also-bought"], [class*="also-viewed"], ' +
        '[class*="cross-sell"], [class*="upsell"], [class*="frequently-bought"], ' +
        '[data-section*="related"], [data-widget*="related"], [data-component*="related"], ' +
        // Amazon carousels and similarity sections
        '[class*="a-carousel"], [id*="similarities"], [id*="also-viewed"], ' +
        // Generic multi-product grids (only skip commerce intent from hover here, not clicks)
        '[class*="product-list"], [class*="product-grid"], [class*="item-list"]'
      ));
    }

    shouldTrackTarget(node, options = {}) {
      if (!(node instanceof Element)) return false;
      if (this.isEmotionUiNode(node)) return false;
      const forHover = Boolean(options.forHover);
      const tag = String(node.tagName || "").toLowerCase();
      const text = this.normalizeText(node.textContent || "");
      const aria = this.normalizeText(node.getAttribute("aria-label"));
      const title = this.normalizeText(node.getAttribute("title"));
      const id = this.normalizeText(node.id);
      const className = this.normalizeText(String(node.className || "").split(/\s+/).slice(0, 2).join("."));
      const token = aria || title || id || text.slice(0, 42) || className;

      if (!token) return false;
      if (token.length < 2) return false;

      const interactive = this.isInteractiveTarget(node);
      const priceNode = this.isPriceElement(node);
      const meaningful = this.hasIntentKeyword(`${token} ${className}`);
      const genericTag = tag === "div" || tag === "span" || tag === "p";

      if (forHover) {
        if (genericTag && !interactive && !priceNode && !meaningful) return false;
        if (!interactive && !priceNode && !meaningful && text.length > 40) return false;
      }

      return true;
    }

    describeTarget(el, options = {}) {
      const node = this.detectPrimaryElement(el, options);
      if (!node) return "";
      if (!this.shouldTrackTarget(node, options)) return "";

      const tag = String(node.tagName || "node").toLowerCase();
      const aria = this.normalizeText(node.getAttribute("aria-label"));
      const id = this.normalizeText(node.id);
      const title = this.normalizeText(node.getAttribute("title"));
      const value = this.normalizeText(node.getAttribute("value"));
      const text = this.normalizeText(node.textContent || "").slice(0, 36);
      const className = this.normalizeText(String(node.className || "").split(/\s+/).slice(0, 2).join("."));
      const token = aria || title || value || text || id || className || "";
      if (!token) return "";
      return `${tag}:${token}`.slice(0, 120);
    }

    incrementMapValue(map, key, delta = 1, maxBuckets = this.config.maxTargetBuckets) {
      if (!map || typeof map !== "object") return;
      if (!key) return;
      if (!(key in map) && Object.keys(map).length >= maxBuckets) return;
      map[key] = Number(map[key] || 0) + Number(delta || 0);
    }

    extractTargetText(el) {
      if (!(el instanceof Element)) return "";
      if (this.isEmotionUiNode(el)) return "";
      return this.normalizeText([
        el.textContent,
        el.getAttribute("aria-label"),
        el.getAttribute("title"),
        el.getAttribute("value"),
        el.id,
        el.className
      ].join(" "));
    }

    isInteractiveTarget(el) {
      if (!(el instanceof Element)) return false;
      if (this.isEmotionUiNode(el)) return false;
      if (el.closest("a, button, input, select, textarea, label, [role='button'], [onclick], [data-action], [data-testid*='cta'], [class*='btn'], [class*='button']")) {
        return true;
      }
      const styleCursor = window.getComputedStyle(el).cursor;
      return styleCursor === "pointer";
    }

    isEmotionUiNode(el) {
      if (!(el instanceof Element)) return false;
      return Boolean(el.closest(
        "#emotionui-policy-overlay, #emotionui-page-assist-root, #emotionui-live-panel, [id^='emotionui-'], [data-emotionui-highlight], .emo-policy-cta, .emo-policy-close, .emo-assist-actions"
      ));
    }

    isCommerceIntentTarget(el) {
      if (!(el instanceof Element)) return false;
      if (this.isEmotionUiNode(el)) return false;
      const node = this.detectPrimaryElement(el, { forHover: false }) || el;
      if (this.isInteractiveTarget(node)) return true;

      const tag = String(node.tagName || "").toLowerCase();
      const role = this.normalizeText(node.getAttribute("role"));
      const type = this.normalizeText(node.getAttribute("type"));
      const href = this.normalizeText(node.getAttribute("href"));
      const classBlob = this.normalizeText(`${node.id || ""} ${node.className || ""}`);

      return /^(button|a|input|label|summary)$/.test(tag) ||
        /button|link|tab/.test(role) ||
        /button|submit/.test(type) ||
        /checkout|cart|cos|wishlist|favorite|buy|cumpara|comanda|cta/.test(`${href} ${classBlob}`);
    }

    isPriceElement(el) {
      if (!(el instanceof Element)) return false;
      if (el.closest("[data-price], [itemprop='price'], [class*='price'], [id*='price'], [class*='amount'], [class*='cost'], [data-testid*='price'], [data-test*='price']")) {
        return true;
      }
      const blob = this.extractTargetText(el);
      if (/(price|pret|cost|discount|reducere|oferta)/.test(blob)) return true;
      return /(lei|ron|eur|usd|\$|€|£)/.test(blob);
    }

    isLikelyPromoContainer(el) {
      if (!(el instanceof Element)) return false;
      if (el.closest("aside, nav, footer, header")) return true;
      const blob = this.extractTargetText(el.closest("section, article, div, li") || el);
      return /(produse promovate|promoted|sponsored|recommended|related products|similar products|cross sell|upsell)/.test(blob);
    }

    selectPrimaryPriceAnchor() {
      const explicitCandidates = Array.from(document.querySelectorAll(
        "[data-price], [itemprop='price'], [class*='price'], [id*='price'], [class*='amount'], [class*='cost'], [data-testid*='price'], [data-test*='price']"
      ));
      const fallbackCandidates = explicitCandidates.length
        ? []
        : Array.from(document.querySelectorAll("main span, main p, main div, article span, article p, article div"));
      const candidates = (explicitCandidates.length ? explicitCandidates : fallbackCandidates).slice(0, 260);

      let winner = null;
      let bestScore = -Infinity;
      for (const node of candidates) {
        if (!(node instanceof Element)) continue;
        if (!this.isPriceElement(node)) continue;

        const rect = node.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

        const style = window.getComputedStyle(node);
        const fontSize = Number.parseFloat(style.fontSize || "0") || 0;
        const centerX = rect.left + (rect.width / 2);
        const centerDistance = Math.abs(centerX - (window.innerWidth / 2)) / Math.max(1, window.innerWidth / 2);

        let score = 0;
        score += Math.max(0, 1 - centerDistance);
        score += Math.min(2.2, fontSize / 16);
        if (node.closest("main, article, [itemtype*='Product'], [data-product-id], [class*='product-main'], [class*='product-page'], [id*='product']")) {
          score += 2;
        }
        if (this.isLikelyPromoContainer(node)) score -= 3.5;
        if (rect.top >= 0 && rect.top <= (window.innerHeight * 0.75)) score += 0.6;
        if (rect.top > (window.innerHeight * 0.9)) score -= 0.8;

        if (score > bestScore) {
          bestScore = score;
          winner = node;
        }
      }

      return winner;
    }

    getPrimaryPriceAnchor(force = false) {
      const now = Date.now();
      const fresh = this.primaryPriceAnchor && this.primaryPriceAnchor.isConnected && (now - this.lastPriceAnchorTs) < this.config.priceAnchorReselectMs;
      if (!force && fresh) return this.primaryPriceAnchor;
      this.primaryPriceAnchor = this.selectPrimaryPriceAnchor();
      this.lastPriceAnchorTs = now;
      return this.primaryPriceAnchor;
    }

    isPrimaryPriceElement(el) {
      if (!(el instanceof Element)) return false;
      if (!this.isPriceElement(el)) return false;

      const anchor = this.getPrimaryPriceAnchor();
      if (!anchor) return true;
      if (anchor === el || anchor.contains(el) || el.contains(anchor)) return true;

      const anchorCard = anchor.closest("main, article, section, div, li");
      const targetCard = el.closest("main, article, section, div, li");
      if (anchorCard && targetCard && anchorCard === targetCard) return true;

      const a = anchor.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const aCx = a.left + (a.width / 2);
      const aCy = a.top + (a.height / 2);
      const bCx = b.left + (b.width / 2);
      const bCy = b.top + (b.height / 2);
      const distance = Math.hypot(aCx - bCx, aCy - bCy);
      const maxDistance = Math.max(140, Math.max(a.width, a.height) * 1.2);
      return distance <= maxDistance;
    }

    detectCommerceAction(targetEl, textBlob) {
      if (!this.isCommerceIntentTarget(targetEl)) {
        return {
          wishlist: false,
          addToCart: false,
          removeFromCart: false,
          checkout: false,
          purchaseComplete: false
        };
      }
      const text = this.normalizeText(textBlob);
      return {
        wishlist: /(wishlist|favorite|favourite|save|salveaza)/.test(text),
        addToCart: /(add to cart|add to bag|adauga in cos|adaugaincos|in cos|in cosul|in bag)/.test(text),
        removeFromCart: /(remove from cart|remove item|empty cart|sterge din cos|scoate din cos)/.test(text),
        checkout: /(buy now|checkout|proceed to checkout|pay now|place order|cumpara acum|comanda acum|finalizeaza comanda|plaseaza comanda)/.test(text),
        purchaseComplete: /(order complete|multumim pentru comanda|thank you for your order)/.test(text)
      };
    }

    clearActiveHover() {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
      this.activeHoverKey = "";
      this.activeHoverStartTs = 0;
      this.activeHoverIsPrice = false;
      this.activeHoverDwellFired = false;
    }

    registerFilteredEmotionUiEvent(type = "unknown") {
      this.raw.extensionUi.filteredEvents += 1;
      this.raw.extensionUi.lastEventType = String(type || "unknown");
      if (type === "click") this.raw.extensionUi.clickCount += 1;
      if (type === "hover") this.raw.extensionUi.hoverCount += 1;
      this.pushEvent("extension_ui_filtered", { event_type: String(type || "unknown") });
    }

    startHoverTracking(targetEl) {
      const key = this.describeTarget(targetEl, { forHover: true });
      if (!key) return;

      const now = Date.now();
      if (key === this.activeHoverKey) return;

      this.finalizeHoverTracking(now);
      this.activeHoverKey = key;
      this.activeHoverStartTs = now;
      this.activeHoverIsPrice = this.isPrimaryPriceElement(targetEl);
      this.activeHoverDwellFired = false;

      // Only record hover targets (and thus hover-based commerce intent) when NOT inside a
      // related/recommended product container — those sections inflate wishlistIntentCount
      // and ctaIntentCount from passive browsing, not from the user's primary product intent.
      if (!this.isRelatedProductContainer(targetEl)) {
        this.incrementMapValue(this.raw.hoverTargets, key, 1, this.config.maxHoverTargetBuckets);
      }

      this.hoverTimer = setTimeout(() => {
        if (!this.activeHoverKey) return;
        this.raw.dwellEvents += 1;
        this.activeHoverDwellFired = true;
        this.pushEvent("dwell_event", { target: this.activeHoverKey, price: this.activeHoverIsPrice });
        if (this.activeHoverIsPrice) {
          this.raw.priceHover += 1;
          this.pushEvent("price_hover", { target: this.activeHoverKey, source: "dwell_timer" });
        }
      }, this.config.dwellThresholdMs);
    }

    finalizeHoverTracking(now = Date.now()) {
      if (!this.activeHoverKey || !this.activeHoverStartTs) {
        this.clearActiveHover();
        return;
      }

      const durationMs = Math.max(0, now - this.activeHoverStartTs);
      if (durationMs > 0) {
        this.incrementMapValue(this.raw.hoverDurationByTargetMs, this.activeHoverKey, durationMs);
        if (this.activeHoverIsPrice) {
          this.raw.timeOnPriceMs += durationMs;
          if (durationMs >= this.config.priceHoverMinMs && !this.activeHoverDwellFired) {
            this.raw.priceHover += 1;
            this.pushEvent("price_hover", { target: this.activeHoverKey, durationMs });
          }
        }
      }

      this.clearActiveHover();
    }

    sampleActiveHover(now = Date.now()) {
      if (!this.activeHoverKey || !this.activeHoverStartTs) return;
      const durationMs = Math.max(0, now - this.activeHoverStartTs);
      if (!durationMs) return;

      this.incrementMapValue(this.raw.hoverDurationByTargetMs, this.activeHoverKey, durationMs);
      if (this.activeHoverIsPrice) {
        this.raw.timeOnPriceMs += durationMs;
        if (durationMs >= this.config.priceHoverMinMs && !this.activeHoverDwellFired) {
          this.raw.priceHover += 1;
          this.activeHoverDwellFired = true;
          this.pushEvent("price_hover", { target: this.activeHoverKey, durationMs, source: "active_sample" });
        }
      }

      this.activeHoverStartTs = now;
    }

    updateMouseJitter(event) {
      const now = Date.now();

      // Guard A: skip jitter detection on gallery/zoom/magnifier elements — these generate
      // normal high-velocity mouse movement on sites like Dedeman (Fotorama magnifier).
      const target = event.target instanceof Element ? event.target : null;
      if (target) {
        const isNoisyElement = target.closest(
          '[class*="fotorama"], [class*="magnif"], [class*="zoom"], [class*="gallery-thumb"], ' +
          '[class*="carousel"], [class*="slider"], [class*="lightbox"], [data-fotorama], ' +
          '[class*="swiper"], [class*="slick"]'
        );
        if (isNoisyElement) return;
      }

      this.mouseTrail.push({ x: Number(event.clientX || 0), y: Number(event.clientY || 0), ts: now });
      while (this.mouseTrail.length && (now - this.mouseTrail[0].ts) > this.config.jitterWindowMs) {
        this.mouseTrail.shift();
      }

      if (this.mouseTrail.length < 3) return;
      if ((now - this.lastJitterTs) < this.config.jitterMinGapMs) return;

      // Guard B: require at least 2 direction reversals — true jitter is erratic back-and-forth,
      // not smooth linear movement across a dense interactive zone.
      let directionChanges = 0;
      for (let i = 2; i < this.mouseTrail.length; i++) {
        const dx1 = this.mouseTrail[i - 1].x - this.mouseTrail[i - 2].x;
        const dy1 = this.mouseTrail[i - 1].y - this.mouseTrail[i - 2].y;
        const dx2 = this.mouseTrail[i].x - this.mouseTrail[i - 1].x;
        const dy2 = this.mouseTrail[i].y - this.mouseTrail[i - 1].y;
        if ((dx1 * dx2 + dy1 * dy2) < 0) directionChanges++;
      }
      if (directionChanges < 2) return; // linear scan across zones, not erratic jitter

      let totalDist = 0;
      for (let i = 1; i < this.mouseTrail.length; i += 1) {
        const dx = this.mouseTrail[i].x - this.mouseTrail[i - 1].x;
        const dy = this.mouseTrail[i].y - this.mouseTrail[i - 1].y;
        totalDist += Math.sqrt((dx * dx) + (dy * dy));
      }

      const avgSpeed = totalDist / Math.max(0.1, this.config.jitterWindowMs / 1000);
      if (avgSpeed > (this.config.jitterThresholdPx * 10)) {
        this.raw.mouseJitter = Math.min(10, Number(this.raw.mouseJitter || 0) + 0.5);
        this.lastJitterTs = now;
        this.pushEvent("mouse_jitter", { speed: Number(avgSpeed.toFixed(2)) });
      }
    }

    pushEvent(type, data = {}) {
      const log = this.raw.eventLog;
      log.push({ type, ts: Date.now(), ...data });
      if (log.length > this.config.maxEventLog) log.shift();
    }

    syncScrollPercentage() {
      const maxScrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      this.raw.maxScrollPercentage = Math.max(
        this.raw.maxScrollPercentage,
        Math.max(0, Math.min(1, this.raw.maxScrollY / maxScrollable))
      );
    }

    sampleActiveSectionDwell(now = Date.now()) {
      if (!this.activeSection || !this.activeSectionStartTs) return;
      const delta = Math.max(0, now - this.activeSectionStartTs);
      if (!delta) return;

      this.raw.sectionDwellMs[this.activeSection] += delta;
      this.activeSectionStartTs = now;

      if (this.raw.sectionDwellMs.reviews >= this.config.reviewRewardDwellMs) {
        this.raw.outcomes.review_dwell_over_10s = true;
      }
    }

    switchSection(nextSection, reason = "auto") {
      if (!nextSection) return;
      if (!SECTION_KEYS.includes(nextSection)) return;
      const now = Date.now();
      const isViewportSwitch = reason === "scroll_viewport";
      const isHoverSwitch = reason === "hover";

      if (isViewportSwitch || isHoverSwitch) {
        if ((now - this.lastSectionSwitchTs) < this.config.minSectionSwitchGapMs) {
          return;
        }
        if (this.activeSection && this.activeSectionStartTs) {
          const activeDwell = now - this.activeSectionStartTs;
          if (activeDwell < this.config.minSectionDwellBeforeViewportSwitchMs) {
            return;
          }
        }
      }

      if (this.activeSection === nextSection) {
        this.sampleActiveSectionDwell(now);
        return;
      }

      if (this.activeSection) {
        this.sampleActiveSectionDwell(now);
        this.raw.sectionSwitches += 1;
      }

      this.activeSection = nextSection;
      this.activeSectionStartTs = now;
      this.lastSectionSwitchTs = now;
      this.raw.sectionVisits[nextSection] += 1;
      this.pushEvent("section_switch", { section: nextSection, reason });
    }

    markInactivitySave(callback) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = setTimeout(() => {
        if (typeof callback === "function") callback("inactivity_30s");
      }, this.config.inactivityTimeoutMs);
    }

    registerPolicyDecision(decision) {
      if (!decision || !decision.policy) return;
      const now = Date.now();
      const policy = String(decision.policy).toUpperCase();
      this.raw.policy.latest = policy;

      const changed = policy !== this.lastPolicyHistoryValue;
      const enoughGap = (now - this.lastPolicyHistoryTs) >= this.config.policyHistoryMinGapMs;
      if (changed || enoughGap) {
        this.raw.policy.history.push({ policy, ts: now, confidence: Number(decision.confidence || 0) });
        if (this.raw.policy.history.length > 30) this.raw.policy.history.shift();
        this.lastPolicyHistoryTs = now;
        this.lastPolicyHistoryValue = policy;
      }

      if (policy === "INTERVENE") {
        this.raw.outcomes.intervention_exposed = true;
      }
    }

    registerInterventionClosed() {
      if (this.raw.outcomes.intervention_closed) return;
      this.raw.outcomes.intervention_closed = true;
      this.pushEvent("intervention_closed", {});
    }

    registerInterventionAccepted(meta = {}) {
      if (this.raw.outcomes.intervention_accepted) return;
      this.raw.outcomes.intervention_accepted = true;
      this.pushEvent("intervention_accepted", {
        intervention_type: String(meta.intervention_type || "none"),
        mode: String(meta.resolved_mode || meta.mode || "unknown")
      });
    }

    syncCommerceDerived() {
      if (this.detectPurchaseCompletionPath()) {
        this.raw.outcomes.purchase_completed = true;
      }

      if (this.raw.outcomes.checkout_started || this.raw.outcomes.purchase_completed) {
        this.raw.directCheckout = true;
      }

      if (this.raw.outcomes.purchase_completed) {
        this.raw.cartAbandons = 0;
      } else if (this.raw.outcomes.added_to_cart && !this.raw.outcomes.checkout_started && this.raw.cartAbandons <= 0) {
        this.raw.cartAbandons = 1;
      }
    }

    getRawSnapshot() {
      const now = Date.now();
      this.sampleActiveHover(now);
      this.sampleActiveSectionDwell(now);
      this.syncScrollPercentage();
      this.syncCommerceDerived();

      return {
        ...this.raw,
        sectionDwellMs: { ...this.raw.sectionDwellMs },
        sectionVisits: { ...this.raw.sectionVisits },
        clickTargets: { ...this.raw.clickTargets },
        hoverTargets: { ...this.raw.hoverTargets },
        hoverDurationByTargetMs: { ...this.raw.hoverDurationByTargetMs },
        outcomes: { ...this.raw.outcomes },
        policy: {
          latest: this.raw.policy.latest,
          history: this.raw.policy.history.slice(-20)
        },
        extensionUi: { ...this.raw.extensionUi },
        activeSection: this.activeSection || "",
        activeSectionAgeMs: (this.activeSection && this.activeSectionStartTs)
          ? Math.max(0, now - this.activeSectionStartTs)
          : 0,
        sessionDurationSec: Math.max(0, Math.round((now - this.raw.pageStartTs) / 1000))
      };
    }

    start({ onInactivity } = {}) {
      this.stop();
      this.controller = new AbortController();
      const signal = this.controller.signal;
      this.pendingViewportSection = "";
      this.pendingViewportHits = 0;

      document.addEventListener("mousemove", (event) => {
        this.updateMouseJitter(event);
        this.markInactivitySave(onInactivity);
      }, { signal, passive: true });

      document.addEventListener("click", (event) => {
        const now = Date.now();
        const target = event.target instanceof Element ? event.target : null;
        if (target && this.isEmotionUiNode(target)) {
          this.registerFilteredEmotionUiEvent("click");
          this.markInactivitySave(onInactivity);
          return;
        }
        this.raw.clicks += 1;

        const x = Number(event.clientX || 0);
        const y = Number(event.clientY || 0);
        this.clickLog.push({ x, y, ts: now });
        while (this.clickLog.length && (now - this.clickLog[0].ts) > this.config.rageWindowMs) {
          this.clickLog.shift();
        }

        if (this.clickLog.length >= this.config.rageMinClicks) {
          const recent = this.clickLog.slice(-this.config.rageMinClicks);
          let maxDist = 0;
          for (let i = 0; i < recent.length; i += 1) {
            for (let j = i + 1; j < recent.length; j += 1) {
              maxDist = Math.max(maxDist, Math.hypot(recent[i].x - recent[j].x, recent[i].y - recent[j].y));
            }
          }
          if (
            maxDist <= this.config.rageMaxDistancePx &&
            (now - this.lastRageTs) >= this.config.rageCooldownMs &&
            this.raw.rageClicks < this.config.rageMaxPerSession
          ) {
            this.raw.rageClicks += 1;
            this.lastRageTs = now;
            this.pushEvent("rage_click", { maxDist: Number(maxDist.toFixed(1)) });
          }
        }

        if (target) {
          const primaryTarget = this.detectPrimaryElement(target, { forHover: false }) || target;
          const text = this.extractTargetText(primaryTarget);
          const actions = this.detectCommerceAction(primaryTarget, text);
          const targetKey = this.describeTarget(primaryTarget, { forHover: false });
          if (targetKey) {
            this.incrementMapValue(this.raw.clickTargets, targetKey, 1);
          }

          if (!this.isInteractiveTarget(primaryTarget) && !this.isPriceElement(primaryTarget)) {
            // Only count as dead click if a previous dead click happened within 2s — single
            // reflexive taps on text/images are normal browsing, not confusion signals.
            if ((now - this.lastDeadClickTs) <= 2000) {
              this.raw.deadClicks += 1;
              this.pushEvent("dead_click", { target: targetKey || "unknown" });
            }
            this.lastDeadClickTs = now;
          }

          if (actions.wishlist) {
            this.raw.outcomes.added_to_wishlist = true;
            this.pushEvent("wishlist_toggle", { target: targetKey || "unknown" });
          }
          if (actions.addToCart) {
            this.raw.cartAddRemove += 1;
            this.raw.outcomes.added_to_cart = true;
            this.pushEvent("add_to_cart", { target: targetKey || "unknown" });
          }
          if (actions.removeFromCart) {
            this.raw.cartAddRemove += 1;
            this.raw.cartAbandons += 1;
            this.pushEvent("remove_from_cart", { target: targetKey || "unknown" });
          }
          if (actions.checkout) {
            this.raw.directCheckout = true;
            this.raw.outcomes.checkout_started = true;
            this.pushEvent("checkout_started", { target: targetKey || "unknown" });
          }
          if (actions.purchaseComplete) {
            this.raw.outcomes.purchase_completed = true;
          }
          if (this.isPrimaryPriceElement(primaryTarget)) {
            this.raw.priceHover += 1;
            this.pushEvent("price_interaction_click", { target: targetKey || "unknown" });
          }

          const section = this.detectSectionFromElement(primaryTarget);
          if (section) this.switchSection(section, "click");
        }

        this.pushEvent("click", { section: this.activeSection || "none" });
        this.markInactivitySave(onInactivity);
      }, { signal, passive: true });

      document.addEventListener("mouseover", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (this.isEmotionUiNode(target)) {
          this.registerFilteredEmotionUiEvent("hover");
          return;
        }
        this.startHoverTracking(target);
        const section = this.detectSectionFromElement(target);
        if (section) this.switchSection(section, "hover");
      }, { signal, passive: true });

      document.addEventListener("mouseout", (event) => {
        const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
        if (related && this.isEmotionUiNode(related)) return;
        if (related && this.describeTarget(related, { forHover: true }) === this.activeHoverKey) return;
        this.finalizeHoverTracking(Date.now());
      }, { signal, passive: true });

      window.addEventListener("scroll", () => {
        const y = window.scrollY;
        this.raw.scrollEvents += 1;
        this.raw.maxScrollY = Math.max(this.raw.maxScrollY, y);

        const direction = y > this.lastScrollY ? "down" : (y < this.lastScrollY ? "up" : this.lastScrollDirection);
        if (this.lastScrollDirection && direction && direction !== this.lastScrollDirection) {
          this.raw.scrollReversals += 1;
          this.pushEvent("scroll_reversal", { direction });
        }
        this.lastScrollDirection = direction || this.lastScrollDirection;
        this.lastScrollY = y;
        this.syncScrollPercentage();

        const sectionFromViewport = this.detectSectionFromViewport();
        if (sectionFromViewport) {
          if (this.pendingViewportSection === sectionFromViewport) {
            this.pendingViewportHits += 1;
          } else {
            this.pendingViewportSection = sectionFromViewport;
            this.pendingViewportHits = 1;
          }

          if (this.pendingViewportHits >= this.config.viewportSectionStabilityCount) {
            this.switchSection(sectionFromViewport, "scroll_viewport");
            this.pendingViewportHits = 0;
          }
        } else {
          this.pendingViewportSection = "";
          this.pendingViewportHits = 0;
        }

        this.markInactivitySave(onInactivity);
      }, { signal, passive: true });

      document.addEventListener("mouseout", (event) => {
        const nearTop = Number(event.clientY || 9999) <= this.config.exitIntentThresholdPx;
        if (nearTop && event.relatedTarget == null) {
          this.raw.exitIntent += 1;
          this.pushEvent("exit_intent", {});
        }
      }, { signal, passive: true });

      window.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          this.pushEvent("tab_hidden", {});
        } else {
          this.pushEvent("tab_visible", {});
        }
      }, { signal });

      this.markInactivitySave(onInactivity);
      this.getPrimaryPriceAnchor(true);
      const initial = this.detectSectionFromViewport();
      if (initial) this.switchSection(initial, "init");
    }

    stop() {
      if (this.controller) this.controller.abort();
      this.controller = null;
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
      this.finalizeHoverTracking(Date.now());
      this.sampleActiveSectionDwell(Date.now());
    }
  }

  window.EmotionUIDataCollector = DataCollector;
})();
