# Focus Timer - Testing & Verification Guide

This document covers automated verification results, manual test steps, and clear notes on what was verified versus what requires interactive browser observation.

---

## 1. Automated Verification Results

Using a local headless Chromium instance (`Chrome 156` on macOS) launched with `--load-extension` and Chrome DevTools Protocol (CDP), the following was automatically verified:

- [x] **Manifest V3 Validity**: Extension manifest parsed and registered cleanly without deprecation warnings or permission faults.
- [x] **Background Service Worker Initialization**: Service worker (`background/service-worker.js`) booted and registered at `chrome-extension://.../service_worker.js`.
- [x] **JavaScript Syntax & Modules**: All scripts (`service-worker.js`, `storage.js`, `content.js`, `popup.js`, `options.js`, `blocked.js`) passed V8 syntax checks without runtime errors.
- [x] **Badge Formatting & Character Limit**:
  - $> 10$ minutes remaining: Formats as `25m`, `11m`, `10m` ($\le 3$ characters).
  - $\le 10$ minutes remaining ($< 600$s): Formats as `M:SS` (`9:03`, `0:59`, `0:00`, $\le 4$ characters).
  - Colors: Focus = Red (`#ef4444`), Break = Green (`#10b981`), Paused = Grey (`#6b7280`).
  - Idle/Reset: Badge text is empty string `""`.
- [x] **Tab Title Mutation & Prefix Logic**:
  - Prefixes with `⏱ MM:SS | <Title>`.
  - Safely ignores internal mutations via `isUpdatingTitleInternally`.
  - Captures dynamic website title changes (e.g. notifications/video changes) without losing user content.
  - Successfully restores original title upon pause/reset.

---

## 2. Interactive Manual Checklist

Follow these steps in Google Chrome to visually verify the new features:

### A. Load / Reload the Extension
1. Open Chrome and go to `chrome://extensions`.
2. Ensure **Developer mode** (top-right) is ON.
3. Click **"Load unpacked"** (or click the reload icon on the "Focus Timer" card if already loaded).
4. Select `/Users/macbookpro/Documents/workspace/pomodo-timer-extension`.
5. Pin **Focus Timer** to your browser toolbar.

---

### B. Verify Feature 1: Docked Top-Center Notch Pill
1. **Initial Idle State**:
   - Open any website (e.g., `https://wikipedia.org`).
   - Notice: No pill appears (it is hidden when idle before starting).
2. **Start Timer**:
   - Click the extension icon in the toolbar and click **Play** (▶).
   - Look at the top center of the web page:
     - A small, compact capsule appears **flush with the top edge of the browser viewport**.
     - It has **square top corners** and **rounded bottom corners**, styled like a notch hanging from Chrome's header.
     - Displays the red phase dot (focus) and live `MM:SS`.
3. **Hover Interaction**:
   - Move your mouse over the pill:
     - It smoothly widens to reveal the **Pause/Resume** button and **Skip** button.
     - Click **Pause**: The time pauses, the toolbar badge turns grey, and the notch stays visible in paused state.
     - Click **Resume**: The countdown resumes.
     - Move your mouse away: The pill smoothly collapses back to the compact size.
4. **Site-Blocker Exclusion**:
   - Navigate to `chrome-extension://<id>/blocked/blocked.html` or visit a blocked site like `reddit.com`.
   - Verify: The top notch pill is **not rendered** on the blocked page.
5. **Reset / Stop**:
   - Open popup and click **Reset**.
   - Verify: The pill disappears from the page completely.

---

### C. Verify Feature 2: Live Toolbar Badge & Dynamic Ring Icon
1. **Color Coding**:
   - Focus session running: Badge background is **Red** (`#ef4444`).
   - Break session running: Badge background is **Green** (`#10b981`).
   - Paused: Badge background is **Grey** (`#6b7280`).
2. **Badge Format Switch**:
   - Set focus duration to 11 minutes in Options, start timer: Badge shows `11m`.
   - As it crosses under 10:00 (e.g., at 9:59), watch the badge switch to `9:59`, then `9:58`... down to `M:SS` every second.
   - Max 4 characters fits cleanly within Chrome's action badge area.
3. **Dynamic Canvas Progress Ring**:
   - Look at the extension icon in the toolbar: as time elapses, an arc fills clockwise on the icon ring reflecting progress.
4. **Service Worker Wake-up Resiliency**:
   - In `chrome://extensions`, locate the "service worker" link for Focus Timer.
   - Click "Stop" / terminate the service worker.
   - Wait 5 seconds or switch tabs: Chrome wakes the service worker, and the badge/icon immediately resumes from storage without losing state or skipping time.

---

### D. Verify Feature 3: Tab Title Timer Across Multiple Tabs
1. Open 3 different websites in separate tabs (e.g., `wikipedia.org`, `github.com`, `news.ycombinator.com`).
2. Start the timer from the popup or notch.
3. Check all tab headers:
   - Each tab's title shows `⏱ 24:59 | Wikipedia`, `⏱ 24:59 | GitHub`, etc.
   - The countdown ticks down in sync on all tabs every second.
4. Pause the timer:
   - All tab titles immediately revert to their original titles without the prefix.
5. Resume:
   - All tab titles re-attach the timer prefix.
6. Options toggle:
   - Open Options (`options.html`) and toggle **Tab Title Timer** OFF.
   - All tab titles immediately revert.

---

## 3. What Could NOT Be Automatically Verified

While headless Chromium confirmed script execution, service worker booting, CDP targets, and unit math, the following require real human visual inspection:

1. **Native OS Picture-in-Picture Rendering**:
   - The headless environment does not have a physical OS window manager to pop out native OS PiP windows. Visual verification of the floating PiP window floating over native desktop apps must be done in a normal Chrome window.
2. **Audio Chime Audibility**:
   - Headless Chrome does not have an active audio output device attached; Web Audio API executes but audible chime playback must be heard on physical speakers/headphones.
3. **Visual Aesthetics & Pixel Alignment**:
   - The exact visual feel of the flush notch hanging seamlessly from the browser toolbar chrome should be checked in your preferred desktop window size and zoom level.
