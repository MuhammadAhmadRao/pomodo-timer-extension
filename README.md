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
│   └── service-worker.js      # Alarms, notifications, DNR blocking rules, badge updates
├── content/
│   ├── content.js             # In-page draggable floating widget (Shadow DOM)
│   └── content.css            # Isolated widget styles
├── popup/
│   ├── popup.html             # Main extension popup interface
│   ├── popup.css              # Glassmorphic dark/light UI
│   └── popup.js               # Timer math, controls, and canvas PiP stream
├── options/
│   ├── options.html           # Settings dashboard
│   ├── options.css            # Settings stylesheet
│   └── options.js             # Manage durations, presets, and blocked domains
├── blocked/
│   ├── blocked.html           # "Stay Focused" redirect page
│   ├── blocked.css            # Blocked page design
│   └── blocked.js             # Live countdown and referrer redirection
├── shared/
│   ├── storage.js             # Shared storage helpers & default config
│   └── sound.js               # Audio synthesis for transition chimes (Web Audio API)
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```
