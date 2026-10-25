/**
 * Focus Timer - Blocked Site Redirect Logic
 */
(async function () {
  const timeDisplay = document.getElementById("time-display");
  const cycleText = document.getElementById("cycle-text");
  const quoteText = document.getElementById("quote-text");
  const btnCloseTab = document.getElementById("btn-close-tab");
  const btnOpenOptions = document.getElementById("btn-open-options");

  // Allow 5 Minutes Elements
  const unblockActionWrapper = document.getElementById("unblock-action-wrapper");
  const btnAllow5min = document.getElementById("btn-allow-5min");
  const allowModal = document.getElementById("allow-modal");
  const allowCountdown = document.getElementById("allow-countdown");
  const btnAllowCancel = document.getElementById("btn-allow-cancel");
  const btnAllowConfirm = document.getElementById("btn-allow-confirm");

  let timerState = null;
  let settings = null;
  let intervalId = null;
  let allowCooldownInterval = null;
  let allowCooldownRemaining = 20;

  // Curated motivational quotes
  const QUOTES = [
    "Deep work produces world-class results. Stay locked in.",
    "Small disciplines repeated with consistency lead to great achievements.",
    "Focus is a muscle. The more you resist distraction, the stronger you get.",
    "Your future self will thank you for the focus you put in right now.",
    "Action cures anxiety. Dive back into what truly matters."
  ];

  // Set random quote
  quoteText.textContent = `"${QUOTES[Math.floor(Math.random() * QUOTES.length)]}"`;

  async function loadData() {
    const data = await FocusTimerStorage.getStorage(["settings", "timerState"]);
    settings = data.settings || FocusTimerStorage.DEFAULT_SETTINGS;
    timerState = data.timerState || FocusTimerStorage.DEFAULT_TIMER_STATE;

    applyTheme(settings.theme);
    updateDisplay();
  }

  function applyTheme(theme) {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else if (theme === "dark") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      // System
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", "light");
      }
    }
  }

  function updateDisplay() {
    if (!timerState) return;

    // Cycle text
    const targetRounds = settings ? settings.roundsBeforeLongBreak : 4;
    const currentRound = Math.min(targetRounds, (timerState.cycleCount || 0) + 1);
    cycleText.textContent = `Round ${currentRound} of ${targetRounds}`;

    // Time display
    const remainingMs = FocusTimerStorage.computeRemaining(timerState);
    timeDisplay.textContent = FocusTimerStorage.formatTime(remainingMs);

    // Adapt text for Allowlist mode vs Blocklist mode
    if (settings && settings.blockingMode === "allowlist") {
      quoteText.textContent = "Only your allowed sites are available during focus.";
      quoteText.style.fontStyle = "normal";
      quoteText.style.fontWeight = "600";
    }

    // In Strict Mode: Hide Allow 5 Minutes button completely
    const isStrict = Boolean(settings && settings.strictModeEnabled);
    if (unblockActionWrapper) {
      unblockActionWrapper.style.display = isStrict ? "none" : "block";
    }
    if (isStrict && allowModal) {
      closeAllowModal();
    }

    // If session ended or phase switched to break, redirect back or unblock
    if (timerState.phase !== "focus" || !timerState.isRunning) {
      timeDisplay.textContent = "Break Time!";
      const urlParams = new URLSearchParams(window.location.search);
      const targetUrl = urlParams.get("url") || document.referrer;
      if (targetUrl && !targetUrl.includes(chrome.runtime.id)) {
        setTimeout(() => {
          window.location.href = targetUrl;
        }, 1200);
      }
    }
  }

  function startLiveTicker() {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(updateDisplay, 1000);
  }

  function openAllowModal() {
    if (!allowModal) return;
    allowModal.classList.remove("hidden");
    allowCooldownRemaining = 20;
    if (allowCountdown) allowCountdown.textContent = "20s";
    if (btnAllowConfirm) btnAllowConfirm.disabled = true;

    if (allowCooldownInterval) clearInterval(allowCooldownInterval);
    allowCooldownInterval = setInterval(() => {
      allowCooldownRemaining = Math.max(0, allowCooldownRemaining - 1);
      if (allowCooldownRemaining > 0) {
        if (allowCountdown) allowCountdown.textContent = `${allowCooldownRemaining}s`;
      } else {
        if (allowCountdown) allowCountdown.textContent = "Ready";
        if (btnAllowConfirm) btnAllowConfirm.disabled = false;
        clearInterval(allowCooldownInterval);
        allowCooldownInterval = null;
      }
    }, 1000);
  }

  function closeAllowModal() {
    if (!allowModal) return;
    allowModal.classList.add("hidden");
    if (allowCooldownInterval) {
      clearInterval(allowCooldownInterval);
      allowCooldownInterval = null;
    }
  }

  if (btnAllow5min) {
    btnAllow5min.addEventListener("click", openAllowModal);
  }
  if (btnAllowCancel) {
    btnAllowCancel.addEventListener("click", closeAllowModal);
  }
  if (btnAllowConfirm) {
    btnAllowConfirm.addEventListener("click", () => {
      if (allowCooldownRemaining > 0) return;
      closeAllowModal();

      chrome.runtime.sendMessage({ action: "ALLOW_5_MINUTES" }, (res) => {
        if (res && res.success) {
          const urlParams = new URLSearchParams(window.location.search);
          const targetUrl = urlParams.get("url") || document.referrer;
          if (targetUrl && !targetUrl.includes(chrome.runtime.id)) {
            window.location.href = targetUrl;
          } else {
            window.history.back();
          }
        }
      });
    });
  }

  // Handle storage updates in real-time
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.timerState) {
        timerState = changes.timerState.newValue;
        updateDisplay();
      }
      if (changes.settings) {
        settings = changes.settings.newValue;
        applyTheme(settings.theme);
        updateDisplay();
      }
    }
  });

  // Action listeners
  btnCloseTab.addEventListener("click", () => {
    window.close();
  });

  btnOpenOptions.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options/options.html"));
    }
  });

  await loadData();
  startLiveTicker();
})();
