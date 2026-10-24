/**
 * Focus Timer - Options & Settings Controller
 */
(async function () {
  const focusInput = document.getElementById("focus-duration");
  const shortBreakInput = document.getElementById("short-break");
  const longBreakInput = document.getElementById("long-break");
  const roundsTargetInput = document.getElementById("rounds-target");
  const dailyGoalInput = document.getElementById("daily-goal");

  const addSiteForm = document.getElementById("add-site-form");
  const siteInput = document.getElementById("site-input");
  const blockedSitesContainer = document.getElementById("blocked-sites-container");
  const presetChips = document.querySelectorAll(".preset-chip");

  const toggleTopPill = document.getElementById("toggle-top-pill");
  const toggleTabTitle = document.getElementById("toggle-tab-title");
  const toggleNotifications = document.getElementById("toggle-notifications");
  const toggleSound = document.getElementById("toggle-sound");
  const toggleStrictMode = document.getElementById("toggle-strict-mode");
  const selectTheme = document.getElementById("select-theme");

  const btnSave = document.getElementById("btn-save");
  const btnResetDefaults = document.getElementById("btn-reset-defaults");
  const btnAddSite = document.getElementById("btn-add-site");
  const saveToast = document.getElementById("save-toast");
  const strictModeBanner = document.getElementById("strict-mode-banner");

  let currentSettings = { ...FocusTimerStorage.DEFAULT_SETTINGS };
  let currentBlockedSites = [...currentSettings.blockedSites];
  let currentTimerState = { ...FocusTimerStorage.DEFAULT_TIMER_STATE };
  let isStrictLocked = false;

  const PRESETS = {
    social: ["twitter.com", "x.com", "facebook.com", "instagram.com", "tiktok.com"],
    video: ["youtube.com", "netflix.com", "twitch.tv", "disneyplus.com"],
    news: ["reddit.com", "news.ycombinator.com", "cnn.com", "bbc.com"]
  };

  async function init() {
    const data = await FocusTimerStorage.getStorage(["settings", "timerState"]);
    if (data.settings) {
      currentSettings = { ...currentSettings, ...data.settings };
      currentBlockedSites = [...(currentSettings.blockedSites || [])];
    }
    if (data.timerState) {
      currentTimerState = { ...currentTimerState, ...data.timerState };
    }

    populateUI();
    applyTheme(currentSettings.theme);
    evaluateStrictLock();
  }

  function evaluateStrictLock() {
    isStrictLocked = Boolean(
      currentSettings.strictModeEnabled &&
      currentTimerState &&
      currentTimerState.isRunning &&
      currentTimerState.phase === "focus"
    );

    if (strictModeBanner) {
      strictModeBanner.style.display = isStrictLocked ? "flex" : "none";
    }

    // Lock/unlock timer durations
    focusInput.disabled = isStrictLocked;
    shortBreakInput.disabled = isStrictLocked;
    longBreakInput.disabled = isStrictLocked;
    roundsTargetInput.disabled = isStrictLocked;

    // Lock/unlock blocker
    siteInput.disabled = isStrictLocked;
    if (btnAddSite) btnAddSite.disabled = isStrictLocked;
    presetChips.forEach((chip) => {
      chip.disabled = isStrictLocked;
      chip.style.opacity = isStrictLocked ? "0.5" : "1";
      chip.style.cursor = isStrictLocked ? "not-allowed" : "pointer";
    });

    // Lock/unlock strict mode toggle itself and reset button
    if (toggleStrictMode) toggleStrictMode.disabled = isStrictLocked;
    btnResetDefaults.disabled = isStrictLocked;

    // Refresh blocked site tags to enable/disable remove buttons
    renderBlockedSites();
  }

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

  function populateUI() {
    focusInput.value = currentSettings.focusDuration;
    shortBreakInput.value = currentSettings.shortBreakDuration;
    longBreakInput.value = currentSettings.longBreakDuration;
    roundsTargetInput.value = currentSettings.roundsBeforeLongBreak;
    if (dailyGoalInput) {
      dailyGoalInput.value = currentSettings.dailyGoalMinutes || 120;
    }

    toggleTopPill.checked = currentSettings.topPillEnabled !== false && currentSettings.floatingWidgetEnabled !== false;
    toggleTabTitle.checked = currentSettings.tabTitleTimerEnabled !== false;
    toggleNotifications.checked = Boolean(currentSettings.notificationEnabled);
    toggleSound.checked = Boolean(currentSettings.soundEnabled);
    if (toggleStrictMode) {
      toggleStrictMode.checked = Boolean(currentSettings.strictModeEnabled);
    }
    selectTheme.value = currentSettings.theme || "dark";

    renderBlockedSites();
  }

  function cleanDomain(input) {
    return input
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");
  }

  function renderBlockedSites() {
    blockedSitesContainer.innerHTML = "";

    if (currentBlockedSites.length === 0) {
      const emptyNote = document.createElement("span");
      emptyNote.style.color = "var(--text-muted)";
      emptyNote.style.fontSize = "13px";
      emptyNote.textContent = "No sites currently blocked. Add one above!";
      blockedSitesContainer.appendChild(emptyNote);
      return;
    }

    currentBlockedSites.forEach((domain) => {
      const tag = document.createElement("div");
      tag.className = "site-tag";
      tag.innerHTML = `
        <span>${domain}</span>
        <button type="button" class="remove-btn" title="Remove ${domain}" ${isStrictLocked ? "disabled style='opacity:0.4;cursor:not-allowed;'" : ""}>&times;</button>
      `;

      tag.querySelector(".remove-btn").addEventListener("click", () => {
        if (!isStrictLocked) {
          removeSite(domain);
        }
      });

      blockedSitesContainer.appendChild(tag);
    });
  }

  function addSite(domain) {
    if (isStrictLocked) return;
    const cleaned = cleanDomain(domain);
    if (!cleaned) return;

    if (!currentBlockedSites.includes(cleaned)) {
      currentBlockedSites.push(cleaned);
      renderBlockedSites();
    }
  }

  function removeSite(domain) {
    if (isStrictLocked) return;
    currentBlockedSites = currentBlockedSites.filter((s) => s !== domain);
    renderBlockedSites();
  }

  // Form submit for adding site
  addSiteForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (isStrictLocked) return;
    if (siteInput.value) {
      addSite(siteInput.value);
      siteInput.value = "";
    }
  });

  // Preset chips
  presetChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      if (isStrictLocked) return;
      const presetKey = chip.dataset.preset;
      const sites = PRESETS[presetKey] || [];
      sites.forEach(addSite);
    });
  });

  // Real-time theme change preview
  selectTheme.addEventListener("change", () => {
    applyTheme(selectTheme.value);
  });

  // Save Settings
  btnSave.addEventListener("click", async () => {
    // If strict locked, keep existing locked attributes intact
    const updatedSettings = {
      focusDuration: isStrictLocked ? currentSettings.focusDuration : Math.max(1, parseInt(focusInput.value, 10) || 25),
      shortBreakDuration: isStrictLocked ? currentSettings.shortBreakDuration : Math.max(1, parseInt(shortBreakInput.value, 10) || 5),
      longBreakDuration: isStrictLocked ? currentSettings.longBreakDuration : Math.max(1, parseInt(longBreakInput.value, 10) || 15),
      roundsBeforeLongBreak: isStrictLocked ? currentSettings.roundsBeforeLongBreak : Math.max(1, parseInt(roundsTargetInput.value, 10) || 4),
      dailyGoalMinutes: Math.max(1, parseInt(dailyGoalInput ? dailyGoalInput.value : 120, 10) || 120),
      blockedSites: isStrictLocked ? [...currentSettings.blockedSites] : [...currentBlockedSites],
      strictModeEnabled: isStrictLocked ? currentSettings.strictModeEnabled : (toggleStrictMode ? toggleStrictMode.checked : false),
      topPillEnabled: toggleTopPill.checked,
      floatingWidgetEnabled: toggleTopPill.checked,
      tabTitleTimerEnabled: toggleTabTitle.checked,
      notificationEnabled: toggleNotifications.checked,
      soundEnabled: toggleSound.checked,
      theme: selectTheme.value
    };

    // If timer is not running, adjust remaining duration if focus time changed
    const { timerState } = await FocusTimerStorage.getStorage(["timerState"]);
    if (timerState && !timerState.isRunning && timerState.phase === "focus") {
      const newDurationMs = updatedSettings.focusDuration * 60 * 1000;
      timerState.totalDuration = newDurationMs;
      timerState.remainingWhenPaused = newDurationMs;
      await FocusTimerStorage.setStorage({ timerState });
    }

    await FocusTimerStorage.setStorage({ settings: updatedSettings });
    currentSettings = updatedSettings;

    // Trigger toast
    showToast();
  });

  // Reset Defaults
  btnResetDefaults.addEventListener("click", async () => {
    if (isStrictLocked) return;
    if (confirm("Reset all settings and timer durations back to default values?")) {
      currentSettings = { ...FocusTimerStorage.DEFAULT_SETTINGS };
      currentBlockedSites = [...currentSettings.blockedSites];
      await FocusTimerStorage.setStorage({ settings: currentSettings });
      populateUI();
      applyTheme(currentSettings.theme);
      showToast("Reset to defaults");
    }
  });

  // Listen for storage changes in real time
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.timerState) {
        currentTimerState = changes.timerState.newValue || { ...FocusTimerStorage.DEFAULT_TIMER_STATE };
        evaluateStrictLock();
      }
      if (changes.settings) {
        currentSettings = { ...currentSettings, ...(changes.settings.newValue || {}) };
        evaluateStrictLock();
      }
    }
  });

  function showToast(text = "Preferences saved") {
    saveToast.textContent = text;
    saveToast.classList.add("visible");
    setTimeout(() => {
      saveToast.classList.remove("visible");
    }, 2200);
  }

  init();
})();
