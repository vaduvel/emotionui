/**
 * Adaptive State UI — Layer 4: Adaptive Layout
 * Modifies the product page layout based on behavioral state.
 * Each state has specific UI adaptations that appear/disappear.
 */

const ADAPTATIONS = {
  STANDARD: {
    sections: [],
    hideElements: [],
    showElements: [],
    bodyClass: 'emo-standard',
  },

  EXPRESS_LANE: {
    sections: [
      {
        id: 'emo-express-bar',
        position: 'before-cta',
        html: `
          <div class="emo-adaptation emo-express-bar">
            <div class="emo-express-inner">
              <span class="emo-express-icon">⚡</span>
              <span>Fast checkout available — your order ships today</span>
            </div>
          </div>
        `,
      },
    ],
    hideElements: ['.product-related', '.product-reviews-teaser'],
    showElements: ['.product-express-checkout'],
    bodyClass: 'emo-express',
  },

  PRICE_ALERT_MODE: {
    sections: [
      {
        id: 'emo-price-tools',
        position: 'after-price',
        html: `
          <div class="emo-adaptation emo-price-tools">
            <div class="emo-price-breakdown">
              <div class="emo-price-row">
                <span>Price per month (12 installments)</span>
                <strong>108.25 lei/mo</strong>
              </div>
              <div class="emo-price-row">
                <span>Price match guarantee</span>
                <span class="emo-badge">Active</span>
              </div>
              <div class="emo-price-row">
                <span>Free return within 30 days</span>
                <span class="emo-badge">Included</span>
              </div>
            </div>
          </div>
        `,
      },
    ],
    hideElements: [],
    showElements: ['.product-price-history'],
    bodyClass: 'emo-price',
  },

  DESIGN_OXYGEN: {
    sections: [
      {
        id: 'emo-oxygen-msg',
        position: 'top',
        html: `
          <div class="emo-adaptation emo-oxygen-msg">
            <span>Take your time. Here's a simplified view.</span>
          </div>
        `,
      },
    ],
    hideElements: ['.product-upsells', '.product-badges', '.product-related'],
    showElements: [],
    bodyClass: 'emo-oxygen',
  },

  NEGOTIATOR_MODE: {
    sections: [
      {
        id: 'emo-reassurance',
        position: 'after-cta',
        html: `
          <div class="emo-adaptation emo-reassurance">
            <div class="emo-trust-signals">
              <div class="emo-trust-item">
                <span class="emo-trust-icon">🛡️</span>
                <div>
                  <strong>2 Year Warranty</strong>
                  <p>Full manufacturer coverage included</p>
                </div>
              </div>
              <div class="emo-trust-item">
                <span class="emo-trust-icon">↩️</span>
                <div>
                  <strong>30 Day Returns</strong>
                  <p>Free returns, no questions asked</p>
                </div>
              </div>
              <div class="emo-trust-item">
                <span class="emo-trust-icon">⭐</span>
                <div>
                  <strong>4.8/5 Rating</strong>
                  <p>Based on 2,847 verified reviews</p>
                </div>
              </div>
            </div>
          </div>
        `,
      },
    ],
    hideElements: [],
    showElements: ['.product-social-proof'],
    bodyClass: 'emo-negotiator',
  },

  RESEARCH_MODE: {
    sections: [
      {
        id: 'emo-research-panel',
        position: 'after-specs',
        html: `
          <div class="emo-adaptation emo-research-panel">
            <h3 class="emo-research-title">Deep Dive</h3>
            <div class="emo-comparison-grid">
              <div class="emo-compare-card">
                <strong>vs. Bose QC Ultra</strong>
                <p>Better ANC, lighter weight, USB-C</p>
                <span class="emo-verdict emo-win">EmotionUI Pick</span>
              </div>
              <div class="emo-compare-card">
                <strong>vs. AirPods Max</strong>
                <p>Better portability, lower price, similar sound</p>
                <span class="emo-verdict emo-win">Value Winner</span>
              </div>
            </div>
          </div>
        `,
      },
    ],
    hideElements: [],
    showElements: ['.product-full-specs', '.product-reviews-detailed'],
    bodyClass: 'emo-research',
  },

  SPOTLIGHT_MODE: {
    sections: [
      {
        id: 'emo-spotlight-guide',
        position: 'top',
        html: `
          <div class="emo-adaptation emo-spotlight-guide">
            <span>👋 Here's what matters most:</span>
          </div>
        `,
      },
    ],
    hideElements: ['.product-secondary-info', '.product-upsells'],
    showElements: [],
    bodyClass: 'emo-spotlight',
  },

  EDITORIAL_MODE: {
    sections: [
      {
        id: 'emo-editorial-header',
        position: 'top',
        html: `
          <div class="emo-adaptation emo-editorial-header">
            <span>Evening Edition — Relaxed Browsing</span>
          </div>
        `,
      },
    ],
    hideElements: ['.product-urgency', '.product-badges', '.product-upsells'],
    showElements: [],
    bodyClass: 'emo-editorial',
  },
};

export class AdaptiveLayout {
  constructor(container) {
    this.container = container || document.getElementById('product-page');
    this.currentState = 'STANDARD';
    this._insertedElements = [];
    this._hiddenElements = [];
    this._shownElements = [];
  }

  apply(state) {
    // Clean up previous adaptations
    this._cleanup();

    const adaptation = ADAPTATIONS[state] || ADAPTATIONS.STANDARD;

    // Remove old body classes
    document.body.className = document.body.className
      .replace(/emo-\S+/g, '')
      .trim();
    document.body.classList.add(adaptation.bodyClass);

    // Insert adaptive sections
    if (this.container) {
      for (const section of adaptation.sections) {
        const existing = document.getElementById(section.id);
        if (existing) existing.remove();

        const wrapper = document.createElement('div');
        wrapper.id = section.id;
        wrapper.innerHTML = section.html;
        const el = wrapper.firstElementChild;

        const anchor = this._findAnchor(section.position);
        if (anchor) {
          anchor.parentNode.insertBefore(el, anchor.nextSibling);
        } else {
          this.container.prepend(el);
        }
        this._insertedElements.push(el);
      }

      // Hide elements
      for (const selector of adaptation.hideElements) {
        const els = this.container.querySelectorAll(selector);
        els.forEach(el => {
          el.style.display = 'none';
          this._hiddenElements.push(el);
        });
      }

      // Show elements
      for (const selector of adaptation.showElements) {
        const els = this.container.querySelectorAll(selector);
        els.forEach(el => {
          el.style.display = '';
          this._shownElements.push(el);
        });
      }
    }

    this.currentState = state;
  }

  _findAnchor(position) {
    if (!this.container) return null;
    const map = {
      'top': null, // prepend
      'before-cta': this.container.querySelector('.product-cta'),
      'after-cta': this.container.querySelector('.product-cta'),
      'after-price': this.container.querySelector('.product-price'),
      'after-specs': this.container.querySelector('.product-specs'),
    };
    return map[position] || null;
  }

  _cleanup() {
    this._insertedElements.forEach(el => el?.remove());
    this._insertedElements = [];

    this._hiddenElements.forEach(el => {
      if (el) el.style.display = '';
    });
    this._hiddenElements = [];

    this._shownElements = [];
  }

  reset() {
    this.apply('STANDARD');
  }
}
