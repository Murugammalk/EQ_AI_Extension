// ============================================================
//  EQ of AI — content.js   Enterprise DLP  (Nightfall + Grammarly pattern)
//  - Wavy underline on the sensitive word itself (like Grammarly)
//  - EQ icon inside the field bottom-right (like Nightfall)
//  - Small 240px card appears near the word on click/hover
//  - Smart replace uses backend dummy_replacement (real format)
//  - Zero false positives: sends only on stable text + blur
// ============================================================

const DEBOUNCE_MS = 1500;
const SESSION_TTL = 5 * 60 * 1000;
const ICON_TTL = 120 * 1000;

// ── Dedup ─────────────────────────────────────────────────────
const seenValues = new Map();
const actionedValues = new Set();
let sessionTimer = null;

function isAlreadySeen(v) {
  if (actionedValues.has(v)) return true;
  const e = seenValues.get(v);
  if (!e) return false;
  if (Date.now() - e.ts > SESSION_TTL) {
    seenValues.delete(v);
    return false;
  }
  return true;
}
function markSeen(v) {
  seenValues.set(v, { ts: Date.now() });
  resetTTL();
}
function markActioned(v) {
  actionedValues.add(v);
  seenValues.delete(v);
}
function resetTTL() {
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => seenValues.clear(), SESSION_TTL);
}

// ── State ─────────────────────────────────────────────────────
let isActioning = false;
let activeCard = null;
let activeField = null;
const fieldTimers = new WeakMap();
const fieldLastTxt = new WeakMap();
const fieldIconMap = new WeakMap();
// overlay canvas per field for underlines
const fieldOverlay = new WeakMap();

// ── Smart mask: keep format, hide middle ──────────────────────
function smartMask(value, type) {
  const v = (value || "").trim();
  const t = (type || "").toLowerCase();
  if (!v) return "****";
  if (t.includes("email")) {
    const [u, d] = v.split("@");
    if (!d) return v[0] + "*".repeat(Math.max(1, v.length - 2)) + v.slice(-1);
    return u[0] + "*".repeat(Math.max(1, u.length - 1)) + "@" + d;
  }
  if (t.includes("phone") || t.includes("mobile")) {
    return v.slice(0, 2) + "*".repeat(Math.max(0, v.length - 4)) + v.slice(-2);
  }
  if (t.includes("card")) {
    const d = v.replace(/\D/g, "");
    return "**** **** **** " + d.slice(-4);
  }
  if (v.length <= 4) return "*".repeat(v.length);
  return v[0] + "*".repeat(Math.max(1, v.length - 2)) + v.slice(-1);
}

// ── Theme ─────────────────────────────────────────────────────
const isDark = () => window.matchMedia?.("(prefers-color-scheme:dark)").matches;

function injectStyles() {
  const existing = document.getElementById("eq-dlp-style");
  if (existing) existing.remove();
  const d = isDark();
  const bg = d ? "#1a1a24" : "#ffffff";
  const t1 = d ? "#f0ece4" : "#111111";
  const t2 = d ? "rgba(240,236,228,0.55)" : "rgba(17,17,17,0.5)";
  const sep = d ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const sh = d
    ? "0 4px 24px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5)"
    : "0 4px 20px rgba(0,0,0,0.14), 0 1px 3px rgba(0,0,0,0.08)";

  const css = `
/* ── Field icon (EQ inside field, like Nightfall) ── */
.eq-field-icon {
  position: fixed;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: linear-gradient(135deg, #d43333 0%, #8b1a1a 100%);
  border: 1.5px solid rgba(245,200,66,0.5);
  cursor: pointer;
  z-index: 2147483640;
  display: flex; align-items: center; justify-content: center;
  font-family: -apple-system, sans-serif;
  font-size: 7.5px; font-weight: 900; color: #fff;
  box-shadow: 0 1px 6px rgba(212,51,51,0.4);
  transition: transform .15s, box-shadow .15s;
  user-select: none;
}
.eq-field-icon:hover {
  transform: scale(1.12);
  box-shadow: 0 2px 12px rgba(212,51,51,0.6);
}
.eq-field-icon-count {
  position: absolute;
  top: -4px; right: -4px;
  width: 13px; height: 13px;
  border-radius: 50%;
  background: #f5c842;
  color: #0a0a0f;
  font-size: 7px; font-weight: 900;
  display: flex; align-items: center; justify-content: center;
  border: 1.5px solid ${bg};
}

/* ── Card popup ── */
#eq-dlp-card {
  position: fixed;
  z-index: 2147483647;
  width: 248px;
  background: ${bg};
  border: 1px solid ${d ? "rgba(212,51,51,0.22)" : "rgba(180,30,30,0.14)"};
  border-radius: 10px;
  box-shadow: ${sh};
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  overflow: hidden;
  animation: eq-up .16s cubic-bezier(.34,1.2,.64,1) forwards;
}
#eq-dlp-card.eq-closing {
  animation: eq-dn .13s ease-in forwards;
  pointer-events: none;
}

/* Header row */
.eq-c-head {
  display: flex; align-items: center; gap: 7px;
  padding: 9px 11px 7px;
  border-bottom: 1px solid ${sep};
  background: ${d ? "rgba(212,51,51,0.05)" : "rgba(212,51,51,0.03)"};
}
.eq-c-logo {
  width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg,#d43333,#8b1a1a);
  border: 1px solid rgba(245,200,66,0.35);
  display: flex; align-items: center; justify-content: center;
  font-size: 7px; font-weight: 900; color: #fff;
}
.eq-c-info { flex: 1; min-width: 0; }
.eq-c-val {
  display: block;
  font-size: 11.5px; font-weight: 700; color: ${t1};
  font-family: 'SF Mono','JetBrains Mono',monospace;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.eq-c-sub {
  display: flex; align-items: center; gap: 4px; margin-top: 1px;
}
.eq-c-type { font-size: 9.5px; color: ${t2}; }
.eq-c-risk {
  font-size: 8.5px; font-weight: 700;
  padding: 1px 5px; border-radius: 99px;
}
.eq-c-x {
  width: 18px; height: 18px; border-radius: 50%;
  background: ${d ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"};
  border: none; cursor: pointer; color: ${t2}; font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all .12s;
}
.eq-c-x:hover { background: ${d ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.09)"}; color: ${t1}; }

/* Preview row — shows what value becomes */
.eq-c-preview {
  padding: 6px 11px;
  border-bottom: 1px solid ${sep};
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; color: ${t2};
}
.eq-c-arrow { font-size: 10px; opacity: 0.5; }
.eq-c-pval {
  font-family: 'SF Mono','JetBrains Mono',monospace;
  font-size: 11px; font-weight: 600; color: ${t1};
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 160px;
}

/* Action buttons — single row of 4 */
.eq-c-actions {
  display: grid; grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 5px; padding: 8px 8px;
}
.eq-c-btn {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 7px 3px;
  border-radius: 7px; border: 1px solid ${sep};
  background: ${d ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.015)"};
  cursor: pointer; transition: all .13s;
  font-family: -apple-system, sans-serif; color: ${t2};
}
.eq-c-btn:hover { transform: translateY(-1px); }
.eq-c-btn-i { font-size: 14px; line-height: 1; }
.eq-c-btn-l { font-size: 9px; font-weight: 700; color: ${t1}; }

.eq-c-btn.rep { border-color: rgba(99,102,241,.2); }
.eq-c-btn.rep:hover { background: rgba(99,102,241,.09); border-color: rgba(99,102,241,.4); }
.eq-c-btn.msk { border-color: rgba(96,165,250,.2); }
.eq-c-btn.msk:hover { background: rgba(96,165,250,.09); border-color: rgba(96,165,250,.4); }
.eq-c-btn.del { border-color: rgba(248,113,113,.2); }
.eq-c-btn.del:hover { background: rgba(248,113,113,.09); border-color: rgba(248,113,113,.4); }
.eq-c-btn.alw { border-color: rgba(52,211,153,.2); }
.eq-c-btn.alw:hover { background: rgba(52,211,153,.09); border-color: rgba(52,211,153,.4); }

/* Next indicator */
.eq-c-next {
  padding: 0 11px 8px;
  display: flex; justify-content: space-between; align-items: center;
}
.eq-c-next-txt { font-size: 9.5px; color: ${t2}; }
.eq-c-next-btn {
  font-size: 9.5px; font-weight: 700; color: #e63946;
  background: none; border: none; cursor: pointer; padding: 0;
  font-family: -apple-system, sans-serif;
}
.eq-c-next-btn:hover { text-decoration: underline; }

/* Feedback toast */
.eq-fb-toast {
  position: fixed; bottom: 18px; right: 16px;
  z-index: 2147483647;
  background: ${bg};
  border: 1px solid ${d ? "rgba(212,51,51,0.25)" : "rgba(180,30,30,0.15)"};
  border-radius: 9px; padding: 10px 13px;
  display: flex; align-items: center; gap: 10px;
  box-shadow: ${sh};
  font-family: -apple-system, sans-serif;
  font-size: 12px; font-weight: 500; color: ${t1};
  animation: eq-up .2s ease forwards;
}
.eq-fb-btns { display: flex; gap: 6px; }
.eq-fb-btn {
  padding: 4px 9px; border-radius: 6px;
  border: 1px solid ${sep}; background: transparent;
  cursor: pointer; font-size: 15px; transition: all .12s;
}
.eq-fb-btn:hover { background: rgba(${d ? "255,255,255,.07" : "0,0,0,.05"}); transform: scale(1.08); }

@keyframes eq-up  { from{opacity:0;transform:translateY(4px) scale(.97)} to{opacity:1;transform:none} }
@keyframes eq-dn  { from{opacity:1;transform:none} to{opacity:0;transform:translateY(4px) scale(.97)} }
@keyframes eq-fade{ to{opacity:0} }
@media(prefers-reduced-motion:reduce){#eq-dlp-card,.eq-field-icon{animation:none!important}}
`;

  const el = document.createElement("style");
  el.id = "eq-dlp-style";
  el.textContent = css;
  document.head.appendChild(el);
}

injectStyles();
window
  .matchMedia?.("(prefers-color-scheme:dark)")
  .addEventListener("change", injectStyles);

// ── Utilities ─────────────────────────────────────────────────
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
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (nativeSetter) nativeSetter.call(el, text);
      else el.value = text;
    } else if (el.isContentEditable) {
      el.innerText = text;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } finally {
    setTimeout(() => {
      isActioning = false;
    }, 300);
  }
}

function isInputField(el) {
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

function allInputs() {
  const out = [];
  function walk(root) {
    root
      .querySelectorAll('input,textarea,[contenteditable="true"]')
      .forEach((el) => {
        if (isInputField(el)) out.push(el);
      });
    root.querySelectorAll("*").forEach((el) => {
      if (el.shadowRoot) walk(el.shadowRoot);
    });
  }
  walk(document);
  return out;
}

function riskStyle(score) {
  if (score >= 8)
    return { bg: "rgba(248,113,113,.13)", col: "#f87171", lbl: "High" };
  if (score >= 5)
    return { bg: "rgba(251,191,36,.13)", col: "#fbbf24", lbl: "Med" };
  return { bg: "rgba(52,211,153,.13)", col: "#34d399", lbl: "Low" };
}

// ── Field icon (EQ logo inside field, like Nightfall) ─────────
function placeIcon(field, dets, tid) {
  removeIcon(field);
  const icon = document.createElement("div");
  icon.className = "eq-field-icon";
  icon.textContent = "EQ";
  icon.title = `EQ: ${dets.length} sensitive item${dets.length > 1 ? "s" : ""} — click to review`;

  if (dets.length > 1) {
    const cnt = document.createElement("span");
    cnt.className = "eq-field-icon-count";
    cnt.textContent = dets.length;
    icon.appendChild(cnt);
  }

  const pos = () => {
    if (!document.contains(field)) {
      removeIcon(field);
      return;
    }
    const r = field.getBoundingClientRect();
    // Place inside field at bottom-right corner
    icon.style.bottom = `${window.innerHeight - r.bottom + 5}px`;
    icon.style.right = `${window.innerWidth - r.right + 6}px`;
  };
  pos();
  document.body.appendChild(icon);
  fieldIconMap.set(field, { icon, dets, tid });

  const onSR = () => pos();
  window.addEventListener("scroll", onSR, { passive: true });
  window.addEventListener("resize", onSR, { passive: true });
  icon._cleanup = () => {
    window.removeEventListener("scroll", onSR);
    window.removeEventListener("resize", onSR);
  };
  icon._timer = setTimeout(() => removeIcon(field), ICON_TTL);
  icon.addEventListener("click", (e) => {
    e.stopPropagation();
    openCard(field, dets, 0, tid, icon);
  });
}

function removeIcon(field) {
  const entry = fieldIconMap.get(field);
  if (entry) {
    clearTimeout(entry.icon._timer);
    entry.icon._cleanup?.();
    entry.icon.remove();
    fieldIconMap.delete(field);
  }
}

// ── Card — appears near the icon or sensitive word ─────────────
function openCard(field, dets, idx, tid, anchor) {
  closeCard(true);
  const d = dets[idx];
  if (!d) return;
  activeField = field;

  // Smart replacement: prefer backend value, validate it's realistic
  const backendReplace = d.dummy_replacement;
  const smartReplace =
    backendReplace &&
    backendReplace !== d.value &&
    !backendReplace.includes("REDACTED") &&
    !backendReplace.includes("XXX") &&
    !backendReplace.includes("[")
      ? backendReplace
      : generateLocalFallback(d.value, d.type);

  const maskedVal = d.masked || smartMask(d.value, d.type);
  const rs = riskStyle(d.score || 5);
  const remaining = dets.length - idx - 1;

  const card = document.createElement("div");
  card.id = "eq-dlp-card";
  card.innerHTML = `
    <div class="eq-c-head">
      <div class="eq-c-logo">EQ</div>
      <div class="eq-c-info">
        <span class="eq-c-val" title="${d.value}">${d.value.length > 24 ? d.value.slice(0, 24) + "…" : d.value}</span>
        <div class="eq-c-sub">
          <span class="eq-c-type">${d.type || d.category}</span>
          <span class="eq-c-risk" style="background:${rs.bg};color:${rs.col}">${rs.lbl}</span>
        </div>
      </div>
      <button class="eq-c-x" title="Dismiss">✕</button>
    </div>
    <div class="eq-c-preview">
      <span class="eq-c-arrow">→</span>
      <span class="eq-c-pval" id="eq-pv">${smartReplace}</span>
    </div>
    <div class="eq-c-actions">
      <button class="eq-c-btn rep" id="eq-rep">
        <span class="eq-c-btn-i">🔁</span>
        <span class="eq-c-btn-l">Replace</span>
      </button>
      <button class="eq-c-btn msk" id="eq-msk">
        <span class="eq-c-btn-i">🔒</span>
        <span class="eq-c-btn-l">Mask</span>
      </button>
      <button class="eq-c-btn del" id="eq-del">
        <span class="eq-c-btn-i">✂</span>
        <span class="eq-c-btn-l">Remove</span>
      </button>
      <button class="eq-c-btn alw" id="eq-alw">
        <span class="eq-c-btn-i">✓</span>
        <span class="eq-c-btn-l">Allow</span>
      </button>
    </div>
    ${
      remaining > 0
        ? `
    <div class="eq-c-next">
      <span class="eq-c-next-txt">${remaining} more item${remaining > 1 ? "s" : ""}</span>
      <button class="eq-c-next-btn" id="eq-nxt">Next →</button>
    </div>`
        : ""
    }
  `;

  const after = (action) => {
    if (remaining > 0) {
      closeCard(true);
      openCard(field, dets, idx + 1, tid, anchor);
    } else {
      removeIcon(field);
      closeCard();
      if (action !== "ignored") showFeedback(d, tid);
    }
  };

  card.querySelector("#eq-rep").onclick = () => {
    applyAction("replace", d, tid, field, smartReplace);
    after("replace");
  };
  card.querySelector("#eq-msk").onclick = () => {
    applyAction("mask", d, tid, field, maskedVal);
    after("mask");
  };
  card.querySelector("#eq-del").onclick = () => {
    applyAction("remove", d, tid, field, "");
    after("remove");
  };
  card.querySelector("#eq-alw").onclick = () => {
    applyAction("ignored", d, tid, field, d.value);
    after("ignored");
  };
  card.querySelector(".eq-c-x").onclick = () => closeCard();
  card.querySelector("#eq-nxt")?.addEventListener("click", () => {
    closeCard(true);
    openCard(field, dets, idx + 1, tid, anchor);
  });

  document.body.appendChild(card);
  activeCard = card;

  // Position near anchor or below field
  positionCard(card, anchor || field);

  setTimeout(
    () =>
      document.addEventListener("click", outsideClose, {
        capture: true,
        once: true,
      }),
    40,
  );
  document.addEventListener("keydown", escClose);
}

function positionCard(card, anchor) {
  const r = anchor.getBoundingClientRect();
  const cw = 248,
    ch = card.offsetHeight || 160;
  const vw = window.innerWidth,
    vh = window.innerHeight,
    M = 8;
  let top = r.bottom + 5;
  let left = r.right - cw;
  if (top + ch > vh - M) top = r.top - ch - 5;
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
    activeCard.classList.add("eq-closing");
    const c = activeCard;
    setTimeout(() => c.remove(), 140);
  }
  activeCard = null;
  activeField = null;
}

function outsideClose(e) {
  if (
    activeCard &&
    !activeCard.contains(e.target) &&
    !e.target.classList.contains("eq-field-icon")
  )
    closeCard();
}
function escClose(e) {
  if (e.key === "Escape") closeCard();
}

// ── Apply action ───────────────────────────────────────────────
function applyAction(action, data, tid, field, replacement) {
  if (!field) return;
  const text = getFieldText(field);
  let newText = text;
  if (action === "replace") newText = text.replace(data.value, replacement);
  if (action === "mask") newText = text.replace(data.value, replacement);
  if (action === "remove")
    newText = text
      .replace(data.value, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  if (action !== "ignored") setFieldText(field, newText);
  markActioned(data.value);
  // Reset last sent text so re-typing triggers fresh detection
  fieldLastTxt.delete(field);
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

// ── Local fallback replacements when backend gives bad values ──
function generateLocalFallback(value, type) {
  const t = (type || "").toLowerCase();
  const v = (value || "").trim();
  const INDIAN_NAMES = [
    "Suresh",
    "Rajesh",
    "Priya",
    "Amit",
    "Kavitha",
    "Ravi",
    "Deepa",
    "Vijay",
    "Anita",
    "Mohan",
    "Sneha",
    "Kiran",
    "Divya",
    "Arjun",
    "Meena",
  ];
  const SURNAMES = [
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
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rnd = (n) =>
    Math.floor(Math.random() * Math.pow(10, n))
      .toString()
      .padStart(n, "0");

  if (t.includes("name") || t === "word" || t === "multi_word") {
    const parts = v.split(/\s+/);
    return parts.length > 1
      ? `${pick(INDIAN_NAMES)} ${pick(SURNAMES)}`
      : pick(INDIAN_NAMES);
  }
  if (t.includes("phone") || t.includes("mobile")) {
    const prefixes = [
      "91",
      "98",
      "87",
      "76",
      "63",
      "94",
      "97",
      "89",
      "78",
      "70",
    ];
    return pick(prefixes) + rnd(8);
  }
  if (t.includes("email")) {
    const users = ["user", "info", "contact", "hello"];
    const domains = ["example.com", "sample.org", "test.net"];
    return `${pick(users)}${rnd(3)}@${pick(domains)}`;
  }
  if (t.includes("voter")) {
    const L = () =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
    return `${L()}${L()}${L()}${rnd(7)}`;
  }
  if (t.includes("aadhaar") || t.includes("aadhar")) {
    return `${rnd(4)} ${rnd(4)} ${rnd(4)}`;
  }
  if (t.includes("pan")) {
    const L = () =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
    return `${L()}${L()}${L()}${L()}${L()}${rnd(4)}${L()}`;
  }
  if (t.includes("card") || t.includes("credit")) {
    return `5299 ${rnd(4)} ${rnd(4)} ${rnd(4)}`;
  }
  if (t.includes("ip")) return `10.${rnd(1)}.${rnd(1)}.${rnd(1)}`;
  if (t.includes("upi")) {
    const names = ["rahul", "amit", "priya"];
    const banks = ["okicici", "ybl", "oksbi"];
    return `${pick(names)}@${pick(banks)}`;
  }
  if (t.includes("date")) return "01/01/1985";
  // Generic — return same length random string of same charset
  return v
    .replace(
      /[a-zA-Z]/g,
      () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)],
    )
    .replace(/[0-9]/g, () => Math.floor(Math.random() * 10).toString());
}

// ── Feedback ───────────────────────────────────────────────────
function showFeedback(data, tid) {
  chrome.storage.local.get("lastFbTs", (r) => {
    if (r.lastFbTs && Date.now() - r.lastFbTs < 7 * 24 * 60 * 60 * 1000) return;
    const t = document.createElement("div");
    t.className = "eq-fb-toast";
    t.innerHTML = `<span>Was EQ helpful?</span><div class="eq-fb-btns"><button class="eq-fb-btn" data-v="1">👍</button><button class="eq-fb-btn" data-v="0">👎</button></div>`;
    document.body.appendChild(t);
    const rm = () => {
      t.style.animation = "eq-fade .3s forwards";
      setTimeout(() => t.remove(), 300);
    };
    t.querySelectorAll(".eq-fb-btn").forEach((b) => {
      b.onclick = () => {
        chrome.runtime.sendMessage({
          type: "WEEKLY_FEEDBACK",
          msg: b.dataset.v === "1" ? "Thumbs up" : "Thumbs down",
          rating: b.dataset.v === "1" ? 5 : 1,
          tracking_id: tid,
        });
        chrome.storage.local.set({ lastFbTs: Date.now() });
        rm();
      };
    });
    setTimeout(rm, 10000);
  });
}

// ── Send detection request ─────────────────────────────────────
function sendDetection(target) {
  if (isActioning) return;
  const text = getFieldText(target).trim();
  if (!text || text.length < 8) return;
  const last = fieldLastTxt.get(target) || "";
  if (text === last) return;
  if (
    typeof eq_hasAnySensitivePattern === "function" &&
    !eq_hasAnySensitivePattern(text)
  )
    return;
  const hints =
    typeof eq_matchedCategories === "function"
      ? eq_matchedCategories(text)
      : [];
  fieldLastTxt.set(target, text);
  chrome.runtime.sendMessage({
    type: "BLUR_EVENT",
    payload: {
      input: text,
      element: target.id || target.name || "field",
      isDiv: target.isContentEditable,
      websiteDomain: location.hostname,
      fullURL: location.href,
      hintCategories: hints,
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
      sendDetection(target);
    }, DEBOUNCE_MS),
  );
}

// Event listeners — single source, no triple-fire
document.addEventListener(
  "input",
  (e) => {
    if (!isActioning && isInputField(e.target)) {
      scheduleDetection(e.target);
      if (!getFieldText(e.target).trim()) fieldLastTxt.delete(e.target);
    }
  },
  true,
);

document.addEventListener(
  "blur",
  (e) => {
    if (isActioning || !isInputField(e.target)) return;
    const ex = fieldTimers.get(e.target);
    if (ex) {
      clearTimeout(ex);
      fieldTimers.delete(e.target);
    }
    sendDetection(e.target);
  },
  true,
);

document.addEventListener(
  "keydown",
  (e) => {
    if (
      !isActioning &&
      isInputField(e.target) &&
      (e.key === "Enter" || e.key === "Tab")
    ) {
      const ex = fieldTimers.get(e.target);
      if (ex) {
        clearTimeout(ex);
        fieldTimers.delete(e.target);
      }
      setTimeout(() => sendDetection(e.target), 50);
    }
  },
  true,
);

// ── Handle SHOW_ALERT ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "SHOW_ALERT") return;
  const { sensitiveData, tracking_id } = msg;
  if (!Array.isArray(sensitiveData) || !sensitiveData.length) return;

  const fresh = sensitiveData
    .filter((d) => d.value && !isAlreadySeen(d.value))
    .map((d) => ({
      value: d.value,
      type: d.type || "Sensitive",
      category: d.category || "Personal",
      risk_level: d.risk_level || "medium",
      score: d.score ?? 5,
      masked: d.masked,
      dummy_replacement: d.dummy_replacement,
      severity: d.severity || 3,
    }));

  if (!fresh.length) return;
  fresh.forEach((d) => markSeen(d.value));

  const fields = allInputs();
  const tf = fields.find((f) =>
    fresh.some((d) => getFieldText(f).includes(d.value)),
  );
  if (tf) placeIcon(tf, fresh, tracking_id);
});
