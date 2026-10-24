# 🍅 Focus Timer - Pomodoro & Website Blocker

A clean, modern, zero-dependency Chrome extension (Manifest V3) combining a customizable Pomodoro timer with an intelligent website distraction blocker.

---

## ✨ Features

1. **Pomodoro Timer Engine**:
   - 25-minute focus, 5-minute short break, 15-minute long break after 4 rounds (all fully configurable).
   - Survives background service worker idle shutdowns using `chrome.storage.local` timestamps (`endTime`) and `chrome.alarms`.
   - Desktop notifications and Web Audio chimes on phase transitions.

2. **Live Toolbar Badge & Dynamic Progress Icon**:
   - Live 1-second countdown updates.
   - Shows "24m" style minutes when $> 10$ minutes remain, and "M:SS" (e.g. "9:03", max 4 characters) for the final 10 minutes.
   - Phase-coded badge backgrounds: Red for Focus, Green for Break, Grey when Paused.
   - Dynamic `OffscreenCanvas` icon drawing a circular progress ring that fills as time elapses.

3. **Docked Top-Center Notch Pill (In-Page)**:
   - Replaces floating widgets with a fixed capsule flush with the top edge of the page (`top: 0`, horizontally centered).
   - Square top corners and rounded bottom corners, styled like a native notch hanging from Chrome's header.
   - Compact: 98px wide $\times$ 28px tall, showing phase dot and `MM:SS`.
   - On hover, expands smoothly to reveal Pause/Resume and Skip controls.
   - Isolated via Shadow DOM with zero layout shift; hidden when idle or on `blocked.html`.

4. **Dynamic Tab Title Countdown**:
   - Prefixes `document.title` with `⏱ MM:SS | ` on every tab while running.
   - Handled via `MutationObserver` to prevent infinite loops and preserve dynamic website title updates.
   - Automatically restores original titles when paused or reset.

5. **Picture-in-Picture & Website Blocker**:
   - Streams live timer to a native OS Picture-in-Picture pop-out window floating over all desktop applications.
   - Redirects distracting domains during Focus phases to a calming "Stay Focused" page via `declarativeNetRequest`.

6. **Task Labels & Quick-Pick Chips**:
   - Optional "What are you working on?" input before and during focus sessions.
   - Automatically remembers the last 5 task labels as convenient 1-click quick-pick chips.
   - Displays the truncated task label in the popup centerpiece, docked top pill tooltip, and PiP window.

7. **Statistics Dashboard, Streaks & Visual Analytics**:
   - Dedicated stats page (`stats/stats.html`) accessible from both popup and options.
   - Today's focus progress toward your customizable daily goal (`dailyGoalMinutes`, default 120m).
   - Current and longest streak tracking with local date boundary handling (streaks stay alive until midnight).
   - Last 7 days plain SVG bar chart with daily goal reference line and hover tooltips.
   - 30-day summary metrics and activity matrix.
   - Top tasks/labels breakdown ranked by total focus time and percentage share.
   - CSV export and one-click stats reset with confirmation.

8. **Strict Mode & Distraction Resistance**:
   - **Enforced at Service Worker Level**: When Strict Mode is enabled and a focus phase is active, `PAUSE`, `RESET`, `SKIP`, and phase changes are rejected by the background service worker, not merely hidden in the UI.
   - **UI Lock**: Control buttons in the popup, docked notch pill, and PiP stream are disabled with lock indicators.
   - **Settings Protection**: In the Options page, timer durations, the blocked sites list, and the Strict Mode toggle are made read-only with a persistent banner until the focus phase completes.
   - **Emergency Exit**: Includes a friction-gated escape hatch requiring a 30-second cooldown wait and typing the exact confirmation phrase `"I choose to stop focusing"`. Partial focus time ($\ge 1$ min) is logged for analytics.
   - **Blocked Page Friction**: "Allow 5 Minutes" temporary unblock button requires a 20-second cooldown wait, and is completely hidden when Strict Mode is enabled.
   - **Honest Limitation**: Chrome does not allow browser extensions to prevent users from disabling or uninstalling them. While Strict Mode locks all extension controls, web pages, and background messages, it can still be bypassed by navigating to `chrome://extensions` and toggling the extension off.

---

## 🚀 How to Install and Run (for Beginners)

1. Open Google Chrome.
2. Navigate to `chrome://extensions` in the address bar.
3. In the top-right corner, turn ON **"Developer mode"**.
4. Click the **"Load unpacked"** button in the top-left corner.
5. Select this project folder (`pomodo-timer-extension`).
6. Click the Extensions puzzle icon in Chrome's toolbar and pin **Focus Timer**.

---

## 📁 Project Structure

```text
pomodo-timer-extension/
├── manifest.json              # Manifest V3 configuration & permissions
├── background/
│   └── service-worker.js      # Alarms, idempotent session logs, DNR rules, badge updates
├── content/
│   ├── content.js             # Docked top notch pill & tab title countdown
│   └── content.css            # Isolated notch styles
├── popup/
│   ├── popup.html             # Popup interface with task label input & quick chips
│   ├── popup.css              # Glassmorphic dark/light UI
│   └── popup.js               # Timer math, label management, and PiP stream
├── options/
│   ├── options.html           # Settings dashboard & daily goal configuration
│   ├── options.css            # Settings stylesheet
│   └── options.js             # Manage durations, daily goal, presets, blocked domains
├── stats/
│   ├── stats.html             # Analytics dashboard
│   ├── stats.css              # Glassmorphic stats layout & SVG chart styling
│   └── stats.js               # KPI calculations, plain SVG bar chart, CSV export
├── blocked/
│   ├── blocked.html           # "Stay Focused" redirect page
│   ├── blocked.css            # Blocked page design
│   └── blocked.js             # Live countdown and referrer redirection
├── shared/
│   ├── storage.js             # Shared storage helpers & default config
│   ├── stats.js               # Pure streak, aggregation, top label, and CSV functions
│   └── sound.js               # Audio synthesis for transition chimes (Web Audio API)
├── test/
│   ├── stats.test.js          # Unit tests for streaks, timezones, and aggregations
│   └── session-log.test.js    # Unit tests for session log idempotency and pruning
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```
