/**
 * Focus Timer - Content Script
 * 1. Docked Top-Center Notch Pill (Shadow DOM with inline styles)
 * 2. Real-Time Tab Title Countdown (with MutationObserver)
 */
(function () {
  // Only run in the top frame, never in sub-iframes or extension pages
  if (window.self !== window.top) return;
  if (window.location.href.includes("blocked.html")) return;

  const HOST_TAG = "focus-timer-notch";
  if (document.querySelector(HOST_TAG)) return;

  let settings = FocusTimerStorage.DEFAULT_SETTINGS;
  let timerState = FocusTimerStorage.DEFAULT_TIMER_STATE;
  let tickerInterval = null;

  let hostEl = null;
  let shadowRoot = null;
  let pillEl = null;
  let dotEl = null;
  let timeEl = null;
  let btnToggleEl = null;
  let iconPlayEl = null;
  let iconPauseEl = null;
  let btnSkipEl = null;

  // Title management
  const TITLE_PREFIX_REGEX = /^⏱\s+\d+:\d+\s+\|\s+/;
  let originalBaseTitle = document.title.replace(TITLE_PREFIX_REGEX, "") || "New Tab";
  let isUpdatingTitleInternally = false;
  let titleObserver = null;

  // Inlined styles to guarantee zero delay and immunity to CSP or web accessible resources issues
  const NOTCH_STYLES = `
    :host {
      all: initial !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 0 !important;
      overflow: visible !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      user-select: none !important;
      -webkit-user-select: none !important;
    }

    .top-pill-container {
      position: fixed !important;
      top: 0 !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      display: flex !important;
      justify-content: center !important;
      align-items: flex-start !important;
      pointer-events: none !important;
      z-index: 2147483647 !important;
    }

    .top-pill {
      pointer-events: auto !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 8px !important;
      background: #0f172a !important;
      background: rgba(15, 23, 42, 0.96) !important;
      backdrop-filter: blur(14px) !important;
      -webkit-backdrop-filter: blur(14px) !important;
      border: 1px solid rgba(255, 255, 255, 0.22) !important;
      border-top: none !important;
      border-top-left-radius: 0 !important;
      border-top-right-radius: 0 !important;
      border-bottom-left-radius: 12px !important;
      border-bottom-right-radius: 12px !important;
      height: 28px !important;
      width: 98px !important;
      padding: 0 10px !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6) !important;
      color: #ffffff !important;
      cursor: default !important;
      transition: width 0.22s cubic-bezier(0.4, 0, 0.2, 1),
                  box-shadow 0.2s ease,
                  background 0.2s ease !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
    }

    .top-pill:hover {
      width: 154px !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.75) !important;
      background: #090d16 !important;
    }

    .pill-dot {
      width: 7px !important;
      height: 7px !important;
      border-radius: 50% !important;
      background: #ef4444 !important;
      box-shadow: 0 0 6px rgba(239, 68, 68, 0.8) !important;
      flex-shrink: 0 !important;
      transition: background-color 0.25s ease, box-shadow 0.25s ease !important;
    }

    .pill-dot.break {
      background: #10b981 !important;
      box-shadow: 0 0 6px rgba(16, 185, 129, 0.8) !important;
    }

    .pill-time {
      font-size: 13px !important;
      font-weight: 700 !important;
      letter-spacing: -0.3px !important;
      font-variant-numeric: tabular-nums !important;
      color: #ffffff !important;
      line-height: 1 !important;
      white-space: nowrap !important;
    }

    .pill-actions {
      display: flex !important;
      align-items: center !important;
      gap: 5px !important;
      opacity: 0 !important;
      max-width: 0 !important;
      overflow: hidden !important;
      pointer-events: none !important;
      transition: opacity 0.18s ease, max-width 0.22s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }

    .top-pill:hover .pill-actions {
      opacity: 1 !important;
      max-width: 60px !important;
      pointer-events: auto !important;
    }

    .pill-btn {
      background: rgba(255, 255, 255, 0.16) !important;
      border: none !important;
      color: #e2e8f0 !important;
      width: 20px !important;
      height: 20px !important;
      border-radius: 50% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      padding: 0 !important;
      transition: background 0.15s ease, transform 0.15s ease, color 0.15s ease !important;
    }

    .pill-btn:hover {
      background: rgba(255, 255, 255, 0.35) !important;
      color: #ffffff !important;
      transform: scale(1.15) !important;
    }

    .pill-btn svg {
      width: 10px !important;
      height: 10px !important;
      display: block !important;
    }
  `;

  async function init() {
    const data = await FocusTimerStorage.getStorage(["settings", "timerState"]);
    if (data.settings) settings = data.settings;
    if (data.timerState) timerState = data.timerState;

    createNotchElement();
    setupTitleObserver();
    updateAll();
    startTicker();
  }

  /**
   * Builds the docked top-center pill inside an isolated Shadow DOM
   */
  function createNotchElement() {
    if (hostEl) return;

    hostEl = document.createElement(HOST_TAG);
    hostEl.style.cssText = "position:fixed!important;top:0!important;left:0!important;width:100%!important;height:0!important;z-index:2147483647!important;pointer-events:none!important;overflow:visible!important;";

    shadowRoot = hostEl.attachShadow({ mode: "open" });

    // Inject styles directly
    const styleEl = document.createElement("style");
    styleEl.textContent = NOTCH_STYLES;
    shadowRoot.appendChild(styleEl);

    // Pill structure
    const container = document.createElement("div");
    container.className = "top-pill-container";
    container.innerHTML = `
      <div class="top-pill" id="pill">
        <div class="pill-dot" id="dot"></div>
        <span class="pill-time" id="time">25:00</span>
        <div class="pill-actions">
          <button class="pill-btn" id="btn-toggle" title="Pause / Resume">
            <svg id="icon-play" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <svg id="icon-pause" style="display:none;" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
          </button>
          <button class="pill-btn" id="btn-skip" title="Skip Phase">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 4 15 12 5 20 5 4"></polygon>
              <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
            </svg>
          </button>
        </div>
      </div>
    `;

    shadowRoot.appendChild(container);

    // Append to DOM
    if (document.body) {
      document.body.appendChild(hostEl);
    } else {
      document.documentElement.appendChild(hostEl);
    }

    // Cache elements
    pillEl = shadowRoot.getElementById("pill");
    dotEl = shadowRoot.getElementById("dot");
    timeEl = shadowRoot.getElementById("time");
    btnToggleEl = shadowRoot.getElementById("btn-toggle");
    iconPlayEl = shadowRoot.getElementById("icon-play");
    iconPauseEl = shadowRoot.getElementById("icon-pause");
    btnSkipEl = shadowRoot.getElementById("btn-skip");

    attachNotchEvents();
  }

  function attachNotchEvents() {
    btnToggleEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isStrictFocus = Boolean(
        settings.strictModeEnabled &&
        timerState.isRunning &&
        (timerState.phase || "focus") === "focus"
      );
      if (isStrictFocus) return;

      const action = timerState.isRunning ? "PAUSE" : "START";
      chrome.runtime.sendMessage({ action }, (res) => {
        if (res && res.timerState) {
          timerState = res.timerState;
          updateAll();
        }
      });
    });

    btnSkipEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isStrictFocus = Boolean(
        settings.strictModeEnabled &&
        timerState.isRunning &&
        (timerState.phase || "focus") === "focus"
      );
      if (isStrictFocus) return;

      chrome.runtime.sendMessage({ action: "SKIP" }, (res) => {
        if (res && res.timerState) {
          timerState = res.timerState;
          updateAll();
        }
      });
    });
  }

  /**
   * Sets up MutationObserver to track external page title changes safely
   */
  function setupTitleObserver() {
    if (titleObserver) return;

    const observerCallback = () => {
      if (isUpdatingTitleInternally) return;
      const current = document.title;
      // Capture base title stripped of our prefix
      originalBaseTitle = current.replace(TITLE_PREFIX_REGEX, "") || originalBaseTitle;
      if (timerState && timerState.isRunning && settings.tabTitleTimerEnabled !== false) {
        updateTabTitle();
      }
    };

    titleObserver = new MutationObserver(observerCallback);

    // Observe title or head
    const titleElement = document.querySelector("title");
    if (titleElement) {
      titleObserver.observe(titleElement, { childList: true, characterData: true, subtree: true });
    } else if (document.head) {
      titleObserver.observe(document.head, { childList: true, subtree: true });
    }
  }

  /**
   * Updates tab title with prefix or restores original
   */
  function updateTabTitle() {
    const isRunning = Boolean(timerState && timerState.isRunning);
    const isEnabled = settings.tabTitleTimerEnabled !== false;

    if (isRunning && isEnabled) {
      const remaining = FocusTimerStorage.computeRemaining(timerState);
      const timeFormatted = FocusTimerStorage.formatTime(remaining);
      const targetTitle = `⏱ ${timeFormatted} | ${originalBaseTitle}`;

      if (document.title !== targetTitle) {
        isUpdatingTitleInternally = true;
        document.title = targetTitle;
        isUpdatingTitleInternally = false;
      }
    } else {
      // Restore clean original title when paused, idle, or disabled
      if (TITLE_PREFIX_REGEX.test(document.title)) {
        isUpdatingTitleInternally = true;
        document.title = document.title.replace(TITLE_PREFIX_REGEX, "");
        isUpdatingTitleInternally = false;
      }
    }
  }

  /**
   * Updates notch pill UI and tab title
   */
  function updateAll() {
    if (!hostEl || !timerState) return;

    // Check if session is running or paused (or has elapsed time)
    const isSessionActive = Boolean(
      timerState.isRunning ||
      timerState.isStarted ||
      (timerState.remainingWhenPaused && timerState.totalDuration && timerState.remainingWhenPaused < timerState.totalDuration)
    );

    const isPillEnabled = settings.topPillEnabled !== false && settings.floatingWidgetEnabled !== false;

    // Visibility: Hide when no session is running or paused (or disabled in options)
    if (!isSessionActive || !isPillEnabled) {
      hostEl.style.display = "none";
    } else {
      hostEl.style.display = "block";
    }

    // Update time
    const remaining = FocusTimerStorage.computeRemaining(timerState);
    timeEl.textContent = FocusTimerStorage.formatTime(remaining);

    // Update phase dot: red = focus, green = break
    const isFocus = (timerState.phase || "focus") === "focus";
    dotEl.className = `pill-dot ${isFocus ? "" : "break"}`;

    // Update play/pause button state
    if (timerState.isRunning) {
      iconPlayEl.style.display = "none";
      iconPauseEl.style.display = "block";
    } else {
      iconPlayEl.style.display = "block";
      iconPauseEl.style.display = "none";
    }

    // Update docked pill state under strict mode
    const isStrictFocus = Boolean(
      settings.strictModeEnabled &&
      timerState.isRunning &&
      isFocus
    );

    if (isStrictFocus) {
      btnToggleEl.disabled = true;
      btnToggleEl.style.opacity = "0.35";
      btnToggleEl.style.cursor = "not-allowed";
      btnToggleEl.title = "Strict mode: pause disabled";

      btnSkipEl.disabled = true;
      btnSkipEl.style.opacity = "0.35";
      btnSkipEl.style.cursor = "not-allowed";
      btnSkipEl.title = "Strict mode: skip disabled";

      const rawLabel = (timerState.label || "").trim();
      const truncatedLabel = rawLabel.length > 25 ? rawLabel.slice(0, 24) + "…" : rawLabel;
      pillEl.title = `🔒 Strict Focus${truncatedLabel ? ": " + truncatedLabel : ""}`;
    } else {
      btnToggleEl.disabled = false;
      btnToggleEl.style.opacity = "1";
      btnToggleEl.style.cursor = "pointer";
      btnToggleEl.title = timerState.isRunning ? "Pause" : "Resume";

      btnSkipEl.disabled = false;
      btnSkipEl.style.opacity = "1";
      btnSkipEl.style.cursor = "pointer";
      btnSkipEl.title = "Skip Phase";

      // Update docked pill tooltip with truncated task label
      const rawLabel = (timerState.label || "").trim();
      if (isFocus && rawLabel) {
        const maxChars = 28;
        const truncatedLabel = rawLabel.length > maxChars ? rawLabel.slice(0, maxChars - 1) + "…" : rawLabel;
        pillEl.title = `Focus: ${truncatedLabel}`;
      } else {
        pillEl.title = isFocus ? "Focus Timer" : "Break Time";
      }
    }

    // Update tab title
    updateTabTitle();
  }

  function startTicker() {
    if (tickerInterval) clearInterval(tickerInterval);
    tickerInterval = setInterval(updateAll, 1000);
  }

  // React to storage changes from background or popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.timerState) {
        timerState = changes.timerState.newValue;
        updateAll();
      }
      if (changes.settings) {
        settings = changes.settings.newValue;
        updateAll();
      }
    }
  });

  init();
})();
