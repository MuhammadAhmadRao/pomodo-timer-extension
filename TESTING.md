# Focus Timer - Testing & Verification Guide

This document covers automated verification results, manual test steps, and clear notes on what was verified versus what requires interactive browser observation.

---

## 1. Automated Verification Results

Using Node.js test runner (`node --test test/*.test.js`) and headless Chromium (`Chrome 156` on macOS), the following was automatically verified:

- [x] **Manifest V3 Validity**: Extension manifest parsed and registered cleanly with new resources (`stats/stats.html`, `stats.html`).
- [x] **JavaScript Syntax & Modules**: All scripts (`background/service-worker.js`, `shared/storage.js`, `shared/stats.js`, `content/content.js`, `popup/popup.js`, `options/options.js`, `blocked/blocked.js`, `stats/stats.js`) passed V8 syntax validation without errors.
- [x] **Session Log Idempotency & Pruning (`test/session-log.test.js`)**:
  - Incomplete sessions under 1 minute ($< 60$s) are filtered out and ignored.
  - Incomplete sessions $\ge 1$ minute are correctly logged with `completed: false` and actual focused time.
  - Completed focus sessions are recorded with `completed: true`.
  - Duplicate session logging is strictly prevented (idempotent across multiple event dispatches).
  - Sessions older than 365 days are automatically pruned from `chrome.storage.local`.
- [x] **Streak & Daily Aggregation Logic (`test/stats.test.js` - 14 unit tests)**:
  - Day counts towards streaks only if it has at least one completed focus session.
  - Streak preservation: when today has no session yet, yesterday's streak is kept alive until the day ends.
  - Broken streak detection when yesterday had no session.
  - Longest streak tracking historically across multi-day gaps.
  - Day boundary handling across midnight (`23:59:59` vs `00:00:01`).
  - Timezone handling: correct local date calculation across timezones (e.g. UTC vs `America/New_York` vs `Asia/Tokyo`).
  - Daily goal progress calculation and 7-day breakdown.
  - Top labels grouping, descending duration sorting, and percentage share.
  - CSV generation with proper header formatting and quote escaping.
- [x] **Strict Mode Enforcement & Emergency Exit (`test/strict-mode.test.js` - 4 unit tests)**:
  - Background Service Worker rejects `PAUSE`, `RESET`, `SKIP`, `SWITCH_PHASE`, and `ALLOW_5_MINUTES` during strict focus.
  - Break phases permit normal timer controls and actions even when Strict Mode is enabled.
  - Emergency Exit terminates session, logs incomplete session with actual focused time if $\ge 1$ minute, and resets timer to idle.
  - Emergency Exit ignores brief sessions under 1 minute.
  - Temporary unblock (`ALLOW_5_MINUTES`) sets `tempUnblockUntil` and dynamic rules clear when phase ends.
- [x] **Keyboard Shortcuts & Context Menu (`test/commands-contextmenu.test.js` - 7 unit tests)**:
  - Domain normalization extracts clean hosts (e.g. `https://www.reddit.com/r/tech` -> `reddit.com`).
  - Ignores internal browser pages (`chrome://`, extension pages, `about:blank`, `file://`).
  - Duplicate blocklist prevention.
  - Context menu addition locked and rejected during active strict focus.
  - Keyboard command `toggle-timer` starts and pauses timer when strict mode is off.
  - Keyboard commands `toggle-timer` (pause) and `skip-phase` are rejected during strict focus.
  - Keyboard commands operate normally during break phases.

---

## 2. Interactive Manual Checklist

Follow these steps in Google Chrome to visually verify the task label feature and stats page:

### A. Load / Reload the Extension
1. Open Chrome and go to `chrome://extensions`.
2. Ensure **Developer mode** is ON.
3. Click the reload icon on the **Focus Timer** card.
4. Pin **Focus Timer** to your browser toolbar.

---

### B. Verify Task Labels & Quick-Pick Chips
1. **Popup Task Input**:
   - Open the popup while on the **Focus** tab.
   - You should see the text input **"What are you working on?"** with a tag icon (`🏷️`).
   - Type a task label (e.g., `Refactoring Auth API`). Notice the clear button (`×`) appears.
   - Click the **Play** button (▶) to start the session.
2. **Quick-Pick Chips**:
   - Type a task and press **Enter** (or start the session).
   - Verify: The label appears as a quick-pick chip underneath the input.
   - Start 5 different tasks across tests: verify the last 5 unique labels appear as quick-pick chips.
   - Click any chip: it immediately populates the input and updates the current session's label.
3. **Popup Centerpiece Badge**:
   - While a task is active, check the center of the circular timer:
   - A badge `🎯 Refactoring Auth API` appears (truncated cleanly if long), with the full label visible on hover.
4. **Docked Pill Tooltip**:
   - Open any web page (e.g., `https://wikipedia.org`).
   - Hover over the top notch pill:
   - Verify the tooltip displays `Focus: Refactoring Auth API` (truncated if long).
5. **Pop-out Window / Picture-in-Picture**:
   - Click the Picture-in-Picture pop-out icon in the popup header.
   - In the floating PiP window, verify the truncated label appears below the status text.
6. **Break Phase Behavior**:
   - Click the **Short Break** or **Long Break** tab:
   - Verify the task input section is cleanly hidden so it doesn't distract during rest periods.

---

### C. Verify Session Logging Behavior
1. **Early Reset Under 1 Minute**:
   - Start a focus session, wait 15 seconds, and click **Reset**.
   - Open stats page: verify no session was logged (sub-minute focus discarded).
2. **Early Skip/Reset Over 1 Minute**:
   - Start a focus session, wait at least 65 seconds, and click **Reset** or **Skip**.
   - Open stats page or inspect `chrome.storage.local.get("sessions")`:
   - Verify entry logged with `completed: false` and `focusedMs` matching the elapsed time.
3. **Full Completion**:
   - Let a focus session run to completion (or set focus duration to 1 minute in options).
   - Verify entry logged with `completed: true`.

---

### D. Verify Stats Page (`stats/stats.html`)
1. **Navigation Links**:
   - From Popup: Click the new chart icon button (`📊`) in the header. Verify it opens the Stats page in a new tab.
   - From Options: Click the **"📊 View Stats"** button in the options page header. Verify it opens the Stats page.
2. **Today's KPIs & Daily Goal**:
   - Check **Today's Focus**: shows total focused minutes today.
   - Check **Daily Goal**: progress bar fills according to the new setting in Options (`Daily goal (minutes)`).
   - Check **Completed Rounds**: reflects count of completed sessions today.
3. **Streaks**:
   - Check **Current Streak** and **Best Streak 🏆**:
   - When at least one session is completed today, streak is active.
   - If today has no sessions yet, streak shows yesterday's streak with a note that it's alive until midnight.
4. **Last 7 Days Plain SVG Bar Chart**:
   - Shows 7 vertical bars (oldest to today).
   - Each bar displays focused minutes on top and day name below.
   - Includes a dashed reference line for your daily goal.
   - Hovering over any bar shows a tooltip with exact minutes and completed sessions.
5. **Last 30 Days Summary**:
   - Metrics for total focus time, sessions completed, daily average, and active days.
   - 30-day activity matrix with dots highlighted on active days.
6. **Top Labels**:
   - Ranks all recorded tasks by focused time with percentages and horizontal progress bars.
7. **Action Buttons**:
   - Click **"Export CSV"**: downloads `focus-timer-sessions-YYYY-MM-DD.csv` containing all session details.
   - Click **"Clear Stats"**: displays confirmation dialog. Upon confirming, resets session log to empty and reveals the friendly empty state illustration.
8. **Theme Consistency**:
   - Click the theme toggle button: smoothly switches between Dark and Light themes matching the extension aesthetic.

---

### E. Verify Strict Mode & Distraction Resistance
1. **Enable Strict Mode in Options**:
   - Open the Options page (`options/options.html`).
   - In Section 3 (Preferences), turn ON the **Strict Mode 🔒** toggle.
   - Click **Save Changes** and see the toast confirmation.
2. **Strict Focus UI & Background Locks**:
   - Open the popup and start a **Focus** session (▶).
   - **In Popup**: Pause, Reset, Skip, and Phase tabs become disabled (`opacity: 0.5`, `cursor: not-allowed`). A yellow `🔒 STRICT MODE` badge appears below the timer.
   - **In Docked Notch Pill**: On web pages, hovering over the notch pill reveals disabled action buttons (`opacity: 0.35`, `cursor: not-allowed`), and the tooltip displays `🔒 Strict Focus: [Task]`.
   - **In PiP Window**: The pop-out window renders `🔒 STRICT MODE`.
   - **In Service Worker**: Open DevTools console on any page and execute:
     `chrome.runtime.sendMessage({ action: "PAUSE" }, console.log)`
     Verify it responds: `{ success: false, error: "Strict mode is active. Pausing is disabled during focus." }`.
   - **In Options Page**: A prominent amber lock banner appears at the top. Timer durations, site blocker input, presets, tag remove buttons, and the Strict Mode toggle itself are disabled and read-only.
3. **Break Phases Behave Normally**:
   - When focus transitions to Short Break or Long Break, all controls, pause/reset/skip, and options unlock automatically.
4. **Emergency Exit Escape Hatch**:
   - While a strict focus phase is running, click **"⚠️ End session early..."** at the bottom of the popup.
   - An emergency modal opens with a 30-second live countdown (`30s`, `29s`, ...).
   - Confirm button remains disabled until the 30-second cooldown reaches zero AND the exact confirmation phrase `"I choose to stop focusing"` is typed into the input.
   - Clicking Confirm ends the session, resets the timer to idle focus, and logs the session as incomplete (`completed: false`) in the session history if focused time was $\ge 1$ minute.
5. **"Allow 5 Minutes" on `blocked.html`**:
   - **With Strict Mode OFF**: Try visiting a blocked website (e.g. `reddit.com`). Click the **"⏱️ Allow 5 Minutes"** button. A modal opens with a 20-second visible countdown. Once the 20 seconds elapse, confirm becomes active and unblocks sites for 5 minutes.
   - **With Strict Mode ON**: Try visiting a blocked website. Verify the **"Allow 5 Minutes"** button is completely hidden from the page.

---

### F. Verify Keyboard Shortcuts & Context Menu
1. **Context Menu - Block Normal Website**:
   - Navigate to any public website (e.g. `https://wikipedia.org`).
   - Right-click anywhere on the webpage.
   - Click **"Block this site during focus"**.
   - Verify a notification appears confirming `wikipedia.org` was added to the blocklist.
   - Check the Options page: `wikipedia.org` is now listed in the blocklist tags.
2. **Context Menu - Avoid Duplicates**:
   - Right-click on the same page again and click **"Block this site during focus"**.
   - Verify a notification informs you that `wikipedia.org` is already in the blocklist.
3. **Context Menu - Internal Browser Pages**:
   - Try right-clicking on `chrome://extensions` or an extension page.
   - Notice the context menu item either is not displayed (per Chrome security) or displays an alert that internal pages cannot be blocked.
4. **Context Menu - Strict Mode During Focus**:
   - Turn Strict Mode ON in Options and start a focus session.
   - Right-click on any webpage: notice the context menu item is either disabled or says `Block this site during focus (Disabled in Strict Mode)`.
   - If clicked, an alert confirms that the blocklist cannot be modified during strict focus.
5. **Keyboard Shortcuts - Toggle Timer (`Alt+Shift+P` / `⌥+Shift+P`)**:
   - While idle on any webpage, press `Alt+Shift+P`.
   - Verify the timer starts (badge turns red and begins counting down).
   - Press `Alt+Shift+P` again: verify the timer pauses (badge turns grey).
6. **Keyboard Shortcuts - Skip Phase (`Alt+Shift+S` / `⌥+Shift+S`)**:
   - While timer is running, press `Alt+Shift+S`.
   - Verify the session completes and automatically switches to Break (badge turns green).
7. **Keyboard Shortcuts - Strict Mode Enforcement**:
   - Turn Strict Mode ON and start a focus session.
   - Press `Alt+Shift+P` (attempt to pause): verify a desktop notification alerts that pausing is disabled in strict mode. The timer keeps running.
   - Press `Alt+Shift+S` (attempt to skip): verify a desktop notification alerts that skipping is disabled in strict mode. The timer keeps running.
8. **Shortcuts Link in Options**:
   - Open Options page (`options/options.html`).
   - In Section 4 (Keyboard Shortcuts), verify the registered shortcuts are displayed.
   - Click the **"⚙️ Customize Shortcuts"** button: verify it opens `chrome://extensions/shortcuts` in a new tab.

---

## 3. What Could NOT Be Automatically Verified

While automated Node.js unit tests and headless Chrome verified data math, state transitions, storage persistence, and message rejection, the following require real human visual inspection and physical environment checks:

1. **Physical Keyboard Shortcut Event Dispatches in the OS**:
   - While the command handlers in the service worker were unit-tested, physical OS keyboard hardware dispatching `Alt+Shift+P` and `Alt+Shift+S` to Chrome across different window focus states requires physical manual testing.
2. **Native Right-Click Context Menu Visual Rendering**:
   - The native OS right-click popup menu rendered by the Chrome browser interface cannot be visually screenshotted or clicked in headless mode without a desktop GUI session.
3. **OS-Level System Sleep and Wake Transitions**:
   - We verified mathematically that timer calculations use absolute timestamps (`endTime = Date.now() + duration`), ensuring elapsed time survives background suspension. However, actual OS power-state transitions (putting Mac/PC to sleep mid-focus for 10 minutes and waking it) require physical testing.
4. **Physical Browser / OS Restart Mid-Focus**:
   - Verifying that closing the Chrome browser application completely during a strict focus session and relaunching it preserves the locked state requires an interactive browser session.
5. **Native Extension Uninstall / Disable Bypass**:
   - Chrome does not permit extensions to restrict or disable access to `chrome://extensions`. Consequently, users can technically bypass Strict Mode by disabling the extension in Chrome settings.
6. **Native Audio Chime Output**:
   - The Web Audio API synthesizer node connections are tested, but actual acoustic perception through speakers requires human verification.



