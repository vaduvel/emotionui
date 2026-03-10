/**
 * Adaptive State UI — Layer 3: Design Tokens
 * Maps behavioral states to CSS custom properties.
 * Applied to :root for global theming.
 */

const TOKEN_SETS = {
  STANDARD: {
    '--emo-bg': '#ffffff',
    '--emo-bg-secondary': '#f8f9fa',
    '--emo-text': '#1a1a2e',
    '--emo-text-secondary': '#6c757d',
    '--emo-accent': '#4361ee',
    '--emo-accent-hover': '#3a56d4',
    '--emo-border': '#dee2e6',
    '--emo-radius': '8px',
    '--emo-shadow': '0 2px 8px rgba(0,0,0,0.08)',
    '--emo-shadow-lg': '0 8px 24px rgba(0,0,0,0.12)',
    '--emo-spacing': '1rem',
    '--emo-spacing-lg': '2rem',
    '--emo-font-size': '1rem',
    '--emo-font-size-lg': '1.25rem',
    '--emo-line-height': '1.6',
    '--emo-transition': '0.55s cubic-bezier(0.4, 0, 0.2, 1)',
    '--emo-cta-bg': '#4361ee',
    '--emo-cta-text': '#ffffff',
    '--emo-cta-size': '1rem',
    '--emo-cta-padding': '0.75rem 2rem',
    '--emo-cta-radius': '8px',
    '--emo-cta-shadow': '0 4px 12px rgba(67, 97, 238, 0.3)',
    '--emo-panel-opacity': '1',
    '--emo-layout-gap': '2rem',
    '--emo-highlight': 'transparent',
    '--emo-banner-bg': 'transparent',
    '--emo-banner-text': 'transparent',
  },

  EXPRESS_LANE: {
    '--emo-bg': '#ffffff',
    '--emo-bg-secondary': '#f0fdf4',
    '--emo-accent': '#16a34a',
    '--emo-accent-hover': '#15803d',
    '--emo-cta-bg': '#16a34a',
    '--emo-cta-text': '#ffffff',
    '--emo-cta-size': '1.15rem',
    '--emo-cta-padding': '1rem 2.5rem',
    '--emo-cta-shadow': '0 6px 16px rgba(22, 163, 74, 0.35)',
    '--emo-banner-bg': '#f0fdf4',
    '--emo-banner-text': '#15803d',
    '--emo-shadow': '0 2px 8px rgba(22, 163, 74, 0.1)',
  },

  PRICE_ALERT_MODE: {
    '--emo-bg': '#ffffff',
    '--emo-bg-secondary': '#fffbeb',
    '--emo-accent': '#d97706',
    '--emo-accent-hover': '#b45309',
    '--emo-cta-bg': '#d97706',
    '--emo-cta-text': '#ffffff',
    '--emo-cta-size': '1.05rem',
    '--emo-cta-padding': '0.85rem 2rem',
    '--emo-cta-shadow': '0 4px 14px rgba(217, 119, 6, 0.3)',
    '--emo-banner-bg': '#fffbeb',
    '--emo-banner-text': '#92400e',
    '--emo-highlight': 'rgba(217, 119, 6, 0.08)',
  },

  DESIGN_OXYGEN: {
    '--emo-bg': '#fafbfc',
    '--emo-bg-secondary': '#f0f4ff',
    '--emo-text': '#1a1a2e',
    '--emo-text-secondary': '#64748b',
    '--emo-accent': '#6366f1',
    '--emo-accent-hover': '#4f46e5',
    '--emo-radius': '12px',
    '--emo-shadow': '0 1px 4px rgba(0,0,0,0.04)',
    '--emo-spacing': '1.5rem',
    '--emo-spacing-lg': '3rem',
    '--emo-font-size': '1.05rem',
    '--emo-line-height': '1.8',
    '--emo-cta-bg': '#6366f1',
    '--emo-cta-text': '#ffffff',
    '--emo-cta-size': '1.1rem',
    '--emo-cta-padding': '1rem 2.5rem',
    '--emo-cta-radius': '12px',
    '--emo-cta-shadow': '0 4px 16px rgba(99, 102, 241, 0.25)',
    '--emo-layout-gap': '3rem',
    '--emo-banner-bg': '#f0f4ff',
    '--emo-banner-text': '#4338ca',
  },

  NEGOTIATOR_MODE: {
    '--emo-bg': '#ffffff',
    '--emo-bg-secondary': '#f8fafc',
    '--emo-accent': '#0891b2',
    '--emo-accent-hover': '#0e7490',
    '--emo-cta-bg': '#0891b2',
    '--emo-cta-text': '#ffffff',
    '--emo-cta-size': '1.05rem',
    '--emo-cta-padding': '0.85rem 2rem',
    '--emo-cta-shadow': '0 4px 14px rgba(8, 145, 178, 0.3)',
    '--emo-shadow': '0 2px 12px rgba(0,0,0,0.06)',
    '--emo-banner-bg': '#ecfeff',
    '--emo-banner-text': '#155e75',
    '--emo-highlight': 'rgba(8, 145, 178, 0.06)',
  },

  RESEARCH_MODE: {
    '--emo-bg': '#ffffff',
    '--emo-bg-secondary': '#f5f3ff',
    '--emo-accent': '#7c3aed',
    '--emo-accent-hover': '#6d28d9',
    '--emo-font-size': '0.95rem',
    '--emo-line-height': '1.7',
    '--emo-cta-bg': '#7c3aed',
    '--emo-cta-text': '#ffffff',
    '--emo-cta-size': '0.95rem',
    '--emo-cta-padding': '0.75rem 1.75rem',
    '--emo-cta-shadow': '0 4px 12px rgba(124, 58, 237, 0.25)',
    '--emo-banner-bg': '#f5f3ff',
    '--emo-banner-text': '#5b21b6',
    '--emo-layout-gap': '1.5rem',
  },

  SPOTLIGHT_MODE: {
    '--emo-bg': '#ffffff',
    '--emo-bg-secondary': '#fff7ed',
    '--emo-accent': '#ea580c',
    '--emo-accent-hover': '#c2410c',
    '--emo-radius': '10px',
    '--emo-cta-bg': '#ea580c',
    '--emo-cta-text': '#ffffff',
    '--emo-cta-size': '1.15rem',
    '--emo-cta-padding': '1rem 2.5rem',
    '--emo-cta-radius': '10px',
    '--emo-cta-shadow': '0 6px 18px rgba(234, 88, 12, 0.35)',
    '--emo-shadow': '0 4px 16px rgba(234, 88, 12, 0.1)',
    '--emo-highlight': 'rgba(234, 88, 12, 0.08)',
    '--emo-banner-bg': '#fff7ed',
    '--emo-banner-text': '#9a3412',
  },

  EDITORIAL_MODE: {
    '--emo-bg': '#1a1a2e',
    '--emo-bg-secondary': '#16213e',
    '--emo-text': '#e2e8f0',
    '--emo-text-secondary': '#94a3b8',
    '--emo-accent': '#a78bfa',
    '--emo-accent-hover': '#8b5cf6',
    '--emo-border': '#334155',
    '--emo-radius': '6px',
    '--emo-shadow': '0 2px 8px rgba(0,0,0,0.3)',
    '--emo-shadow-lg': '0 8px 24px rgba(0,0,0,0.4)',
    '--emo-spacing': '1.25rem',
    '--emo-spacing-lg': '2.5rem',
    '--emo-font-size': '1.1rem',
    '--emo-line-height': '1.9',
    '--emo-cta-bg': '#a78bfa',
    '--emo-cta-text': '#1a1a2e',
    '--emo-cta-size': '1rem',
    '--emo-cta-padding': '0.85rem 2rem',
    '--emo-cta-radius': '6px',
    '--emo-cta-shadow': '0 4px 14px rgba(167, 139, 250, 0.3)',
    '--emo-banner-bg': '#16213e',
    '--emo-banner-text': '#c4b5fd',
    '--emo-highlight': 'rgba(167, 139, 250, 0.06)',
  },
};

export class DesignTokens {
  constructor(root = document.documentElement) {
    this.root = root;
    this.currentState = 'STANDARD';
    this.tokens = TOKEN_SETS;
  }

  apply(state) {
    const set = this.tokens[state] || this.tokens.STANDARD;
    const base = this.tokens.STANDARD;

    // Apply base tokens first, then override with state-specific
    const merged = { ...base, ...set };

    for (const [prop, value] of Object.entries(merged)) {
      this.root.style.setProperty(prop, value);
    }

    this.root.setAttribute('data-emotion-state', state);
    this.currentState = state;
  }

  getTokens(state) {
    return { ...this.tokens.STANDARD, ...(this.tokens[state] || {}) };
  }

  getAllStates() {
    return Object.keys(this.tokens);
  }

  reset() {
    this.apply('STANDARD');
  }
}
