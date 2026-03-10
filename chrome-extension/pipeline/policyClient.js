(() => {
  class PolicyClient {
    constructor(options = {}) {
      this.sendMessage = typeof options.sendMessage === "function" ? options.sendMessage : (async () => null);
    }

    updateStats(stats) {
      return this.sendMessage({ type: "EMOTIONUI_UPDATE_STATS", stats });
    }

    decide(features, context) {
      return this.sendMessage({
        type: "EMOTIONUI_POLICY_DECIDE",
        features,
        context
      });
    }

    learn(features, decision, context) {
      return this.sendMessage({
        type: "EMOTIONUI_POLICY_LEARN",
        features,
        decision,
        context
      });
    }

    saveSession(payload) {
      return this.sendMessage({
        type: "EMOTIONUI_SAVE_SESSION",
        payload
      });
    }
  }

  window.EmotionUIPolicyClient = PolicyClient;
})();
