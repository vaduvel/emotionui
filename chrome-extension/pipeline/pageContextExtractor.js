(() => {
  class PageContextExtractor {
    constructor(config = {}) {
      this.config = {
        textNodeScanLimit: 220,
        stickyBottomThresholdPx: 96,
        stickyRightThresholdPx: 56,
        ...config
      };
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

    round(value, digits = 3) {
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      return Number(n.toFixed(digits));
    }

    collectTextBlobs() {
      const nodes = Array.from(document.querySelectorAll("button, a, [role='button'], section, article, aside, div, span, p, li, strong, b"))
        .slice(0, this.config.textNodeScanLimit);

      return nodes
        .map((node) => this.normalizeText([
          node.textContent,
          node.getAttribute("aria-label"),
          node.getAttribute("title"),
          node.id,
          node.className
        ].join(" ")))
        .filter(Boolean);
    }

    hasPattern(blobs, pattern) {
      return blobs.some((blob) => pattern.test(blob));
    }

    countPattern(blobs, pattern) {
      return blobs.reduce((count, blob) => count + (pattern.test(blob) ? 1 : 0), 0);
    }

    countInteractiveMatches(pattern) {
      const nodes = Array.from(document.querySelectorAll("button, a, [role='button'], input[type='button'], input[type='submit'], label"))
        .slice(0, 160);
      return nodes.reduce((count, node) => {
        const text = this.normalizeText([
          node.textContent,
          node.getAttribute("aria-label"),
          node.getAttribute("title"),
          node.className
        ].join(" "));
        return count + (pattern.test(text) ? 1 : 0);
      }, 0);
    }

    detectStickyPurchaseCta() {
      const nodes = Array.from(document.querySelectorAll("button, a, [role='button'], [data-testid*='cta'], [class*='sticky'], [style*='position: sticky'], [style*='position:fixed']"))
        .slice(0, 80);

      return nodes.some((node) => {
        if (!(node instanceof Element)) return false;
        const text = this.normalizeText([
          node.textContent,
          node.getAttribute("aria-label"),
          node.getAttribute("title")
        ].join(" "));
        if (!/(add to cart|buy now|checkout|adauga in cos|cumpara|comanda|finalizeaza)/.test(text)) return false;

        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        const isSticky = style.position === "sticky" || style.position === "fixed";
        const nearBottom = rect.bottom >= (window.innerHeight - this.config.stickyBottomThresholdPx);
        const nearRight = rect.right >= (window.innerWidth - this.config.stickyRightThresholdPx);
        return isSticky || nearBottom || nearRight;
      });
    }

    extract() {
      const blobs = this.collectTextBlobs();
      const primaryActionCount = this.countInteractiveMatches(/(add to cart|buy now|checkout|adauga in cos|adauga|adaugaincos|pune in cos|cumpara|comanda|finalizeaza)/);
      const secondaryActionCount = this.countInteractiveMatches(/(favorite|wishlist|salveaza|compare|compara|notify|alerteaza|urmareste|adauga o opinie|opinii|lista de dorinte)/);
      const variantOptionCount = this.countInteractiveMatches(/(\b(128|256|512)\s?gb\b|\b1\s?tb\b|\b2\s?tb\b|culoare|color|marime|size|capacity|capacitate|dimensiune|model|varianta|tip)/);
      const reviewAnchorCount = this.countInteractiveMatches(/(reviews?|review-uri|recenzii|rating|stele|stars?|opinii|pareri|nota)/);
      const promoBlockCount = this.countPattern(blobs, /(voucher|promo|deal|discount|reducere|oferta|economisesti|pret vechi|prp|card cadou|genius deals)/);
      const infoBlockCount = this.countPattern(blobs, /(retur|return|garantie|warranty|livrare|delivery|free shipping|secure payment|plata securizata|instalment|installment|rate)/);
      const hasPrimaryPrice = document.querySelector("[data-price], [itemprop='price'], [class*='price'], [id*='price'], [class*='amount'], [class*='cost']") != null;
      const hasDiscountSignal = this.hasPattern(blobs, /(discount|reducere|redus|save|economisesti|oferta|promo|coupon|voucher|deal|black friday|pret vechi|prp)/);
      const hasStickyPurchaseCta = this.detectStickyPurchaseCta();
      const hasUrgencySignal = this.hasPattern(blobs, /(last pieces|limited stock|only \d+ left|stoc limitat|ultimele bucati|grabeste-te|hurry|selling fast|low stock|in stoc limitat)/);
      const hasInstallmentSignal = this.hasPattern(blobs, /(rate|in rate|monthly|per month|luna|luni|instalment|installment|finantare|buyback)/);
      const hasReviewDensitySignal = this.hasPattern(blobs, /(\(\d+\s*(reviews?|review-uri|recenzii)\)|\d+\s*(reviews?|review-uri|recenzii)|rating|stele|stars?)/);
      const hasSpecTableSignal = document.querySelector("table, dl, [class*='spec'], [id*='spec'], [data-testid*='spec']") != null;
      const hasTrustSignal = this.hasPattern(blobs, /(retur|return|garantie|warranty|livrare|delivery|free shipping|genius|verified|autentic|secure payment|plata securizata)/);
      const hasVariantChoices = variantOptionCount >= 2;
      const hasCompareAction = this.hasPattern(blobs, /(compare|compara)/);
      const hasShippingSignal = this.hasPattern(blobs, /(livrare|delivery|curier|pickup|ridicare|shipping)/);
      const hasWarrantySignal = this.hasPattern(blobs, /(garantie|warranty|protectie|retur|return)/);
      const hasPromoCluster = promoBlockCount >= 3;

      const summary = {
        hasPrimaryPrice,
        hasDiscountSignal,
        hasStickyPurchaseCta,
        hasUrgencySignal,
        hasInstallmentSignal,
        hasReviewDensitySignal,
        hasSpecTableSignal,
        hasTrustSignal,
        hasVariantChoices,
        hasCompareAction,
        hasShippingSignal,
        hasWarrantySignal,
        hasPromoCluster
      };

      const hints = Object.entries(summary)
        .filter(([, value]) => Boolean(value))
        .map(([key]) => key);

      const metrics = {
        primaryActionCount,
        secondaryActionCount,
        variantOptionCount,
        reviewAnchorCount,
        promoBlockCount,
        infoBlockCount,
        pageDensityScore: this.round(Math.min(1, (
          primaryActionCount * 0.18 +
          secondaryActionCount * 0.12 +
          variantOptionCount * 0.08 +
          promoBlockCount * 0.08 +
          infoBlockCount * 0.08
        ) / 6))
      };

      return {
        summary,
        hints,
        metrics,
        coverage: this.round(hints.length / Math.max(1, Object.keys(summary).length))
      };
    }
  }

  window.EmotionUIPageContextExtractor = PageContextExtractor;
})();
