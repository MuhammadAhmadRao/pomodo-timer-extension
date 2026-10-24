/**
 * Focus Timer - Statistics & Analytics Controller
 */
(async function () {
  // DOM Elements
  const emptyState = document.getElementById("empty-state");
  const statsContent = document.getElementById("stats-content");

  // Header Actions
  const btnTheme = document.getElementById("btn-theme");
  const themeIcon = document.getElementById("theme-icon");
  const btnExportCsv = document.getElementById("btn-export-csv");
  const btnClearStats = document.getElementById("btn-clear-stats");

  // KPI Elements
  const todayFocusedVal = document.getElementById("today-focused-val");
  const todayGoalBadge = document.getElementById("kpi-today-goal-badge");
  const todayProgressFill = document.getElementById("today-progress-fill");
  const todayProgressText = document.getElementById("today-progress-text");
  const todayProgressPercent = document.getElementById("today-progress-percent");
  const todaySessionsVal = document.getElementById("today-sessions-val");
  const todaySessionsSubtext = document.getElementById("today-sessions-subtext");
  const currentStreakVal = document.getElementById("current-streak-val");
  const longestStreakVal = document.getElementById("longest-streak-val");
  const streakNote = document.getElementById("streak-note");

  // Chart Elements
  const barChartSvg = document.getElementById("bar-chart-svg");

  // 30-Day Elements
  const summary30Total = document.getElementById("summary-30-total");
  const summary30Completed = document.getElementById("summary-30-completed");
  const summary30Avg = document.getElementById("summary-30-avg");
  const summary30Active = document.getElementById("summary-30-active");
  const activityDotsRow = document.getElementById("activity-dots-row");

  // Labels Elements
  const labelsList = document.getElementById("labels-list");

  // State
  let settings = FocusTimerStorage.DEFAULT_SETTINGS;
  let sessions = [];

  async function init() {
    const data = await FocusTimerStorage.getStorage(["settings", "sessions"]);
    if (data.settings) settings = { ...FocusTimerStorage.DEFAULT_SETTINGS, ...data.settings };
    if (Array.isArray(data.sessions)) sessions = data.sessions;

    applyTheme(settings.theme);
    renderDashboard();
    setupEventListeners();
  }

  function applyTheme(theme) {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      if (themeIcon) themeIcon.textContent = "☀️";
    } else if (theme === "dark") {
      document.documentElement.removeAttribute("data-theme");
      if (themeIcon) themeIcon.textContent = "🌙";
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        document.documentElement.removeAttribute("data-theme");
        if (themeIcon) themeIcon.textContent = "🌙";
      } else {
        document.documentElement.setAttribute("data-theme", "light");
        if (themeIcon) themeIcon.textContent = "☀️";
      }
    }
  }

  function renderDashboard() {
    if (!sessions || sessions.length === 0) {
      if (emptyState) emptyState.classList.remove("hidden");
      if (statsContent) statsContent.classList.add("hidden");
      if (btnExportCsv) btnExportCsv.disabled = true;
      if (btnClearStats) btnClearStats.disabled = true;
      return;
    }

    if (emptyState) emptyState.classList.add("hidden");
    if (statsContent) statsContent.classList.remove("hidden");
    if (btnExportCsv) btnExportCsv.disabled = false;
    if (btnClearStats) btnClearStats.disabled = false;

    const dailyGoalMinutes = settings.dailyGoalMinutes || 120;
    const now = Date.now();

    // Pure stats calculations
    const streaks = FocusTimerStats.calculateStreaks(sessions, now);
    const aggregation = FocusTimerStats.calculateDailyAggregation(sessions, now, undefined, dailyGoalMinutes);
    const topLabels = FocusTimerStats.calculateTopLabels(sessions);

    // 1. Render Today's KPIs
    renderTodayKpis(aggregation.today);

    // 2. Render Streaks
    renderStreaks(streaks, aggregation.today);

    // 3. Render Last 7 Days SVG Chart
    render7DayBarChart(aggregation.last7Days, dailyGoalMinutes);

    // 4. Render 30-Day Summary & Activity Dots
    render30DaySummary(aggregation.last30Days, sessions);

    // 5. Render Top Labels
    renderTopLabels(topLabels);
  }

  function renderTodayKpis(today) {
    if (todayFocusedVal) todayFocusedVal.textContent = today.focusedMinutes;
    if (todayGoalBadge) todayGoalBadge.textContent = `Goal: ${today.dailyGoalMinutes}m`;
    if (todayProgressFill) todayProgressFill.style.width = `${today.progressPercent}%`;
    if (todayProgressText) todayProgressText.textContent = `${today.focusedMinutes} / ${today.dailyGoalMinutes} min`;
    if (todayProgressPercent) todayProgressPercent.textContent = `${today.progressPercent}%`;

    if (todaySessionsVal) todaySessionsVal.textContent = today.completedSessions;
    if (todaySessionsSubtext) {
      todaySessionsSubtext.textContent =
        today.completedSessions === 1
          ? "1 focus round completed today"
          : `${today.completedSessions} focus rounds completed today`;
    }
  }

  function renderStreaks(streaks, today) {
    if (currentStreakVal) currentStreakVal.textContent = streaks.currentStreak;
    if (longestStreakVal) longestStreakVal.textContent = streaks.longestStreak;

    if (streakNote) {
      if (today.completedSessions > 0) {
        streakNote.textContent = "🔥 Streak active today! Awesome job keeping the momentum.";
        streakNote.style.color = "var(--accent-success)";
      } else if (streaks.currentStreak > 0) {
        streakNote.textContent = "⏳ Yesterday's streak is alive! Complete 1 session today before midnight.";
        streakNote.style.color = "#f59e0b";
      } else {
        streakNote.textContent = "🎯 Complete at least 1 focus round today to start a new streak!";
        streakNote.style.color = "var(--text-muted)";
      }
    }
  }

  /**
   * Renders a clean, responsive, interactive SVG Bar Chart without external libraries
   */
  function render7DayBarChart(last7Days, dailyGoalMinutes) {
    if (!barChartSvg) return;

    const width = 700;
    const height = 240;
    const padTop = 30;
    const padBottom = 40;
    const padLeft = 45;
    const padRight = 20;

    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    // Calculate max Y value
    const maxDataMins = Math.max(...last7Days.map((d) => d.focusedMinutes), 0);
    const maxY = Math.max(dailyGoalMinutes * 1.15, maxDataMins * 1.15, 60);

    const getY = (val) => padTop + plotHeight - (val / maxY) * plotHeight;

    let svgHtml = "";

    // 1. Gridlines & Y-Axis Labels
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const val = Math.round((maxY / ySteps) * i);
      const y = getY(val);
      svgHtml += `
        <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="var(--chart-grid)" stroke-width="1" />
        <text x="${padLeft - 8}" y="${y + 4}" fill="var(--text-muted)" font-size="11" text-anchor="end" font-variant-numeric="tabular-nums">${val}m</text>
      `;
    }

    // 2. Daily Goal Reference Line
    const goalY = getY(dailyGoalMinutes);
    svgHtml += `
      <line x1="${padLeft}" y1="${goalY}" x2="${width - padRight}" y2="${goalY}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.85" />
      <text x="${width - padRight}" y="${goalY - 6}" fill="#f59e0b" font-size="10" font-weight="700" text-anchor="end">GOAL (${dailyGoalMinutes}m)</text>
    `;

    // 3. Bars & X-Axis Day Labels
    const count = last7Days.length;
    const slotWidth = plotWidth / count;
    const barWidth = Math.min(slotWidth * 0.58, 48);

    last7Days.forEach((day, idx) => {
      const x = padLeft + idx * slotWidth + (slotWidth - barWidth) / 2;
      const barH = (day.focusedMinutes / maxY) * plotHeight;
      const y = padTop + plotHeight - barH;
      const cx = x + barWidth / 2;

      // Bar fill colors
      let barFill = "var(--accent)";
      if (day.isToday) {
        barFill = "var(--accent-secondary)";
      } else if (day.metGoal) {
        barFill = "var(--accent-success)";
      }

      // Rounded bar top
      const r = Math.min(barWidth / 2, 6);

      svgHtml += `
        <g class="chart-bar-group" style="cursor: pointer;">
          <title>${day.dayName} (${day.dateStr}): ${day.focusedMinutes} min focused, ${day.completedCount} completed sessions</title>
          
          <!-- Bar Background Track (optional soft column glow) -->
          <rect x="${x}" y="${padTop}" width="${barWidth}" height="${plotHeight}" fill="rgba(255,255,255,0.02)" rx="${r}" />

          <!-- Value Label Above Bar -->
          <text x="${cx}" y="${y - 8}" fill="${day.isToday ? 'var(--text-main)' : 'var(--text-muted)'}" font-size="11" font-weight="700" text-anchor="middle" font-variant-numeric="tabular-nums">
            ${day.focusedMinutes > 0 ? `${day.focusedMinutes}m` : '0'}
          </text>

          <!-- Active Bar -->
          <rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barH, 3)}" fill="${barFill}" rx="${r}" opacity="${day.focusedMinutes > 0 ? '0.92' : '0.25'}">
            <animate attributeName="height" from="0" to="${Math.max(barH, 3)}" dur="0.4s" fill="freeze" />
            <animate attributeName="y" from="${padTop + plotHeight}" to="${y}" dur="0.4s" fill="freeze" />
          </rect>

          <!-- Day Label Below -->
          <text x="${cx}" y="${height - padBottom + 18}" fill="${day.isToday ? 'var(--text-main)' : 'var(--text-muted)'}" font-size="12" font-weight="${day.isToday ? '800' : '500'}" text-anchor="middle">
            ${day.displayLabel}
          </text>
        </g>
      `;
    });

    barChartSvg.innerHTML = svgHtml;
  }

  function render30DaySummary(last30, allSessions) {
    if (summary30Total) summary30Total.textContent = FocusTimerStats.formatMinutesFriendly(last30.totalFocusedMinutes);
    if (summary30Completed) summary30Completed.textContent = last30.completedSessions;
    if (summary30Avg) summary30Avg.textContent = `${last30.dailyAverageMinutes}m`;
    if (summary30Active) summary30Active.textContent = `${last30.activeDaysCount} / 30`;

    // Render 30 Activity Dots (from 29 days ago to today)
    if (!activityDotsRow) return;
    activityDotsRow.innerHTML = "";

    const todayStr = FocusTimerStats.getLocalDateString();
    let cur = todayStr;
    const dateList = [];
    for (let i = 0; i < 30; i++) {
      dateList.unshift(cur);
      cur = FocusTimerStats.getPreviousLocalDateString(cur);
    }

    const sessionsByDate = new Set();
    allSessions.forEach((s) => {
      if (s.completed) {
        const d = FocusTimerStats.getLocalDateString(s.endedAt || s.startedAt);
        if (d) sessionsByDate.add(d);
      }
    });

    dateList.forEach((d) => {
      const dot = document.createElement("div");
      const hasCompleted = sessionsByDate.has(d);
      const isToday = d === todayStr;

      dot.className = `activity-dot ${hasCompleted ? "active" : ""} ${isToday ? "today" : ""}`;
      dot.title = `${d}: ${hasCompleted ? "Completed focus round" : "No completed focus rounds"}${isToday ? " (Today)" : ""}`;
      activityDotsRow.appendChild(dot);
    });
  }

  function renderTopLabels(labels) {
    if (!labelsList) return;
    labelsList.innerHTML = "";

    if (!labels || labels.length === 0) {
      labelsList.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">No task labels recorded yet.</p>`;
      return;
    }

    labels.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "label-row";
      row.innerHTML = `
        <div class="label-info-row">
          <div class="label-left">
            <span class="label-rank">#${index + 1}</span>
            <span class="label-name">${escapeHtml(item.label)}</span>
            <span class="label-meta">(${item.totalCount} ${item.totalCount === 1 ? 'session' : 'sessions'})</span>
          </div>
          <div class="label-right">
            <span class="label-time">${FocusTimerStats.formatMinutesFriendly(item.focusedMinutes)}</span>
            <span class="label-pct">${item.percentage}%</span>
          </div>
        </div>
        <div class="label-bar-bg">
          <div class="label-bar-fill" style="width: ${Math.max(item.percentage, 2)}%;"></div>
        </div>
      `;
      labelsList.appendChild(row);
    });
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setupEventListeners() {
    // Theme toggle
    btnTheme.addEventListener("click", async () => {
      const nextTheme = settings.theme === "light" ? "dark" : "light";
      settings.theme = nextTheme;
      await FocusTimerStorage.setStorage({ settings });
      applyTheme(nextTheme);
    });

    // Export CSV
    btnExportCsv.addEventListener("click", () => {
      if (!sessions || sessions.length === 0) {
        alert("No session data available to export.");
        return;
      }

      const csvData = FocusTimerStats.generateSessionsCSV(sessions);
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const todayStr = FocusTimerStats.getLocalDateString();
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `focus-timer-sessions-${todayStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });

    // Clear Stats with Confirmation
    btnClearStats.addEventListener("click", async () => {
      const confirmed = confirm(
        "Are you sure you want to clear all focus session history and statistics?\n\nThis action cannot be undone."
      );
      if (confirmed) {
        sessions = [];
        await FocusTimerStorage.setStorage({ sessions: [] });
        renderDashboard();
      }
    });

    // React to storage changes from background or popup
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") {
        let shouldRerender = false;
        if (changes.sessions) {
          sessions = changes.sessions.newValue || [];
          shouldRerender = true;
        }
        if (changes.settings) {
          settings = { ...FocusTimerStorage.DEFAULT_SETTINGS, ...changes.settings.newValue };
          applyTheme(settings.theme);
          shouldRerender = true;
        }
        if (shouldRerender) {
          renderDashboard();
        }
      }
    });
  }

  init();
})();
