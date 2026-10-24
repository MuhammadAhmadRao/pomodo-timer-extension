/**
 * Shared storage defaults, keys, and utility functions for Focus Timer.
 * Compatible with Service Worker (importScripts), Content Scripts, and extension pages.
 */
(function (root) {
  const DEFAULT_SETTINGS = {
    focusDuration: 25,          // in minutes
    shortBreakDuration: 5,       // in minutes
    longBreakDuration: 15,       // in minutes
    roundsBeforeLongBreak: 4,    // complete cycles before long break
    blockedSites: [
      "facebook.com",
      "instagram.com",
      "twitter.com",
      "x.com",
      "tiktok.com",
      "reddit.com",
      "youtube.com",
      "netflix.com"
    ],
    soundEnabled: true,
    notificationEnabled: true,
    floatingWidgetEnabled: true,
    topPillEnabled: true,
    tabTitleTimerEnabled: true,
    theme: "dark",               // 'dark' | 'light' | 'system'
    dailyGoalMinutes: 120       // target daily focus in minutes
  };

  const DEFAULT_TIMER_STATE = {
    isRunning: false,
    isStarted: false,           // true when running or paused, false when idle/reset
    phase: "focus",             // 'focus' | 'shortBreak' | 'longBreak'
    endTime: null,              // timestamp in ms
    totalDuration: 25 * 60 * 1000,
    remainingWhenPaused: 25 * 60 * 1000,
    cycleCount: 0,              // completed focus rounds in current cycle
    totalCompletedFocusRounds: 0, // historical counter
    sessionId: null,            // unique ID for active focus session
    sessionStartedAt: null,     // timestamp when active focus session started
    plannedMs: null,            // duration planned for active session
    label: ""                   // current task label
  };

  const PHASES = {
    focus: {
      name: "Focus",
      shortLabel: "FOCUS",
      badgeColor: "#ef4444",
      emoji: "🎯",
      quote: "Deep work produces world-class results. Stay locked in."
    },
    shortBreak: {
      name: "Short Break",
      shortLabel: "REST",
      badgeColor: "#10b981",
      emoji: "☕",
      quote: "Breathe, stretch, and rest your eyes for a moment."
    },
    longBreak: {
      name: "Long Break",
      shortLabel: "BREAK",
      badgeColor: "#3b82f6",
      emoji: "🌴",
      quote: "Outstanding job! Take a well-deserved breather."
    }
  };

  /**
   * Promisified chrome.storage.local.get
   */
  function getStorage(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(result || {});
      });
    });
  }

  /**
   * Promisified chrome.storage.local.set
   */
  function setStorage(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, () => {
        resolve();
      });
    });
  }

  /**
   * Formats millisecond duration into "MM:SS" or "HH:MM:SS"
   */
  function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n) => String(n).padStart(2, "0");

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  /**
   * Calculates remaining time in ms based on state
   */
  function computeRemaining(state) {
    if (!state) return 0;
    if (!state.isRunning) {
      return state.remainingWhenPaused || 0;
    }
    return Math.max(0, (state.endTime || 0) - Date.now());
  }

  // Export to global scope
  const FocusTimerStorage = {
    DEFAULT_SETTINGS,
    DEFAULT_TIMER_STATE,
    PHASES,
    getStorage,
    setStorage,
    formatTime,
    computeRemaining
  };

  root.FocusTimerStorage = FocusTimerStorage;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = FocusTimerStorage;
  }
})(typeof self !== "undefined" ? self : this);
