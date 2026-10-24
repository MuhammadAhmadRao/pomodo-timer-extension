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

## 3. What Could NOT Be Automatically Verified

While automated Node.js unit tests and headless Chrome verified data math, state transitions, storage persistence, and manifest parsing, the following require real human visual inspection:

1. **Native OS File Download Dialog**:
   - The browser's native file-system download prompt for the CSV export cannot be visually validated in headless mode without a physical desktop session.
2. **Native OS Modal Dialog Confirmations**:
   - Visual inspection of the browser's native `confirm()` modal popup when clicking "Clear Stats".
3. **Visual Aesthetics & High-DPI Font Rendering**:
   - The exact visual feel of the SVG bar chart gradients, font rendering, and glassmorphic card blurs in different desktop color profiles and zoom levels.

