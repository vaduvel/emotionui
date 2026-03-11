(() => {
  class ActionResolver {
    constructor(config = {}, hooks = {}) {
      this.config = config;
      this.onInterventionClosed = hooks.onInterventionClosed || (() => {});
      this.onInterventionCta = hooks.onInterventionCta || (() => {});
      this.currentPolicy = "SILENT";
      this.currentDecision = null;
      this.root = null;
      this.assistRoot = null;
      this.styleEl = null;
      this.disposeHandlers = [];
      this.highlightedNodes = [];
    }

    normalizeText(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/[ăâ]/g, "a")
        .replace(/[î]/g, "i")
        .replace(/[șş]/g, "s")
        .replace(/[țţ]/g, "t")
        .replace(/\s+/g, " ")
        .trim();
    }

    ensureRoot() {
      if (this.root && document.body.contains(this.root)) return this.root;

      const root = document.createElement("div");
      root.id = "emotionui-policy-overlay";
      root.setAttribute("data-emotionui", "1");
      root.style.position = "fixed";
      root.style.right = "14px";
      root.style.bottom = "14px";
      root.style.zIndex = "2147483647";
      root.style.fontFamily = "Inter, system-ui, -apple-system, Segoe UI, sans-serif";
      root.style.display = "none";
      document.documentElement.appendChild(root);
      this.root = root;
      return root;
    }

    ensureAssistRoot() {
      if (this.assistRoot && document.body.contains(this.assistRoot)) return this.assistRoot;

      const root = document.createElement("div");
      root.id = "emotionui-page-assist-root";
      root.setAttribute("data-emotionui", "1");
      root.style.position = "fixed";
      root.style.right = "14px";
      root.style.top = "84px";
      root.style.zIndex = "2147483646";
      root.style.fontFamily = "Inter, system-ui, -apple-system, Segoe UI, sans-serif";
      root.style.display = "none";
      document.documentElement.appendChild(root);
      this.assistRoot = root;
      return root;
    }

    ensureStyle() {
      if (this.styleEl && document.head.contains(this.styleEl)) return;
      const style = document.createElement("style");
      style.id = "emotionui-action-resolver-style";
      style.textContent = `
        [data-emotionui-highlight="price"] {
          outline: 2px solid rgba(245, 158, 11, 0.95) !important;
          box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.22) !important;
          border-radius: 10px !important;
          transition: box-shadow 180ms ease, outline-color 180ms ease;
        }
        [data-emotionui-highlight="section"] {
          outline: 2px solid rgba(59, 130, 246, 0.92) !important;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.18) !important;
          border-radius: 10px !important;
          transition: box-shadow 180ms ease, outline-color 180ms ease;
        }
        [data-emotionui-highlight="cta"] {
          outline: 2px solid rgba(16, 185, 129, 0.92) !important;
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.18) !important;
          border-radius: 10px !important;
          transition: box-shadow 180ms ease, outline-color 180ms ease;
        }
      `;
      document.head.appendChild(style);
      this.styleEl = style;
    }

    clearHandlers() {
      for (const fn of this.disposeHandlers) fn();
      this.disposeHandlers = [];
    }

    clearHighlights() {
      for (const node of this.highlightedNodes) {
        if (!(node instanceof Element)) continue;
        node.removeAttribute("data-emotionui-highlight");
      }
      this.highlightedNodes = [];
    }

    clearAssist() {
      this.clearHighlights();
      if (!this.assistRoot) return;
      this.assistRoot.style.display = "none";
      this.assistRoot.innerHTML = "";
    }

    hide() {
      if (this.root) {
        this.root.style.display = "none";
        this.root.innerHTML = "";
      }
      this.clearHandlers();
      this.clearAssist();
      this.currentDecision = null;
    }

    resolvePresentation(decision = {}) {
      const typeKey = String(decision.intervention_type || "").toLowerCase();
      const variants = (this.config && this.config.interventionTypes) || {};
      const variant = variants[typeKey] || {};
      const explanationSummary = String(decision.user_explanation_summary || "").trim();
      const explanationTitle = String(decision.user_explanation_title || "").trim();

      return {
        observeBadgeText: variant.observeBadgeText || this.config.observeBadgeText || "EmotionUI: Observing",
        title: explanationTitle || variant.title || this.config.interveneTitle || "Need a quicker path?",
        body: explanationSummary || variant.body || this.config.interveneBody || "We can simplify this page.",
        cta: variant.cta || this.config.interveneCta || "Apply assist",
        dismiss: variant.dismiss || this.config.interveneDismiss || "Dismiss"
      };
    }

    resolveTextBlob(node) {
      if (!(node instanceof Element)) return "";
      return this.normalizeText([
        node.textContent,
        node.getAttribute("aria-label"),
        node.getAttribute("title"),
        node.id,
        node.className
      ].join(" "));
    }

    isVisible(node) {
      if (!(node instanceof Element)) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 2 && rect.height > 2;
    }

    addHighlight(node, kind) {
      if (!(node instanceof Element)) return;
      node.setAttribute("data-emotionui-highlight", kind);
      this.highlightedNodes.push(node);
    }

    scrollToNode(node, kind = "section") {
      if (!(node instanceof Element)) return;
      this.clearHighlights();
      this.addHighlight(node, kind);
      node.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    findBestNode(pattern, selectors, options = {}) {
      const nodes = Array.from(document.querySelectorAll(selectors)).slice(0, Number(options.limit || 220));
      let bestNode = null;
      let bestScore = -Infinity;

      for (const node of nodes) {
        if (!(node instanceof Element)) continue;
        if (!this.isVisible(node)) continue;
        const text = this.resolveTextBlob(node);
        if (!pattern.test(text)) continue;

        const rect = node.getBoundingClientRect();
        let score = 0;
        score += /^(a|button|summary)$/i.test(node.tagName) ? 2 : 0;
        score += /^h[1-4]$/i.test(node.tagName) ? 1.5 : 0;
        score += node.getAttribute("role") === "tab" ? 2 : 0;
        score += rect.top >= 0 && rect.top <= window.innerHeight ? 1.4 : 0.5;
        score += Math.max(0, 1 - Math.abs((rect.top + rect.height / 2) - (window.innerHeight / 2)) / Math.max(1, window.innerHeight));

        if (score > bestScore) {
          bestScore = score;
          bestNode = node;
        }
      }

      return bestNode;
    }

    findResearchTargets() {
      const selectors = "button, a, [role='tab'], h2, h3, h4, section, article, details, summary, div";
      const patterns = [
        { key: "specs", label: "Specs", pattern: /(spec|specificatii|technical|detalii tehnice)/ },
        { key: "reviews", label: "Reviews", pattern: /(review|recenzii|opinii|rating)/ },
        { key: "faq", label: "FAQ", pattern: /(faq|intrebari|q&a|question)/ },
        { key: "description", label: "Description", pattern: /(description|descriere|overview|detalii)/ }
      ];

      return patterns
        .map((entry) => ({ ...entry, node: this.findBestNode(entry.pattern, selectors, { limit: 260 }) }))
        .filter((entry) => entry.node);
    }

    findPrimaryPriceNode() {
      return this.findBestNode(
        /(lei|ron|eur|usd|\$|€|£|price|pret|cost|discount|reducere|oferta)/,
        "[data-price], [itemprop='price'], [class*='price'], [id*='price'], [class*='amount'], [class*='cost'], main span, main p, main div, article span, article p, article div",
        { limit: 260 }
      );
    }

    findPrimaryCtaNode() {
      return this.findBestNode(
        /(add to cart|buy now|checkout|adauga in cos|cumpara|comanda|finalizeaza)/,
        "button, a, [role='button']",
        { limit: 120 }
      );
    }

    renderObserveBadge(decision = {}) {
      const presentation = this.resolvePresentation(decision);
      const root = this.ensureRoot();
      this.clearHandlers();
      root.style.display = "block";
      root.innerHTML = `
        <div style="background:#111827;color:#e5e7eb;border-radius:999px;padding:8px 12px;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,0.2);">
          ${presentation.observeBadgeText}
        </div>
      `;
    }

    renderInterventionCard(decision = {}) {
      const presentation = this.resolvePresentation(decision);
      const root = this.ensureRoot();
      this.clearHandlers();
      root.style.display = "block";
      root.innerHTML = `
        <div style="width:280px;background:#0f172a;color:#e2e8f0;border:1px solid #1e293b;border-radius:14px;padding:12px;box-shadow:0 18px 36px rgba(0,0,0,0.32);">
          <div style="font-size:13px;font-weight:700;line-height:1.3;margin-bottom:6px;">${presentation.title}</div>
          <div style="font-size:12px;line-height:1.4;color:#94a3b8;margin-bottom:10px;">${presentation.body}</div>
          <div style="display:flex;gap:8px;">
            <button type="button" class="emo-policy-cta" style="flex:1;background:#2563eb;border:0;color:#fff;font-size:12px;font-weight:600;padding:8px 10px;border-radius:8px;cursor:pointer;">${presentation.cta}</button>
            <button type="button" class="emo-policy-close" style="background:#1f2937;border:0;color:#cbd5e1;font-size:12px;padding:8px 10px;border-radius:8px;cursor:pointer;">${presentation.dismiss}</button>
          </div>
        </div>
      `;

      const cta = root.querySelector(".emo-policy-cta");
      const close = root.querySelector(".emo-policy-close");

      if (cta) {
        const handler = () => this.onInterventionCta(this.currentDecision || decision || {});
        cta.addEventListener("click", handler, { passive: true });
        this.disposeHandlers.push(() => cta.removeEventListener("click", handler));
      }

      if (close) {
        const handler = () => {
          this.onInterventionClosed(this.currentDecision || decision || {});
          this.hide();
          this.currentPolicy = "SILENT";
        };
        close.addEventListener("click", handler, { passive: true });
        this.disposeHandlers.push(() => close.removeEventListener("click", handler));
      }
    }

    renderResearchAssist(decision = {}) {
      const targets = this.findResearchTargets();
      if (!targets.length) {
        this.clearAssist();
        return;
      }
      const explanation = String(decision.user_explanation_summary || "Jump directly to the sections that matter instead of scanning the full page.");

      const root = this.ensureAssistRoot();
      root.style.display = "block";
      root.innerHTML = `
        <div style="width:300px;background:rgba(15,23,42,0.96);color:#e2e8f0;border:1px solid #1e293b;border-radius:14px;padding:12px;box-shadow:0 16px 36px rgba(15,23,42,0.22);backdrop-filter: blur(8px);">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#93c5fd;margin-bottom:8px;">Research shortcuts</div>
          <div style="font-size:12px;line-height:1.45;color:#cbd5e1;margin-bottom:10px;">${explanation}</div>
          <div class="emo-assist-actions" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
        </div>
      `;

      const actions = root.querySelector(".emo-assist-actions");
      if (!actions) return;

      for (const target of targets) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = target.label;
        button.style.background = "#1d4ed8";
        button.style.color = "#fff";
        button.style.border = "0";
        button.style.borderRadius = "999px";
        button.style.padding = "7px 10px";
        button.style.fontSize = "12px";
        button.style.fontWeight = "600";
        button.style.cursor = "pointer";
        actions.appendChild(button);

        const handler = () => this.scrollToNode(target.node, "section");
        button.addEventListener("click", handler, { passive: true });
        this.disposeHandlers.push(() => button.removeEventListener("click", handler));
      }
    }

    renderPriceAssist(decision = {}) {
      const root = this.ensureAssistRoot();
      const priceNode = this.findPrimaryPriceNode();
      const ctaNode = this.findPrimaryCtaNode();
      const summary = (decision.page_context && typeof decision.page_context === "object") ? decision.page_context : {};
      const explanation = String(decision.user_explanation_summary || "Key reassurance signals found on this page.");

      root.style.display = "block";
      root.innerHTML = `
        <div style="width:300px;background:rgba(15,23,42,0.96);color:#e2e8f0;border:1px solid #1e293b;border-radius:14px;padding:12px;box-shadow:0 16px 36px rgba(15,23,42,0.22);backdrop-filter: blur(8px);">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#fbbf24;margin-bottom:8px;">Value check</div>
          <div style="font-size:12px;line-height:1.45;color:#cbd5e1;margin-bottom:10px;">${explanation}</div>
          <div class="emo-assist-bullets" style="display:grid;gap:6px;margin-bottom:10px;"></div>
          <div class="emo-assist-actions" style="display:flex;gap:8px;flex-wrap:wrap;"></div>
        </div>
      `;

      const bullets = root.querySelector(".emo-assist-bullets");
      const actions = root.querySelector(".emo-assist-actions");
      if (!bullets || !actions) return;

      const items = [];
      if (summary.hasDiscountSignal) items.push("Discount or offer signal detected");
      if (summary.hasInstallmentSignal) items.push("Installment or financing info available");
      if (summary.hasTrustSignal) items.push("Returns, delivery, or guarantee reassurance present");
      if (summary.hasUrgencySignal) items.push("Availability urgency is visible");
      if (!items.length) items.push("Price and purchase path are available for a quick value check");

      for (const item of items.slice(0, 4)) {
        const line = document.createElement("div");
        line.textContent = `• ${item}`;
        line.style.fontSize = "12px";
        line.style.color = "#e2e8f0";
        bullets.appendChild(line);
      }

      if (priceNode) {
        this.addHighlight(priceNode, "price");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Go to price";
        btn.style.background = "#b45309";
        btn.style.color = "#fff";
        btn.style.border = "0";
        btn.style.borderRadius = "999px";
        btn.style.padding = "7px 10px";
        btn.style.fontSize = "12px";
        btn.style.fontWeight = "600";
        btn.style.cursor = "pointer";
        actions.appendChild(btn);
        const handler = () => this.scrollToNode(priceNode, "price");
        btn.addEventListener("click", handler, { passive: true });
        this.disposeHandlers.push(() => btn.removeEventListener("click", handler));
      }

      if (ctaNode) {
        this.addHighlight(ctaNode, "cta");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Go to CTA";
        btn.style.background = "#047857";
        btn.style.color = "#fff";
        btn.style.border = "0";
        btn.style.borderRadius = "999px";
        btn.style.padding = "7px 10px";
        btn.style.fontSize = "12px";
        btn.style.fontWeight = "600";
        btn.style.cursor = "pointer";
        actions.appendChild(btn);
        const handler = () => this.scrollToNode(ctaNode, "cta");
        btn.addEventListener("click", handler, { passive: true });
        this.disposeHandlers.push(() => btn.removeEventListener("click", handler));
      }
    }

    renderAdaptiveAssist(decision = {}) {
      if (decision.dismiss_cooldown_active) {
        this.clearAssist();
        return;
      }

      const type = String(decision.intervention_type || "none").toLowerCase();
      this.clearAssist();
      this.ensureStyle();

      if (type === "research_assist") {
        this.renderResearchAssist(decision);
        return;
      }

      if (type === "price_reassurance" || type === "value_reassurance") {
        this.renderPriceAssist(decision);
        return;
      }

      if (type === "focus_guidance" || type === "express_checkout") {
        const ctaNode = this.findPrimaryCtaNode();
        if (ctaNode) {
          this.addHighlight(ctaNode, "cta");
        }
      }
    }

    apply(decision = {}) {
      const policy = String(decision.policy || "SILENT").toUpperCase();
      this.currentPolicy = policy;
      this.currentDecision = { ...decision, policy };

      if (policy === "SILENT") {
        this.hide();
        return;
      }

      if (decision.dismiss_cooldown_active) {
        this.hide();
        return;
      }

      if (policy === "OBSERVE") {
        this.renderObserveBadge(this.currentDecision);
        this.renderAdaptiveAssist(this.currentDecision);
        return;
      }

      this.renderInterventionCard(this.currentDecision);
      this.renderAdaptiveAssist(this.currentDecision);
    }

    resetToSilent() {
      this.currentPolicy = "SILENT";
      this.hide();
    }

    destroy() {
      this.hide();
      if (this.root && this.root.parentElement) {
        this.root.parentElement.removeChild(this.root);
      }
      if (this.assistRoot && this.assistRoot.parentElement) {
        this.assistRoot.parentElement.removeChild(this.assistRoot);
      }
      if (this.styleEl && this.styleEl.parentElement) {
        this.styleEl.parentElement.removeChild(this.styleEl);
      }
      this.root = null;
      this.assistRoot = null;
      this.styleEl = null;
    }
  }

  window.EmotionUIActionResolver = ActionResolver;
})();
