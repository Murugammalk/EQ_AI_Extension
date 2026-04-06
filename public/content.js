// ============================================================
//  EQ of AI — content.js v6
//  Fixes: posCard RAF, shadow DOM submit hooks, banner
//  positioning, only-masked regex, zero-width char strip,
//  free-limit banner, card open guard during actioning
// ============================================================
"use strict";

const EQ_DEBOUNCE = 1200; // ms after user stops typing
const EQ_SESSION = 5 * 60 * 1000; // 5-min dedup window
const EQ_MIN_LEN = 4; // minimum chars before sending to backend

// ── Platform map ──────────────────────────────────────────────
const PLATFORMS = {
  "chatgpt.com": {
    fields: ["#prompt-textarea", 'div[contenteditable="true"]'],
    submit: [
      'button[data-testid="send-button"]',
      'button[aria-label="Send prompt"]',
    ],
    name: "ChatGPT",
  },
  "claude.ai": {
    fields: [
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"]',
    ],
    submit: [
      'button[aria-label="Send message"]',
      'button[data-testid="send-button"]',
    ],
    name: "Claude",
  },
  "gemini.google.com": {
    fields: [".ql-editor", 'div[contenteditable="true"]'],
    submit: [".send-button", 'button[aria-label="Send message"]'],
    name: "Gemini",
  },
  "copilot.microsoft.com": {
    fields: ["#userInput", "textarea", 'div[contenteditable="true"]'],
    submit: ['button[aria-label="Submit"]', 'button[type="submit"]'],
    name: "Copilot",
  },
  "perplexity.ai": {
    fields: ["textarea", 'div[contenteditable="true"]'],
    submit: ['button[aria-label="Submit"]', 'button[type="submit"]'],
    name: "Perplexity",
  },
  "grok.com": {
    fields: ["textarea", 'div[contenteditable="true"]'],
    submit: ['button[type="submit"]'],
    name: "Grok",
  },
  "poe.com": {
    fields: ["textarea"],
    submit: ['button[type="submit"]'],
    name: "Poe",
  },
};

const HOSTNAME = location.hostname.replace("www.", "");
const PLATFORM = Object.keys(PLATFORMS).find((k) => HOSTNAME.includes(k));
const PLATFORM_CFG = PLATFORM ? PLATFORMS[PLATFORM] : null;

// ── Dedup ─────────────────────────────────────────────────────
const seenValues = new Map();
const actionedValues = new Set();
// Values WE injected as replacements — never flag these as sensitive
const injectedValues = new Set();
let sessionTimer = null;

function isAlreadySeen(v) {
  if (!v) return false;
  if (actionedValues.has(v)) return true;
  if (injectedValues.has(v)) return true; // ← our own replacement — skip
  const e = seenValues.get(v);
  if (!e) return false;
  if (Date.now() - e.ts > EQ_SESSION) {
    seenValues.delete(v);
    return false;
  }
  return true;
}
function markSeen(v) {
  if (v) {
    seenValues.set(v, { ts: Date.now() });
    _ttl();
  }
}
function markActioned(v) {
  if (v) {
    actionedValues.add(v);
    seenValues.delete(v);
  }
}
function markInjected(v) {
  if (v) {
    injectedValues.add(v);
  }
} // ← new
function _ttl() {
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => seenValues.clear(), EQ_SESSION);
}

// ── Per-field state ───────────────────────────────────────────
let isActioning = false;
let activeCard = null;

const fieldTimers = new WeakMap(); // debounce timer per field
const fieldLastTx = new WeakMap(); // last sent text per field
const fieldIconEl = new WeakMap(); // EQ icon element per field
const fieldPending = new WeakMap(); // pending detections per field
const hookedBtns = new WeakSet(); // submit buttons already hooked

// ── Theme ─────────────────────────────────────────────────────
const isDark = () => window.matchMedia?.("(prefers-color-scheme:dark)").matches;

function injectStyles() {
  document.getElementById("eq-v6-style")?.remove();
  const d = isDark();
  const bg = d ? "#141419" : "#ffffff";
  const bg2 = d ? "#1c1c26" : "#f5f5f8";
  const t1 = d ? "#f0ecff" : "#0d0d18";
  const t2 = d ? "rgba(240,236,255,.5)" : "rgba(13,13,24,.45)";
  const sep = d ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.07)";
  const sh = d
    ? "0 0 0 1px rgba(255,255,255,.08),0 16px 48px rgba(0,0,0,.8)"
    : "0 0 0 1px rgba(0,0,0,.1),0 8px 32px rgba(0,0,0,.15)";

  const css = `
.eq6-icon{position:fixed;width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#e63946,#b52d38);border:2px solid rgba(255,255,255,.22);cursor:pointer;z-index:2147483640;display:flex;align-items:center;justify-content:center;font-family:-apple-system,sans-serif;font-size:8.5px;font-weight:900;color:#fff;letter-spacing:-.3px;box-shadow:0 2px 12px rgba(230,57,70,.55),0 0 0 5px rgba(230,57,70,.1);transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;user-select:none;animation:eq6-icon-pop .25s cubic-bezier(.34,1.56,.64,1) forwards}
.eq6-icon:hover{transform:scale(1.2);box-shadow:0 4px 20px rgba(230,57,70,.7),0 0 0 7px rgba(230,57,70,.08)}
.eq6-count{position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;border-radius:99px;padding:0 3px;background:#f5c842;color:#0a0a0f;font-size:8px;font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid ${bg};font-family:-apple-system,sans-serif}

/* Block banner */
.eq6-block{position:fixed;z-index:2147483646;background:${d ? "#1a0e10" : "#fff5f6"};border:1.5px solid rgba(230,57,70,.45);border-left:4px solid #e63946;border-radius:10px;padding:12px 14px;display:flex;align-items:flex-start;gap:10px;box-shadow:0 6px 24px rgba(230,57,70,.2);font-family:-apple-system,sans-serif;max-width:380px;animation:eq6-in .18s cubic-bezier(.34,1.1,.64,1) forwards}
.eq6-block-icon{font-size:18px;flex-shrink:0;margin-top:1px}
.eq6-block-body{flex:1}
.eq6-block-title{font-size:13px;font-weight:700;color:${d ? "#fca5a5" : "#9b1c1c"};margin-bottom:2px}
.eq6-block-sub{font-size:11.5px;color:${d ? "rgba(252,165,165,.7)" : "rgba(155,28,28,.7)"};line-height:1.4}
.eq6-block-btns{display:flex;gap:6px;margin-top:8px}
.eq6-block-review{padding:6px 14px;border-radius:7px;background:#e63946;color:#fff;border:none;cursor:pointer;font-size:11.5px;font-weight:700;font-family:-apple-system,sans-serif;transition:opacity .12s}
.eq6-block-review:hover{opacity:.85}
.eq6-block-send{padding:6px 12px;border-radius:7px;background:transparent;color:${t2};border:1px solid ${sep};cursor:pointer;font-size:11.5px;font-weight:600;font-family:-apple-system,sans-serif;transition:all .12s}
.eq6-block-send:hover{background:rgba(${d ? "255,255,255,.06" : "0,0,0,.05"})}

/* Upgrade / limit banner */
.eq6-upgrade{position:fixed;z-index:2147483646;background:${d ? "#0e1a14" : "#f0fff4"};border:1.5px solid rgba(52,211,153,.45);border-left:4px solid #34d399;border-radius:10px;padding:12px 14px;display:flex;align-items:flex-start;gap:10px;box-shadow:0 6px 24px rgba(52,211,153,.15);font-family:-apple-system,sans-serif;max-width:380px;animation:eq6-in .18s cubic-bezier(.34,1.1,.64,1) forwards;bottom:80px;right:16px}
.eq6-upgrade-title{font-size:13px;font-weight:700;color:${d ? "#6ee7b7" : "#065f46"};margin-bottom:2px}
.eq6-upgrade-sub{font-size:11.5px;color:${d ? "rgba(110,231,183,.7)" : "rgba(6,95,70,.7)"};line-height:1.4}
.eq6-upgrade-btn{display:inline-block;margin-top:8px;padding:6px 14px;border-radius:7px;background:#34d399;color:#064e3b;border:none;cursor:pointer;font-size:11.5px;font-weight:700;font-family:-apple-system,sans-serif;text-decoration:none}

/* Card popup */
#eq6-card{position:fixed;z-index:2147483647;width:288px;background:${bg};border-radius:14px;box-shadow:${sh};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;animation:eq6-in .2s cubic-bezier(.34,1.15,.64,1) forwards}
#eq6-card.eq6-closing{animation:eq6-out .15s ease-in forwards;pointer-events:none}
.eq6-bar{height:3.5px;background:linear-gradient(90deg,#e63946,#c8450f,#f5c842)}
.eq6-head{display:flex;align-items:center;gap:10px;padding:11px 13px 9px;border-bottom:1px solid ${sep};background:${d ? "rgba(230,57,70,.04)" : "rgba(230,57,70,.025)"}}
.eq6-logo{width:30px;height:30px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#e63946,#b52d38);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:#fff;box-shadow:0 2px 8px rgba(230,57,70,.4)}
.eq6-title{flex:1;min-width:0}
.eq6-val{display:block;font-size:13px;font-weight:700;color:${t1};font-family:'SF Mono','Menlo','Consolas',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.3px}
.eq6-meta{display:flex;align-items:center;gap:5px;margin-top:2px}
.eq6-type{font-size:9.5px;color:${t2};text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.eq6-risk{font-size:9px;font-weight:800;padding:1.5px 7px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px}
.eq6-badge-src{font-size:8px;font-weight:700;padding:1.5px 5px;border-radius:4px;background:${d ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"};color:${t2};text-transform:uppercase;letter-spacing:.3px}
.eq6-x{width:22px;height:22px;border-radius:50%;background:${d ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)"};border:none;cursor:pointer;color:${t2};font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .12s}
.eq6-x:hover{background:${d ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.1)"};color:${t1}}
.eq6-preview{margin:9px 12px 2px;padding:8px 11px;background:${bg2};border:1px solid ${sep};border-radius:9px;display:flex;align-items:center;gap:7px}
.eq6-prev-lbl{font-size:9px;font-weight:700;color:${t2};text-transform:uppercase;letter-spacing:.5px;flex-shrink:0}
.eq6-prev-val{font-family:'SF Mono','Menlo','Consolas',monospace;font-size:12px;font-weight:600;color:#34d399;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.eq6-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px 10px 10px}
.eq6-btn{display:flex;align-items:center;gap:8px;padding:10px 11px;border-radius:10px;border:1px solid ${sep};background:${d ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.018)"};cursor:pointer;transition:all .13s;font-family:-apple-system,sans-serif;text-align:left}
.eq6-btn:hover{transform:translateY(-1px)}
.eq6-btn:active{transform:scale(.97)}
.eq6-btn-icon{font-size:17px;line-height:1;flex-shrink:0}
.eq6-btn-body{display:flex;flex-direction:column;gap:1px}
.eq6-btn-label{font-size:11.5px;font-weight:700;color:${t1};line-height:1.2}
.eq6-btn-hint{font-size:9.5px;color:${t2};line-height:1.3}
.eq6-btn.r{border-color:rgba(99,102,241,.22)}.eq6-btn.r:hover{background:rgba(99,102,241,.09);border-color:rgba(99,102,241,.45)}
.eq6-btn.m{border-color:rgba(96,165,250,.22)}.eq6-btn.m:hover{background:rgba(96,165,250,.09);border-color:rgba(96,165,250,.45)}
.eq6-btn.d{border-color:rgba(248,113,113,.22)}.eq6-btn.d:hover{background:rgba(248,113,113,.09);border-color:rgba(248,113,113,.45)}
.eq6-btn.a{border-color:rgba(52,211,153,.22)}.eq6-btn.a:hover{background:rgba(52,211,153,.09);border-color:rgba(52,211,153,.45)}
.eq6-more{display:flex;justify-content:space-between;align-items:center;padding:0 12px 10px}
.eq6-more-txt{font-size:10px;color:${t2}}
.eq6-more-btn{font-size:10.5px;font-weight:700;color:#e63946;background:none;border:none;cursor:pointer;font-family:-apple-system,sans-serif;padding:0;transition:opacity .12s}
.eq6-more-btn:hover{opacity:.7}
.eq6-toast{position:fixed;bottom:22px;right:16px;z-index:2147483647;background:${bg};border:1px solid ${sep};border-left:3px solid #e63946;border-radius:11px;padding:11px 14px;display:flex;align-items:center;gap:10px;box-shadow:${sh};font-family:-apple-system,sans-serif;font-size:12px;font-weight:500;color:${t1};animation:eq6-in .2s ease forwards}
.eq6-toast-btn{padding:5px 12px;border-radius:7px;border:1px solid ${sep};background:transparent;cursor:pointer;font-size:16px;transition:all .12s}
.eq6-toast-btn:hover{background:rgba(${d ? "255,255,255,.08" : "0,0,0,.05"});transform:scale(1.1)}
@keyframes eq6-icon-pop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes eq6-in{from{opacity:0;transform:translateY(8px) scale(.95)}to{opacity:1;transform:none}}
@keyframes eq6-out{from{opacity:1;transform:none}to{opacity:0;transform:translateY(8px) scale(.95)}}
@keyframes eq6-fade{to{opacity:0}}
@media(prefers-reduced-motion:reduce){#eq6-card,.eq6-icon,.eq6-block,.eq6-upgrade{animation:none!important}}
`;
  const el = document.createElement("style");
  el.id = "eq-v6-style";
  el.textContent = css;
  (document.head || document.documentElement).appendChild(el);
}

injectStyles();
window
  .matchMedia?.("(prefers-color-scheme:dark)")
  .addEventListener("change", injectStyles);

// ── DOM utils ─────────────────────────────────────────────────
function getFieldText(el) {
  if (!el) return "";
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return el.value;
  if (el.isContentEditable) return el.innerText;
  return "";
}

function setFieldText(el, text) {
  isActioning = true;
  try {
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      const proto =
        el.tagName === "INPUT"
          ? window.HTMLInputElement.prototype
          : window.HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(el, text);
      else el.value = text;
    } else if (el.isContentEditable) {
      el.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } finally {
    setTimeout(() => {
      isActioning = false;
    }, 300);
  }
}

function isInputEl(el) {
  if (!el) return false;
  const t = el.tagName?.toLowerCase();
  if (t === "textarea") return true;
  if (t === "input")
    return [
      "text",
      "search",
      "email",
      "url",
      "tel",
      "number",
      "password",
    ].includes((el.type || "text").toLowerCase());
  return !!el.isContentEditable;
}

// Walks both regular DOM and shadow roots
function allInputs() {
  const out = [];
  const walk = (root) => {
    root
      .querySelectorAll('input,textarea,[contenteditable="true"]')
      .forEach((el) => {
        if (isInputEl(el)) out.push(el);
      });
    root.querySelectorAll("*").forEach((el) => {
      if (el.shadowRoot) walk(el.shadowRoot);
    });
  };
  walk(document);
  return out;
}

// Queries including shadow DOM (for submit buttons on ChatGPT etc.)
function queryAllIncludingShadow(selectors) {
  const results = [];
  const walk = (root) => {
    selectors.forEach((sel) => {
      root.querySelectorAll(sel).forEach((el) => results.push(el));
    });
    root.querySelectorAll("*").forEach((el) => {
      if (el.shadowRoot) walk(el.shadowRoot);
    });
  };
  walk(document);
  return results;
}

function riskBadge(score) {
  if (score >= 8)
    return { bg: "rgba(248,113,113,.14)", col: "#f87171", lbl: "HIGH" };
  if (score >= 5)
    return { bg: "rgba(251,191,36,.14)", col: "#fbbf24", lbl: "MED" };
  return { bg: "rgba(52,211,153,.14)", col: "#34d399", lbl: "LOW" };
}

// ── Smart mask fallback ───────────────────────────────────────
function smartMask(value, type) {
  const v = (value || "").trim();
  const t = (type || "").toLowerCase();
  if (!v) return "****";
  if (t.includes("email") || v.includes("@")) {
    const [u, dom] = v.split("@");
    if (dom)
      return (u[0] || "*") + "*".repeat(Math.max(1, u.length - 1)) + "@" + dom;
  }
  if (t.includes("phone") || t.includes("mobile"))
    return v.slice(0, 2) + "*".repeat(Math.max(0, v.length - 4)) + v.slice(-2);
  if (t.includes("card") || t.includes("credit"))
    return "**** **** **** " + v.replace(/\D/g, "").slice(-4);
  if (v.length <= 4) return "*".repeat(v.length);
  return v[0] + "*".repeat(Math.max(1, v.length - 2)) + v.slice(-1);
}

// ── Local replacement fallback ────────────────────────────────
function localReplace(value, type) {
  const v = (value || "").trim();
  const t = (type || "").toLowerCase();
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rnd = (n) =>
    Math.floor(Math.random() * Math.pow(10, n))
      .toString()
      .padStart(n, "0");
  const rndL = (n) =>
    Array.from(
      { length: n },
      () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)],
    ).join("");
  const FIRST = [
    "Suresh",
    "Rajesh",
    "Priya",
    "Amit",
    "Kavitha",
    "Ravi",
    "Vijay",
    "Anita",
    "Mohan",
    "Sneha",
  ];
  const LAST = [
    "Kumar",
    "Sharma",
    "Patel",
    "Singh",
    "Rao",
    "Nair",
    "Reddy",
    "Gupta",
    "Joshi",
    "Shah",
  ];

  if (t.includes("email") || v.includes("@"))
    return `${pick(["suresh", "priya", "amit", "user"])}${rnd(3)}@${pick(["example.com", "sample.org", "test.net"])}`;
  if (t.includes("phone") || t.includes("mobile") || t.includes("phone_number"))
    return pick(["91", "98", "87", "76", "94"]) + rnd(8);
  if (
    t.includes("person") ||
    t.includes("name") ||
    t === "word" ||
    t === "multi_word"
  )
    return v.includes(" ") ? `${pick(FIRST)} ${pick(LAST)}` : pick(FIRST);
  if (t.includes("voter")) return rndL(3) + rnd(7);
  if (t.includes("aadhaar") || t.includes("aadhar") || t.includes("in_aadhaar"))
    return `${rnd(4)} ${rnd(4)} ${rnd(4)}`;
  if (t.includes("pan") || t.includes("in_pan"))
    return rndL(5) + rnd(4) + rndL(1);
  if (t.includes("passport")) return rndL(1) + rnd(7);
  if (t.includes("card") || t.includes("credit"))
    return `5299 ${rnd(4)} ${rnd(4)} ${rnd(4)}`;
  if (t.includes("ip_address") || t.includes("ipv4"))
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`;
  if (t.includes("upi"))
    return `${pick(["suresh", "priya", "amit"])}@${pick(["okicici", "ybl", "oksbi"])}`;
  if (t.includes("ssn") || t.includes("us_ssn"))
    return `${rnd(3)}-${rnd(2)}-${rnd(4)}`;
  // Generic: shuffle chars
  return v
    .replace(/[a-zA-Z]/g, () => rndL(1))
    .replace(/[0-9]/g, () => Math.floor(Math.random() * 10));
}

// Validate backend dummy_replacement — reject garbage
function getReplace(d) {
  const br = d.dummy_replacement || "";
  const bad =
    !br ||
    br === d.value ||
    br.trim() === "" ||
    ["REDACTED", "XXX", "TOKEN", "PLACEHOLDER", "EXAMPLE"].some((x) =>
      br.toUpperCase().includes(x),
    ) ||
    br.startsWith("[");
  return bad ? localReplace(d.value, d.type) : br;
}

// ── Field icon ─────────────────────────────────────────────────
function placeIcon(field, dets, tid) {
  removeIcon(field);
  const icon = document.createElement("div");
  icon.className = "eq6-icon";
  icon.textContent = "EQ";
  icon.title = `EQ: ${dets.length} sensitive item${dets.length > 1 ? "s" : ""} — click to protect`;

  if (dets.length > 1) {
    const badge = document.createElement("span");
    badge.className = "eq6-count";
    badge.textContent = dets.length;
    icon.appendChild(badge);
  }

  const pos = () => {
    if (!document.contains(field)) {
      removeIcon(field);
      return;
    }
    const r = field.getBoundingClientRect();
    icon.style.bottom = `${window.innerHeight - r.bottom + 6}px`;
    icon.style.right = `${window.innerWidth - r.right + 6}px`;
  };
  pos();
  document.body.appendChild(icon);
  fieldIconEl.set(field, icon);

  const onSR = () => pos();
  window.addEventListener("scroll", onSR, { passive: true });
  window.addEventListener("resize", onSR, { passive: true });
  icon._off = () => {
    window.removeEventListener("scroll", onSR);
    window.removeEventListener("resize", onSR);
  };
  icon._timer = setTimeout(() => removeIcon(field), 120_000);
  icon.addEventListener("click", (e) => {
    e.stopPropagation();
    openCard(dets, 0, tid, field, icon);
  });
}

function removeIcon(field) {
  const icon = fieldIconEl.get(field);
  if (icon) {
    clearTimeout(icon._timer);
    icon._off?.();
    icon.remove();
    fieldIconEl.delete(field);
  }
}

// ── Submit interception ───────────────────────────────────────
function hookSubmitButtons() {
  if (!PLATFORM_CFG) return;
  // Use shadow-DOM-aware query so ChatGPT buttons are found
  const btns = queryAllIncludingShadow(PLATFORM_CFG.submit);
  btns.forEach((btn) => {
    if (hookedBtns.has(btn)) return;
    hookedBtns.add(btn);
    btn.addEventListener("click", onSubmitClick, { capture: true });
  });
}

function onSubmitClick(e) {
  const fields = allInputs();
  const field =
    fields.find(
      (f) => document.activeElement === f && getFieldText(f).trim().length > 0,
    ) || fields.find((f) => getFieldText(f).trim().length > 0);
  if (!field) return;

  const pending = fieldPending.get(field);
  if (!pending || !pending.dets.length) return;

  const unactioned = pending.dets.filter((d) => !actionedValues.has(d.value));
  if (!unactioned.length) return;

  e.preventDefault();
  e.stopImmediatePropagation();
  showBlockBanner(e.currentTarget, unactioned, pending.tid, field);
}

function showBlockBanner(btnEl, dets, tid, field) {
  document.getElementById("eq6-block-banner")?.remove();

  const banner = document.createElement("div");
  banner.id = "eq6-block-banner";
  banner.className = "eq6-block";
  banner.innerHTML = `
    <span class="eq6-block-icon">🛡</span>
    <div class="eq6-block-body">
      <div class="eq6-block-title">EQ blocked your message</div>
      <div class="eq6-block-sub">${dets.length} sensitive item${dets.length > 1 ? "s" : ""} detected. Review before sending.</div>
      <div class="eq6-block-btns">
        <button class="eq6-block-review" id="eq6-blk-rv">Review now</button>
        <button class="eq6-block-send"   id="eq6-blk-sk">Send anyway</button>
      </div>
    </div>`;

  // Add to DOM first so offsetHeight is real
  document.body.appendChild(banner);

  // NOW position (after DOM paint)
  requestAnimationFrame(() => {
    const r = btnEl.getBoundingClientRect();
    const bw = 380;
    let left = r.right - bw;
    let top = r.top - banner.offsetHeight - 10;
    if (left < 8) left = 8;
    if (top < 8) top = r.bottom + 8;
    banner.style.top = `${top}px`;
    banner.style.left = `${left}px`;
  });

  banner.querySelector("#eq6-blk-rv").onclick = () => {
    banner.remove();
    openCard(dets, 0, tid, field, fieldIconEl.get(field) || field);
  };
  banner.querySelector("#eq6-blk-sk").onclick = () => {
    banner.remove();
    dets.forEach((d) => markActioned(d.value));
    setTimeout(() => btnEl.click(), 60);
  };

  setTimeout(() => banner?.remove(), 15_000);
}

// ── Free limit banner ─────────────────────────────────────────
function showLimitBanner(message, upgradeUrl) {
  document.getElementById("eq6-limit-banner")?.remove();
  const banner = document.createElement("div");
  banner.id = "eq6-limit-banner";
  banner.className = "eq6-upgrade";
  banner.innerHTML = `
    <span style="font-size:18px;flex-shrink:0">⭐</span>
    <div>
      <div class="eq6-upgrade-title">Daily limit reached</div>
      <div class="eq6-upgrade-sub">${message}</div>
      <a class="eq6-upgrade-btn" href="${upgradeUrl}" target="_blank">Upgrade to Premium</a>
    </div>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;font-size:16px;margin-left:auto;opacity:.5">✕</button>`;
  document.body.appendChild(banner);
  setTimeout(() => banner?.remove(), 10_000);
}

// ── Card popup ────────────────────────────────────────────────
function openCard(dets, idx, tid, field, anchor) {
  // Guard: don't open card while text replacement is in progress
  if (isActioning) return;

  closeCard(true);
  const d = dets[idx];
  if (!d) return;

  const rep = getReplace(d);
  const msk = d.masked || smartMask(d.value, d.type);
  const rb = riskBadge(d.score || 5);
  const rem = dets.length - idx - 1;
  const sourceLabel = d.source ? d.source.toUpperCase() : "AI";

  const card = document.createElement("div");
  card.id = "eq6-card";
  card.innerHTML = `
    <div class="eq6-bar"></div>
    <div class="eq6-head">
      <div class="eq6-logo">EQ</div>
      <div class="eq6-title">
        <span class="eq6-val" title="${d.value}">${d.value.length > 28 ? d.value.slice(0, 28) + "…" : d.value}</span>
        <div class="eq6-meta">
          <span class="eq6-type">${d.type || d.category}</span>
          <span class="eq6-risk" style="background:${rb.bg};color:${rb.col}">${rb.lbl}</span>
          <span class="eq6-badge-src">${sourceLabel}</span>
        </div>
      </div>
      <button class="eq6-x" title="Dismiss (Esc)">✕</button>
    </div>
    <div class="eq6-preview">
      <span class="eq6-prev-lbl">Replace →</span>
      <span class="eq6-prev-val" title="${rep}">${rep}</span>
    </div>
    <div class="eq6-actions">
      <button class="eq6-btn r" id="eq6-r">
        <span class="eq6-btn-icon">🔁</span>
        <div class="eq6-btn-body"><span class="eq6-btn-label">Replace</span><span class="eq6-btn-hint">Realistic fake</span></div>
      </button>
      <button class="eq6-btn m" id="eq6-m">
        <span class="eq6-btn-icon">🔒</span>
        <div class="eq6-btn-body"><span class="eq6-btn-label">Mask</span><span class="eq6-btn-hint">${msk}</span></div>
      </button>
      <button class="eq6-btn d" id="eq6-d">
        <span class="eq6-btn-icon">✂</span>
        <div class="eq6-btn-body"><span class="eq6-btn-label">Remove</span><span class="eq6-btn-hint">Delete entirely</span></div>
      </button>
      <button class="eq6-btn a" id="eq6-a">
        <span class="eq6-btn-icon">✓</span>
        <div class="eq6-btn-body"><span class="eq6-btn-label">Allow</span><span class="eq6-btn-hint">Send as-is</span></div>
      </button>
    </div>
    ${
      rem > 0
        ? `
    <div class="eq6-more">
      <span class="eq6-more-txt">${rem} more item${rem > 1 ? "s" : ""}</span>
      <button class="eq6-more-btn" id="eq6-nxt">Next →</button>
    </div>`
        : ""
    }`;

  document.body.appendChild(card);
  activeCard = card;

  // Position AFTER DOM paint so offsetHeight is real
  requestAnimationFrame(() => posCard(card, anchor || field));

  const next = (action) => {
    if (rem > 0) {
      closeCard(true);
      openCard(dets, idx + 1, tid, field, anchor);
    } else {
      removeIcon(field);
      closeCard();
      if (action !== "ignored") showToast(d, tid);
    }
  };

  card.querySelector("#eq6-r").onclick = () => {
    applyAction("replace", d, tid, field, rep);
    next("replace");
  };
  card.querySelector("#eq6-m").onclick = () => {
    applyAction("mask", d, tid, field, msk);
    next("mask");
  };
  card.querySelector("#eq6-d").onclick = () => {
    applyAction("remove", d, tid, field, "");
    next("remove");
  };
  card.querySelector("#eq6-a").onclick = () => {
    applyAction("ignored", d, tid, field, d.value);
    next("ignored");
  };
  card.querySelector(".eq6-x").onclick = () => closeCard();
  card.querySelector("#eq6-nxt")?.addEventListener("click", () => {
    closeCard(true);
    openCard(dets, idx + 1, tid, field, anchor);
  });

  setTimeout(
    () =>
      document.addEventListener("click", outsideClose, {
        capture: true,
        once: true,
      }),
    50,
  );
  document.addEventListener("keydown", escClose);
}

function posCard(card, anchor) {
  const r = anchor?.getBoundingClientRect?.() || {
    top: 100,
    bottom: 120,
    left: 100,
    right: 300,
  };
  const cw = 288;
  const ch = card.offsetHeight || 240;
  const vw = window.innerWidth,
    vh = window.innerHeight,
    M = 10;
  let top = r.bottom + 8;
  let left = r.right - cw;
  if (top + ch > vh - M) top = r.top - ch - 8;
  if (top < M) top = M;
  if (left < M) left = M;
  if (left + cw > vw - M) left = vw - cw - M;
  card.style.top = `${top}px`;
  card.style.left = `${left}px`;
}

function closeCard(instant = false) {
  if (!activeCard) return;
  document.removeEventListener("keydown", escClose);
  if (instant) {
    activeCard.remove();
  } else {
    activeCard.classList.add("eq6-closing");
    const c = activeCard;
    setTimeout(() => c.remove(), 160);
  }
  activeCard = null;
}
function outsideClose(e) {
  if (
    activeCard &&
    !activeCard.contains(e.target) &&
    !e.target.classList.contains("eq6-icon")
  )
    closeCard();
}
function escClose(e) {
  if (e.key === "Escape") closeCard();
}

// ── Apply action to field ─────────────────────────────────────
function applyAction(action, data, tid, field, replacement) {
  if (!field) return;
  const text = getFieldText(field);
  let newText = text;

  if (action === "replace" || action === "mask") {
    newText = text.split(data.value).join(replacement);
    // Mark the replacement value so it is never flagged by future scans
    if (replacement) markInjected(replacement);
  } else if (action === "remove") {
    newText = text
      .split(data.value)
      .join("")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  // "ignored" / "allowed" — don't modify field

  if (action !== "ignored") {
    setFieldText(field, newText);
    // Update last-sent text to the NEW content so the next debounce
    // sees the already-modified text and skips the API call entirely.
    // Do NOT delete fieldLastTx — that's what was triggering re-detection.
    fieldLastTx.set(
      field,
      newText
        .trim()
        .replace(/\u200b/g, "")
        .replace(/\u00a0/g, " "),
    );
  }

  markActioned(data.value);

  chrome.runtime.sendMessage({
    type: "USER_ACTION",
    action,
    tracking_id: tid,
    metadata: {
      risk_level: data.risk_level,
      score: data.score,
      data_type: data.category || data.type,
      severity: data.severity,
      value: (data.value || "").substring(0, 50),
    },
  });
}

// ── Feedback toast ────────────────────────────────────────────
function showToast(data, tid) {
  chrome.storage.local.get("lastFbTs", (r) => {
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
    if (r.lastFbTs && Date.now() - r.lastFbTs < ONE_WEEK) return;

    const t = document.createElement("div");
    t.className = "eq6-toast";
    t.innerHTML = `<span style="flex:1">Was EQ helpful?</span>
      <div style="display:flex;gap:6px">
        <button class="eq6-toast-btn" data-v="1">👍</button>
        <button class="eq6-toast-btn" data-v="0">👎</button>
      </div>`;
    document.body.appendChild(t);

    const rm = () => {
      t.style.animation = "eq6-fade .3s forwards";
      setTimeout(() => t.remove(), 300);
    };
    t.querySelectorAll(".eq6-toast-btn").forEach((b) => {
      b.onclick = () => {
        const pos = b.dataset.v === "1";
        chrome.runtime.sendMessage({
          type: "WEEKLY_FEEDBACK",
          msg: pos ? "Thumbs up" : "Thumbs down",
          rating: pos ? 5 : 1,
          tracking_id: tid,
        });
        chrome.storage.local.set({ lastFbTs: Date.now() });
        rm();
      };
    });
    setTimeout(rm, 10_000);
  });
}

// ── Send text to backend ──────────────────────────────────────
function sendToAI(target) {
  if (isActioning) return;

  const rawText = getFieldText(target);
  const text = rawText
    .trim()
    .replace(/\u200b/g, "")
    .replace(/\u00a0/g, " ");

  if (!text || text.length < EQ_MIN_LEN) return;

  // Skip if ONLY masked tokens
  if (/^(\[MASKED_\w+\]\s*)+$/.test(text)) return;

  const last = fieldLastTx.get(target) || "";
  if (text === last) return;

  fieldLastTx.set(target, text);

  // Tell the backend which values we already injected so it can skip them
  const knownInjected = Array.from(injectedValues);

  chrome.runtime.sendMessage({
    type: "BLUR_EVENT",
    payload: {
      input: text,
      element: target.id || target.name || "field",
      isDiv: target.isContentEditable,
      websiteDomain: location.hostname,
      fullURL: location.href,
      platform: PLATFORM || "unknown",
      injectedValues: knownInjected, // ← backend will skip these
    },
  });
}

function scheduleDetection(target) {
  if (isActioning) return;
  const ex = fieldTimers.get(target);
  if (ex) clearTimeout(ex);
  fieldTimers.set(
    target,
    setTimeout(() => {
      fieldTimers.delete(target);
      sendToAI(target);
    }, EQ_DEBOUNCE),
  );
}

// ── Event listeners ───────────────────────────────────────────
document.addEventListener(
  "input",
  (e) => {
    if (!isActioning && isInputEl(e.target)) {
      scheduleDetection(e.target);
      if (!getFieldText(e.target).trim()) fieldLastTx.delete(e.target);
    }
  },
  true,
);

document.addEventListener(
  "blur",
  (e) => {
    if (isActioning || !isInputEl(e.target)) return;
    const ex = fieldTimers.get(e.target);
    if (ex) {
      clearTimeout(ex);
      fieldTimers.delete(e.target);
    }
    sendToAI(e.target);
  },
  true,
);

document.addEventListener(
  "keydown",
  (e) => {
    if (
      !isActioning &&
      isInputEl(e.target) &&
      (e.key === "Enter" || e.key === "Tab")
    ) {
      const ex = fieldTimers.get(e.target);
      if (ex) {
        clearTimeout(ex);
        fieldTimers.delete(e.target);
      }
      setTimeout(() => sendToAI(e.target), 50);
    }
  },
  true,
);

// ── Hook submit buttons + MutationObserver ────────────────────
if (PLATFORM_CFG) {
  hookSubmitButtons();
  new MutationObserver(() => hookSubmitButtons()).observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// ── Messages from background.js ───────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  // Detection results → show icon + store pending
  if (msg.type === "SHOW_ALERT") {
    const { sensitiveData, tracking_id } = msg;
    if (!Array.isArray(sensitiveData) || !sensitiveData.length) return;

    const fresh = sensitiveData
      .filter((d) => d.value && !isAlreadySeen(d.value))
      // Extra guard: never alert on a value we ourselves injected
      .filter((d) => !injectedValues.has(d.value))
      .map((d) => ({
        value: d.value,
        type: d.type || "Sensitive",
        category: d.category || "Personal",
        risk_level: d.risk_level || "medium",
        score: d.score ?? 5,
        masked: d.masked,
        dummy_replacement: d.dummy_replacement,
        severity: d.severity || 3,
        source: d.source || "AI",
      }));

    if (!fresh.length) return;
    fresh.forEach((d) => markSeen(d.value));

    const fields = allInputs();
    const tf = fields.find((f) =>
      fresh.some((d) => getFieldText(f).includes(d.value)),
    );
    if (!tf) return;

    fieldPending.set(tf, { dets: fresh, tid: tracking_id });
    placeIcon(tf, fresh, tracking_id);
  }

  // Free tier limit hit → show upgrade banner
  if (msg.type === "SHOW_LIMIT_BANNER") {
    showLimitBanner(
      msg.message,
      msg.upgradeUrl || "https://innometrixtechub.in/upgrade",
    );
  }
});