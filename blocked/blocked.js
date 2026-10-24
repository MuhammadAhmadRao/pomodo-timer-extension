/**
 * Focus Timer - Blocked Site Redirect Logic
 */
(async function () {
  const timeDisplay = document.getElementById("time-display");
  const cycleText = document.getElementById("cycle-text");
  const quoteText = document.getElementById("quote-text");
  const btnCloseTab = document.getElementById("btn-close-tab");
  const btnOpenOptions = document.getElementById("btn-open-options");

  let timerState = null;
  let settings = null;
  let intervalId = null;

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

    // If session ended or phase switched to break, redirect back or unblock
    if (timerState.phase !== "focus" || !timerState.isRunning) {
      timeDisplay.textContent = "Break Time!";
      if (document.referrer && !document.referrer.includes(chrome.runtime.id)) {
        setTimeout(() => {
          window.location.href = document.referrer;
        }, 1200);
      }
    }
  }

  function startLiveTicker() {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(updateDisplay, 1000);
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
