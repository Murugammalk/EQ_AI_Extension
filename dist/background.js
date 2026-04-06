// ============================================================
//  EQ of AI — background.js v5
//  All detection goes to AI backend — no client regex
// ============================================================
importScripts("config.js");

let isRefreshing = false;
let refreshQueue = [];
let actionHistory = [];
const MAX_HISTORY = 50;

chrome.runtime.onInstalled.addListener(() => {
  validateSession();
  loadHistory();
});
chrome.runtime.onStartup.addListener(() => {
  validateSession();
  loadHistory();
});

function loadHistory() {
  chrome.storage.local.get("actionHistory", (r) => {
    if (Array.isArray(r.actionHistory)) actionHistory = r.actionHistory;
  });
}
function saveHistory() {
  chrome.storage.local.set({
    actionHistory: actionHistory.slice(0, MAX_HISTORY),
  });
}

// ── Session validation ────────────────────────────────────────
async function validateSession() {
  try {
    const res = await fetch(ENDPOINTS.validate, {
      method: "GET",
      credentials: "include",
    });
    if (res.ok) return;
    if (res.status === 401) {
      const stored = await new Promise((r) =>
        chrome.storage.local.get(["user_email"], r),
      );
      if (stored.user_email) {
        const rr = await fetch(ENDPOINTS.refresh, {
          method: "POST",
          credentials: "include",
        });
        if (!rr.ok) {
          chrome.storage.local.remove(["user_email", "user_name"]);
          chrome.runtime.sendMessage({ type: "AUTH_EXPIRED" }).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.warn("[EQ] offline:", e.message);
  }
}

// ── Auth-aware fetch with token refresh ───────────────────────
async function authFetch(url, opts = {}) {
  const o = { ...opts, credentials: "include" };
  let res = await fetch(url, o);
  if (res.status !== 401) return res;
  if (isRefreshing)
    return new Promise((rv, rj) => refreshQueue.push({ url, o, rv, rj }));
  isRefreshing = true;
  try {
    const rr = await fetch(ENDPOINTS.refresh, {
      method: "POST",
      credentials: "include",
    });
    if (!rr.ok) throw new Error("refresh:" + rr.status);
    res = await fetch(url, o);
    refreshQueue.forEach(({ url: u, o: op, rv, rj }) =>
      fetch(u, op).then(rv).catch(rj),
    );
  } catch (err) {
    refreshQueue.forEach(({ rj }) => rj(err));
    chrome.storage.local.remove(["user_email", "user_name"]);
    chrome.runtime.sendMessage({ type: "AUTH_EXPIRED" }).catch(() => {});
  } finally {
    isRefreshing = false;
    refreshQueue = [];
  }
  return res;
}

async function fetchWithRetry(url, opts, tries = 2, delay = 800) {
  for (let i = 0; i <= tries; i++) {
    try {
      return await authFetch(url, opts);
    } catch (err) {
      if (i === tries) throw err;
      await new Promise((r) => setTimeout(r, delay * (i + 1)));
    }
  }
}

// ── Browser info ─────────────────────────────────────────────
function getBrowser() {
  const ua = navigator.userAgent;
  return {
    name: ua.includes("Edg")
      ? "Edge"
      : ua.includes("Chrome")
        ? "Chrome"
        : ua.includes("Firefox")
          ? "Firefox"
          : ua.includes("Safari") && !ua.includes("Chrome")
            ? "Safari"
            : "Unknown",
    platform: navigator.platform,
    version:
      (ua.match(/(?:Chrome|Edg|Firefox|Safari)\/([0-9.]+)/) || [])[1] || "?",
  };
}

// ── Date helpers ──────────────────────────────────────────────
function getToday() {
  return new Date().toLocaleDateString("en-CA");
}

// ── Category toggles from Shield tab ─────────────────────────
async function getDisabledCategories() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["personal", "financial", "medical"], (r) => {
      const d = [];
      if (r.personal === false) d.push("personal");
      if (r.financial === false) d.push("financial");
      if (r.medical === false) d.push("medical");
      resolve(d);
    });
  });
}

// ── Exposure data ─────────────────────────────────────────────
async function getExposureData() {
  const defaults = [
    { label: "Financial", percentage: 0 },
    { label: "Personal", percentage: 0 },
    { label: "Medical", percentage: 0 },
    { label: "Organizational", percentage: 0 },
  ];
  return new Promise((resolve) => {
    chrome.storage.local.get(["exposureData", "exposureDate"], (r) => {
      const today = getToday();
      if (!r.exposureDate || r.exposureDate !== today) return resolve(defaults);
      if (!r.exposureData) return resolve(defaults);
      try {
        resolve(JSON.parse(r.exposureData));
      } catch {
        resolve(defaults);
      }
    });
  });
}

// ── Category resolver ─────────────────────────────────────────
function resolveCategory(category, type) {
  const c = (category || "").toLowerCase();
  const t = (type || "").toLowerCase();
  const s = c + " " + t;
  if (
    [
      "financial",
      "card",
      "credit",
      "debit",
      "bank",
      "upi",
      "ifsc",
      "gst",
      "swift",
      "iban",
      "pan",
      "account",
      "currency",
      "pancard",
    ].some((k) => s.includes(k))
  )
    return "Financial";
  if (
    [
      "medical",
      "health",
      "drug",
      "blood",
      "medicine",
      "diagnosis",
      "condition",
      "ndc",
    ].some((k) => s.includes(k))
  )
    return "Medical";
  if (
    [
      "ip",
      "ipv4",
      "ipv6",
      "mac",
      "api",
      "token",
      "key",
      "aws",
      "slack",
      "github",
      "stripe",
      "network",
      "org",
      "organizational",
    ].some((k) => s.includes(k))
  )
    return "Organizational";
  return "Personal";
}

// ── Update exposure bars ──────────────────────────────────────
function updateExposure(action, category, type, score) {
  chrome.storage.local.get(["exposureData", "exposureDate"], (r) => {
    const today = getToday();
    const defaults = [
      { label: "Financial", percentage: 0 },
      { label: "Personal", percentage: 0 },
      { label: "Medical", percentage: 0 },
      { label: "Organizational", percentage: 0 },
    ];
    let data = defaults;
    if (r.exposureDate === today && r.exposureData) {
      try {
        data = JSON.parse(r.exposureData);
      } catch {
        data = defaults;
      }
    }
    const label = resolveCategory(category, type);
    const delta = Math.min(12, Math.max(3, Math.round((score || 5) * 1.2)));
    data = data.map((item) => {
      if (item.label !== label) return item;
      let pct = item.percentage;
      if (action === "detected") pct = Math.min(100, pct + delta);
      else if (action === "ignored")
        pct = Math.min(100, pct + Math.round(delta / 3));
      else pct = Math.max(0, pct - Math.round(delta / 2));
      return { ...item, percentage: Math.round(pct) };
    });
    chrome.storage.local.set(
      { exposureData: JSON.stringify(data), exposureDate: today },
      () =>
        chrome.runtime
          .sendMessage({ type: "exposureUpdate", data })
          .catch(() => {}),
    );
  });
}

// ── Risk counts — 1 per unique value per day ──────────────────
function updateRiskCounts(detections) {
  const today = getToday();
  chrome.storage.local.get(["riskCounts", "riskDate", "riskTracked"], (r) => {
    const isToday = r.riskDate === today;
    let counts =
      isToday && r.riskCounts ? r.riskCounts : { high: 0, medium: 0, low: 0 };
    let tracked = isToday && r.riskTracked ? r.riskTracked : [];
    let changed = false;
    detections.forEach((d) => {
      const key = `${(d.type || "?").toLowerCase()}:${(d.value || "").substring(0, 40)}`;
      if (tracked.includes(key)) return;
      tracked.push(key);
      changed = true;
      const lv = (d.risk_level || "medium").toLowerCase();
      if (lv === "high") counts.high++;
      else if (lv === "low") counts.low++;
      else counts.medium++;
    });
    if (!changed) return;
    const score = Math.min(
      100,
      counts.high * 20 + counts.medium * 8 + counts.low * 3,
    );
    chrome.storage.local.set(
      { riskCounts: counts, riskDate: today, riskTracked: tracked },
      () =>
        chrome.runtime
          .sendMessage({ type: "riskCountsUpdate", data: counts, score })
          .catch(() => {}),
    );
  });
}

// ── Daily score history ───────────────────────────────────────
const TYPES = [
  "Financial",
  "Personal",
  "Medical",
  "Organizational",
  "Network",
  "Travel",
  "Technical",
];
function saveDailyScore(data_type, score, action) {
  if (!TYPES.includes(data_type)) return;
  const today = getToday();
  chrome.storage.local.get("dailyScores", (r) => {
    const all = r.dailyScores || {};
    if (!all[today]) all[today] = Object.fromEntries(TYPES.map((t) => [t, []]));
    if (!Array.isArray(all[today][data_type])) all[today][data_type] = [];
    all[today][data_type].push({
      score: parseInt(score) || 5,
      action,
      ts: Date.now(),
    });
    const keys = Object.keys(all).sort().slice(-30);
    chrome.storage.local.set({
      dailyScores: Object.fromEntries(keys.map((k) => [k, all[k]])),
    });
  });
}

// ── Message handler ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    // ── Detection — send ALL text straight to AI ──────────────
    if (msg.type === "BLUR_EVENT") {
      const { websiteDomain, input: userInput } = msg.payload;
      const [disabled_categories, exposureData] = await Promise.all([
        getDisabledCategories(),
        getExposureData(),
      ]);
      try {
        const res = await fetchWithRetry(ENDPOINTS.aiValidate, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: userInput,
            websiteDomain,
            exposureData,
            disabled_categories,
            browserDetails: getBrowser(),
            // No hintCategories — AI decides everything
          }),
        });

        if (!res?.ok) {
          console.warn("[EQ] aiValidate:", res?.status);
          return;
        }

        const { tracking_id, data } = await res.json();
        if (!Array.isArray(data) || !data.length) return;

        // Update risk counts
        updateRiskCounts(data);

        // Update exposure immediately on detection
        data.forEach((d) => {
          updateExposure("detected", d.category, d.type, d.score || 5);
        });

        if (websiteDomain) chrome.storage.local.set({ websiteDomain });

        // Send alert to content.js
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs?.length) return;
          chrome.tabs
            .sendMessage(tabs[0].id, {
              type: "SHOW_ALERT",
              sensitiveData: data,
              tracking_id,
            })
            .catch(() => {});
        });
      } catch (err) {
        console.error("[EQ] BLUR_EVENT:", err);
      }
    }

    // ── User action (Replace/Mask/Remove/Allow) ───────────────
    if (msg.type === "USER_ACTION") {
      const { action, metadata, tracking_id } = msg;
      const rawType = metadata.data_type || "";
      const data_type =
        rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();

      updateExposure(
        action,
        data_type,
        metadata.type || "",
        parseInt(metadata.score) || 5,
      );
      saveDailyScore(data_type, metadata.score, action);

      const entry = {
        action,
        data_type,
        score: metadata.score,
        value: metadata.value,
        ts: Date.now(),
      };
      actionHistory.unshift(entry);
      if (actionHistory.length > MAX_HISTORY) actionHistory.pop();
      saveHistory();

      chrome.runtime
        .sendMessage({
          type: "actionHistoryUpdate",
          data: actionHistory.slice(0, 20),
        })
        .catch(() => {});

      fetchWithRetry(ENDPOINTS.aiAction, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracking_id,
          action,
          metadata,
          domain: sender?.url,
        }),
      }).catch((err) => console.error("[EQ] action:", err));
    }

    // ── Weekly feedback ───────────────────────────────────────
    if (msg.type === "WEEKLY_FEEDBACK") {
      const { msg: message, rating, tracking_id } = msg;
      chrome.storage.local.get("user_email", (r) => {
        fetchWithRetry(ENDPOINTS.feedback, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_email: r.user_email || "",
            message,
            rating: parseInt(rating),
            tracking_id,
          }),
        }).catch((err) => console.error("[EQ] feedback:", err));
      });
    }

    // ── Dashboard stats ───────────────────────────────────────
    if (msg.type === "GET_STATS") {
      sendResponse({ history: actionHistory.slice(0, 20) });
    }
  })();
  return true;
});
