/**
 * Focus Timer - Stats & Analytics Utilities
 * Pure calculation logic for streaks, daily aggregations, top labels, and CSV export.
 * Compatible with Service Worker, extension pages, and Node.js unit tests.
 */
(function (root) {
  /**
   * Returns a local date string "YYYY-MM-DD" for a given timestamp and timezone.
   * If timeZone is omitted, the runtime's local timezone is used.
   */
  function getLocalDateString(timestamp = Date.now(), timeZone) {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";

    if (timeZone) {
      try {
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }).formatToParts(date);
        const y = parts.find((p) => p.type === "year")?.value;
        const m = parts.find((p) => p.type === "month")?.value;
        const d = parts.find((p) => p.type === "day")?.value;
        if (y && m && d) return `${y}-${m}-${d}`;
      } catch (err) {
        // Fallback to local if invalid timezone passed
      }
    }

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /**
   * Calendar-arithmetic previous local day string ("YYYY-MM-DD" - 1 calendar day).
   * Safe across month, year, and leap-year boundaries without DST drift.
   */
  function getPreviousLocalDateString(dateStr) {
    if (!dateStr || typeof dateStr !== "string") return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return "";
    const prevDate = new Date(Date.UTC(y, m - 1, d - 1));
    const py = prevDate.getUTCFullYear();
    const pm = String(prevDate.getUTCMonth() + 1).padStart(2, "0");
    const pd = String(prevDate.getUTCDate()).padStart(2, "0");
    return `${py}-${pm}-${pd}`;
  }

  /**
   * Calendar-arithmetic next local day string ("YYYY-MM-DD" + 1 calendar day).
   */
  function getNextLocalDateString(dateStr) {
    if (!dateStr || typeof dateStr !== "string") return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return "";
    const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
    const ny = nextDate.getUTCFullYear();
    const nm = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
    const nd = String(nextDate.getUTCDate()).padStart(2, "0");
    return `${ny}-${nm}-${nd}`;
  }

  /**
   * Calculates current streak and longest streak:
   * - A day counts if it has at least one completed focus session (completed: true).
   * - Uses user's LOCAL date for day boundaries.
   * - If today has no completed session yet, the streak is NOT broken until the day ends.
   */
  function calculateStreaks(sessions = [], nowTimestamp = Date.now(), timeZone) {
    if (!Array.isArray(sessions) || sessions.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    // Filter completed focus sessions
    const completedSessions = sessions.filter((s) => s && s.completed === true);
    if (completedSessions.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    // Collect distinct local date strings
    const completedDatesSet = new Set();
    for (const session of completedSessions) {
      const refTime = session.endedAt || session.startedAt;
      if (refTime) {
        const dateStr = getLocalDateString(refTime, timeZone);
        if (dateStr) completedDatesSet.add(dateStr);
      }
    }

    if (completedDatesSet.size === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    const todayStr = getLocalDateString(nowTimestamp, timeZone);
    const yesterdayStr = getPreviousLocalDateString(todayStr);

    // Current Streak calculation
    let currentStreak = 0;
    if (completedDatesSet.has(todayStr)) {
      // Completed session today: streak counts backwards from today
      let checkDate = todayStr;
      while (completedDatesSet.has(checkDate)) {
        currentStreak++;
        checkDate = getPreviousLocalDateString(checkDate);
      }
    } else if (completedDatesSet.has(yesterdayStr)) {
      // No session today yet, but completed yesterday: streak not broken
      let checkDate = yesterdayStr;
      while (completedDatesSet.has(checkDate)) {
        currentStreak++;
        checkDate = getPreviousLocalDateString(checkDate);
      }
    } else {
      // Neither today nor yesterday had completed sessions
      currentStreak = 0;
    }

    // Longest Streak calculation (all-time consecutive days)
    const sortedDates = Array.from(completedDatesSet).sort();
    let longestStreak = 0;
    let runningStreak = 0;
    let expectedDate = null;

    for (const d of sortedDates) {
      if (expectedDate === null || d === expectedDate) {
        runningStreak++;
      } else {
        runningStreak = 1;
      }
      expectedDate = getNextLocalDateString(d);
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    }

    // Ensure longest streak is at least current streak
    longestStreak = Math.max(longestStreak, currentStreak);

    return { currentStreak, longestStreak };
  }

  /**
   * Calculates today's summary, last 7 days bar data, and last 30 days summary.
   */
  function calculateDailyAggregation(
    sessions = [],
    nowTimestamp = Date.now(),
    timeZone,
    dailyGoalMinutes = 120
  ) {
    const todayStr = getLocalDateString(nowTimestamp, timeZone);
    const goalMins = Math.max(1, Number(dailyGoalMinutes) || 120);

    // Group sessions by local date string
    const sessionsByDate = new Map();
    let allFocusedMs = 0;

    for (const s of sessions) {
      if (!s) continue;
      const refTime = s.endedAt || s.startedAt;
      if (!refTime) continue;
      const dateStr = getLocalDateString(refTime, timeZone);
      if (!dateStr) continue;

      if (!sessionsByDate.has(dateStr)) {
        sessionsByDate.set(dateStr, []);
      }
      sessionsByDate.get(dateStr).push(s);
      allFocusedMs += s.focusedMs || 0;
    }

    // 1. Today's stats
    const todaySessions = sessionsByDate.get(todayStr) || [];
    const todayFocusedMs = todaySessions.reduce((acc, s) => acc + (s.focusedMs || 0), 0);
    const todayFocusedMinutes = Math.round(todayFocusedMs / 60000);
    const todayCompletedCount = todaySessions.filter((s) => s.completed === true).length;
    const todayProgressRatio = Math.min(1, todayFocusedMinutes / goalMins);
    const todayProgressPercent = Math.min(100, Math.round((todayFocusedMinutes / goalMins) * 100));

    // 2. Last 7 Days (including today, chronologically left-to-right)
    const last7Days = [];
    let curDate = todayStr;
    const past7DateStrs = [];
    for (let i = 0; i < 7; i++) {
      past7DateStrs.unshift(curDate);
      curDate = getPreviousLocalDateString(curDate);
    }

    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (const dateStr of past7DateStrs) {
      const daySessions = sessionsByDate.get(dateStr) || [];
      const focusedMs = daySessions.reduce((acc, s) => acc + (s.focusedMs || 0), 0);
      const focusedMinutes = Math.round(focusedMs / 60000);
      const completedCount = daySessions.filter((s) => s.completed === true).length;

      // Parse date components to get weekday name
      const [y, m, d] = dateStr.split("-").map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d));
      const dayIndex = dateObj.getUTCDay();
      const isToday = dateStr === todayStr;

      last7Days.push({
        dateStr,
        dayName: DAY_NAMES[dayIndex],
        displayLabel: isToday ? "Today" : DAY_NAMES[dayIndex],
        focusedMinutes,
        focusedMs,
        completedCount,
        isToday,
        metGoal: focusedMinutes >= goalMins
      });
    }

    // 3. Last 30 Days Summary
    let date30 = todayStr;
    const past30DateStrs = new Set();
    for (let i = 0; i < 30; i++) {
      past30DateStrs.add(date30);
      date30 = getPreviousLocalDateString(date30);
    }

    let last30FocusedMs = 0;
    let last30CompletedCount = 0;
    let last30ActiveDaysCount = 0;

    for (const dateStr of past30DateStrs) {
      const daySessions = sessionsByDate.get(dateStr) || [];
      if (daySessions.length > 0) {
        const focused = daySessions.reduce((acc, s) => acc + (s.focusedMs || 0), 0);
        last30FocusedMs += focused;
        const completed = daySessions.filter((s) => s.completed === true).length;
        last30CompletedCount += completed;
        if (completed > 0) {
          last30ActiveDaysCount++;
        }
      }
    }

    const last30FocusedMinutes = Math.round(last30FocusedMs / 60000);
    const dailyAverageMinutes = Math.round(last30FocusedMinutes / 30);

    return {
      today: {
        dateStr: todayStr,
        focusedMinutes: todayFocusedMinutes,
        focusedMs: todayFocusedMs,
        completedSessions: todayCompletedCount,
        dailyGoalMinutes: goalMins,
        progressRatio: todayProgressRatio,
        progressPercent: todayProgressPercent
      },
      last7Days,
      last30Days: {
        totalFocusedMinutes: last30FocusedMinutes,
        totalFocusedMs: last30FocusedMs,
        completedSessions: last30CompletedCount,
        activeDaysCount: last30ActiveDaysCount,
        dailyAverageMinutes
      }
    };
  }

  /**
   * Aggregates total focused time and count grouped by label.
   */
  function calculateTopLabels(sessions = []) {
    if (!Array.isArray(sessions) || sessions.length === 0) {
      return [];
    }

    const map = new Map();
    let grandTotalMs = 0;

    for (const s of sessions) {
      if (!s) continue;
      const rawLabel = (s.label || "").trim();
      const labelKey = rawLabel || "(No label)";
      const focusedMs = Math.max(0, s.focusedMs || 0);

      grandTotalMs += focusedMs;

      if (!map.has(labelKey)) {
        map.set(labelKey, {
          label: labelKey,
          isUnlabeled: !rawLabel,
          focusedMs: 0,
          completedCount: 0,
          totalCount: 0
        });
      }

      const item = map.get(labelKey);
      item.focusedMs += focusedMs;
      item.totalCount += 1;
      if (s.completed) {
        item.completedCount += 1;
      }
    }

    const list = Array.from(map.values());

    // Sort descending by focusedMs
    list.sort((a, b) => b.focusedMs - a.focusedMs);

    return list.map((item) => {
      const focusedMinutes = Math.round(item.focusedMs / 60000);
      const percentage = grandTotalMs > 0 ? Math.round((item.focusedMs / grandTotalMs) * 100) : 0;
      return {
        ...item,
        focusedMinutes,
        percentage
      };
    });
  }

  /**
   * Formats minutes into human-readable e.g. "2h 15m" or "45m"
   */
  function formatMinutesFriendly(minutes) {
    const mins = Math.max(0, Math.round(minutes || 0));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) {
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${m}m`;
  }

  /**
   * Generates CSV string for exporting session logs.
   */
  function generateSessionsCSV(sessions = []) {
    const headers = [
      "Session ID",
      "Date",
      "Started At (ISO)",
      "Ended At (ISO)",
      "Planned (minutes)",
      "Focused (minutes)",
      "Completed",
      "Label"
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = [headers.map(escapeCsv).join(",")];

    for (const s of sessions) {
      if (!s) continue;
      const startedIso = s.startedAt ? new Date(s.startedAt).toISOString() : "";
      const endedIso = s.endedAt ? new Date(s.endedAt).toISOString() : "";
      const dateStr = s.endedAt ? getLocalDateString(s.endedAt) : (s.startedAt ? getLocalDateString(s.startedAt) : "");
      const plannedMins = s.plannedMs ? Math.round(s.plannedMs / 60000) : "";
      const focusedMins = s.focusedMs ? (s.focusedMs / 60000).toFixed(1) : "0";

      const row = [
        escapeCsv(s.id || ""),
        escapeCsv(dateStr),
        escapeCsv(startedIso),
        escapeCsv(endedIso),
        escapeCsv(plannedMins),
        escapeCsv(focusedMins),
        escapeCsv(Boolean(s.completed)),
        escapeCsv(s.label || "")
      ];

      rows.push(row.join(","));
    }

    return rows.join("\r\n");
  }

  /**
   * Prunes sessions older than maxDays (default 365)
   */
  function pruneOldSessions(sessions = [], maxDays = 365, nowTimestamp = Date.now()) {
    if (!Array.isArray(sessions)) return [];
    const cutoff = nowTimestamp - maxDays * 24 * 60 * 60 * 1000;
    return sessions.filter((s) => {
      const ref = s.endedAt || s.startedAt;
      return ref && ref >= cutoff;
    });
  }

  const FocusTimerStats = {
    getLocalDateString,
    getPreviousLocalDateString,
    getNextLocalDateString,
    calculateStreaks,
    calculateDailyAggregation,
    calculateTopLabels,
    formatMinutesFriendly,
    generateSessionsCSV,
    pruneOldSessions
  };

  root.FocusTimerStats = FocusTimerStats;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = FocusTimerStats;
  }
})(typeof self !== "undefined" ? self : this);
