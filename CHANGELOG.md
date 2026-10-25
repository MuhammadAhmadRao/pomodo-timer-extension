# Changelog

All notable changes to the **Focus Timer** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-25

### Added
- **Core Pomodoro Engine**:
  - Focus, Short Break, and Long Break cycle management with configurable durations.
  - Timestamp-based state tracking ensuring drift-free precision across service worker sleep cycles.
  - Manifest V3 Service Worker with `chrome.alarms` scheduling.
  - Dynamic OffscreenCanvas toolbar icon showing a circular progress ring and live badge timer.
- **Docked Top Notch Pill**:
  - Lightweight, non-intrusive floating notch docked at top-center of web pages via Shadow DOM.
  - Live countdown, phase indicators, play/pause and skip controls, and task label tooltip.
  - Real-time tab title updates with dynamic phase and countdown prefix.
- **Picture-in-Picture Mode**:
  - Offscreen HTML5 Canvas stream rendered to native OS Picture-in-Picture window.
  - Floats above all desktop apps with live remaining time, phase, and active task display.
- **Task Labels & Quick-Pick Chips**:
  - "What are you working on?" input before and during focus sessions.
  - Automatic persistence of the last 5 unique task labels as 1-click quick-pick chips.
  - Centerpiece task badge in popup and truncated labels in notch pill and PiP.
- **Analytics & Statistics Dashboard**:
  - Dedicated stats dashboard (`stats/stats.html`) accessible from popup and options.
  - Daily goal tracking with customizable goal target (`dailyGoalMinutes`).
  - Current streak and longest streak calculations with midnight-safe timezone handling.
  - Interactive SVG bar chart for 7-day focus trends with goal reference line.
  - 30-day activity matrix and top tasks breakdown ranked by total focus duration.
  - CSV export for sessions log and one-click stats reset with safety confirmation.
- **Strict Mode (Unbreakable Focus)**:
  - Background Service Worker enforcement rejecting `PAUSE`, `RESET`, `SKIP`, and phase changes during running focus phases.
  - Control locks across popup, docked pill, PiP stream, context menus, and keyboard shortcuts.
  - Read-only protection for options page timer durations, blocklists, and strict toggle.
  - Friction-gated Emergency Exit requiring a 30-second cooldown timer and typing `"I choose to stop focusing"`.
- **Keyboard Shortcuts & Context Menu**:
  - Configurable global shortcuts: `Alt+Shift+P` (toggle timer) and `Alt+Shift+S` (skip phase).
  - Context menu item: "Block this site during focus" with automatic domain normalization, internal URL rejection, and strict mode disabling.
- **Dual Blocking Modes (Blocklist & Allowlist)**:
  - **Blocklist Mode**: Redirects distracting domains to the calming "Stay Focused" page during focus.
  - **Allowlist Mode**: Blocks *every* website except approved work/docs domains, localhost, and extension pages.
  - Dynamic `declarativeNetRequest` rules with Priority 2 allows and Priority 1 catch-all redirects.
  - Pre-packaged quick-add chips (Docs & Learning, Work & Tools, Reference).
  - Warning banner when allowlist is empty.
  - Automatic redirection of open unapproved tabs and restoration upon focus completion.
  - Privacy-preserving `optional_host_permissions` requested on-demand only when Allowlist mode is activated.

### Changed
- Refactored `syncBlockingRules` to execute inside a serialized promise queue, eliminating race conditions.
- Hardened all Chrome extension message and alarm listeners with `try/catch` blocks and `lastError` checks to ensure zero uncaught errors in `chrome://extensions`.
- Formatted repository with MIT License and updated `.gitignore`.
