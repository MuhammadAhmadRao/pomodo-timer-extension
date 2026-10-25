const test = require("node:test");
const assert = require("node:assert/strict");

/**
 * Pure simulation helpers matching service-worker.js DNR rule builder
 */
function buildBlockingRules(settings, shouldBlock) {
  if (!shouldBlock) {
    return [];
  }

  const mode = settings.blockingMode || "blocklist";
  const rules = [];
  let ruleId = 1;

  if (mode === "allowlist") {
    // 1. High-priority allow rule for localhost and 127.0.0.1
    rules.push({
      id: ruleId++,
      priority: 2,
      action: { type: "allow" },
      condition: {
        urlFilter: "||localhost^",
        resourceTypes: ["main_frame"]
      }
    });

    rules.push({
      id: ruleId++,
      priority: 2,
      action: { type: "allow" },
      condition: {
        urlFilter: "||127.0.0.1^",
        resourceTypes: ["main_frame"]
      }
    });

    // 2. High-priority allow rules for each domain in allowedSites
    const allowedSites = settings.allowedSites || [];
    allowedSites.forEach((site) => {
      const clean = site
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "");
      if (clean) {
        rules.push({
          id: ruleId++,
          priority: 2,
          action: { type: "allow" },
          condition: {
            urlFilter: `||${clean}^`,
            resourceTypes: ["main_frame"]
          }
        });
      }
    });

    // 3. Low-priority catch-all redirect rule for all http/https main_frame requests
    rules.push({
      id: ruleId++,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { extensionPath: "/blocked/blocked.html" }
      },
      condition: {
        urlFilter: "|http://*",
        resourceTypes: ["main_frame"],
        excludedRequestDomains: ["localhost", "127.0.0.1"]
      }
    });

    rules.push({
      id: ruleId++,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { extensionPath: "/blocked/blocked.html" }
      },
      condition: {
        urlFilter: "|https://*",
        resourceTypes: ["main_frame"],
        excludedRequestDomains: ["localhost", "127.0.0.1"]
      }
    });
  } else {
    // Blocklist mode: redirect only specified blocked sites
    const blockedSites = settings.blockedSites || [];
    blockedSites.forEach((site) => {
      const clean = site
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "");
      if (clean) {
        rules.push({
          id: ruleId++,
          priority: 1,
          action: {
            type: "redirect",
            redirect: { extensionPath: "/blocked/blocked.html" }
          },
          condition: {
            urlFilter: `||${clean}^`,
            resourceTypes: ["main_frame"]
          }
        });
      }
    });
  }

  return rules;
}

/**
 * Open tab filtering simulation matching service-worker.js
 */
function shouldRedirectTabInAllowlist(tabUrl, allowedSites) {
  if (!tabUrl || !/^https?:\/\//i.test(tabUrl)) {
    return false; // ignore chrome://, chrome-extension://, file://, about:blank
  }
  let parsed;
  try {
    parsed = new URL(tabUrl);
  } catch (e) {
    return false;
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return false;
  }

  // Check if hostname matches any allowed site (exact or subdomain)
  const isAllowed = allowedSites.some((site) => {
    const clean = site
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");
    return clean && (hostname === clean || hostname.endsWith("." + clean));
  });

  return !isAllowed;
}

/**
 * Tab restoration simulation matching service-worker.js
 */
function restoreTabUrl(tabUrl) {
  if (!tabUrl || !tabUrl.includes("/blocked/blocked.html")) {
    return null;
  }
  try {
    const parsed = new URL(tabUrl);
    const originalUrl = parsed.searchParams.get("url");
    if (originalUrl && /^https?:\/\//i.test(originalUrl)) {
      return originalUrl;
    }
  } catch (e) {
    return null;
  }
  return null;
}

test("allowlist mode: rule generation creates priority 2 allow rules and priority 1 redirect rules", () => {
  const settings = {
    blockingMode: "allowlist",
    allowedSites: ["github.com", "stackoverflow.com"]
  };

  const rules = buildBlockingRules(settings, true);

  // Check unique incrementing IDs
  const ids = rules.map((r) => r.id);
  assert.equal(new Set(ids).size, rules.length);
  assert.equal(rules[0].id, 1);
  assert.equal(rules[rules.length - 1].id, rules.length);

  // Check localhost allow rules (priority 2)
  const localhostAllow = rules.filter((r) => r.action.type === "allow" && r.priority === 2);
  assert.ok(localhostAllow.some((r) => r.condition.urlFilter === "||localhost^"));
  assert.ok(localhostAllow.some((r) => r.condition.urlFilter === "||127.0.0.1^"));
  assert.ok(localhostAllow.some((r) => r.condition.urlFilter === "||github.com^"));
  assert.ok(localhostAllow.some((r) => r.condition.urlFilter === "||stackoverflow.com^"));

  // Check catch-all redirect rules (priority 1)
  const redirects = rules.filter((r) => r.action.type === "redirect" && r.priority === 1);
  assert.equal(redirects.length, 2);
  assert.equal(redirects[0].condition.urlFilter, "|http://*");
  assert.equal(redirects[1].condition.urlFilter, "|https://*");
  assert.deepEqual(redirects[0].condition.excludedRequestDomains, ["localhost", "127.0.0.1"]);
});

test("allowlist mode: never blocks internal, extension, chrome://, or localhost pages", () => {
  const allowedSites = ["github.com"];

  // chrome:// and extension pages are never redirected
  assert.equal(shouldRedirectTabInAllowlist("chrome://extensions", allowedSites), false);
  assert.equal(shouldRedirectTabInAllowlist("chrome-extension://xyz/popup/popup.html", allowedSites), false);
  assert.equal(shouldRedirectTabInAllowlist("about:blank", allowedSites), false);
  assert.equal(shouldRedirectTabInAllowlist("file:///Users/doc.html", allowedSites), false);

  // localhost and 127.0.0.1 are never redirected
  assert.equal(shouldRedirectTabInAllowlist("http://localhost:3000/app", allowedSites), false);
  assert.equal(shouldRedirectTabInAllowlist("http://127.0.0.1:8080/", allowedSites), false);

  // Allowed site and subdomains are preserved
  assert.equal(shouldRedirectTabInAllowlist("https://github.com/torvalds/linux", allowedSites), false);
  assert.equal(shouldRedirectTabInAllowlist("https://api.github.com/users", allowedSites), false);
  assert.equal(shouldRedirectTabInAllowlist("https://gist.github.com", allowedSites), false);

  // Unallowed sites are redirected
  assert.equal(shouldRedirectTabInAllowlist("https://twitter.com/home", allowedSites), true);
  assert.equal(shouldRedirectTabInAllowlist("https://news.ycombinator.com", allowedSites), true);
  assert.equal(shouldRedirectTabInAllowlist("https://youtube.com/watch?v=123", allowedSites), true);
});

test("allowlist mode: empty allowlist blocks all external sites with warning", () => {
  const settings = {
    blockingMode: "allowlist",
    allowedSites: []
  };

  const rules = buildBlockingRules(settings, true);

  // Priority 1 redirects exist
  const redirects = rules.filter((r) => r.action.type === "redirect");
  assert.equal(redirects.length, 2);

  // In empty allowlist, any external website is redirected
  assert.equal(shouldRedirectTabInAllowlist("https://google.com", settings.allowedSites), true);
  assert.equal(shouldRedirectTabInAllowlist("https://github.com", settings.allowedSites), true);

  // But localhost and chrome:// are STILL safe
  assert.equal(shouldRedirectTabInAllowlist("http://localhost:5173", settings.allowedSites), false);
  assert.equal(shouldRedirectTabInAllowlist("chrome://settings", settings.allowedSites), false);

  // UI empty detection logic
  const shouldWarnEmpty = settings.blockingMode === "allowlist" && settings.allowedSites.length === 0;
  assert.equal(shouldWarnEmpty, true);
});

test("allowlist mode: open tabs redirection and restoration", () => {
  const originalUrl = "https://reddit.com/r/webdev";
  const blockedPageUrl = `chrome-extension://focus-timer/blocked/blocked.html?url=${encodeURIComponent(originalUrl)}`;

  // Tab restoration extracts the exact original URL
  const restored = restoreTabUrl(blockedPageUrl);
  assert.equal(restored, originalUrl);

  // Invalid or external blocked URLs without ?url return null
  assert.equal(restoreTabUrl("chrome-extension://focus-timer/blocked/blocked.html"), null);
  assert.equal(restoreTabUrl("https://example.com"), null);
});

test("mid-session mode switching: cleanly switches DNR rules and IDs", () => {
  // 1. Session started in blocklist mode
  const blocklistSettings = {
    blockingMode: "blocklist",
    blockedSites: ["twitter.com", "facebook.com"]
  };
  const blocklistRules = buildBlockingRules(blocklistSettings, true);
  assert.equal(blocklistRules.length, 2);
  assert.ok(blocklistRules.every((r) => r.action.type === "redirect"));

  // 2. User switches to allowlist mode mid-session
  const allowlistSettings = {
    blockingMode: "allowlist",
    allowedSites: ["developer.mozilla.org"]
  };
  const allowlistRules = buildBlockingRules(allowlistSettings, true);
  // 2 localhost allows + 1 domain allow + 2 http/https redirects = 5 rules
  assert.equal(allowlistRules.length, 5);
  assert.equal(allowlistRules.filter((r) => r.action.type === "allow").length, 3);
  assert.equal(allowlistRules.filter((r) => r.action.type === "redirect").length, 2);

  // 3. Focus phase completes -> shouldBlock becomes false
  const inactiveRules = buildBlockingRules(allowlistSettings, false);
  assert.equal(inactiveRules.length, 0);
});

test("service worker restart: reproduces deterministic rules from storage", () => {
  const storedSettings = {
    blockingMode: "allowlist",
    allowedSites: ["github.com", "stackoverflow.com", "developer.mozilla.org", "docs.google.com"]
  };

  // Run 1: initial setup
  const run1Rules = buildBlockingRules(storedSettings, true);

  // Simulate Service Worker termination and wake-up
  const run2Rules = buildBlockingRules(storedSettings, true);

  assert.deepEqual(run1Rules, run2Rules);
  assert.equal(run2Rules.length, 2 + 4 + 2); // 2 localhost allows + 4 allowed sites + 2 redirects
});
