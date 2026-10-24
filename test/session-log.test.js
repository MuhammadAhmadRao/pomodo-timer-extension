const test = require("node:test");
const assert = require("node:assert/strict");

// Mock Chrome Storage Local
function createMockChromeStorage(initial = {}) {
  let store = { ...initial };
  return {
    local: {
      get(keys, cb) {
        if (!keys) return cb({ ...store });
        const result = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) {
          if (k in store) result[k] = store[k];
        }
        cb(result);
      },
      set(data, cb) {
        store = { ...store, ...data };
        if (cb) cb();
      },
      _inspect() {
        return store;
      }
    }
  };
}

test("session logging: idempotent, ignores < 1 min, caps at 365 days", async () => {
  const mockStorage = createMockChromeStorage();

  // In-memory set and storage helper matching service-worker.js implementation
  const loggedSessionIds = new Set();

  async function recordSession(entry) {
    if (!entry || !entry.id) return;
    if (!entry.completed && (entry.focusedMs || 0) < 60000) {
      return;
    }
    if (loggedSessionIds.has(entry.id)) {
      return;
    }
    loggedSessionIds.add(entry.id);

    return new Promise((resolve) => {
      mockStorage.local.get(["sessions"], (res) => {
        const sessions = res.sessions || [];
        if (sessions.some((s) => s.id === entry.id)) {
          return resolve();
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

        const updated = [...sessions, cleanEntry].filter(
          (s) => (s.endedAt || s.startedAt || 0) >= oneYearAgo
        );

        mockStorage.local.set({ sessions: updated }, resolve);
      });
    });
  }

  // 1. Incomplete session under 1 minute (45s = 45000ms) should be ignored
  await recordSession({
    id: "short_1",
    startedAt: Date.now() - 45000,
    endedAt: Date.now(),
    plannedMs: 1500000,
    focusedMs: 45000,
    completed: false,
    label: "Quick attempt"
  });

  let data = mockStorage.local._inspect();
  assert.equal((data.sessions || []).length, 0);

  // 2. Incomplete session >= 1 minute (90s = 90000ms) should be recorded
  await recordSession({
    id: "partial_1",
    startedAt: Date.now() - 90000,
    endedAt: Date.now(),
    plannedMs: 1500000,
    focusedMs: 90000,
    completed: false,
    label: "Drafting email"
  });

  data = mockStorage.local._inspect();
  assert.equal(data.sessions.length, 1);
  assert.equal(data.sessions[0].id, "partial_1");
  assert.equal(data.sessions[0].completed, false);
  assert.equal(data.sessions[0].label, "Drafting email");

  // 3. Completed session (25 min) should be recorded
  await recordSession({
    id: "completed_1",
    startedAt: Date.now() - 1500000,
    endedAt: Date.now(),
    plannedMs: 1500000,
    focusedMs: 1500000,
    completed: true,
    label: "Code review"
  });

  data = mockStorage.local._inspect();
  assert.equal(data.sessions.length, 2);
  assert.equal(data.sessions[1].id, "completed_1");
  assert.equal(data.sessions[1].completed, true);

  // 4. Idempotency: re-logging completed_1 should do nothing
  await recordSession({
    id: "completed_1",
    startedAt: Date.now() - 1500000,
    endedAt: Date.now(),
    plannedMs: 1500000,
    focusedMs: 1500000,
    completed: true,
    label: "Code review"
  });

  data = mockStorage.local._inspect();
  assert.equal(data.sessions.length, 2, "Session count must remain 2 (no duplicates)");

  // 5. Pruning: an entry older than 365 days should be pruned
  const oldTimestamp = Date.now() - 370 * 24 * 60 * 60 * 1000;
  mockStorage.local.set({
    sessions: [
      { id: "ancient", endedAt: oldTimestamp, completed: true, focusedMs: 1500000, label: "Ancient" },
      ...data.sessions
    ]
  });

  await recordSession({
    id: "fresh_2",
    startedAt: Date.now() - 1500000,
    endedAt: Date.now(),
    plannedMs: 1500000,
    focusedMs: 1500000,
    completed: true,
    label: "New feature"
  });

  data = mockStorage.local._inspect();
  assert.ok(!data.sessions.some((s) => s.id === "ancient"), "Ancient session must be pruned");
  assert.equal(data.sessions.length, 3);
});
