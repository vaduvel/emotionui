/**
 * Adaptive State UI — Layer 1: Sensory
 * Tracks behavioral signals from mouse, keyboard, scroll, and navigation events.
 * All processing is on-device. No data leaves the browser until session end.
 */

const DEFAULT_CONFIG = {
  jitterWindow: 500,        // ms window for mouse jitter calculation
  jitterThreshold: 50,      // px movement threshold for jitter detection
  rageClickWindow: 1000,    // ms window for rage click detection
  rageClickCount: 3,        // clicks within window to count as rage
  dwellThreshold: 3000,     // ms to count as a dwell event
  scrollThrashWindow: 2000, // ms window for scroll direction changes
  exitIntentThreshold: 10,  // px from top of viewport
  inactivityTimeout: 30000, // ms before session ends from inactivity
};

export class Sensory {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.signals = this._createSignals();
    this._listeners = [];
    this._callbacks = [];
    this._mousePositions = [];
    this._clickTimestamps = [];
    this._clickPositions = [];
    this._scrollDirections = [];
    this._dwellTimer = null;
    this._inactivityTimer = null;
    this._sessionEvents = [];
    this._lastScrollY = 0;
    this._hoveredElement = null;
    this._hoverStart = 0;
    this._bound = false;
  }

  _createSignals() {
    return {
      rage_clicks: 0,
      mouse_jitter: 0,
      exit_intent: 0,
      dwell_events: 0,
      scroll_thrash: 0,
      dead_clicks: 0,
      product_views: 1,
      spec_dwell: 0,
      cart_add_remove: 0,
      price_hover: 0,
      direct_checkout: false,
      total_visits: 1,
      cart_abandons: 0,
      hour: new Date().getHours(),
      mobile: /Mobi|Android/i.test(navigator.userAgent),
    };
  }

  onSignalChange(callback) {
    this._callbacks.push(callback);
  }

  _emit() {
    const snapshot = { ...this.signals };
    this._callbacks.forEach(cb => cb(snapshot));
  }

  _recordEvent(type, data = {}) {
    this._sessionEvents.push({
      type,
      timestamp: Date.now(),
      ...data,
    });
  }

  getSessionEvents() {
    return this._sessionEvents;
  }

  bind(container = document) {
    if (this._bound) return;
    this._bound = true;

    const on = (el, evt, fn) => {
      el.addEventListener(evt, fn, { passive: true });
      this._listeners.push([el, evt, fn]);
    };

    // Mouse movement → jitter detection
    on(container, 'mousemove', (e) => {
      const now = Date.now();
      this._mousePositions.push({ x: e.clientX, y: e.clientY, t: now });
      this._mousePositions = this._mousePositions.filter(p => now - p.t < this.config.jitterWindow);

      if (this._mousePositions.length >= 3) {
        let totalDist = 0;
        for (let i = 1; i < this._mousePositions.length; i++) {
          const dx = this._mousePositions[i].x - this._mousePositions[i - 1].x;
          const dy = this._mousePositions[i].y - this._mousePositions[i - 1].y;
          totalDist += Math.sqrt(dx * dx + dy * dy);
        }
        const avgSpeed = totalDist / (this.config.jitterWindow / 1000);
        if (avgSpeed > this.config.jitterThreshold * 10) {
          this.signals.mouse_jitter = Math.min(10, this.signals.mouse_jitter + 0.5);
          this._recordEvent('jitter', { speed: avgSpeed });
          this._emit();
        }
      }

      this._resetInactivity();
    });

    // Click tracking → rage clicks + dead clicks
    on(container, 'click', (e) => {
      const now = Date.now();
      this._clickTimestamps.push(now);
      this._clickPositions.push({ x: e.clientX, y: e.clientY, t: now });
      this._clickTimestamps = this._clickTimestamps.filter(t => now - t < this.config.rageClickWindow);

      // Rage clicks: multiple rapid clicks in small area
      if (this._clickTimestamps.length >= this.config.rageClickCount) {
        const recent = this._clickPositions.filter(p => now - p.t < this.config.rageClickWindow);
        if (recent.length >= this.config.rageClickCount) {
          const maxDist = this._maxDistance(recent);
          if (maxDist < 100) {
            this.signals.rage_clicks++;
            this._recordEvent('rage_click', { count: this.signals.rage_clicks });
            this._emit();
          }
        }
      }

      // Dead clicks: click on non-interactive element
      const tag = e.target.tagName.toLowerCase();
      const interactive = ['a', 'button', 'input', 'select', 'textarea', 'label'];
      const isInteractive = interactive.includes(tag) ||
        e.target.closest('a, button, [role="button"], [onclick]') ||
        e.target.hasAttribute('onclick') ||
        window.getComputedStyle(e.target).cursor === 'pointer';

      if (!isInteractive) {
        this.signals.dead_clicks++;
        this._recordEvent('dead_click', { target: tag });
        this._emit();
      }

      this._resetInactivity();
    });

    // Scroll tracking → scroll thrash
    on(window, 'scroll', () => {
      const now = Date.now();
      const currentY = window.scrollY;
      const direction = currentY > this._lastScrollY ? 'down' : 'up';

      this._scrollDirections.push({ dir: direction, t: now });
      this._scrollDirections = this._scrollDirections.filter(s => now - s.t < this.config.scrollThrashWindow);

      let changes = 0;
      for (let i = 1; i < this._scrollDirections.length; i++) {
        if (this._scrollDirections[i].dir !== this._scrollDirections[i - 1].dir) {
          changes++;
        }
      }

      if (changes >= 3) {
        this.signals.scroll_thrash = Math.min(10, this.signals.scroll_thrash + 0.3);
        this._recordEvent('scroll_thrash', { changes });
        this._emit();
      }

      this._lastScrollY = currentY;
      this._resetInactivity();
    });

    // Exit intent: mouse leaves viewport near top
    on(document, 'mouseout', (e) => {
      if (e.clientY <= this.config.exitIntentThreshold && e.relatedTarget === null) {
        this.signals.exit_intent++;
        this._recordEvent('exit_intent');
        this._emit();
      }
    });

    // Dwell time tracking
    on(container, 'mouseover', (e) => {
      const el = e.target.closest('[data-emotion-track]');
      if (el) {
        this._hoveredElement = el;
        this._hoverStart = Date.now();
        clearTimeout(this._dwellTimer);
        this._dwellTimer = setTimeout(() => {
          const trackType = el.dataset.emotionTrack;
          if (trackType === 'spec') {
            this.signals.spec_dwell++;
            this._recordEvent('spec_dwell');
          } else if (trackType === 'price') {
            this.signals.price_hover++;
            this._recordEvent('price_hover');
          } else {
            this.signals.dwell_events++;
            this._recordEvent('dwell_event', { element: trackType });
          }
          this._emit();
        }, this.config.dwellThreshold);
      }
    });

    on(container, 'mouseout', (e) => {
      const el = e.target.closest('[data-emotion-track]');
      if (el && el === this._hoveredElement) {
        clearTimeout(this._dwellTimer);
        this._hoveredElement = null;
      }
    });

    // Visibility change for session timing
    on(document, 'visibilitychange', () => {
      if (document.hidden) {
        this._recordEvent('tab_hidden');
      } else {
        this._recordEvent('tab_visible');
      }
    });

    this._resetInactivity();
  }

  _maxDistance(points) {
    let max = 0;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        max = Math.max(max, Math.sqrt(dx * dx + dy * dy));
      }
    }
    return max;
  }

  _resetInactivity() {
    clearTimeout(this._inactivityTimer);
    this._inactivityTimer = setTimeout(() => {
      this._recordEvent('inactivity_timeout');
      this._callbacks.forEach(cb => cb(this.signals, 'session_end'));
    }, this.config.inactivityTimeout);
  }

  // Manual signal setters for demo panel
  setSignal(name, value) {
    if (name in this.signals) {
      this.signals[name] = value;
      this._recordEvent('manual_set', { signal: name, value });
      this._emit();
    }
  }

  incrementSignal(name, delta = 1) {
    if (name in this.signals && typeof this.signals[name] === 'number') {
      this.signals[name] = Math.max(0, this.signals[name] + delta);
      this._recordEvent('manual_increment', { signal: name, delta });
      this._emit();
    }
  }

  toggleSignal(name) {
    if (name in this.signals && typeof this.signals[name] === 'boolean') {
      this.signals[name] = !this.signals[name];
      this._recordEvent('manual_toggle', { signal: name, value: this.signals[name] });
      this._emit();
    }
  }

  reset() {
    this.signals = this._createSignals();
    this._sessionEvents = [];
    this._mousePositions = [];
    this._clickTimestamps = [];
    this._clickPositions = [];
    this._scrollDirections = [];
    this._emit();
  }

  destroy() {
    this._listeners.forEach(([el, evt, fn]) => el.removeEventListener(evt, fn));
    this._listeners = [];
    clearTimeout(this._dwellTimer);
    clearTimeout(this._inactivityTimer);
    this._bound = false;
  }
}
