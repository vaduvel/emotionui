(() => {
  class PdpGate {
    constructor(config = {}) {
      this.config = {
        minTrackableScore: 0.68,
        minUnsureScore: 0.42,
        maxListingPenaltyForTrackable: 0.34,
        actionNodeScanLimit: 160,
        listingNodeScanLimit: 240,
        ...config
      };
    }

    round(value, digits = 3) {
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      return Number(n.toFixed(digits));
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

    evaluate() {
      const host = this.normalizeText(window.location.hostname || "");
      const path = this.normalizeText(window.location.pathname || "");
      const search = this.normalizeText(window.location.search || "");
      const documentReadyState = document.readyState;
      const reasons = [];

      const blockedHostPattern = /(accounts\.google\.com|myaccount\.google\.com|mail\.google\.com|calendar\.google\.com|docs\.google\.com|drive\.google\.com|kaggle\.com)/i;
      if (blockedHostPattern.test(host)) {
        return this.result("NOT_PDP", 0, ["blocked_host"], {
          host,
          path,
          documentReadyState
        });
      }

      const nonProductPathPattern = /(\/cart|\/cos|\/checkout|\/payment|\/order|\/account|\/login|\/register|\/wishlist|\/favorite|\/search|\/category|\/catalog|\/help|\/support|\/datasets)\b/i;
      if (nonProductPathPattern.test(path)) {
        return this.result("NOT_PDP", 0.02, ["blocked_path"], {
          host,
          path,
          documentReadyState
        });
      }

      const productPathStrong =
        /\/(product|produs|item)\/[a-z0-9][a-z0-9\-_]{3,}/i.test(path) ||
        /\/(dp|pd)\/[a-z0-9]{6,}/i.test(path) ||
        /\/p\/[a-z0-9][a-z0-9\-_]{5,}/i.test(path);

      if (documentReadyState === "loading") {
        return this.result(
          productPathStrong ? "TRACKABLE_PDP" : "UNSURE",
          productPathStrong ? 0.72 : 0.35,
          productPathStrong ? ["product_path_strong", "dom_loading_fast_accept"] : ["dom_loading_wait_for_signals"],
          {
            host,
            path,
            documentReadyState,
            productPathStrong
          }
        );
      }

      const structuredProductNodes = Array.from(document.querySelectorAll("[itemtype*='Product'], [data-product-id], meta[property='og:type'][content*='product']")).slice(0, 8);
      const structuredProduct = structuredProductNodes.length > 0;
      const priceMarker = document.querySelector("[data-price], [itemprop='price'], [class*='price'], [id*='price']") != null;
      const productHeadingNode = document.querySelector("h1");
      const productHeadingText = this.normalizeText(productHeadingNode?.textContent || "");
      const productHeading = Boolean(productHeadingNode && productHeadingText);
      const genericHeading = /(rezultate|search results|categorie|catalog|electrocasnice & climatizare|aparate frigorifice|combine frigorifice|produse promovate)\b/i.test(productHeadingText);
      const productLinkCount = document.querySelectorAll("a[href*='/pd/'], a[href*='/dp/'], a[href*='/p/']").length;
      const searchQueryLike = /(?:[?&](q|query|search|keyword|k|text)=|ref=search|from=search|source=search)/i.test(search);

      const actionNodes = Array.from(document.querySelectorAll("button, a, [role='button']")).slice(0, this.config.actionNodeScanLimit);
      let buyCtaCount = 0;
      const hasCommerceAction = actionNodes.some((node) => {
        const text = this.normalizeText([
          node.textContent,
          node.getAttribute("aria-label"),
          node.getAttribute("title")
        ].join(" "));
        const match = /(add to cart|buy now|checkout|wishlist|add to wishlist|adauga in cos|cumpara|comanda|finalizeaza)/i.test(text);
        if (match && /(add to cart|buy now|checkout|adauga in cos|cumpara|comanda|finalizeaza)/i.test(text)) {
          buyCtaCount += 1;
        }
        return match;
      });

      const infoTabNodes = Array.from(document.querySelectorAll("a, button, [role='tab'], [aria-label], summary")).slice(0, this.config.actionNodeScanLimit);
      const hasInfoTabs = infoTabNodes.some((node) => {
        const text = this.normalizeText([
          node.textContent,
          node.getAttribute("aria-label"),
          node.getAttribute("title")
        ].join(" "));
        return /(review|recenzii|spec|specificatii|faq|intrebari|descriere|description)/i.test(text);
      });

      const listingControlPattern = /(filtreaza|filtrează|ordoneaza|ordonează|sort by|filter by|cum sunt ordonate rezultatele|rezultate cautare|search results|aplica filtre|sterge filtre|aplica sortare)/i;
      const listingControlCount = Array.from(document.querySelectorAll("button, a, label, summary, h2, h3, nav, aside")).slice(0, this.config.listingNodeScanLimit)
        .reduce((count, node) => {
          const text = this.normalizeText([
            node.textContent,
            node.getAttribute("aria-label"),
            node.getAttribute("title")
          ].join(" "));
          return count + (listingControlPattern.test(text) ? 1 : 0);
        }, 0);

      const filterRailPresent = document.querySelector("aside [type='checkbox'], aside [type='radio'], nav [aria-label*='filter'], aside summary, aside details") != null;
      const productSignals = {
        productPathStrong,
        structuredProduct,
        priceMarker,
        hasCommerceAction,
        hasInfoTabs,
        productHeading,
        genericHeading,
        productLinkCount,
        buyCtaCount,
        listingControlCount,
        searchQueryLike,
        filterRailPresent
      };

      const strongPdpCandidate = productPathStrong && priceMarker && hasCommerceAction && productHeading && !genericHeading;
      productSignals.strongPdpCandidate = strongPdpCandidate;

      let score = 0;
      score += productPathStrong ? 0.24 : 0;
      score += structuredProduct ? 0.18 : 0;
      score += priceMarker ? 0.14 : 0;
      score += hasCommerceAction ? 0.16 : 0;
      score += hasInfoTabs ? 0.12 : 0;
      score += (productHeading && !genericHeading) ? 0.12 : 0;
      score += strongPdpCandidate ? 0.08 : 0;
      score += productLinkCount <= 3 ? 0.08 : 0;

      if (productPathStrong) reasons.push("product_path_strong");
      if (structuredProduct) reasons.push("structured_product_signal");
      if (priceMarker) reasons.push("price_marker_present");
      if (hasCommerceAction) reasons.push("commerce_action_present");
      if (hasInfoTabs) reasons.push("info_tabs_present");
      if (productHeading && !genericHeading) reasons.push("product_heading_present");

      let listingPenalty = 0;
      listingPenalty += searchQueryLike ? 0.34 : 0;
      listingPenalty += listingControlCount >= 2 ? 0.22 : 0;
      listingPenalty += productLinkCount >= 4 ? (strongPdpCandidate ? 0.06 : 0.18) : 0;
      listingPenalty += buyCtaCount >= 3 ? (strongPdpCandidate ? 0.06 : 0.18) : 0;
      listingPenalty += structuredProductNodes.length >= 3 ? 0.14 : 0;
      listingPenalty += genericHeading ? 0.2 : 0;
      listingPenalty += filterRailPresent ? 0.1 : 0;

      if (searchQueryLike) reasons.push("search_query_detected");
      if (listingControlCount >= 2) reasons.push("listing_controls_detected");
      if (productLinkCount >= 4) reasons.push("multiple_product_links_detected");
      if (buyCtaCount >= 3) reasons.push("multiple_buy_ctas_detected");
      if (structuredProductNodes.length >= 3) reasons.push("multiple_structured_products_detected");
      if (genericHeading) reasons.push("generic_heading_detected");
      if (filterRailPresent) reasons.push("filter_rail_detected");

      const finalScore = this.round(Math.max(0, Math.min(1, score - listingPenalty)));
      let verdict = "UNSURE";

      if (
        finalScore >= this.config.minTrackableScore &&
        listingPenalty <= this.config.maxListingPenaltyForTrackable &&
        priceMarker &&
        hasCommerceAction &&
        productHeading &&
        !genericHeading
      ) {
        verdict = "TRACKABLE_PDP";
      } else if (
        strongPdpCandidate &&
        hasInfoTabs &&
        finalScore >= this.config.minUnsureScore &&
        listingPenalty <= 0.42
      ) {
        verdict = "TRACKABLE_PDP";
      } else if (
        listingPenalty >= 0.46 ||
        (!productPathStrong && searchQueryLike) ||
        (genericHeading && productLinkCount >= 4) ||
        (listingControlCount >= 3 && productLinkCount >= 4)
      ) {
        verdict = "NOT_PDP";
      } else if (finalScore < this.config.minUnsureScore) {
        verdict = "NOT_PDP";
      }

      const finalReasons = verdict === "TRACKABLE_PDP"
        ? reasons.filter((reason) => !/search_query_detected|listing_controls_detected|multiple_product_links_detected|multiple_buy_ctas_detected|multiple_structured_products_detected|generic_heading_detected|filter_rail_detected/.test(reason))
        : reasons;

      return this.result(verdict, finalScore, finalReasons, {
        host,
        path,
        documentReadyState,
        ...productSignals,
        listingPenalty: this.round(listingPenalty),
        signalScore: this.round(score)
      });
    }

    result(verdict, score, reasons, metrics = {}) {
      return {
        verdict,
        trackable: verdict === "TRACKABLE_PDP",
        score: this.round(score),
        reasons: Array.from(new Set((reasons || []).filter(Boolean))),
        metrics
      };
    }
  }

  window.EmotionUIPdpGate = PdpGate;
})();
