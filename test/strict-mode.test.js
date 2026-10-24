const test = require("node:test");
const assert = require("node:assert/strict");

// Mock environment for background service worker message handler logic
function createMockBackgroundEnvironment(initialSettings = {}, initialTimerState = {}) {
  let settings = {
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    roundsBeforeLongBreak: 4,
    strictModeEnabled: false,
    ...initialSettings
  };

  let timerState = {
    isRunning: false,
    isStarted: false,
    phase: "focus",
    endTime: null,
    totalDuration: 25 * 60 * 1000,
    remainingWhenPaused: 25 * 60 * 1000,
    sessionId: null,
    sessionStartedAt: null,
    plannedMs: null,
    label: "",
    tempUnblockUntil: null,
    ...initialTimerState
  };

  const sessions = [];

  async function recordSession(entry) {
    if (!entry || !entry.id) return;
    if (!entry.completed && (entry.focusedMs || 0) < 60000) return;
    sessions.push({ ...entry });
  }

  // Simulate onMessage dispatch matching background/service-worker.js
  async function handleMessage(message) {
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
          sessionId = "sess_" + Date.now();
          sessionStartedAt = Date.now();
          plannedMs = timerState.totalDuration || remaining;
        }

        timerState = {
          ...timerState,
          isStarted: true,
          isRunning: true,
          endTime,
          totalDuration: timerState.totalDuration || remaining,
          sessionId: isFocus ? sessionId : null,
          sessionStartedAt: isFocus ? sessionStartedAt : null,
          plannedMs: isFocus ? plannedMs : null,
          label: message.label !== undefined ? message.label : timerState.label
        };
        return { success: true, timerState };
      }

      case "PAUSE": {
        if (isStrictFocus) {
          return { success: false, error: "Strict mode is active. Pausing is disabled during focus." };
        }
        const remaining = Math.max(0, (timerState.endTime || 0) - Date.now());
        timerState = {
          ...timerState,
          isStarted: true,
          isRunning: false,
          remainingWhenPaused: remaining,
          endTime: null
        };
        return { success: true, timerState };
      }

      case "RESET": {
        if (isStrictFocus) {
          return { success: false, error: "Strict mode is active. Resetting is disabled during focus." };
        }
        timerState = {
          ...timerState,
          isStarted: false,
          isRunning: false,
          endTime: null,
          tempUnblockUntil: null
        };
        return { success: true, timerState };
      }

      case "SKIP": {
        if (isStrictFocus) {
          return { success: false, error: "Strict mode is active. Skipping is disabled during focus." };
        }
        timerState = {
          ...timerState,
          phase: timerState.phase === "focus" ? "shortBreak" : "focus",
          isRunning: true,
          tempUnblockUntil: null
        };
        return { success: true, timerState };
      }

      case "SWITCH_PHASE": {
        if (isStrictFocus) {
          return { success: false, error: "Strict mode is active. Switching phase is disabled during focus." };
        }
        timerState = {
          ...timerState,
          phase: message.phase,
          isRunning: false,
          tempUnblockUntil: null
        };
        return { success: true, timerState };
      }

      case "ALLOW_5_MINUTES": {
        if (isStrictFocus) {
          return { success: false, error: "Strict mode is active. Temporary unblocking is disabled." };
        }
        const tempUnblockUntil = Date.now() + 5 * 60 * 1000;
        timerState = {
          ...timerState,
          tempUnblockUntil
        };
        return { success: true, tempUnblockUntil };
      }

      case "EMERGENCY_EXIT": {
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

        const durationMs = settings.focusDuration * 60 * 1000;
        timerState = {
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
        return { success: true, timerState };
      }

      default:
        return { error: "Unknown action" };
    }
  }

  return {
    getSettings: () => settings,
    setSettings: (s) => { settings = { ...settings, ...s }; },
    getTimerState: () => timerState,
    getSessions: () => sessions,
    handleMessage
  };
}

test("strict mode: rejects PAUSE, RESET, SKIP, SWITCH_PHASE, ALLOW_5_MINUTES during running focus phase", async () => {
  const env = createMockBackgroundEnvironment(
    { strictModeEnabled: true },
    { isRunning: true, isStarted: true, phase: "focus", endTime: Date.now() + 1500000 }
  );

  // 1. PAUSE rejected
  const pauseRes = await env.handleMessage({ action: "PAUSE" });
  assert.equal(pauseRes.success, false);
  assert.match(pauseRes.error, /Strict mode is active/);

  // 2. RESET rejected
  const resetRes = await env.handleMessage({ action: "RESET" });
  assert.equal(resetRes.success, false);
  assert.match(resetRes.error, /Strict mode is active/);

  // 3. SKIP rejected
  const skipRes = await env.handleMessage({ action: "SKIP" });
  assert.equal(skipRes.success, false);
  assert.match(skipRes.error, /Strict mode is active/);

  // 4. SWITCH_PHASE rejected
  const switchRes = await env.handleMessage({ action: "SWITCH_PHASE", phase: "shortBreak" });
  assert.equal(switchRes.success, false);
  assert.match(switchRes.error, /Strict mode is active/);

  // 5. ALLOW_5_MINUTES rejected
  const allowRes = await env.handleMessage({ action: "ALLOW_5_MINUTES" });
  assert.equal(allowRes.success, false);
  assert.match(allowRes.error, /Strict mode is active/);

  // Timer remains running
  assert.equal(env.getTimerState().isRunning, true);
});

test("strict mode: break phases behave normally and allow actions even if strictModeEnabled is true", async () => {
  const env = createMockBackgroundEnvironment(
    { strictModeEnabled: true },
    { isRunning: true, isStarted: true, phase: "shortBreak", endTime: Date.now() + 300000 }
  );

  // PAUSE allowed during break
  const pauseRes = await env.handleMessage({ action: "PAUSE" });
  assert.equal(pauseRes.success, true);
  assert.equal(env.getTimerState().isRunning, false);

  // RESET allowed during break
  const resetRes = await env.handleMessage({ action: "RESET" });
  assert.equal(resetRes.success, true);

  // ALLOW_5_MINUTES allowed
  const allowRes = await env.handleMessage({ action: "ALLOW_5_MINUTES" });
  assert.equal(allowRes.success, true);
  assert.ok(allowRes.tempUnblockUntil > Date.now());
});

test("emergency exit: terminates session, logs incomplete session if >= 1 min, resets timer", async () => {
  const now = Date.now();
  const env = createMockBackgroundEnvironment(
    { strictModeEnabled: true, focusDuration: 25 },
    {
      isRunning: true,
      isStarted: true,
      phase: "focus",
      sessionId: "sess_strict_1",
      sessionStartedAt: now - 300000, // 5 minutes ago
      totalDuration: 1500000,
      endTime: now + 1200000, // 20 minutes remaining -> 5 minutes focused
      label: "Deep Work Task"
    }
  );

  const exitRes = await env.handleMessage({ action: "EMERGENCY_EXIT" });
  assert.equal(exitRes.success, true);

  const finalState = env.getTimerState();
  assert.equal(finalState.isRunning, false);
  assert.equal(finalState.isStarted, false);
  assert.equal(finalState.phase, "focus");
  assert.equal(finalState.tempUnblockUntil, null);

  // Incomplete session logged
  const sessions = env.getSessions();
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, "sess_strict_1");
  assert.equal(sessions[0].completed, false);
  assert.equal(sessions[0].label, "Deep Work Task");
  assert.ok(sessions[0].focusedMs >= 290000);
});

test("emergency exit: does not log incomplete session if under 1 minute", async () => {
  const now = Date.now();
  const env = createMockBackgroundEnvironment(
    { strictModeEnabled: true, focusDuration: 25 },
    {
      isRunning: true,
      isStarted: true,
      phase: "focus",
      sessionId: "sess_strict_short",
      sessionStartedAt: now - 30000, // 30s ago
      totalDuration: 1500000,
      endTime: now + 1470000,
      label: "Too brief"
    }
  );

  const exitRes = await env.handleMessage({ action: "EMERGENCY_EXIT" });
  assert.equal(exitRes.success, true);

  const sessions = env.getSessions();
  assert.equal(sessions.length, 0, "Sessions under 1 minute must not be logged");
});
