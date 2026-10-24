const test = require("node:test");
const assert = require("node:assert/strict");

// Helper to normalize domain from URL
function normalizeDomain(url) {
  if (!url || !/^https?:\/\//i.test(url)) {
    return null; // internal, chrome://, or extension page
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch (e) {
    return null;
  }
}

// Helper to simulate context menu site addition
function handleContextMenuBlock(url, settings, timerState) {
  const isStrictFocus = Boolean(
    settings.strictModeEnabled &&
    timerState.isRunning &&
    timerState.phase === "focus"
  );

  if (isStrictFocus) {
    return { success: false, reason: "strict_mode_locked" };
  }

  const domain = normalizeDomain(url);
  if (!domain) {
    return { success: false, reason: "invalid_or_internal_url" };
  }

  const currentBlocked = [...(settings.blockedSites || [])];
  const isDuplicate = currentBlocked.some(
    (site) => site.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") === domain
  );

  if (isDuplicate) {
    return { success: false, reason: "already_blocked", domain };
  }

  currentBlocked.push(domain);
  return {
    success: true,
    domain,
    updatedBlockedSites: currentBlocked
  };
}

// Helper to simulate command execution
function handleKeyboardCommand(command, settings, timerState) {
  const isStrictFocus = Boolean(
    settings.strictModeEnabled &&
    timerState.isRunning &&
    timerState.phase === "focus"
  );

  if (command === "toggle-timer") {
    if (timerState.isRunning) {
      if (isStrictFocus) {
        return { success: false, error: "Strict mode is active. Pausing is disabled during focus." };
      }
      return {
        success: true,
        action: "paused",
        timerState: { ...timerState, isRunning: false }
      };
    } else {
      return {
        success: true,
        action: "started",
        timerState: { ...timerState, isRunning: true, isStarted: true }
      };
    }
  }

  if (command === "skip-phase") {
    if (isStrictFocus) {
      return { success: false, error: "Strict mode is active. Skipping is disabled during focus." };
    }
    return {
      success: true,
      action: "skipped",
      timerState: {
        ...timerState,
        phase: timerState.phase === "focus" ? "shortBreak" : "focus",
        isRunning: true
      }
    };
  }

  return { success: false, error: "unknown_command" };
}

test("context menu: normalizes URLs correctly", () => {
  assert.equal(normalizeDomain("https://www.reddit.com/r/technology"), "reddit.com");
  assert.equal(normalizeDomain("http://Sub.Domain.com/page?query=1#hash"), "sub.domain.com");
  assert.equal(normalizeDomain("https://twitter.com/"), "twitter.com");
  assert.equal(normalizeDomain("https://www.youtube.com/watch?v=123"), "youtube.com");
});

test("context menu: ignores chrome://, extension pages, file URLs, and about:blank", () => {
  assert.equal(normalizeDomain("chrome://extensions/"), null);
  assert.equal(normalizeDomain("chrome://settings/"), null);
  assert.equal(normalizeDomain("chrome-extension://fignfifoniblkonapihmkfakmlgkbkcf/popup.html"), null);
  assert.equal(normalizeDomain("file:///Users/username/doc.html"), null);
  assert.equal(normalizeDomain("about:blank"), null);
});

test("context menu: avoids duplicate domains in blocklist", () => {
  const settings = { blockedSites: ["reddit.com", "twitter.com"] };
  const timerState = { isRunning: false, phase: "focus" };

  const res1 = handleContextMenuBlock("https://www.reddit.com/explore", settings, timerState);
  assert.equal(res1.success, false);
  assert.equal(res1.reason, "already_blocked");
  assert.equal(res1.domain, "reddit.com");

  const res2 = handleContextMenuBlock("https://news.ycombinator.com/item?id=1", settings, timerState);
  assert.equal(res2.success, true);
  assert.equal(res2.domain, "news.ycombinator.com");
  assert.deepEqual(res2.updatedBlockedSites, ["reddit.com", "twitter.com", "news.ycombinator.com"]);
});

test("context menu: locked during strict focus session", () => {
  const settings = { strictModeEnabled: true, blockedSites: ["reddit.com"] };
  const timerState = { isRunning: true, phase: "focus" };

  const res = handleContextMenuBlock("https://youtube.com/watch?v=1", settings, timerState);
  assert.equal(res.success, false);
  assert.equal(res.reason, "strict_mode_locked");
});

test("keyboard shortcuts: toggle-timer starts and pauses normally when strict mode is off", () => {
  const settings = { strictModeEnabled: false };
  let timerState = { isRunning: false, phase: "focus" };

  // Start
  const startRes = handleKeyboardCommand("toggle-timer", settings, timerState);
  assert.equal(startRes.success, true);
  assert.equal(startRes.action, "started");
  timerState = startRes.timerState;
  assert.equal(timerState.isRunning, true);

  // Pause
  const pauseRes = handleKeyboardCommand("toggle-timer", settings, timerState);
  assert.equal(pauseRes.success, true);
  assert.equal(pauseRes.action, "paused");
  assert.equal(pauseRes.timerState.isRunning, false);
});

test("keyboard shortcuts: toggle-timer and skip-phase respect strict mode during focus", () => {
  const settings = { strictModeEnabled: true };
  const timerState = { isRunning: true, phase: "focus" };

  // Pausing rejected
  const toggleRes = handleKeyboardCommand("toggle-timer", settings, timerState);
  assert.equal(toggleRes.success, false);
  assert.match(toggleRes.error, /Strict mode is active/);

  // Skipping rejected
  const skipRes = handleKeyboardCommand("skip-phase", settings, timerState);
  assert.equal(skipRes.success, false);
  assert.match(skipRes.error, /Strict mode is active/);
});

test("keyboard shortcuts: toggle-timer and skip-phase work during break even with strict mode enabled", () => {
  const settings = { strictModeEnabled: true };
  const timerState = { isRunning: true, phase: "shortBreak" };

  // Pause allowed during break
  const toggleRes = handleKeyboardCommand("toggle-timer", settings, timerState);
  assert.equal(toggleRes.success, true);
  assert.equal(toggleRes.action, "paused");

  // Skip allowed during break
  const skipRes = handleKeyboardCommand("skip-phase", settings, timerState);
  assert.equal(skipRes.success, true);
  assert.equal(skipRes.action, "skipped");
  assert.equal(skipRes.timerState.phase, "focus");
});
