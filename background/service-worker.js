/**
 * Focus Timer - Background Service Worker (Manifest V3)
 *
 * Resilient against service worker termination:
 * - Never uses setInterval for core state persistence.
 * - Saves state in chrome.storage.local.
 * - Uses chrome.alarms for phase completions.
 * - Live 1-second badge & dynamic OffscreenCanvas icon updates while active.
 * - Recomputes state immediately on every service worker wake-up.
 * - Updates declarativeNetRequest rules dynamically when focus starts/stops.
 */

importScripts("../shared/storage.js", "../shared/stats.js");

const ALARM_NAME = "FOCUS_TIMER_PHASE_END";
const BADGE_BACKUP_ALARM = "FOCUS_TIMER_BADGE_BACKUP";
const TEMP_UNBLOCK_ALARM = "FOCUS_TIMER_TEMP_UNBLOCK";

let liveSecondTickerId = null;
const loggedSessionIds = new Set();

/**
 * Idempotently saves a completed or partial focus session into chrome.storage.local under "sessions".
 * - Only focus phases are logged.
 * - Caps log at 365 days and prunes older entries.
 * - Incomplete sessions under 1 minute are ignored.
 * - Duplicate session IDs are strictly prevented.
 */
async function recordSession(entry) {
  if (!entry || !entry.id) return;
  // Ignore incomplete sessions under 1 minute (60,000 ms)
  if (!entry.completed && (entry.focusedMs || 0) < 60000) {
    return;
  }

  // Fast in-memory deduplication check
  if (loggedSessionIds.has(entry.id)) {
    return;
  }
  loggedSessionIds.add(entry.id);

  try {
    const { sessions = [] } = await FocusTimerStorage.getStorage(["sessions"]);
    if (sessions.some((s) => s.id === entry.id)) {
      return;
    }

    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const cleanEntry = {
      id: entry.id,
      startedAt: entry.startedAt || (entry.endedAt - (entry.focusedMs || 0)),
      endedAt: entry.endedAt || Date.now(),
      plannedMs: entry.plannedMs || entry.focusedMs || 0,
      focusedMs: entry.focusedMs || 0,
      completed: Boolean(entry.completed),
      label: (entry.label || "").trim()
    };

    const updatedSessions = [...sessions, cleanEntry].filter(
      (s) => (s.endedAt || s.startedAt || 0) >= oneYearAgo
    );

    await FocusTimerStorage.setStorage({ sessions: updatedSessions });
  } catch (err) {
    console.warn("Failed to record session log:", err);
  }
}

// Initialize on install or startup
chrome.runtime.onInstalled.addListener(async () => {
  await initializeStorage();
  await syncRulesAndBadge();

  // Create context menu item on install (not on every SW wake-up)
  if (chrome.contextMenus) {
    chrome.contextMenus.create({
      id: "block-current-site",
      title: "Block this site during focus",
      contexts: ["page"]
    }, () => {
      if (chrome.runtime.lastError) {}
    });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await syncRulesAndBadge();
});

/**
 * Initializes default settings and state if not yet stored
 */
async function initializeStorage() {
  const current = await FocusTimerStorage.getStorage([
    "settings",
    "timerState"
  ]);

  const settings = {
    ...FocusTimerStorage.DEFAULT_SETTINGS,
    ...(current.settings || {})
  };

  const timerState = {
    ...FocusTimerStorage.DEFAULT_TIMER_STATE,
    ...(current.timerState || {})
  };

  if (timerState.isStarted === undefined) {
    timerState.isStarted = Boolean(timerState.isRunning);
  }

  if (!timerState.totalDuration) {
    timerState.totalDuration = settings.focusDuration * 60 * 1000;
    timerState.remainingWhenPaused = timerState.totalDuration;
  }

  await FocusTimerStorage.setStorage({ settings, timerState });
}

/**
 * Handles phase completion, temporary unblock expiry, and backup alarms
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await handlePhaseCompletion();
  } else if (alarm.name === BADGE_BACKUP_ALARM) {
    await updateBadgeAndIcon();
  } else if (alarm.name === TEMP_UNBLOCK_ALARM) {
    const { timerState = FocusTimerStorage.DEFAULT_TIMER_STATE } =
      await FocusTimerStorage.getStorage(["timerState"]);
    await FocusTimerStorage.setStorage({
      timerState: { ...timerState, tempUnblockUntil: null }
    });
    await syncRulesAndBadge();
  }
});

/**
 * Transitions from focus -> break or break -> focus
 */
async function handlePhaseCompletion(options = {}) {
  const { settings = FocusTimerStorage.DEFAULT_SETTINGS, timerState = FocusTimerStorage.DEFAULT_TIMER_STATE } =
    await FocusTimerStorage.getStorage(["settings", "timerState"]);

  let nextPhase = "focus";
  let nextCycleCount = timerState.cycleCount || 0;
  let nextTotalCompleted = timerState.totalCompletedFocusRounds || 0;
  let notifTitle = "Focus Timer";
  let notifMessage = "";
  let soundType = "focus";

  if (timerState.phase === "focus") {
    // If not an early skip, log the completed focus session
    if (!options.isSkip) {
      const plannedMs = timerState.plannedMs || timerState.totalDuration || (settings.focusDuration * 60 * 1000);
      const focusedMs = plannedMs;
      const endedAt = Date.now();
      const startedAt = timerState.sessionStartedAt || (endedAt - focusedMs);
      const sessionId = timerState.sessionId || ("sess_" + startedAt + "_" + Math.random().toString(36).slice(2, 7));

      await recordSession({
        id: sessionId,
        startedAt,
        endedAt,
        plannedMs,
        focusedMs,
        completed: true,
        label: timerState.label || ""
      });

      nextCycleCount += 1;
      nextTotalCompleted += 1;
    }
    soundType = "focus";

    if (nextCycleCount >= (settings.roundsBeforeLongBreak || 4)) {
      nextPhase = "longBreak";
      nextCycleCount = 0;
      notifTitle = "🎉 Long Break Time!";
      notifMessage = `Superb work! You completed ${settings.roundsBeforeLongBreak} rounds. Relax for ${settings.longBreakDuration} minutes.`;
    } else {
      nextPhase = "shortBreak";
      notifTitle = "☕ Short Break Time!";
      notifMessage = `Focus round complete! Take a quick ${settings.shortBreakDuration}-minute break.`;
    }
  } else {
    // Ending a break -> transition back to focus
    nextPhase = "focus";
    soundType = "break";
    notifTitle = "🎯 Focus Phase Starting!";
    notifMessage = `Break is over. Ready for ${settings.focusDuration} minutes of deep focus?`;
  }

  const durationMinutes =
    nextPhase === "focus"
      ? settings.focusDuration
      : nextPhase === "shortBreak"
      ? settings.shortBreakDuration
      : settings.longBreakDuration;

  const durationMs = durationMinutes * 60 * 1000;
  const now = Date.now();
  const nextEndTime = now + durationMs;

  const isNextFocus = nextPhase === "focus";
  const nextSessionId = isNextFocus ? ("sess_" + now + "_" + Math.random().toString(36).slice(2, 7)) : null;
  const nextSessionStartedAt = isNextFocus ? now : null;
  const nextPlannedMs = isNextFocus ? durationMs : null;

  const updatedState = {
    ...timerState,
    isRunning: true,
    isStarted: true,
    phase: nextPhase,
    endTime: nextEndTime,
    totalDuration: durationMs,
    remainingWhenPaused: durationMs,
    cycleCount: nextCycleCount,
    totalCompletedFocusRounds: nextTotalCompleted,
    sessionId: nextSessionId,
    sessionStartedAt: nextSessionStartedAt,
    plannedMs: nextPlannedMs,
    label: timerState.label || "",
    tempUnblockUntil: null
  };

  await chrome.alarms.clear(TEMP_UNBLOCK_ALARM);
  await FocusTimerStorage.setStorage({ timerState: updatedState });

  // Schedule next phase alarm
  await chrome.alarms.create(ALARM_NAME, { when: nextEndTime });

  // Desktop notification
  if (settings.notificationEnabled) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: notifTitle,
      message: notifMessage,
      priority: 2,
      requireInteraction: false
    });
  }

  // Notify any active clients/tabs to trigger audio chime
  notifyClients({ action: "PHASE_COMPLETED", soundType, phase: nextPhase });

  // Update dynamic DNR blocking rules & badge
  await syncRulesAndBadge();
}

/**
 * Broadcast message to popup, content scripts, and extension pages
 */
function notifyClients(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    });
  });
}

/**
 * Updates declarativeNetRequest dynamic blocking rules:
 * - Active ONLY when phase === 'focus' and isRunning === true
 * - Cleared during breaks, paused state, or when focus is not running.
 */
async function syncBlockingRules(settings, timerState) {
  const isTempUnblocked = Boolean(
    timerState.tempUnblockUntil && timerState.tempUnblockUntil > Date.now()
  );
  const shouldBlock = timerState.isRunning && timerState.phase === "focus" && !isTempUnblocked;
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingRuleIds = existingRules.map((r) => r.id);

  if (!shouldBlock) {
    if (existingRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRuleIds,
        addRules: []
      });
    }
    return;
  }

  // Generate dynamic rules from blockedSites
  const blockedSites = settings.blockedSites || [];
  const redirectUrl = chrome.runtime.getURL("blocked/blocked.html");

  const newRules = [];
  let ruleIdCounter = 1;

  for (const site of blockedSites) {
    const cleanDomain = site
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");

    if (!cleanDomain) continue;

    newRules.push({
      id: ruleIdCounter++,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { url: redirectUrl }
      },
      condition: {
        urlFilter: `||${cleanDomain}^`,
        resourceTypes: ["main_frame"]
      }
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingRuleIds,
    addRules: newRules
  });
}

/**
 * Renders circular progress ring icon with OffscreenCanvas
 * Fraction: elapsed / total (fills with elapsed time)
 */
function renderDynamicIcon(fraction, phase, isRunning) {
  try {
    if (typeof OffscreenCanvas === "undefined") return null;

    const size = 32;
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const radius = 12;

    // Track circle (background ring)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Progress arc: fills with elapsed time
    const clamped = Math.max(0, Math.min(1, fraction));
    if (clamped > 0) {
      const startAngle = -0.5 * Math.PI;
      const endAngle = startAngle + clamped * 2 * Math.PI;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, endAngle);

      let strokeColor = "#ef4444"; // Red for focus
      if (phase !== "focus") {
        strokeColor = "#10b981"; // Green for break
      }
      if (!isRunning) {
        strokeColor = "#94a3b8"; // Grey when paused
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // Mini center core
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = !isRunning ? "#94a3b8" : (phase === "focus" ? "#ef4444" : "#10b981");
    ctx.fill();

    return ctx.getImageData(0, 0, size, size);
  } catch (err) {
    console.warn("OffscreenCanvas drawing failed:", err);
    return null;
  }
}

/**
 * Resets action icon to static bundle icons
 */
async function setStaticIcon() {
  try {
    await chrome.action.setIcon({
      path: {
        16: "icons/icon16.png",
        32: "icons/icon32.png",
        48: "icons/icon48.png",
        128: "icons/icon128.png"
      }
    });
  } catch (e) {}
}

/**
 * Updates badge text, badge color, and dynamic progress icon
 * Rules:
 * - > 10 min remaining: "24m" style minutes
 * - <= 10 min remaining: "M:SS" (e.g. "9:03"), max 4 characters
 * - Red background for focus, green for break, grey when paused
 * - Stopped/idle: empty badge, static icon
 */
async function updateBadgeAndIcon() {
  const { timerState = FocusTimerStorage.DEFAULT_TIMER_STATE } =
    await FocusTimerStorage.getStorage(["timerState"]);

  // If idle (neither running nor paused)
  if (!timerState.isStarted && !timerState.isRunning) {
    chrome.action.setBadgeText({ text: "" });
    await setStaticIcon();
    return;
  }

  let remainingMs = 0;
  if (timerState.isRunning) {
    remainingMs = Math.max(0, (timerState.endTime || 0) - Date.now());
    // Auto transition if completed
    if (remainingMs <= 0 && timerState.endTime) {
      await handlePhaseCompletion();
      return;
    }
  } else {
    // Paused
    remainingMs = timerState.remainingWhenPaused || 0;
  }

  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  let badgeText = "";

  // Switch format at 10 minute mark (>= 600s: "XXm", < 600s: "M:SS", max 4 chars)
  if (totalSeconds >= 600) {
    const mins = Math.ceil(remainingMs / 60000);
    badgeText = `${mins}m`;
  } else {
    const m = Math.floor(totalSeconds / 60);
    const s = String(totalSeconds % 60).padStart(2, "0");
    badgeText = `${m}:${s}`;
  }

  // Set badge text
  chrome.action.setBadgeText({ text: badgeText });

  // Set badge background color
  if (!timerState.isRunning) {
    chrome.action.setBadgeBackgroundColor({ color: "#6b7280" }); // Grey when paused
  } else if (timerState.phase === "focus") {
    chrome.action.setBadgeBackgroundColor({ color: "#ef4444" }); // Red for focus
  } else {
    chrome.action.setBadgeBackgroundColor({ color: "#10b981" }); // Green for break
  }

  // Update dynamic icon
  const totalDuration = timerState.totalDuration || (25 * 60 * 1000);
  const elapsedFraction = Math.max(0, Math.min(1, 1 - (remainingMs / totalDuration)));
  const iconData = renderDynamicIcon(elapsedFraction, timerState.phase, timerState.isRunning);

  if (iconData) {
    try {
      await chrome.action.setIcon({ imageData: { 32: iconData } });
    } catch (e) {
      await setStaticIcon();
    }
  } else {
    await setStaticIcon();
  }
}

/**
 * Manages live 1-second ticker in service worker
 */
function syncLiveTicker(isRunning) {
  if (isRunning) {
    if (!liveSecondTickerId) {
      liveSecondTickerId = setInterval(() => {
        updateBadgeAndIcon();
      }, 1000);
    }
  } else {
    if (liveSecondTickerId) {
      clearInterval(liveSecondTickerId);
      liveSecondTickerId = null;
    }
  }
}

/**
 * Re-evaluates both blocking rules, badge, icon, and ticker
 */
async function syncRulesAndBadge() {
  const { settings = FocusTimerStorage.DEFAULT_SETTINGS, timerState = FocusTimerStorage.DEFAULT_TIMER_STATE } =
    await FocusTimerStorage.getStorage(["settings", "timerState"]);

  await syncBlockingRules(settings, timerState);
  await updateBadgeAndIcon();
  syncLiveTicker(Boolean(timerState.isRunning));

  // If running, maintain periodic backup alarm in case service worker gets suspended
  if (timerState.isRunning) {
    chrome.alarms.create(BADGE_BACKUP_ALARM, { periodInMinutes: 1 });
  } else {
    chrome.alarms.clear(BADGE_BACKUP_ALARM);
  }

  // Update context menu item state during strict focus
  if (chrome.contextMenus && chrome.contextMenus.update) {
    const isStrictFocus = Boolean(
      settings.strictModeEnabled &&
      timerState.isRunning &&
      timerState.phase === "focus"
    );
    chrome.contextMenus.update("block-current-site", {
      enabled: !isStrictFocus,
      title: isStrictFocus
        ? "Block this site during focus (Disabled in Strict Mode)"
        : "Block this site during focus"
    }, () => {
      if (chrome.runtime.lastError) {}
    });
  }
}

/**
 * Listen for commands from Popup / Content Scripts / Options
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const { settings = FocusTimerStorage.DEFAULT_SETTINGS, timerState = FocusTimerStorage.DEFAULT_TIMER_STATE } =
      await FocusTimerStorage.getStorage(["settings", "timerState"]);

    const isStrictFocus = Boolean(
      settings.strictModeEnabled &&
      timerState.isRunning &&
      timerState.phase === "focus"
    );

    switch (message.action) {
      case "START": {
        const remaining = timerState.remainingWhenPaused || (settings.focusDuration * 60 * 1000);
        const endTime = Date.now() + remaining;
        const isFocus = timerState.phase === "focus";

        let sessionId = timerState.sessionId;
        let sessionStartedAt = timerState.sessionStartedAt;
        let plannedMs = timerState.plannedMs;

        if (isFocus && (!sessionId || !timerState.isStarted)) {
          sessionId = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
          sessionStartedAt = Date.now();
          plannedMs = timerState.totalDuration || remaining;
        }

        const label = message.label !== undefined ? message.label : (timerState.label || "");

        const updated = {
          ...timerState,
          isStarted: true,
          isRunning: true,
          endTime,
          totalDuration: timerState.totalDuration || remaining,
          sessionId: isFocus ? sessionId : null,
          sessionStartedAt: isFocus ? sessionStartedAt : null,
          plannedMs: isFocus ? plannedMs : null,
          label
        };

        await FocusTimerStorage.setStorage({ timerState: updated });
        await chrome.alarms.create(ALARM_NAME, { when: endTime });
        await syncRulesAndBadge();
        sendResponse({ success: true, timerState: updated });
        break;
      }

      case "PAUSE": {
        if (isStrictFocus) {
          sendResponse({ success: false, error: "Strict mode is active. Pausing is disabled during focus." });
          break;
        }

        const remaining = Math.max(0, (timerState.endTime || 0) - Date.now());
        const updated = {
          ...timerState,
          isStarted: true, // Remains started, but paused
          isRunning: false,
          remainingWhenPaused: remaining,
          endTime: null
        };

        await chrome.alarms.clear(ALARM_NAME);
        await FocusTimerStorage.setStorage({ timerState: updated });
        await syncRulesAndBadge();
        sendResponse({ success: true, timerState: updated });
        break;
      }

      case "RESET": {
        if (isStrictFocus) {
          sendResponse({ success: false, error: "Strict mode is active. Resetting is disabled during focus." });
          break;
        }

        await chrome.alarms.clear(ALARM_NAME);
        await chrome.alarms.clear(TEMP_UNBLOCK_ALARM);

        // If focus session was active, log partial time if >= 1 min
        if (timerState.phase === "focus" && (timerState.isStarted || timerState.isRunning)) {
          const remaining = timerState.isRunning
            ? Math.max(0, (timerState.endTime || 0) - Date.now())
            : (timerState.remainingWhenPaused || 0);
          const total = timerState.totalDuration || (settings.focusDuration * 60 * 1000);
          const focusedMs = Math.max(0, total - remaining);

          if (focusedMs >= 60000 && timerState.sessionId) {
            const endedAt = Date.now();
            const startedAt = timerState.sessionStartedAt || (endedAt - focusedMs);
            await recordSession({
              id: timerState.sessionId,
              startedAt,
              endedAt,
              plannedMs: total,
              focusedMs,
              completed: false,
              label: timerState.label || ""
            });
          }
        }

        const durationMinutes =
          timerState.phase === "focus"
            ? settings.focusDuration
            : timerState.phase === "shortBreak"
            ? settings.shortBreakDuration
            : settings.longBreakDuration;

        const durationMs = durationMinutes * 60 * 1000;
        const updated = {
          ...timerState,
          isStarted: false, // Session stopped/idle
          isRunning: false,
          endTime: null,
          totalDuration: durationMs,
          remainingWhenPaused: durationMs,
          sessionId: null,
          sessionStartedAt: null,
          plannedMs: null,
          tempUnblockUntil: null
        };

        await FocusTimerStorage.setStorage({ timerState: updated });
        await syncRulesAndBadge();
        sendResponse({ success: true, timerState: updated });
        break;
      }

      case "SKIP": {
        if (isStrictFocus) {
          sendResponse({ success: false, error: "Strict mode is active. Skipping is disabled during focus." });
          break;
        }

        await chrome.alarms.clear(ALARM_NAME);
        await chrome.alarms.clear(TEMP_UNBLOCK_ALARM);

        // If focus session was active, log early exit if >= 1 min
        if (timerState.phase === "focus") {
          const remaining = timerState.isRunning
            ? Math.max(0, (timerState.endTime || 0) - Date.now())
            : (timerState.remainingWhenPaused || 0);
          const total = timerState.totalDuration || (settings.focusDuration * 60 * 1000);
          const focusedMs = Math.max(0, total - remaining);

          if (focusedMs >= 60000 && timerState.sessionId) {
            const endedAt = Date.now();
            const startedAt = timerState.sessionStartedAt || (endedAt - focusedMs);
            await recordSession({
              id: timerState.sessionId,
              startedAt,
              endedAt,
              plannedMs: total,
              focusedMs,
              completed: false,
              label: timerState.label || ""
            });
          }
        }

        await handlePhaseCompletion({ isSkip: true });
        const fresh = await FocusTimerStorage.getStorage(["timerState"]);
        sendResponse({ success: true, timerState: fresh.timerState });
        break;
      }

      case "SWITCH_PHASE": {
        if (isStrictFocus) {
          sendResponse({ success: false, error: "Strict mode is active. Switching phase is disabled during focus." });
          break;
        }

        await chrome.alarms.clear(ALARM_NAME);
        await chrome.alarms.clear(TEMP_UNBLOCK_ALARM);
        const requestedPhase = message.phase; // 'focus' | 'shortBreak' | 'longBreak'

        // If abandoning an in-progress focus session
        if (timerState.phase === "focus" && requestedPhase !== "focus" && (timerState.isStarted || timerState.isRunning)) {
          const remaining = timerState.isRunning
            ? Math.max(0, (timerState.endTime || 0) - Date.now())
            : (timerState.remainingWhenPaused || 0);
          const total = timerState.totalDuration || (settings.focusDuration * 60 * 1000);
          const focusedMs = Math.max(0, total - remaining);

          if (focusedMs >= 60000 && timerState.sessionId) {
            const endedAt = Date.now();
            const startedAt = timerState.sessionStartedAt || (endedAt - focusedMs);
            await recordSession({
              id: timerState.sessionId,
              startedAt,
              endedAt,
              plannedMs: total,
              focusedMs,
              completed: false,
              label: timerState.label || ""
            });
          }
        }

        const durationMinutes =
          requestedPhase === "focus"
            ? settings.focusDuration
            : requestedPhase === "shortBreak"
            ? settings.shortBreakDuration
            : settings.longBreakDuration;

        const durationMs = durationMinutes * 60 * 1000;
        const updated = {
          ...timerState,
          phase: requestedPhase,
          isStarted: false,
          isRunning: false,
          endTime: null,
          totalDuration: durationMs,
          remainingWhenPaused: durationMs,
          sessionId: null,
          sessionStartedAt: null,
          plannedMs: null,
          tempUnblockUntil: null
        };

        await FocusTimerStorage.setStorage({ timerState: updated });
        await syncRulesAndBadge();
        sendResponse({ success: true, timerState: updated });
        break;
      }

      case "ALLOW_5_MINUTES": {
        if (isStrictFocus) {
          sendResponse({ success: false, error: "Strict mode is active. Temporary unblocking is disabled." });
          break;
        }

        const unblockDuration = 5 * 60 * 1000;
        const tempUnblockUntil = Date.now() + unblockDuration;
        const updated = {
          ...timerState,
          tempUnblockUntil
        };

        await FocusTimerStorage.setStorage({ timerState: updated });
        await chrome.alarms.create(TEMP_UNBLOCK_ALARM, { when: tempUnblockUntil });
        await syncRulesAndBadge();
        sendResponse({ success: true, tempUnblockUntil });
        break;
      }

      case "EMERGENCY_EXIT": {
        await chrome.alarms.clear(ALARM_NAME);
        await chrome.alarms.clear(TEMP_UNBLOCK_ALARM);

        if (timerState.phase === "focus" && (timerState.isStarted || timerState.isRunning)) {
          const remaining = timerState.isRunning
            ? Math.max(0, (timerState.endTime || 0) - Date.now())
            : (timerState.remainingWhenPaused || 0);
          const total = timerState.totalDuration || (settings.focusDuration * 60 * 1000);
          const focusedMs = Math.max(0, total - remaining);

          if (focusedMs >= 60000 && timerState.sessionId) {
            const endedAt = Date.now();
            const startedAt = timerState.sessionStartedAt || (endedAt - focusedMs);
            await recordSession({
              id: timerState.sessionId,
              startedAt,
              endedAt,
              plannedMs: total,
              focusedMs,
              completed: false,
              label: timerState.label || ""
            });
          }
        }

        const durationMinutes = settings.focusDuration;
        const durationMs = durationMinutes * 60 * 1000;
        const updated = {
          ...timerState,
          isStarted: false,
          isRunning: false,
          phase: "focus",
          endTime: null,
          totalDuration: durationMs,
          remainingWhenPaused: durationMs,
          sessionId: null,
          sessionStartedAt: null,
          plannedMs: null,
          tempUnblockUntil: null
        };

        await FocusTimerStorage.setStorage({ timerState: updated });
        await syncRulesAndBadge();
        sendResponse({ success: true, timerState: updated });
        break;
      }

      case "SET_LABEL": {
        const newLabel = (message.label || "").trim();
        const updated = {
          ...timerState,
          label: newLabel
        };
        await FocusTimerStorage.setStorage({ timerState: updated });
        sendResponse({ success: true, timerState: updated });
        break;
      }

      case "SYNC_STATE": {
        await syncRulesAndBadge();
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ error: "Unknown action" });
    }
  })();

  return true; // Keep message channel open for async response
});

// React to storage changes (e.g. settings updated from options page)
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === "local") {
    if (changes.settings || changes.timerState) {
      await syncRulesAndBadge();
    }
  }
});

/**
 * Context Menu: "Block this site during focus"
 */
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== "block-current-site") return;

    const { settings = FocusTimerStorage.DEFAULT_SETTINGS, timerState = FocusTimerStorage.DEFAULT_TIMER_STATE } =
      await FocusTimerStorage.getStorage(["settings", "timerState"]);

    const isStrictFocus = Boolean(
      settings.strictModeEnabled &&
      timerState.isRunning &&
      timerState.phase === "focus"
    );

    // Reject in Strict Mode during running focus
    if (isStrictFocus) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title: "🔒 Strict Mode Active",
        message: "Cannot modify blocklist while a strict focus session is running.",
        priority: 2
      });
      return;
    }

    const pageUrl = tab?.url || info.pageUrl || "";

    // Ignore chrome://, extension pages, and non-http(s) pages
    if (!pageUrl || !/^https?:\/\//i.test(pageUrl)) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title: "Focus Timer",
        message: "Cannot block internal browser or extension pages.",
        priority: 1
      });
      return;
    }

    let domain = "";
    try {
      const parsed = new URL(pageUrl);
      domain = parsed.hostname.toLowerCase().replace(/^www\./, "");
    } catch (e) {
      return;
    }

    if (!domain) return;

    const currentBlocked = [...(settings.blockedSites || [])];
    const isDuplicate = currentBlocked.some(
      (site) => site.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") === domain
    );

    if (isDuplicate) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title: "Focus Timer",
        message: `${domain} is already in your blocklist.`,
        priority: 1
      });
      return;
    }

    // Add normalized domain to blocklist
    currentBlocked.push(domain);
    const updatedSettings = {
      ...settings,
      blockedSites: currentBlocked
    };

    await FocusTimerStorage.setStorage({ settings: updatedSettings });
    await syncRulesAndBadge();

    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: "🛡️ Site Blocked",
      message: `${domain} will now be blocked during focus sessions.`,
      priority: 1
    });
  });
}

/**
 * Keyboard Shortcuts (manifest commands)
 */
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(async (command) => {
    const { settings = FocusTimerStorage.DEFAULT_SETTINGS, timerState = FocusTimerStorage.DEFAULT_TIMER_STATE } =
      await FocusTimerStorage.getStorage(["settings", "timerState"]);

    const isStrictFocus = Boolean(
      settings.strictModeEnabled &&
      timerState.isRunning &&
      timerState.phase === "focus"
    );

    if (command === "toggle-timer") {
      if (timerState.isRunning) {
        // Attempting to pause
        if (isStrictFocus) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("icons/icon128.png"),
            title: "🔒 Strict Mode Active",
            message: "Pausing is disabled during a strict focus session.",
            priority: 2
          });
          return;
        }

        const remaining = Math.max(0, (timerState.endTime || 0) - Date.now());
        const updated = {
          ...timerState,
          isStarted: true,
          isRunning: false,
          remainingWhenPaused: remaining,
          endTime: null
        };

        await chrome.alarms.clear(ALARM_NAME);
        await FocusTimerStorage.setStorage({ timerState: updated });
        await syncRulesAndBadge();
      } else {
        // Attempting to start/resume
        const remaining = timerState.remainingWhenPaused || (settings.focusDuration * 60 * 1000);
        const endTime = Date.now() + remaining;
        const isFocus = timerState.phase === "focus";

        let sessionId = timerState.sessionId;
        let sessionStartedAt = timerState.sessionStartedAt;
        let plannedMs = timerState.plannedMs;

        if (isFocus && (!sessionId || !timerState.isStarted)) {
          sessionId = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
          sessionStartedAt = Date.now();
          plannedMs = timerState.totalDuration || remaining;
        }

        const updated = {
          ...timerState,
          isStarted: true,
          isRunning: true,
          endTime,
          totalDuration: timerState.totalDuration || remaining,
          sessionId: isFocus ? sessionId : null,
          sessionStartedAt: isFocus ? sessionStartedAt : null,
          plannedMs: isFocus ? plannedMs : null
        };

        await FocusTimerStorage.setStorage({ timerState: updated });
        await chrome.alarms.create(ALARM_NAME, { when: endTime });
        await syncRulesAndBadge();
      }
    } else if (command === "skip-phase") {
      // Attempting to skip
      if (isStrictFocus) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("icons/icon128.png"),
          title: "🔒 Strict Mode Active",
          message: "Skipping is disabled during a strict focus session.",
          priority: 2
        });
        return;
      }

      await chrome.alarms.clear(ALARM_NAME);
      await chrome.alarms.clear(TEMP_UNBLOCK_ALARM);

      if (timerState.phase === "focus") {
        const remaining = timerState.isRunning
          ? Math.max(0, (timerState.endTime || 0) - Date.now())
          : (timerState.remainingWhenPaused || 0);
        const total = timerState.totalDuration || (settings.focusDuration * 60 * 1000);
        const focusedMs = Math.max(0, total - remaining);

        if (focusedMs >= 60000 && timerState.sessionId) {
          const endedAt = Date.now();
          const startedAt = timerState.sessionStartedAt || (endedAt - focusedMs);
          await recordSession({
            id: timerState.sessionId,
            startedAt,
            endedAt,
            plannedMs: total,
            focusedMs,
            completed: false,
            label: timerState.label || ""
          });
        }
      }

      await handlePhaseCompletion({ isSkip: true });
    }
  });
}

