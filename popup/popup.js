/**
 * Focus Timer - Popup Controller
 */
(function () {
  // DOM References
  const tabButtons = document.querySelectorAll(".tab-btn");
  const ringFill = document.getElementById("ring-fill");
  const phaseEmoji = document.getElementById("phase-emoji");
  const phaseName = document.getElementById("phase-name");
  const timerDisplay = document.getElementById("timer-display");
  const statusText = document.getElementById("status-text");
  const roundDotsContainer = document.getElementById("round-dots");

  const btnToggle = document.getElementById("btn-toggle");
  const iconPlay = document.getElementById("icon-play");
  const iconPause = document.getElementById("icon-pause");
  const btnReset = document.getElementById("btn-reset");
  const btnSkip = document.getElementById("btn-skip");
  const btnSettings = document.getElementById("btn-settings");
  const btnTheme = document.getElementById("btn-theme");
  const btnPip = document.getElementById("btn-pip");
  const btnStats = document.getElementById("btn-stats");

  // Task Label References
  const taskSection = document.getElementById("task-section");
  const taskInput = document.getElementById("task-input");
  const btnClearTask = document.getElementById("btn-clear-task");
  const quickChipsContainer = document.getElementById("quick-chips");
  const activeTaskDisplay = document.getElementById("active-task-display");

  // PiP Elements
  const pipCanvas = document.getElementById("pip-canvas");
  const pipVideo = document.getElementById("pip-video");
  const pipCtx = pipCanvas.getContext("2d");

  // State
  let settings = FocusTimerStorage.DEFAULT_SETTINGS;
  let timerState = FocusTimerStorage.DEFAULT_TIMER_STATE;
  let recentLabels = [];
  let tickerTimer = null;
  const CIRCUMFERENCE = 2 * Math.PI * 102; // 640.88

  // Initialize
  async function init() {
    const data = await FocusTimerStorage.getStorage(["settings", "timerState", "recentLabels"]);
    if (data.settings) settings = data.settings;
    if (data.timerState) timerState = data.timerState;
    if (Array.isArray(data.recentLabels)) recentLabels = data.recentLabels;

    applyTheme(settings.theme);
    setupTaskLabelEvents();
    renderAll();
    startTicker();
  }

  /**
   * Applies dark or light theme
   */
  function applyTheme(theme) {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else if (theme === "dark") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", "light");
      }
    }
  }

  /**
   * Renders UI based on current state
   */
  function renderAll() {
    const currentPhase = timerState.phase || "focus";
    const phaseInfo = FocusTimerStorage.PHASES[currentPhase] || FocusTimerStorage.PHASES.focus;

    // Body data attribute for dynamic phase colors
    document.body.setAttribute("data-phase", currentPhase);

    // Active tab
    tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.phase === currentPhase);
    });

    // Phase badge
    phaseEmoji.textContent = phaseInfo.emoji;
    phaseName.textContent = phaseInfo.name;

    // Play/Pause button icons & status text
    if (timerState.isRunning) {
      iconPlay.classList.add("hidden");
      iconPause.classList.remove("hidden");
      statusText.textContent = currentPhase === "focus" ? "Stay focused" : "Rest & recharge";
    } else {
      iconPlay.classList.remove("hidden");
      iconPause.classList.add("hidden");
      statusText.textContent = timerState.isStarted ? "Paused" : "Ready to begin";
    }

    // Rounds dots
    renderRounds();

    // Time & Progress ring
    updateTimeAndRing();

    // Render task label input, quick chips, and centerpiece task badge
    renderTaskSection();

    // Update PiP canvas if running or visible
    drawPipCanvas();
  }

  /**
   * Configures task label events
   */
  function setupTaskLabelEvents() {
    if (!taskInput) return;

    // Save label as user types
    taskInput.addEventListener("input", () => {
      const val = taskInput.value.trim();
      btnClearTask.classList.toggle("hidden", !taskInput.value);
      timerState.label = val;
      FocusTimerStorage.setStorage({ timerState });
      renderActiveTaskPill();
      highlightActiveChip();
    });

    // Enter commits and saves to recent labels
    taskInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        saveCurrentLabelToRecents();
        taskInput.blur();
      }
    });

    // Clear label button
    btnClearTask.addEventListener("click", () => {
      taskInput.value = "";
      btnClearTask.classList.add("hidden");
      timerState.label = "";
      FocusTimerStorage.setStorage({ timerState });
      renderActiveTaskPill();
      highlightActiveChip();
      taskInput.focus();
    });
  }

  /**
   * Persists label to recentLabels (up to 5, deduplicated)
   */
  async function saveCurrentLabelToRecents() {
    const val = (taskInput ? taskInput.value : timerState.label || "").trim();
    if (!val) return;
    const updated = [val, ...recentLabels.filter((l) => l.toLowerCase() !== val.toLowerCase())].slice(0, 5);
    recentLabels = updated;
    await FocusTimerStorage.setStorage({ recentLabels: updated });
    renderQuickChips();
  }

  /**
   * Renders the task section & quick pick chips
   */
  function renderTaskSection() {
    const isFocus = (timerState.phase || "focus") === "focus";

    if (!isFocus) {
      if (taskSection) taskSection.classList.add("hidden");
      if (activeTaskDisplay) activeTaskDisplay.classList.add("hidden");
      return;
    }

    if (taskSection) taskSection.classList.remove("hidden");

    // Don't overwrite if user is actively typing in the input
    if (document.activeElement !== taskInput && taskInput) {
      taskInput.value = timerState.label || "";
    }
    if (btnClearTask) {
      btnClearTask.classList.toggle("hidden", !(taskInput && taskInput.value));
    }

    renderQuickChips();
    renderActiveTaskPill();
  }

  function renderQuickChips() {
    if (!quickChipsContainer) return;
    quickChipsContainer.innerHTML = "";

    if (!Array.isArray(recentLabels) || recentLabels.length === 0) {
      return;
    }

    recentLabels.slice(0, 5).forEach((lbl) => {
      const chip = document.createElement("button");
      chip.type = "button";
      const isSelected = timerState.label && timerState.label.toLowerCase() === lbl.toLowerCase();
      chip.className = `quick-chip ${isSelected ? "active" : ""}`;
      chip.textContent = lbl;
      chip.title = lbl;
      chip.addEventListener("click", async () => {
        taskInput.value = lbl;
        btnClearTask.classList.remove("hidden");
        timerState.label = lbl;
        await FocusTimerStorage.setStorage({ timerState });
        renderActiveTaskPill();
        highlightActiveChip();
      });
      quickChipsContainer.appendChild(chip);
    });
  }

  function highlightActiveChip() {
    if (!quickChipsContainer) return;
    const chips = quickChipsContainer.querySelectorAll(".quick-chip");
    const current = (timerState.label || "").toLowerCase();
    chips.forEach((c) => {
      c.classList.toggle("active", c.textContent.toLowerCase() === current);
    });
  }

  function renderActiveTaskPill() {
    if (!activeTaskDisplay) return;
    const label = (timerState.label || "").trim();
    if (label && (timerState.phase || "focus") === "focus") {
      const maxLen = 22;
      const truncated = label.length > maxLen ? label.slice(0, maxLen - 1) + "…" : label;
      activeTaskDisplay.textContent = `🎯 ${truncated}`;
      activeTaskDisplay.title = label;
      activeTaskDisplay.classList.remove("hidden");
    } else {
      activeTaskDisplay.classList.add("hidden");
      activeTaskDisplay.textContent = "";
      activeTaskDisplay.title = "";
    }
  }

  /**
   * Calculates remaining time & updates SVG ring offset
   */
  function updateTimeAndRing() {
    const remainingMs = FocusTimerStorage.computeRemaining(timerState);
    const totalMs = timerState.totalDuration || (25 * 60 * 1000);

    timerDisplay.textContent = FocusTimerStorage.formatTime(remainingMs);

    const progressRatio = Math.max(0, Math.min(1, remainingMs / totalMs));
    const offset = CIRCUMFERENCE * (1 - progressRatio);
    ringFill.style.strokeDashoffset = offset;
  }

  /**
   * Render round indicator dots
   */
  function renderRounds() {
    const target = settings.roundsBeforeLongBreak || 4;
    const current = timerState.cycleCount || 0;

    roundDotsContainer.innerHTML = "";
    for (let i = 0; i < target; i++) {
      const dot = document.createElement("span");
      dot.className = `dot ${i < current ? "completed" : ""}`;
      roundDotsContainer.appendChild(dot);
    }
  }

  /**
   * Ticker that calculates remaining time precisely
   */
  function startTicker() {
    if (tickerTimer) clearInterval(tickerTimer);
    tickerTimer = setInterval(() => {
      updateTimeAndRing();
      drawPipCanvas();
    }, 500);
  }

  /**
   * Renders the timer frame to the hidden canvas for Picture-in-Picture
   */
  function drawPipCanvas() {
    if (!pipCtx) return;
    const width = pipCanvas.width;
    const height = pipCanvas.height;
    const remainingMs = FocusTimerStorage.computeRemaining(timerState);
    const totalMs = timerState.totalDuration || (25 * 60 * 1000);
    const currentPhase = timerState.phase || "focus";
    const phaseInfo = FocusTimerStorage.PHASES[currentPhase] || FocusTimerStorage.PHASES.focus;

    // Background
    pipCtx.fillStyle = "#0f172a";
    pipCtx.fillRect(0, 0, width, height);

    // Center coordinates
    const cx = width / 2;
    const cy = height / 2;
    const radius = 105;

    // Outer track
    pipCtx.beginPath();
    pipCtx.arc(cx, cy, radius, 0, 2 * Math.PI);
    pipCtx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    pipCtx.lineWidth = 14;
    pipCtx.stroke();

    // Progress arc
    const progressRatio = Math.max(0, Math.min(1, remainingMs / totalMs));
    const startAngle = -0.5 * Math.PI;
    const endAngle = startAngle + progressRatio * 2 * Math.PI;

    pipCtx.beginPath();
    pipCtx.arc(cx, cy, radius, startAngle, endAngle);
    pipCtx.strokeStyle = phaseInfo.badgeColor;
    pipCtx.lineWidth = 14;
    pipCtx.lineCap = "round";
    pipCtx.stroke();

    // Text: Phase
    pipCtx.fillStyle = phaseInfo.badgeColor;
    pipCtx.font = "bold 16px -apple-system, sans-serif";
    pipCtx.textAlign = "center";
    pipCtx.textBaseline = "middle";
    pipCtx.fillText(`${phaseInfo.emoji} ${phaseInfo.name.toUpperCase()}`, cx, cy - 36);

    // Text: Time
    pipCtx.fillStyle = "#ffffff";
    pipCtx.font = "bold 44px -apple-system, sans-serif";
    pipCtx.fillText(FocusTimerStorage.formatTime(remainingMs), cx, cy + 6);

    // Text: Status
    pipCtx.fillStyle = "rgba(255, 255, 255, 0.6)";
    pipCtx.font = "14px -apple-system, sans-serif";
    const status = timerState.isRunning ? "RUNNING" : "PAUSED";
    pipCtx.fillText(status, cx, cy + 42);

    // Text: Truncated Task Label (if focus phase and set)
    if (timerState.label && (timerState.phase || "focus") === "focus") {
      pipCtx.fillStyle = "rgba(255, 255, 255, 0.9)";
      pipCtx.font = "600 13px -apple-system, sans-serif";
      const maxChars = 20;
      const labelText = timerState.label.length > maxChars
        ? timerState.label.slice(0, maxChars - 1) + "…"
        : timerState.label;
      pipCtx.fillText(`🏷️ ${labelText}`, cx, cy + 66);
    }
  }

  /**
   * Picture-in-Picture Pop-out
   */
  async function triggerPictureInPicture() {
    try {
      drawPipCanvas();
      if (!pipVideo.srcObject) {
        pipVideo.srcObject = pipCanvas.captureStream(30);
        await pipVideo.play();
      }

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await pipVideo.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("PiP Error:", err);
      // Fallback: open small floating popup window
      chrome.windows.create({
        url: chrome.runtime.getURL("popup/popup.html"),
        type: "popup",
        width: 360,
        height: 480,
        focused: true
      });
    }
  }

  // Event Listeners: Timer Actions
  btnToggle.addEventListener("click", async () => {
    const action = timerState.isRunning ? "PAUSE" : "START";
    if (action === "START" && (timerState.phase || "focus") === "focus") {
      await saveCurrentLabelToRecents();
    }
    chrome.runtime.sendMessage({ action, label: timerState.label || "" }, (res) => {
      if (res && res.timerState) {
        timerState = res.timerState;
        renderAll();
      }
    });
  });

  btnReset.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "RESET" }, (res) => {
      if (res && res.timerState) {
        timerState = res.timerState;
        renderAll();
      }
    });
  });

  btnSkip.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "SKIP" }, (res) => {
      if (res && res.timerState) {
        timerState = res.timerState;
        renderAll();
      }
    });
  });

  // Event Listeners: Phase Tabs
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetPhase = btn.dataset.phase;
      if (targetPhase === timerState.phase) return;

      chrome.runtime.sendMessage({ action: "SWITCH_PHASE", phase: targetPhase }, (res) => {
        if (res && res.timerState) {
          timerState = res.timerState;
          renderAll();
        }
      });
    });
  });

  // Event Listeners: Navigation, Stats & Options
  btnStats.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("stats/stats.html") });
  });

  btnSettings.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options/options.html"));
    }
  });

  btnTheme.addEventListener("click", async () => {
    const nextTheme = settings.theme === "light" ? "dark" : "light";
    settings.theme = nextTheme;
    await FocusTimerStorage.setStorage({ settings });
    applyTheme(nextTheme);
  });

  btnPip.addEventListener("click", triggerPictureInPicture);

  // Listen for storage changes from background or other tabs
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.timerState) {
        timerState = changes.timerState.newValue;
        renderAll();
      }
      if (changes.settings) {
        settings = changes.settings.newValue;
        applyTheme(settings.theme);
        renderAll();
      }
      if (changes.recentLabels) {
        recentLabels = changes.recentLabels.newValue || [];
        renderQuickChips();
      }
    }
  });

  // Listen for audio chime triggers from service worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "PHASE_COMPLETED" && settings.soundEnabled) {
      FocusSound.playPhaseChime(message.soundType);
    }
  });

  init();
})();
