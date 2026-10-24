const test = require("node:test");
const assert = require("node:assert/strict");
const FocusTimerStats = require("../shared/stats.js");

const {
  getLocalDateString,
  getPreviousLocalDateString,
  getNextLocalDateString,
  calculateStreaks,
  calculateDailyAggregation,
  calculateTopLabels,
  generateSessionsCSV,
  pruneOldSessions
} = FocusTimerStats;

test("getLocalDateString handles timezones and boundaries properly", () => {
  // 2026-10-24 23:30:00 UTC
  const utcTimestamp = Date.UTC(2026, 9, 24, 23, 30, 0);

  // In UTC or London, it's 2026-10-24
  assert.equal(getLocalDateString(utcTimestamp, "UTC"), "2026-10-24");

  // In New York (EDT, UTC-4), it's 19:30 on 2026-10-24
  assert.equal(getLocalDateString(utcTimestamp, "America/New_York"), "2026-10-24");

  // In Tokyo (JST, UTC+9), 23:30 + 9h = 08:30 on next day: 2026-10-25!
  assert.equal(getLocalDateString(utcTimestamp, "Asia/Tokyo"), "2026-10-25");
});

test("calendar arithmetic handles month and leap year boundaries", () => {
  assert.equal(getPreviousLocalDateString("2026-03-01"), "2026-02-28");
  assert.equal(getPreviousLocalDateString("2024-03-01"), "2024-02-29"); // leap year
  assert.equal(getPreviousLocalDateString("2026-01-01"), "2025-12-31"); // year boundary
  assert.equal(getNextLocalDateString("2026-12-31"), "2027-01-01");
  assert.equal(getNextLocalDateString("2024-02-28"), "2024-02-29");
});

test("streaks: empty sessions returns 0 streak", () => {
  const result = calculateStreaks([], Date.UTC(2026, 9, 25, 12, 0, 0), "UTC");
  assert.deepEqual(result, { currentStreak: 0, longestStreak: 0 });
});

test("streaks: incomplete sessions do not count toward streaks", () => {
  const now = Date.UTC(2026, 9, 25, 12, 0, 0); // 2026-10-25
  const sessions = [
    {
      id: "s1",
      startedAt: now - 3600000,
      endedAt: now,
      plannedMs: 1500000,
      focusedMs: 1200000,
      completed: false, // Incomplete!
      label: "Work"
    }
  ];

  const result = calculateStreaks(sessions, now, "UTC");
  assert.deepEqual(result, { currentStreak: 0, longestStreak: 0 });
});

test("streaks: session completed today counts as streak = 1", () => {
  const now = Date.UTC(2026, 9, 25, 12, 0, 0);
  const sessions = [
    {
      id: "s1",
      endedAt: now - 60000,
      completed: true,
      focusedMs: 1500000,
      label: "Focus"
    }
  ];

  const result = calculateStreaks(sessions, now, "UTC");
  assert.deepEqual(result, { currentStreak: 1, longestStreak: 1 });
});

test("streaks: today has no session yet, but yesterday had session -> streak not broken", () => {
  // Today is 2026-10-25 at 10:00 UTC
  const now = Date.UTC(2026, 9, 25, 10, 0, 0);

  // Completed sessions on 2026-10-23 and 2026-10-24
  const sessions = [
    {
      id: "s1",
      endedAt: Date.UTC(2026, 9, 23, 15, 0, 0),
      completed: true,
      focusedMs: 1500000
    },
    {
      id: "s2",
      endedAt: Date.UTC(2026, 9, 24, 18, 0, 0),
      completed: true,
      focusedMs: 1500000
    }
  ];

  const result = calculateStreaks(sessions, now, "UTC");
  // Today has no session yet, but streak from yesterday (Oct 24) and Oct 23 is 2!
  assert.equal(result.currentStreak, 2);
  assert.equal(result.longestStreak, 2);
});

test("streaks: when today completes a session, streak increments", () => {
  const now = Date.UTC(2026, 9, 25, 14, 0, 0);

  const sessions = [
    {
      id: "s1",
      endedAt: Date.UTC(2026, 9, 23, 15, 0, 0),
      completed: true,
      focusedMs: 1500000
    },
    {
      id: "s2",
      endedAt: Date.UTC(2026, 9, 24, 18, 0, 0),
      completed: true,
      focusedMs: 1500000
    },
    {
      id: "s3",
      endedAt: now,
      completed: true,
      focusedMs: 1500000
    }
  ];

  const result = calculateStreaks(sessions, now, "UTC");
  assert.equal(result.currentStreak, 3);
  assert.equal(result.longestStreak, 3);
});

test("streaks: yesterday was missed -> streak is 0 if today has no session", () => {
  // Today is 2026-10-25. Session completed on 2026-10-23, but nothing on 2026-10-24
  const now = Date.UTC(2026, 9, 25, 10, 0, 0);
  const sessions = [
    {
      id: "s1",
      endedAt: Date.UTC(2026, 9, 23, 15, 0, 0),
      completed: true,
      focusedMs: 1500000
    }
  ];

  const result = calculateStreaks(sessions, now, "UTC");
  assert.equal(result.currentStreak, 0);
  assert.equal(result.longestStreak, 1);
});

test("streaks: longest streak is tracked historically across breaks", () => {
  // Past: 4 consecutive days (Oct 10, 11, 12, 13)
  // Break on Oct 14, 15
  // Current: 2 consecutive days (Oct 16, 17). Today is Oct 17.
  const now = Date.UTC(2026, 9, 17, 12, 0, 0);
  const sessions = [
    { id: "1", endedAt: Date.UTC(2026, 9, 10, 10, 0, 0), completed: true, focusedMs: 1500000 },
    { id: "2", endedAt: Date.UTC(2026, 9, 11, 10, 0, 0), completed: true, focusedMs: 1500000 },
    { id: "3", endedAt: Date.UTC(2026, 9, 12, 10, 0, 0), completed: true, focusedMs: 1500000 },
    { id: "4", endedAt: Date.UTC(2026, 9, 13, 10, 0, 0), completed: true, focusedMs: 1500000 },
    { id: "5", endedAt: Date.UTC(2026, 9, 16, 10, 0, 0), completed: true, focusedMs: 1500000 },
    { id: "6", endedAt: Date.UTC(2026, 9, 17, 10, 0, 0), completed: true, focusedMs: 1500000 }
  ];

  const result = calculateStreaks(sessions, now, "UTC");
  assert.equal(result.currentStreak, 2);
  assert.equal(result.longestStreak, 4);
});

test("streaks: day boundary around midnight (23:59:59 vs 00:00:01)", () => {
  // Session A ends at 2026-10-24 23:59:50 UTC (day 1)
  // Session B ends at 2026-10-25 00:00:10 UTC (day 2)
  // "Now" is 2026-10-25 08:00:00 UTC
  const now = Date.UTC(2026, 9, 25, 8, 0, 0);
  const sessionA = {
    id: "a",
    endedAt: Date.UTC(2026, 9, 24, 23, 59, 50),
    completed: true,
    focusedMs: 1500000
  };
  const sessionB = {
    id: "b",
    endedAt: Date.UTC(2026, 9, 25, 0, 0, 10),
    completed: true,
    focusedMs: 1500000
  };

  const result = calculateStreaks([sessionA, sessionB], now, "UTC");
  // Two consecutive days across midnight!
  assert.equal(result.currentStreak, 2);
  assert.equal(result.longestStreak, 2);
});

test("daily aggregation: today's focused minutes, completed count, and daily goal progress", () => {
  const now = Date.UTC(2026, 9, 25, 15, 0, 0);
  const sessions = [
    // Today session 1: 25 min completed
    {
      id: "s1",
      endedAt: Date.UTC(2026, 9, 25, 10, 0, 0),
      completed: true,
      focusedMs: 25 * 60 * 1000,
      label: "Coding"
    },
    // Today session 2: 35 min completed
    {
      id: "s2",
      endedAt: Date.UTC(2026, 9, 25, 12, 0, 0),
      completed: true,
      focusedMs: 35 * 60 * 1000,
      label: "Reading"
    },
    // Today session 3: 15 min reset early (completed: false)
    {
      id: "s3",
      endedAt: Date.UTC(2026, 9, 25, 14, 0, 0),
      completed: false,
      focusedMs: 15 * 60 * 1000,
      label: "Planning"
    },
    // Yesterday session: 25 min (should NOT count in today's stats)
    {
      id: "s4",
      endedAt: Date.UTC(2026, 9, 24, 16, 0, 0),
      completed: true,
      focusedMs: 25 * 60 * 1000,
      label: "Coding"
    }
  ];

  // Daily goal: 100 minutes
  const agg = calculateDailyAggregation(sessions, now, "UTC", 100);

  // Today focused: 25 + 35 + 15 = 75 minutes
  assert.equal(agg.today.focusedMinutes, 75);
  // Today completed sessions: s1 and s2 = 2
  assert.equal(agg.today.completedSessions, 2);
  // Progress ratio: 75 / 100 = 0.75 (75%)
  assert.equal(agg.today.progressRatio, 0.75);
  assert.equal(agg.today.progressPercent, 75);

  // Last 7 days breakdown has 7 entries, with the last being today
  assert.equal(agg.last7Days.length, 7);
  const todayEntry = agg.last7Days[agg.last7Days.length - 1];
  assert.equal(todayEntry.dateStr, "2026-10-25");
  assert.equal(todayEntry.focusedMinutes, 75);
  assert.equal(todayEntry.completedCount, 2);
  assert.equal(todayEntry.isToday, true);

  const yesterdayEntry = agg.last7Days[agg.last7Days.length - 2];
  assert.equal(yesterdayEntry.dateStr, "2026-10-24");
  assert.equal(yesterdayEntry.focusedMinutes, 25);
  assert.equal(yesterdayEntry.completedCount, 1);
});

test("top labels calculates total focused time per label accurately", () => {
  const sessions = [
    { id: "1", focusedMs: 60 * 60 * 1000, label: "Coding", completed: true },
    { id: "2", focusedMs: 30 * 60 * 1000, label: "Coding", completed: true },
    { id: "3", focusedMs: 45 * 60 * 1000, label: "Writing", completed: true },
    { id: "4", focusedMs: 15 * 60 * 1000, label: "", completed: false } // Unlabeled
  ];

  const labels = calculateTopLabels(sessions);
  assert.equal(labels.length, 3);
  // Top should be Coding: 90 min (5400000 ms)
  assert.equal(labels[0].label, "Coding");
  assert.equal(labels[0].focusedMinutes, 90);
  assert.equal(labels[0].totalCount, 2);

  // Second should be Writing: 45 min
  assert.equal(labels[1].label, "Writing");
  assert.equal(labels[1].focusedMinutes, 45);

  // Third should be (No label): 15 min
  assert.equal(labels[2].label, "(No label)");
  assert.equal(labels[2].focusedMinutes, 15);
});

test("CSV export generates valid CSV format", () => {
  const sessions = [
    {
      id: "sess_123",
      startedAt: Date.UTC(2026, 9, 25, 10, 0, 0),
      endedAt: Date.UTC(2026, 9, 25, 10, 25, 0),
      plannedMs: 25 * 60 * 1000,
      focusedMs: 25 * 60 * 1000,
      completed: true,
      label: 'Deep Work, "Fix bug"'
    }
  ];

  const csv = generateSessionsCSV(sessions);
  assert.ok(csv.includes("Session ID"));
  assert.ok(csv.includes('"sess_123"'));
  assert.ok(csv.includes('"Deep Work, ""Fix bug"""')); // escaped quotes
});

test("pruneOldSessions removes sessions older than 365 days", () => {
  const now = Date.UTC(2026, 9, 25, 12, 0, 0);
  const oneDay = 24 * 3600 * 1000;
  const sessions = [
    { id: "fresh", endedAt: now - 30 * oneDay },
    { id: "edge", endedAt: now - 364 * oneDay },
    { id: "old", endedAt: now - 366 * oneDay }
  ];

  const pruned = pruneOldSessions(sessions, 365, now);
  assert.equal(pruned.length, 2);
  assert.equal(pruned[0].id, "fresh");
  assert.equal(pruned[1].id, "edge");
});
