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

  // Allowlist elements
  const modeTabBlocklist = document.getElementById("mode-tab-blocklist");
  const modeTabAllowlist = document.getElementById("mode-tab-allowlist");
  const modeHelpText = document.getElementById("mode-help-text");
  const sectionBlocklist = document.getElementById("section-blocklist");
  const sectionAllowlist = document.getElementById("section-allowlist");
  const emptyAllowlistWarning = document.getElementById("empty-allowlist-warning");
  const addAllowedSiteForm = document.getElementById("add-allowed-site-form");
  const allowedSiteInput = document.getElementById("allowed-site-input");
  const btnAddAllowedSite = document.getElementById("btn-add-allowed-site");
  const allowedSitesContainer = document.getElementById("allowed-sites-container");

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
  let currentAllowedSites = [...(currentSettings.allowedSites || [])];
  let currentBlockingMode = currentSettings.blockingMode || "blocklist";
  let currentTimerState = { ...FocusTimerStorage.DEFAULT_TIMER_STATE };
  let isStrictLocked = false;

  const PRESETS = {
    social: ["twitter.com", "x.com", "facebook.com", "instagram.com", "tiktok.com"],
    video: ["youtube.com", "netflix.com", "twitch.tv", "disneyplus.com"],
    news: ["reddit.com", "news.ycombinator.com", "cnn.com", "bbc.com"],
    learning: ["github.com", "stackoverflow.com", "developer.mozilla.org", "docs.google.com"],
    work: ["notion.so", "figma.com", "slack.com", "linear.app"],
    search: ["google.com", "wikipedia.org"]
  };

  async function init() {
    const data = await FocusTimerStorage.getStorage(["settings", "timerState"]);
    if (data.settings) {
      currentSettings = { ...currentSettings, ...data.settings };
      currentBlockedSites = [...(currentSettings.blockedSites || [])];
      currentAllowedSites = [...(currentSettings.allowedSites || [])];
      currentBlockingMode = currentSettings.blockingMode || "blocklist";
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

    // Lock/unlock mode switch
    if (modeTabBlocklist) {
      modeTabBlocklist.disabled = isStrictLocked;
      modeTabBlocklist.style.opacity = isStrictLocked ? "0.6" : "1";
      modeTabBlocklist.style.cursor = isStrictLocked ? "not-allowed" : "pointer";
    }
    if (modeTabAllowlist) {
      modeTabAllowlist.disabled = isStrictLocked;
      modeTabAllowlist.style.opacity = isStrictLocked ? "0.6" : "1";
      modeTabAllowlist.style.cursor = isStrictLocked ? "not-allowed" : "pointer";
    }

    // Lock/unlock blocklist inputs
    siteInput.disabled = isStrictLocked;
    if (btnAddSite) btnAddSite.disabled = isStrictLocked;

    // Lock/unlock allowlist inputs
    if (allowedSiteInput) allowedSiteInput.disabled = isStrictLocked;
    if (btnAddAllowedSite) btnAddAllowedSite.disabled = isStrictLocked;

    presetChips.forEach((chip) => {
      chip.disabled = isStrictLocked;
      chip.style.opacity = isStrictLocked ? "0.5" : "1";
      chip.style.cursor = isStrictLocked ? "not-allowed" : "pointer";
    });

    // Lock/unlock strict mode toggle itself and reset button
    if (toggleStrictMode) toggleStrictMode.disabled = isStrictLocked;
    btnResetDefaults.disabled = isStrictLocked;

    // Refresh site tags to enable/disable remove buttons
    renderBlockedSites();
    renderAllowedSites();
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

  function applyModeUI(mode) {
    currentBlockingMode = mode;
    if (mode === "allowlist") {
      if (modeTabBlocklist) {
        modeTabBlocklist.classList.remove("active");
        modeTabBlocklist.setAttribute("aria-checked", "false");
      }
      if (modeTabAllowlist) {
        modeTabAllowlist.classList.add("active");
        modeTabAllowlist.setAttribute("aria-checked", "true");
      }
      if (modeHelpText) {
        modeHelpText.textContent = "Allow only approved sites during focus sessions. All other websites will be blocked.";
      }
      if (sectionBlocklist) sectionBlocklist.style.display = "none";
      if (sectionAllowlist) sectionAllowlist.style.display = "block";
    } else {
      if (modeTabBlocklist) {
        modeTabBlocklist.classList.add("active");
        modeTabBlocklist.setAttribute("aria-checked", "true");
      }
      if (modeTabAllowlist) {
        modeTabAllowlist.classList.remove("active");
        modeTabAllowlist.setAttribute("aria-checked", "false");
      }
      if (modeHelpText) {
        modeHelpText.textContent = "Block specific distracting sites while keeping the rest of the web accessible.";
      }
      if (sectionBlocklist) sectionBlocklist.style.display = "block";
      if (sectionAllowlist) sectionAllowlist.style.display = "none";
    }
    updateEmptyAllowlistWarning();
  }

  async function setBlockingMode(mode) {
    if (isStrictLocked) return;

    if (mode === "allowlist") {
      // Request optional host permission if not already granted
      if (chrome.permissions && chrome.permissions.request) {
        const hasPerm = await new Promise((resolve) => {
          chrome.permissions.contains({ origins: ["http://*/*", "https://*/*"] }, resolve);
        });

        if (!hasPerm) {
          const granted = await new Promise((resolve) => {
            chrome.permissions.request(
              {
                origins: ["http://*/*", "https://*/*"]
              },
              (result) => resolve(Boolean(result))
            );
          });

          if (!granted) {
            showToast("Allowlist mode requires website access to block unapproved sites.");
            return;
          }
        }
      }
    }

    applyModeUI(mode);
  }

  function updateEmptyAllowlistWarning() {
    if (!emptyAllowlistWarning) return;
    if (currentBlockingMode === "allowlist" && currentAllowedSites.length === 0) {
      emptyAllowlistWarning.style.display = "flex";
    } else {
      emptyAllowlistWarning.style.display = "none";
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

    currentBlockingMode = currentSettings.blockingMode || "blocklist";
    currentAllowedSites = [...(currentSettings.allowedSites || [])];
    currentBlockedSites = [...(currentSettings.blockedSites || [])];

    applyModeUI(currentBlockingMode);
    renderBlockedSites();
    renderAllowedSites();
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

  function renderAllowedSites() {
    if (!allowedSitesContainer) return;
    allowedSitesContainer.innerHTML = "";

    if (currentAllowedSites.length === 0) {
      const emptyNote = document.createElement("span");
      emptyNote.style.color = "var(--text-muted)";
      emptyNote.style.fontSize = "13px";
      emptyNote.textContent = "No allowed sites added. All websites will be blocked during focus!";
      allowedSitesContainer.appendChild(emptyNote);
      updateEmptyAllowlistWarning();
      return;
    }

    currentAllowedSites.forEach((domain) => {
      const tag = document.createElement("div");
      tag.className = "site-tag allowed";
      tag.innerHTML = `
        <span>${domain}</span>
        <button type="button" class="remove-btn" title="Remove ${domain}" ${isStrictLocked ? "disabled style='opacity:0.4;cursor:not-allowed;'" : ""}>&times;</button>
      `;

      tag.querySelector(".remove-btn").addEventListener("click", () => {
        if (!isStrictLocked) {
          removeAllowedSite(domain);
        }
      });

      allowedSitesContainer.appendChild(tag);
    });

    updateEmptyAllowlistWarning();
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

  function addAllowedSite(domain) {
    if (isStrictLocked) return;
    const cleaned = cleanDomain(domain);
    if (!cleaned) return;
    if (cleaned === "localhost" || cleaned === "127.0.0.1") {
      showToast("localhost is always accessible and never blocked.");
      return;
    }

    if (!currentAllowedSites.includes(cleaned)) {
      currentAllowedSites.push(cleaned);
      renderAllowedSites();
    }
  }

  function removeAllowedSite(domain) {
    if (isStrictLocked) return;
    currentAllowedSites = currentAllowedSites.filter((s) => s !== domain);
    renderAllowedSites();
  }

  // Mode switcher listeners
  if (modeTabBlocklist) {
    modeTabBlocklist.addEventListener("click", () => {
      setBlockingMode("blocklist");
    });
  }

  if (modeTabAllowlist) {
    modeTabAllowlist.addEventListener("click", () => {
      setBlockingMode("allowlist");
    });
  }

  // Form submit for adding blocked site
  addSiteForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (isStrictLocked) return;
    if (siteInput.value) {
      addSite(siteInput.value);
      siteInput.value = "";
    }
  });

  // Form submit for adding allowed site
  if (addAllowedSiteForm) {
    addAllowedSiteForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (isStrictLocked) return;
      if (allowedSiteInput && allowedSiteInput.value) {
        addAllowedSite(allowedSiteInput.value);
        allowedSiteInput.value = "";
      }
    });
  }

  // Preset chips (blocklist and allowlist)
  presetChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      if (isStrictLocked) return;
      const presetKey = chip.dataset.preset;
      const sites = PRESETS[presetKey] || [];
      if (["learning", "work", "search"].includes(presetKey)) {
        sites.forEach(addAllowedSite);
      } else {
        sites.forEach(addSite);
      }
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
      blockingMode: isStrictLocked ? (currentSettings.blockingMode || "blocklist") : currentBlockingMode,
      blockedSites: isStrictLocked ? [...currentSettings.blockedSites] : [...currentBlockedSites],
      allowedSites: isStrictLocked ? [...(currentSettings.allowedSites || [])] : [...currentAllowedSites],
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
      currentAllowedSites = [...(currentSettings.allowedSites || [])];
      currentBlockingMode = currentSettings.blockingMode || "blocklist";
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

  // Open Chrome shortcuts settings page
  const btnConfigureShortcuts = document.getElementById("btn-configure-shortcuts");
  if (btnConfigureShortcuts) {
    btnConfigureShortcuts.addEventListener("click", () => {
      chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
    });
  }

  // Load registered shortcuts from Chrome commands API
  function loadRegisteredShortcuts() {
    if (chrome.commands && chrome.commands.getAll) {
      chrome.commands.getAll((commands) => {
        if (!Array.isArray(commands)) return;
        commands.forEach((cmd) => {
          if (cmd.name === "toggle-timer" && cmd.shortcut) {
            const el = document.getElementById("key-toggle");
            if (el) el.textContent = cmd.shortcut;
          } else if (cmd.name === "skip-phase" && cmd.shortcut) {
            const el = document.getElementById("key-skip");
            if (el) el.textContent = cmd.shortcut;
          }
        });
      });
    }
  }

  function showToast(text = "Preferences saved") {
    saveToast.textContent = text;
    saveToast.classList.add("visible");
    setTimeout(() => {
      saveToast.classList.remove("visible");
    }, 2200);
  }

  init();
  loadRegisteredShortcuts();
})();
