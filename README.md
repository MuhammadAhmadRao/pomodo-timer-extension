# Focus Timer - Pomodoro & Intelligent Site Blocker

> **A distraction-free productivity extension for Google Chrome (Manifest V3).**  
> Combines a precision Pomodoro timer, on-page floating notch pill, native Picture-in-Picture mode, comprehensive streaks & analytics, strict focus lock, and intelligent website blocking (Blocklist & Allowlist modes).

---

## 📸 Screenshots

| Popup Interface | Docked Top Notch Pill |
| :---: | :---: |
| ![Popup Timer & Task Input](https://raw.githubusercontent.com/MuhammadAhmadRao/pomodo-timer-extension/main/assets/screenshot-popup.png) *Popup with live circular ring, task input, and quick chips* | ![Docked Notch Pill](https://raw.githubusercontent.com/MuhammadAhmadRao/pomodo-timer-extension/main/assets/screenshot-notch.png) *Floating notch pill docked at the top of any webpage* |

| Analytics & Streaks Dashboard | Picture-in-Picture & Blocked Page |
| :---: | :---: |
| ![Statistics Dashboard](https://raw.githubusercontent.com/MuhammadAhmadRao/pomodo-timer-extension/main/assets/screenshot-stats.png) *Daily goal progress, 7-day SVG trend chart, and label rankings* | ![Blocked Page](https://raw.githubusercontent.com/MuhammadAhmadRao/pomodo-timer-extension/main/assets/screenshot-blocked.png) *Calming redirect page with live timer and friction unblock* |

---

## ⚡ What It Does

Focus Timer helps developers, writers, and students maintain deep concentration by combining:
1. **Precision Pomodoro Cycles**: Structured focus rounds and rest intervals (Short Break & Long Break) with audio chimes and notifications.
2. **Always-Visible Progress**: A docked top-center notch pill on web pages and an OS-level Picture-in-Picture window that floats above all your desktop apps.
3. **Intentional Work**: Task tagging with "What are you working on?" and quick-pick chips that remember your last 5 tasks.
4. **Distraction Blocking**: Dynamic network-level blocking that redirects distracting websites (or everything except allowed docs) directly to a calming refocus page.
5. **Accountability**: Unbreakable Strict Mode with friction-gated emergency exits, plus a rich statistics dashboard tracking streaks and daily goals.

---

## ✨ Features

### 1. Precision Timer Engine
- **Configurable Intervals**: Default 25m Focus, 5m Short Break, 15m Long Break, with 4 rounds per cycle.
- **Dynamic Toolbar Badge**: Live remaining time formatted as `25m` or `4:32`, with dynamic color coding (Red = Focus, Green = Break, Grey = Paused).
- **OffscreenCanvas Progress Icon**: Circular progress ring rendered in real time onto the extension icon.
- **Web Audio Chimes**: Smooth synthesized audio chimes for session start, completion, and break transitions.

### 2. Docked Top Notch Pill & Tab Title Countdown
- **Docked Notch**: Minimalist, pill widget attached to the top-center of any webpage inside an isolated Shadow DOM (immune to host page CSS and CSP).
- **Interactive Controls**: Hover to reveal Play/Pause and Skip buttons, or view the current task label tooltip.
- **Tab Title Countdown**: Prepends `⏱ 24:59 | ` to the active tab title, automatically reverting to the original title when paused or reset.

### 3. Native Picture-in-Picture (PiP) Window
- Live HTML5 Canvas streamed to Chrome's native Picture-in-Picture video player.
- Floats on top of all native windows (IDEs, terminals, editors) with remaining time, phase indicator, active task, and strict mode status.

### 4. Task Labels & Quick-Pick Chips
- Input your focus goal before or during any focus phase.
- Automatically saves and displays your last 5 unique tasks as 1-click quick-pick chips.
- Truncated label displayed in the circular timer centerpiece, docked pill, and PiP stream.

### 5. Statistics, Streaks & Visual Analytics
- Dedicated dashboard (`stats/stats.html`) accessible from both popup and options.
- **Streaks**: Tracks current streak and all-time longest streak with timezone-safe midnight boundaries.
- **Daily Goal Progress**: Visual progress bar tracking focus minutes against your customizable daily target (`dailyGoalMinutes`, default 120m).
- **7-Day Trend Chart**: Responsive SVG bar chart with daily goal baseline and hover tooltips.
- **30-Day Activity Matrix**: Historical breakdown of daily focus consistency.
- **Task Rankings**: Top labels ranked by total focus time and percentage share.
- **CSV Data Export**: One-click download of all raw session records.

### 6. Strict Mode (Unbreakable Focus)
- **Background-Enforced**: Rejection of `PAUSE`, `RESET`, `SKIP`, and phase-change messages at the service worker level.
- **Interface Lockout**: Disables controls in the popup, docked notch pill, PiP stream, context menus, and keyboard shortcuts.
- **Settings Protection**: Blocks duration adjustments, list modifications, and toggle disabling on the options page until focus ends.
- **Emergency Exit Escape Hatch**: Requires waiting out a 30-second cooldown timer and typing the exact confirmation phrase `"I choose to stop focusing"`. Partial sessions ($\ge 1$ min) are logged for analytics.

### 7. Dual Website Blocking (Blocklist & Allowlist)
- **Blocklist Mode**: Specify distracting websites (e.g., `reddit.com`, `twitter.com`) to redirect to `blocked.html` during focus.
- **Allowlist Mode**: Strict work mode that blocks **every** website *except* approved domains, localhost, and extension pages.
- **Quick-Add Presets**: 1-click presets for Docs & Learning (`github.com`, `stackoverflow.com`, `developer.mozilla.org`, `docs.google.com`), Work & Tools, and Reference.
- **Empty Allowlist Warning**: Alerts the user if the allowlist is empty before sessions begin.
- **Auto Tab Redirection & Restoration**: Unapproved open tabs are redirected to `blocked.html?url=...` when focus starts, and automatically restored back to their original URLs when focus ends.

### 8. Global Keyboard Shortcuts & Context Menu
- `Alt+Shift+P` (or `⌥+Shift+P` on macOS): Start or pause timer.
- `Alt+Shift+S` (or `⌥+Shift+S` on macOS): Skip to next phase.
- **Right-Click Context Menu**: Right-click any webpage to instantly add its domain to your blocklist/allowlist.

---

## 🛠️ How to Install (Unpacked Extension)

1. **Clone or Download** this repository:
   ```bash
   git clone https://github.com/MuhammadAhmadRao/pomodo-timer-extension.git
   ```
2. Open **Google Chrome** and navigate to:
   ```text
   chrome://extensions
   ```
3. In the top right corner, toggle **Developer mode** to **ON**.
4. Click the **Load unpacked** button in the top left.
5. Select the `pomodo-timer-extension` directory.
6. Click the Extensions puzzle icon in Chrome's toolbar and **pin Focus Timer** for instant access!

---

## ⏱️ How the Timer Stays Accurate (Timestamp-Based Design)

Many basic browser extensions rely on JavaScript `setInterval` or `setTimeout`. In Manifest V3, Chrome terminates inactive background service workers after approximately 30 seconds of inactivity, which causes interval-based timers to pause, drift, or reset.

**Focus Timer uses an absolute timestamp-based architecture:**
* **End-Time Anchoring**: When a session starts, the service worker calculates and persists an absolute target timestamp:
  $$\text{endTime} = \text{Date.now()} + \text{durationMs}$$
* **Alarm Scheduling**: A native browser alarm is registered via `chrome.alarms.create("FOCUS_TIMER_PHASE_END", { when: endTime })`. The Chrome browser wakes up the service worker exactly when the alarm fires, regardless of whether the service worker was suspended.
* **Drift-Free Recomputation**: Every time a popup opens, a webpage loads, or the service worker wakes up, the remaining time is calculated directly from system clock difference:
  $$\text{remainingMs} = \max(0, \text{endTime} - \text{Date.now()})$$
* **OS Sleep & Wake Resilience**: If you close your laptop lid or put your computer to sleep for 20 minutes, the timer accurately reflects the elapsed real-world time upon waking, with zero clock drift.

---

## 🛡️ How Website Blocking Works

Blocking is powered by Chrome's native **DeclarativeNetRequest (DNR)** API:

```
                          ┌──────────────────────────┐
                          │   HTTP / HTTPS Request   │
                          └─────────────┬────────────┘
                                        │
                         Is Focus Phase Active & Running?
                                  /            \
                              (Yes)            (No)
                                /                \
                     Which Blocking Mode?     [ Request Allowed ]
                      /                \
             [ Blocklist Mode ]   [ Allowlist Mode ]
                    │                     │
           Matches Blocked Site?    Matches Allowed Site / Localhost?
            /              \                 /              \
         (Yes)             (No)           (Yes)             (No)
          /                  \             /                  \
[ Redirect to blocked.html ] [ Allow ]  [ Allow ]   [ Redirect to blocked.html ]
```

1. **Serialized Atomic Updates**: Dynamic rules are managed through a serialized Promise queue. Rules are applied atomically via `chrome.declarativeNetRequest.updateDynamicRules`, preventing race conditions during rapid state changes.
2. **Subdomain Matching**: Domain condition filters use the standard DNR filter syntax `||domain.com^`, which natively blocks or allows all subdomains (e.g. `api.github.com`, `gist.github.com`, and `github.com`).
3. **Always-Protected Resources**: Internal browser URLs (`chrome://*`), extension pages (`chrome-extension://*`), and local development environments (`localhost`, `127.0.0.1`) are explicitly excluded from redirection and never blocked.
4. **Temporary Unblock ("Allow 5 Minutes")**: With Strict Mode disabled, a 20-second friction cooldown modal allows unblocking for 5 minutes. The service worker schedules a `chrome.alarms` timer to automatically re-engage blocking when the grace period expires.

---

## 🔑 Permissions Overview

| Permission | Scope | Reason |
| :--- | :--- | :--- |
| `storage` | Required | Persists timer state, preferences, session logs, task labels, and streak data locally in `chrome.storage.local`. |
| `alarms` | Required | Schedules phase end completions and periodic keep-alive ticks reliably across service worker idle cycles. |
| `notifications` | Required | Delivers desktop notifications when focus/break phases end, confirms site blocking, and signals strict mode warnings. |
| `declarativeNetRequest` | Required | Manages dynamic network rules to redirect distracting websites to the calming refocus page. |
| `contextMenus` | Required | Registers the right-click "Block this site during focus" context menu item on web pages. |
| `optional_host_permissions` (`http://*/*`, `https://*/*`) | Optional | Requested on-demand **only** if the user activates Allowlist mode, permitting arbitrary unapproved websites to be redirected. |

---

## 🔒 Privacy Statement

**Your privacy is 100% respected:**
* **Zero Telemetry**: Focus Timer contains no analytics SDKs, trackers, or external logging scripts.
* **100% Local Storage**: All settings, task labels, focus durations, and session logs remain entirely on your computer inside `chrome.storage.local`.
* **No Remote Servers**: No data is ever transmitted across the network. The extension operates completely offline.

---

## ⚠️ Known Limitations

1. **Chrome Internal Pages**: Browser security policies prevent extensions from running content scripts or modifying network requests on internal `chrome://` pages (e.g. `chrome://settings`, `chrome://extensions`) and the Chrome Web Store.
2. **Toolbar Drawing**: Chrome extensions cannot draw arbitrary custom UI elements inside Chrome's native browser toolbar. For this reason, Focus Timer provides both the docked on-page notch pill and the Picture-in-Picture floating window.
3. **Strict Mode Extension Disable**: While Strict Mode locks all extension controls, web pages, options, and background messages, Chrome does not allow extensions to prevent users from disabling or uninstalling them in `chrome://extensions`.

---

## 📁 Project Structure

```text
pomodo-timer-extension/
├── manifest.json                  # Manifest V3 extension configuration
├── background/
│   └── service-worker.js          # Core timer engine, DNR rules, alarms, and message router
├── content/
│   ├── content.js                 # Docked top notch pill & tab title countdown (Shadow DOM)
│   └── content.css                # Isolated notch styles
├── popup/
│   ├── popup.html                 # Main popup UI with task label input & quick chips
│   ├── popup.css                  # Glassmorphic dark/light styles
│   └── popup.js                   # Popup state controller and PiP stream generator
├── options/
│   ├── options.html               # Options page: blocking modes, allowlist/blocklist editor
│   ├── options.css                # Options stylesheet
│   └── options.js                 # Options state, permissions request, and strict mode locking
├── stats/
│   ├── stats.html                 # Statistics & analytics dashboard
│   ├── stats.css                  # Glassmorphic analytics layout & SVG chart styling
│   └── stats.js                   # KPI aggregations, streak logic, SVG bar chart, and CSV export
├── blocked/
│   ├── blocked.html               # "Stay Focused" redirect page
│   ├── blocked.css                # Blocked page design
│   └── blocked.js                 # Live countdown, adaptive text, and tab restoration
├── shared/
│   ├── storage.js                 # Storage defaults, state schemas, and timestamp math
│   ├── stats.js                   # Pure functions for streaks, aggregations, and CSV formatting
│   └── sound.js                   # Web Audio API synthesizer for transition chimes
├── test/
│   ├── stats.test.js              # Unit tests for streaks, timezones, and aggregations
│   ├── session-log.test.js        # Unit tests for session log idempotency and pruning
│   ├── strict-mode.test.js        # Unit tests for background strict enforcement & emergency exit
│   ├── commands-contextmenu.test.js # Unit tests for keyboard shortcuts & context menus
│   └── allowlist-mode.test.js     # Unit tests for Allowlist DNR rules, tab redirects & warnings
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── LICENSE                        # MIT License
├── .gitignore                     # Git ignore rules
├── CHANGELOG.md                   # Version history and release notes
└── TESTING.md                     # Comprehensive automated & manual testing guide
```

---

## 🗺️ Roadmap

- [ ] **Ambient Soundscapes**: Built-in white noise, binaural beats, and rain sounds using the Web Audio API.
- [ ] **Calendar Integration**: Export completed focus sessions to Google Calendar or iCal format.
- [ ] **Weekly Email Summary**: Optional local weekly digest summary of productive hours.
- [ ] **Custom Tag Categories**: Color-coded task tags and project folder groupings.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
