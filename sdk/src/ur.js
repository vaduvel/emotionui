/**
 * Adaptive State UI — Layer 5: User Rights (UR) Transparency Widget
 * Always visible when a non-standard mode is active.
 * Shows what the system detected and lets the user opt out.
 */

const WIDGET_STYLES = `
  .emo-ur-widget {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    background: var(--emo-bg, #ffffff);
    border: 1px solid var(--emo-border, #dee2e6);
    border-radius: 12px;
    padding: 12px 20px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    color: var(--emo-text, #1a1a2e);
    transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1),
                opacity 0.55s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0;
    max-width: 520px;
  }

  .emo-ur-widget.emo-ur-visible {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }

  .emo-ur-widget.emo-ur-hidden {
    transform: translateX(-50%) translateY(100px);
    opacity: 0;
    pointer-events: none;
  }

  .emo-ur-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--emo-accent, #4361ee);
    flex-shrink: 0;
    animation: emo-ur-pulse 2s ease-in-out infinite;
  }

  @keyframes emo-ur-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .emo-ur-text {
    flex: 1;
    line-height: 1.4;
  }

  .emo-ur-label {
    font-weight: 600;
    color: var(--emo-accent, #4361ee);
  }

  .emo-ur-desc {
    color: var(--emo-text-secondary, #6c757d);
    margin-top: 2px;
  }

  .emo-ur-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .emo-ur-btn {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--emo-border, #dee2e6);
    background: transparent;
    color: var(--emo-text, #1a1a2e);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }

  .emo-ur-btn:hover {
    background: var(--emo-bg-secondary, #f8f9fa);
  }

  .emo-ur-btn-reset {
    border-color: var(--emo-accent, #4361ee);
    color: var(--emo-accent, #4361ee);
  }

  .emo-ur-btn-reset:hover {
    background: var(--emo-accent, #4361ee);
    color: white;
  }

  .emo-ur-privacy {
    font-size: 10px;
    color: var(--emo-text-secondary, #6c757d);
    opacity: 0.7;
  }
`;

export class URWidget {
  constructor() {
    this.widget = null;
    this.currentState = null;
    this._onReset = null;
    this._onDetails = null;
    this._styleInjected = false;
  }

  init(options = {}) {
    this._onReset = options.onReset || (() => {});
    this._onDetails = options.onDetails || (() => {});

    if (!this._styleInjected) {
      const style = document.createElement('style');
      style.textContent = WIDGET_STYLES;
      document.head.appendChild(style);
      this._styleInjected = true;
    }

    this.widget = document.createElement('div');
    this.widget.className = 'emo-ur-widget emo-ur-hidden';
    this.widget.innerHTML = `
      <div class="emo-ur-dot"></div>
      <div class="emo-ur-text">
        <div class="emo-ur-label"></div>
        <div class="emo-ur-desc"></div>
        <div class="emo-ur-privacy">All processing happens on your device. No personal data is collected.</div>
      </div>
      <div class="emo-ur-actions">
        <button class="emo-ur-btn emo-ur-btn-details">Details</button>
        <button class="emo-ur-btn emo-ur-btn-reset">Reset</button>
      </div>
    `;

    this.widget.querySelector('.emo-ur-btn-reset').addEventListener('click', () => {
      this._onReset();
    });

    this.widget.querySelector('.emo-ur-btn-details').addEventListener('click', () => {
      this._onDetails();
    });

    document.body.appendChild(this.widget);
  }

  update(result) {
    if (!this.widget) return;

    if (!result || result.state === 'STANDARD') {
      this.hide();
      return;
    }

    const label = this.widget.querySelector('.emo-ur-label');
    const desc = this.widget.querySelector('.emo-ur-desc');

    label.textContent = `Adapted: ${result.label}`;
    desc.textContent = result.description;

    this.currentState = result.state;
    this.show();
  }

  show() {
    if (!this.widget) return;
    this.widget.classList.remove('emo-ur-hidden');
    // Force reflow for transition
    void this.widget.offsetHeight;
    this.widget.classList.add('emo-ur-visible');
  }

  hide() {
    if (!this.widget) return;
    this.widget.classList.remove('emo-ur-visible');
    this.widget.classList.add('emo-ur-hidden');
    this.currentState = null;
  }

  destroy() {
    this.widget?.remove();
    this.widget = null;
  }
}
