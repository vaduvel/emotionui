/**
 * Adaptive State UI SDK — Main Orchestrator
 * Connects all 5 layers: Sensory → State Engine → Tokens → Layout → UR
 */

import { Sensory } from './sensory.js';
import { EmotionEngine as StateEngine } from './engine.js';
import { DesignTokens } from './tokens.js';
import { AdaptiveLayout } from './layout.js';
import { URWidget } from './ur.js';

export class EmotionUI {
  constructor(config = {}) {
    this.sensory = new Sensory(config.sensory);
    this.engine = new StateEngine();
    this.tokens = new DesignTokens(config.root || document.documentElement);
    this.layout = new AdaptiveLayout(config.container);
    this.ur = new URWidget();

    this._callbacks = [];
    this._sessionStart = Date.now();
    this._supabaseUrl = config.supabaseUrl || null;
    this._supabaseKey = config.supabaseKey || null;
    this._productId = config.productId || 'sony-wh1000xm5';
  }

  init() {
    // Initialize UR widget
    this.ur.init({
      onReset: () => this.reset(),
      onDetails: () => this._showDetails(),
    });

    // Connect sensory → engine → tokens/layout/ur
    this.sensory.onSignalChange((signals, event) => {
      if (event === 'session_end') {
        this._endSession();
        return;
      }

      const result = this.engine.classify(signals);
      this.tokens.apply(result.state);
      this.layout.apply(result.state);
      this.ur.update(result);

      this._callbacks.forEach(cb => cb({
        signals,
        classification: result,
        state: result.state,
      }));
    });

    // Bind sensory listeners
    this.sensory.bind();

    // Apply default state
    this.tokens.apply('STANDARD');

    // Session end on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this._endSession());
    }

    return this;
  }

  onChange(callback) {
    this._callbacks.push(callback);
  }

  classify(signals) {
    const result = this.engine.classify(signals || this.sensory.signals);
    this.tokens.apply(result.state);
    this.layout.apply(result.state);
    this.ur.update(result);
    return result;
  }

  getState() {
    return {
      signals: { ...this.sensory.signals },
      classification: this.engine.getState(),
      currentState: this.engine.getState()?.state || 'STANDARD',
    };
  }

  reset() {
    this.sensory.reset();
    this.engine.reset();
    this.tokens.reset();
    this.layout.reset();
    this.ur.hide();
    this._callbacks.forEach(cb => cb({
      signals: this.sensory.signals,
      classification: { state: 'STANDARD', label: 'Standard', confidence: 0 },
      state: 'STANDARD',
    }));
  }

  async _endSession() {
    if (!this._supabaseUrl || !this._supabaseKey) return;

    const signals = this.sensory.signals;
    const classification = this.engine.getState();
    const timeOnPage = Math.round((Date.now() - this._sessionStart) / 1000);

    const payload = {
      session_id: this._generateSessionId(),
      product_id: this._productId,
      ...signals,
      time_on_page_sec: timeOnPage,
      classified_state: classification?.state || 'STANDARD',
      classified_action: classification?.action || 'default',
      confidence: classification?.confidence || 0,
      user_agent: navigator.userAgent,
      screen_width: window.innerWidth,
    };

    try {
      await fetch(`${this._supabaseUrl}/rest/v1/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this._supabaseKey,
          'Authorization': `Bearer ${this._supabaseKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn('Adaptive State UI: Failed to save session', e);
    }
  }

  _generateSessionId() {
    return 'emo_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  _showDetails() {
    const state = this.getState();
    console.group('Adaptive State UI — Session Details');
    console.log('Signals:', state.signals);
    console.log('Classification:', state.classification);
    console.log('Engine Rules:', this.engine.getRules());
    console.groupEnd();
  }

  destroy() {
    this.sensory.destroy();
    this.ur.destroy();
    this.layout.reset();
    this.tokens.reset();
  }
}

export class AdaptiveStateUI extends EmotionUI {}

// Named exports for individual layer access
export { Sensory } from './sensory.js';
export { EmotionEngine, StateEngine } from './engine.js';
export { DesignTokens } from './tokens.js';
export { AdaptiveLayout } from './layout.js';
export { URWidget } from './ur.js';
