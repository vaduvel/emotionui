/**
 * Adaptive State UI — Layer 2: State Engine
 * Rule-based classifier with weighted confidence scoring.
 * Optional ONNX ML model for enhanced state classification.
 */

const RULES = [
  {
    id: 'R_EXPRESS',
    state: 'EXPRESS_LANE',
    weight: 0.88,
    test: (s) => s.direct_checkout === true,
    action: 'streamline_checkout',
    label: 'Express Buyer',
    description: 'Direct checkout detected — streamline the purchase flow',
  },
  {
    id: 'R_PRICE',
    state: 'PRICE_ALERT_MODE',
    weight: 0.90,
    test: (s) => s.price_hover >= 2 && s.cart_abandons >= 2 && s.total_visits >= 3,
    action: 'show_price_tools',
    label: 'Price Sensitive',
    description: 'Repeated price checking and cart abandonment — show value tools',
  },
  {
    id: 'R_FRUSTRATION',
    state: 'DESIGN_OXYGEN',
    weight: 0.85,
    test: (s) => s.rage_clicks >= 4 || (s.mouse_jitter >= 5 && s.scroll_thrash >= 3),
    action: 'simplify_layout',
    label: 'Frustrated',
    description: 'High frustration signals — simplify and add breathing room',
  },
  {
    id: 'R_HESITANT',
    state: 'NEGOTIATOR_MODE',
    weight: 0.82,
    test: (s) => s.exit_intent >= 2 && (s.cart_abandons >= 1 || s.price_hover >= 2),
    action: 'show_reassurance',
    label: 'Hesitant',
    description: 'Exit intent with purchase signals — show social proof and guarantees',
  },
  {
    id: 'R_RESEARCH',
    state: 'RESEARCH_MODE',
    weight: 0.75,
    test: (s) => s.spec_dwell >= 3 || s.product_views >= 4,
    action: 'expand_details',
    label: 'Researcher',
    description: 'Deep spec engagement — expand technical details and comparisons',
  },
  {
    id: 'R_CONFUSED',
    state: 'SPOTLIGHT_MODE',
    weight: 0.78,
    test: (s) => s.dwell_events >= 5 || s.dead_clicks >= 3,
    action: 'highlight_actions',
    label: 'Confused',
    description: 'Navigation difficulty — spotlight key actions and simplify',
  },
  {
    id: 'R_NIGHT',
    state: 'EDITORIAL_MODE',
    weight: 0.60,
    test: (s) => s.hour >= 20 && s.mobile === true && s.total_visits <= 2,
    action: 'editorial_layout',
    label: 'Night Browser',
    description: 'Late mobile browsing — editorial calm layout',
  },
];

const CONFIDENCE_THRESHOLD = 0.25;

export class EmotionEngine {
  constructor() {
    this.rules = RULES;
    this.currentState = null;
    this.mlModel = null;
    this._callbacks = [];
  }

  onStateChange(callback) {
    this._callbacks.push(callback);
  }

  _emit(result) {
    this._callbacks.forEach(cb => cb(result));
  }

  classify(signals) {
    const matches = [];

    for (const rule of this.rules) {
      if (rule.test(signals)) {
        matches.push({
          ruleId: rule.id,
          state: rule.state,
          action: rule.action,
          label: rule.label,
          description: rule.description,
          weight: rule.weight,
          confidence: rule.weight,
        });
      }
    }

    // Sort by weight descending — highest priority wins
    matches.sort((a, b) => b.weight - a.weight);

    let result;

    if (matches.length > 0 && matches[0].confidence >= CONFIDENCE_THRESHOLD) {
      const winner = matches[0];
      result = {
        state: winner.state,
        action: winner.action,
        label: winner.label,
        description: winner.description,
        confidence: winner.confidence,
        ruleId: winner.ruleId,
        allMatches: matches,
        source: 'rules',
      };
    } else {
      result = {
        state: 'STANDARD',
        action: 'default',
        label: 'Standard',
        description: 'No strong behavioral signal detected',
        confidence: 0,
        ruleId: null,
        allMatches: matches,
        source: 'rules',
      };
    }

    const changed = !this.currentState || this.currentState.state !== result.state;
    this.currentState = result;

    if (changed) {
      this._emit(result);
    }

    return result;
  }

  async classifyWithML(signals) {
    if (!this.mlModel) {
      return this.classify(signals);
    }

    try {
      const mlResult = await this._runMLModel(signals);
      const ruleResult = this.classify(signals);

      // ML model overrides rules only if confidence is higher
      if (mlResult.confidence > ruleResult.confidence) {
        mlResult.source = 'ml';
        mlResult.ruleResult = ruleResult;
        this.currentState = mlResult;
        this._emit(mlResult);
        return mlResult;
      }

      return ruleResult;
    } catch (e) {
      console.warn('Adaptive State UI: ML model failed, falling back to rules', e);
      return this.classify(signals);
    }
  }

  async loadModel(url) {
    try {
      if (typeof window !== 'undefined' && window.ort) {
        this.mlModel = await window.ort.InferenceSession.create(url);
        console.log('Adaptive State UI: ML model loaded');
      }
    } catch (e) {
      console.warn('Adaptive State UI: Could not load ML model', e);
    }
  }

  async _runMLModel(signals) {
    const STATE_MAP = [
      'STANDARD', 'EXPRESS_LANE', 'PRICE_ALERT_MODE', 'DESIGN_OXYGEN',
      'NEGOTIATOR_MODE', 'RESEARCH_MODE', 'SPOTLIGHT_MODE', 'EDITORIAL_MODE'
    ];

    const ACTION_MAP = [
      'default', 'streamline_checkout', 'show_price_tools', 'simplify_layout',
      'show_reassurance', 'expand_details', 'highlight_actions', 'editorial_layout'
    ];

    const LABEL_MAP = [
      'Standard', 'Express Buyer', 'Price Sensitive', 'Frustrated',
      'Hesitant', 'Researcher', 'Confused', 'Night Browser'
    ];

    const features = new Float32Array([
      signals.rage_clicks,
      signals.mouse_jitter,
      signals.exit_intent,
      signals.dwell_events,
      signals.scroll_thrash,
      signals.dead_clicks,
      signals.product_views,
      signals.spec_dwell,
      signals.cart_add_remove,
      signals.price_hover,
      signals.direct_checkout ? 1 : 0,
      signals.total_visits,
      signals.cart_abandons,
      signals.hour,
      signals.mobile ? 1 : 0,
    ]);

    const tensor = new window.ort.Tensor('float32', features, [1, 15]);
    const results = await this.mlModel.run({ input: tensor });
    const probs = results.probabilities?.data || results.output?.data;

    if (!probs) {
      throw new Error('No output from model');
    }

    let maxIdx = 0;
    let maxProb = probs[0];
    for (let i = 1; i < probs.length; i++) {
      if (probs[i] > maxProb) {
        maxProb = probs[i];
        maxIdx = i;
      }
    }

    return {
      state: STATE_MAP[maxIdx] || 'STANDARD',
      action: ACTION_MAP[maxIdx] || 'default',
      label: LABEL_MAP[maxIdx] || 'Standard',
      description: `ML model classified with ${(maxProb * 100).toFixed(1)}% confidence`,
      confidence: maxProb,
      ruleId: null,
      allMatches: [],
      probabilities: Array.from(probs),
    };
  }

  getState() {
    return this.currentState;
  }

  getRules() {
    return this.rules.map(r => ({
      id: r.id,
      state: r.state,
      weight: r.weight,
      label: r.label,
      description: r.description,
    }));
  }

  reset() {
    this.currentState = null;
  }
}

export { EmotionEngine as StateEngine };
