// ============================================================
//  EQ of AI — content.js  (Grammarly-level UX)
//  - Overlay dot outside DOM
//  - One detection at a time
//  - Smart realistic replacements
//  - Zero false positives: only sends on stable text
// ============================================================

const DEBOUNCE_MS = 1500; // wait 1.5s after typing stops
const SESSION_TTL = 5 * 60 * 1000;
const DOT_TTL     = 120 * 1000; // dot stays 2 min

// ── Dedup ─────────────────────────────────────────────────────
const seenValues     = new Map();
const actionedValues = new Set();
let   sessionTimer   = null;

function isAlreadySeen(v) {
  if (actionedValues.has(v)) return true;
  const e = seenValues.get(v);
  if (!e) return false;
  if (Date.now() - e.ts > SESSION_TTL) { seenValues.delete(v); return false; }
  return true;
}
function markSeen(v)     { seenValues.set(v, {ts:Date.now()}); resetTTL(); }
function markActioned(v) { actionedValues.add(v); seenValues.delete(v); }
function resetTTL() {
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => seenValues.clear(), SESSION_TTL);
}

// ── Per-field state ───────────────────────────────────────────
let isActioning = false;
const fieldTimers   = new WeakMap(); // debounce timers
const fieldLastText = new WeakMap(); // last sent text per field
const fieldDotMap   = new WeakMap(); // dot element per field
let   activeCard    = null;          // currently open card

// ── Smart realistic replacement library ───────────────────────
// Purpose: replace sensitive data with SAME FORMAT but different value
// e.g. Ramesh → Suresh, 9876543210 → 9123456789
const SMART_REPLACE = {
  // Indian male names
  MALE_NAMES: ["Suresh","Rajesh","Mahesh","Dinesh","Ganesh","Ramesh","Naresh",
                "Arun","Vijay","Kiran","Arjun","Vikram","Rohit","Amit","Sanjay",
                "Deepak","Manoj","Praveen","Ravi","Mohan"],
  // Indian female names
  FEMALE_NAMES: ["Priya","Divya","Anita","Sunita","Rekha","Meena","Kavitha",
                  "Lakshmi","Radha","Geetha","Deepa","Nisha","Pooja","Sneha","Asha"],
  // Indian surnames
  SURNAMES: ["Kumar","Sharma","Patel","Singh","Rao","Nair","Pillai","Reddy",
              "Gupta","Joshi","Mehta","Shah","Iyer","Menon","Verma"],
  // Generic first names (international)
  FIRST_NAMES: ["David","Michael","James","Robert","John","William","Thomas",
                 "Sarah","Emily","Emma","Olivia","Sophie","Jessica","Laura"],

  pick(arr) { return arr[Math.floor(Math.random()*arr.length)]; },

  // Detect if value looks like Indian name
  isIndianName(v) {
    const indianNames = [...this.MALE_NAMES,...this.FEMALE_NAMES,...this.SURNAMES];
    return indianNames.some(n => v.toLowerCase().includes(n.toLowerCase()));
  },

  forType(value, type, category) {
    const t = (type||"").toLowerCase();
    const c = (category||"").toLowerCase();
    const v = value||"";

    // ── Names ──────────────────────────────────────────────
    if (t.includes("name")||t==="word"||t==="multi_word") {
      const parts = v.trim().split(/\s+/);
      if (parts.length===1) {
        // Single name — replace with same-culture name
        return this.isIndianName(v)
          ? this.pick([...this.MALE_NAMES,...this.FEMALE_NAMES])
          : this.pick(this.FIRST_NAMES);
      }
      if (parts.length===2) {
        // Full name
        const fn = this.isIndianName(parts[0])
          ? this.pick([...this.MALE_NAMES,...this.FEMALE_NAMES])
          : this.pick(this.FIRST_NAMES);
        const ln = this.isIndianName(parts[1])
          ? this.pick(this.SURNAMES)
          : "Smith";
        return `${fn} ${ln}`;
      }
      return `${this.pick(this.FIRST_NAMES)} ${this.pick(this.SURNAMES)}`;
    }

    // ── Phone / Mobile ─────────────────────────────────────
    if (t.includes("phone")||t.includes("mobile")||t.includes("tel")) {
      // Detect format: Indian 10-digit, US, etc.
      const digits = v.replace(/\D/g,"");
      if (digits.length===10 && digits.startsWith("9")||digits.startsWith("8")||digits.startsWith("7")||digits.startsWith("6")) {
        // Indian mobile — keep first digit, randomize rest
        const prefix = ["91","98","87","76","63","94","97","89","78","70"];
        const p = this.pick(prefix);
        const rest = Math.floor(Math.random()*100000000).toString().padStart(8,"0");
        return p+rest;
      }
      if (digits.length===10) {
        // US format
        const area = ["212","415","312","713","404","602","503","616"];
        const r1 = Math.floor(Math.random()*900+100);
        const r2 = Math.floor(Math.random()*9000+1000);
        return `(${this.pick(area)}) ${r1}-${r2}`;
      }
      // Generic — randomize all digits keeping length
      return digits.replace(/\d/g, ()=>Math.floor(Math.random()*10)).slice(0,digits.length);
    }

    // ── Email ──────────────────────────────────────────────
    if (t.includes("email")) {
      const users   = ["user","info","contact","hello","support","team","privacy"];
      const domains = ["example.com","sample.org","test.net","demo.io","placeholder.com"];
      return `${this.pick(users)}${Math.floor(Math.random()*999+100)}@${this.pick(domains)}`;
    }

    // ── Aadhaar ────────────────────────────────────────────
    if (t.includes("aadhaar")||t.includes("aadhar")) {
      const a=()=>Math.floor(Math.random()*9000+1000);
      return `${a()} ${a()} ${a()}`;
    }

    // ── Voter ID ───────────────────────────────────────────
    if (t.includes("voter")) {
      const letters="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const l=()=>letters[Math.floor(Math.random()*letters.length)];
      const d=()=>Math.floor(Math.random()*10);
      return `${l()}${l()}${l()}${d()}${d()}${d()}${d()}${d()}${d()}${d()}`;
    }

    // ── PAN Card ───────────────────────────────────────────
    if (t.includes("pan")) {
      const letters="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const l=()=>letters[Math.floor(Math.random()*letters.length)];
      const d=()=>Math.floor(Math.random()*10);
      return `${l()}${l()}${l()}${l()}${l()}${d()}${d()}${d()}${d()}${l()}`;
    }

    // ── Passport ───────────────────────────────────────────
    if (t.includes("passport")) {
      const letters="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const l=letters[Math.floor(Math.random()*letters.length)];
      const n=Math.floor(Math.random()*9000000+1000000);
      return `${l}${n}`;
    }

    // ── Credit / Debit Card ────────────────────────────────
    if (t.includes("card")||t.includes("credit")||t.includes("debit")) {
      const prefixes=["4532","5425","3714","6011","3566"];
      const p=this.pick(prefixes);
      const r=()=>Math.floor(Math.random()*9000+1000);
      return `${p} ${r()} ${r()} ${r()}`.slice(0,19);
    }

    // ── UPI ────────────────────────────────────────────────
    if (t.includes("upi")) {
      const names=["rahul","priya","amit","user","sample"];
      const banks=["okicici","ybl","oksbi","okhdfcbank","paytm"];
      return `${this.pick(names)}@${this.pick(banks)}`;
    }

    // ── IP Address ─────────────────────────────────────────
    if (t.includes("ip")) {
      return `192.168.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;
    }

    // ── Date ───────────────────────────────────────────────
    if (t.includes("date")) {
      const m=Math.floor(Math.random()*12+1).toString().padStart(2,"0");
      const d2=Math.floor(Math.random()*28+1).toString().padStart(2,"0");
      const y=Math.floor(Math.random()*30+1970);
      // Match original format
      if (/\d{4}-\d{2}-\d{2}/.test(v)) return `${y}-${m}-${d2}`;
      if (/\d{2}\/\d{2}\/\d{4}/.test(v)) return `${d2}/${m}/${y}`;
      return `${d2}-${m}-${y}`;
    }

    // ── GST ────────────────────────────────────────────────
    if (t.includes("gst")) {
      const st=Math.floor(Math.random()*35+1).toString().padStart(2,"0");
      const letters="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const l=()=>letters[Math.floor(Math.random()*letters.length)];
      const d=()=>Math.floor(Math.random()*10);
      return `${st}${l()}${l()}${l()}${l()}${l()}${d()}${d()}${d()}${d()}${l()}${d()}${l()}${d()}`;
    }

    // ── Default: use backend's dummy_replacement or generic ─
    return null; // signals to use backend value
  }
};

// ── Smart mask: keep first+last char, mask middle ─────────────
function smartMask(value, type) {
  const v = value||"";
  const t = (type||"").toLowerCase();

  if (t.includes("email")) {
    const [user,domain]=v.split("@");
    if (!domain) return v[0]+"*".repeat(v.length-2)+v.slice(-1);
    return user[0]+"*".repeat(user.length-1)+"@"+domain;
  }
  if (t.includes("phone")||t.includes("mobile")) {
    return v.slice(0,2)+"*".repeat(v.length-4)+v.slice(-2);
  }
  if (t.includes("card")) {
    return "**** **** **** "+v.replace(/\D/g,"").slice(-4);
  }
  if (v.length<=4) return "*".repeat(v.length);
  return v[0]+"*".repeat(v.length-2)+v.slice(-1);
}

// ── Theme ─────────────────────────────────────────────────────
const isDark = () => window.matchMedia?.("(prefers-color-scheme:dark)").matches;

function buildCSS() {
  const d = isDark();
  const bg  = d ? "#16161e" : "#ffffff";
  const t1  = d ? "#f0ece4" : "#111111";
  const t2  = d ? "rgba(240,236,228,0.55)" : "rgba(17,17,17,0.5)";
  const sep = d ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
  const sh  = d
    ? "0 8px 32px rgba(0,0,0,0.6),0 2px 8px rgba(0,0,0,0.4)"
    : "0 4px 24px rgba(0,0,0,0.13),0 1px 4px rgba(0,0,0,0.08)";

  return `
/* EQ dot — tiny indicator at field corner */
.eq-dot {
  position: fixed;
  width: 10px; height: 10px;
  border-radius: 50%;
  background: #e63946;
  border: 1.5px solid rgba(255,255,255,0.9);
  cursor: pointer;
  z-index: 2147483640;
  box-shadow: 0 0 0 3px rgba(230,57,70,0.25);
  animation: eq-dotpop .2s cubic-bezier(.34,1.56,.64,1) forwards;
  transition: transform .15s, box-shadow .15s;
}
.eq-dot:hover {
  transform: scale(1.4);
  box-shadow: 0 0 0 5px rgba(230,57,70,0.2);
}
.eq-dot.eq-dot--multi::after {
  content: attr(data-count);
  position: absolute;
  top: -6px; right: -6px;
  width: 12px; height: 12px;
  border-radius: 50%;
  background: #f5c842;
  color: #0a0a0f;
  font-size: 7px; font-weight: 900;
  display: flex; align-items: center; justify-content: center;
  font-family: -apple-system, sans-serif;
}

/* EQ card — tiny action popup */
#eq-card {
  position: fixed;
  z-index: 2147483647;
  width: 260px;
  background: ${bg};
  border: 1px solid ${d?"rgba(230,57,70,0.2)":"rgba(200,30,30,0.15)"};
  border-radius: 12px;
  box-shadow: ${sh};
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  overflow: hidden;
  animation: eq-up .18s cubic-bezier(.34,1.2,.64,1) forwards;
  user-select: none;
}
#eq-card.eq-closing {
  animation: eq-dn .14s ease-in forwards;
  pointer-events: none;
}

/* Card top: detected value + type */
.eq-card-top {
  padding: 10px 12px 8px;
  border-bottom: 1px solid ${sep};
  display: flex; align-items: flex-start; gap: 8px;
}
.eq-card-icon {
  width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0; margin-top: 1px;
  background: linear-gradient(135deg,#d43333,#8b1a1a);
  display: flex; align-items: center; justify-content: center;
  font-size: 7px; font-weight: 900; color: #fff;
}
.eq-card-info { flex: 1; min-width: 0; }
.eq-card-value {
  display: block;
  font-size: 12px; font-weight: 700; color: ${t1};
  font-family: 'SF Mono','JetBrains Mono',monospace;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.eq-card-meta {
  display: flex; align-items: center; gap: 5px; margin-top: 2px;
}
.eq-card-type {
  font-size: 10px; color: ${t2};
}
.eq-card-risk {
  font-size: 9px; font-weight: 700;
  padding: 1px 5px; border-radius: 99px;
}
.eq-card-close {
  width: 18px; height: 18px; border-radius: 50%;
  background: ${d?"rgba(255,255,255,.06)":"rgba(0,0,0,.05)"};
  border: none; cursor: pointer;
  color: ${t2}; font-size: 11px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: background .12s;
}
.eq-card-close:hover { background: ${d?"rgba(255,255,255,.12)":"rgba(0,0,0,.1)"}; color: ${t1}; }

/* Preview line: shows what value becomes */
.eq-card-preview {
  padding: 7px 12px;
  border-bottom: 1px solid ${sep};
  font-size: 10.5px; color: ${t2};
  display: flex; align-items: center; gap: 5px;
}
.eq-card-preview-val {
  font-family: 'SF Mono','JetBrains Mono',monospace;
  font-weight: 600; color: ${t1};
}

/* Action buttons — horizontal row */
.eq-card-actions {
  display: flex; gap: 0; padding: 8px 8px;
}
.eq-btn {
  flex: 1; padding: 7px 4px;
  border-radius: 8px; border: none;
  cursor: pointer; font-size: 10.5px; font-weight: 700;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  transition: all .13s; font-family: -apple-system, sans-serif;
  background: transparent;
}
.eq-btn:hover { transform: translateY(-1px); }
.eq-btn-icon { font-size: 15px; line-height: 1; }
.eq-btn-label { font-size: 9.5px; }

.eq-btn.replace {
  background: rgba(99,102,241,0.1);
  color: #818cf8;
  border: 1px solid rgba(99,102,241,0.2);
  margin-right: 4px;
}
.eq-btn.replace:hover { background: rgba(99,102,241,0.18); border-color: rgba(99,102,241,0.4); }

.eq-btn.mask {
  background: rgba(96,165,250,0.1);
  color: #60a5fa;
  border: 1px solid rgba(96,165,250,0.2);
  margin-right: 4px;
}
.eq-btn.mask:hover { background: rgba(96,165,250,0.18); border-color: rgba(96,165,250,0.4); }

.eq-btn.remove {
  background: rgba(248,113,113,0.1);
  color: #f87171;
  border: 1px solid rgba(248,113,113,0.2);
  margin-right: 4px;
}
.eq-btn.remove:hover { background: rgba(248,113,113,0.18); border-color: rgba(248,113,113,0.4); }

.eq-btn.allow {
  background: rgba(${d?"255,255,255,.04":"0,0,0,.03"});
  color: ${t2};
  border: 1px solid ${sep};
}
.eq-btn.allow:hover { background: rgba(${d?"255,255,255,.08":"0,0,0,.06"}); }

/* Next pill — shows how many more */
.eq-card-next {
  padding: 0 12px 9px;
  display: flex; justify-content: space-between; align-items: center;
}
.eq-card-next-txt {
  font-size: 10px; color: ${t2};
}
.eq-card-next-btn {
  font-size: 10px; font-weight: 700; color: #d43333;
  background: none; border: none; cursor: pointer; padding: 0;
  font-family: -apple-system, sans-serif;
}
.eq-card-next-btn:hover { text-decoration: underline; }

/* Feedback toast */
.eq-toast {
  position: fixed; bottom: 20px; right: 16px;
  z-index: 2147483647;
  background: ${bg};
  border: 1.5px solid rgba(230,57,70,0.3);
  border-radius: 10px; padding: 10px 14px;
  display: flex; align-items: center; gap: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,${d?.5:.12});
  animation: eq-up .2s ease forwards;
  font-family: -apple-system, sans-serif;
  font-size: 12px; font-weight: 600; color: ${t1};
}
.eq-toast-btns { display: flex; gap: 6px; }
.eq-toast-btn {
  padding: 4px 10px; border-radius: 6px;
  border: 1px solid ${sep}; background: transparent;
  cursor: pointer; font-size: 14px; transition: all .12s;
}
.eq-toast-btn:hover { background: rgba(${d?"255,255,255,.07":"0,0,0,.05"}); transform: scale(1.1); }

@keyframes eq-dotpop { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
@keyframes eq-up { from{opacity:0;transform:translateY(5px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes eq-dn { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(5px)} }
@keyframes eq-fade { to{opacity:0} }
@media(prefers-reduced-motion:reduce){#eq-card,.eq-dot{animation:none!important}}
`;
}

// Inject styles
const sEl = document.createElement("style");
sEl.id = "eq-style";
sEl.textContent = buildCSS();
document.head.appendChild(sEl);
window.matchMedia?.("(prefers-color-scheme:dark)").addEventListener("change", ()=>{
  const el = document.getElementById("eq-style");
  if (el) el.textContent = buildCSS();
});

// ── Utilities ─────────────────────────────────────────────────
function getFieldText(el) {
  if (!el) return "";
  if (el.tagName==="INPUT"||el.tagName==="TEXTAREA") return el.value;
  if (el.isContentEditable) return el.innerText;
  return "";
}

function setFieldText(el, text) {
  isActioning = true;
  try {
    if (el.tagName==="INPUT"||el.tagName==="TEXTAREA") {
      const proto = el.tagName==="INPUT"
        ? window.HTMLInputElement.prototype
        : window.HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto,"value")?.set;
      if (setter) setter.call(el, text); else el.value = text;
    } else if (el.isContentEditable) {
      el.innerText = text;
    }
    el.dispatchEvent(new Event("input",{bubbles:true}));
    el.dispatchEvent(new Event("change",{bubbles:true}));
  } finally {
    setTimeout(()=>{ isActioning=false; }, 200);
  }
}

function isInput(el) {
  if (!el) return false;
  const t = el.tagName?.toLowerCase();
  if (t==="textarea") return true;
  if (t==="input") return ["text","search","email","url","tel","number","password"]
    .includes((el.type||"text").toLowerCase());
  return !!el.isContentEditable;
}

function allFields() {
  const out = [];
  function walk(root) {
    root.querySelectorAll('input,textarea,[contenteditable="true"]')
      .forEach(el=>{ if(isInput(el)) out.push(el); });
    root.querySelectorAll("*").forEach(el=>{ if(el.shadowRoot) walk(el.shadowRoot); });
  }
  walk(document);
  return out;
}

function riskColor(score) {
  if (score>=8) return {bg:"rgba(248,113,113,.15)",color:"#f87171",label:"High"};
  if (score>=5) return {bg:"rgba(251,191,36,.15)", color:"#fbbf24",label:"Med"};
  return              {bg:"rgba(52,211,153,.15)",  color:"#34d399", label:"Low"};
}

// ── Dot — tiny red indicator on field ─────────────────────────
function placeDot(field, dets, tid) {
  removeDot(field);
  const dot = document.createElement("div");
  dot.className = "eq-dot" + (dets.length>1?" eq-dot--multi":"");
  if (dets.length>1) dot.setAttribute("data-count", dets.length);
  dot.title = `EQ: ${dets.length} sensitive item${dets.length>1?"s":""} detected`;

  const pos = () => {
    if (!document.contains(field)) { removeDot(field); return; }
    const r = field.getBoundingClientRect();
    dot.style.bottom = `${window.innerHeight - r.bottom + 4}px`;
    dot.style.right  = `${window.innerWidth  - r.right  + 4}px`;
  };
  pos();
  document.body.appendChild(dot);
  fieldDotMap.set(field, dot);

  const onS = ()=>pos();
  window.addEventListener("scroll", onS, {passive:true});
  window.addEventListener("resize", onS, {passive:true});
  dot._cleanup = () => {
    window.removeEventListener("scroll", onS);
    window.removeEventListener("resize", onS);
  };
  dot._timer = setTimeout(()=>removeDot(field), DOT_TTL);

  dot.addEventListener("click", e => {
    e.stopPropagation();
    openCard(field, dets, 0, tid);
  });
}

function removeDot(field) {
  const dot = fieldDotMap.get(field);
  if (dot) {
    clearTimeout(dot._timer);
    dot._cleanup?.();
    dot.remove();
    fieldDotMap.delete(field);
  }
}

// ── Card — tiny popup showing ONE detection at a time ─────────
function openCard(field, dets, idx, tid) {
  closeCard(true);
  const d = dets[idx];
  if (!d) return;

  // Compute smart replacement
  const smartVal = SMART_REPLACE.forType(d.value, d.type, d.category)
                || d.dummy_replacement
                || `[SAFE_${(d.type||"DATA").toUpperCase()}]`;
  const maskedVal = smartMask(d.value, d.type);
  const rc = riskColor(d.score||5);
  const remaining = dets.length - idx - 1;

  const card = document.createElement("div");
  card.id = "eq-card";
  card.setAttribute("role","dialog");
  card.setAttribute("aria-label","EQ Privacy Alert");

  card.innerHTML = `
    <div class="eq-card-top">
      <div class="eq-card-icon">EQ</div>
      <div class="eq-card-info">
        <span class="eq-card-value" title="${d.value}">${d.value.length>22?d.value.slice(0,22)+"…":d.value}</span>
        <div class="eq-card-meta">
          <span class="eq-card-type">${d.type||d.category||"Sensitive"}</span>
          <span class="eq-card-risk" style="background:${rc.bg};color:${rc.color}">${rc.label}</span>
        </div>
      </div>
      <button class="eq-card-close" title="Dismiss">✕</button>
    </div>
    <div class="eq-card-preview">
      <span>→</span>
      <span class="eq-card-preview-val" id="eq-preview">${smartVal}</span>
    </div>
    <div class="eq-card-actions">
      <button class="eq-btn replace" id="eq-btn-replace">
        <span class="eq-btn-icon">🔁</span>
        <span class="eq-btn-label">Replace</span>
      </button>
      <button class="eq-btn mask" id="eq-btn-mask">
        <span class="eq-btn-icon">🔒</span>
        <span class="eq-btn-label">Mask</span>
      </button>
      <button class="eq-btn remove" id="eq-btn-remove">
        <span class="eq-btn-icon">✂</span>
        <span class="eq-btn-label">Remove</span>
      </button>
      <button class="eq-btn allow" id="eq-btn-allow">
        <span class="eq-btn-icon">✓</span>
        <span class="eq-btn-label">Allow</span>
      </button>
    </div>
    ${remaining>0 ? `
    <div class="eq-card-next">
      <span class="eq-card-next-txt">${remaining} more item${remaining>1?"s":""}</span>
      <button class="eq-card-next-btn" id="eq-btn-next">Next →</button>
    </div>` : ""}
  `;

  // Actions
  const act = (action, replacement) => {
    doAction(action, d, tid, field, replacement);
    if (remaining>0) {
      closeCard(true);
      openCard(field, dets, idx+1, tid);
    } else {
      removeDot(field);
      closeCard();
      if (action!=="ignored") showFeedback(d, tid);
    }
  };

  card.querySelector("#eq-btn-replace").addEventListener("click", ()=>act("replace", smartVal));
  card.querySelector("#eq-btn-mask").addEventListener("click",    ()=>act("mask",    maskedVal));
  card.querySelector("#eq-btn-remove").addEventListener("click",  ()=>act("remove",  ""));
  card.querySelector("#eq-btn-allow").addEventListener("click",   ()=>act("ignored", d.value));
  card.querySelector(".eq-card-close").addEventListener("click",  ()=>closeCard());
  if (remaining>0) {
    card.querySelector("#eq-btn-next")?.addEventListener("click", ()=>{
      closeCard(true); openCard(field, dets, idx+1, tid);
    });
  }

  document.body.appendChild(card);
  activeCard = card;
  posCard(card, field);

  // Close on outside click
  setTimeout(()=> document.addEventListener("click", outsideClick, {capture:true, once:true}), 30);
  document.addEventListener("keydown", escKey);
}

function posCard(card, field) {
  const r  = field.getBoundingClientRect();
  const cw = 260, ch = card.offsetHeight||180;
  const vw = window.innerWidth, vh = window.innerHeight, M = 10;

  // Prefer below field, aligned right
  let top  = r.bottom + 6;
  let left = r.right - cw;

  if (top + ch > vh - M)  top  = r.top - ch - 6;
  if (top < M)            top  = M;
  if (left < M)           left = M;
  if (left + cw > vw - M) left = vw - cw - M;

  card.style.top  = `${top}px`;
  card.style.left = `${left}px`;
}

function closeCard(instant=false) {
  if (!activeCard) return;
  document.removeEventListener("keydown", escKey);
  if (instant) {
    activeCard.remove();
  } else {
    activeCard.classList.add("eq-closing");
    const c = activeCard;
    setTimeout(()=>c.remove(), 160);
  }
  activeCard = null;
}

function outsideClick(e) {
  if (activeCard && !activeCard.contains(e.target)) closeCard();
}
function escKey(e) { if(e.key==="Escape") closeCard(); }

// ── Apply action to field ─────────────────────────────────────
function doAction(action, data, tid, field, replacement) {
  if (!field) return;
  const text = getFieldText(field);
  let newText = text;

  if (action==="replace") {
    newText = text.replace(data.value, replacement);
  } else if (action==="mask") {
    newText = text.replace(data.value, replacement);
  } else if (action==="remove") {
    newText = text.replace(data.value, "").replace(/\s{2,}/g," ").trim();
  }
  // "ignored" — don't change text

  if (action!=="ignored") setFieldText(field, newText);
  markActioned(data.value);

  chrome.runtime.sendMessage({
    type: "USER_ACTION",
    action,
    tracking_id: tid,
    metadata: {
      risk_level: data.risk_level,
      score:      data.score,
      data_type:  data.category||data.type,
      severity:   data.severity,
      value:      (data.value||"").substring(0,50),
    },
  });
}

// ── Feedback toast ─────────────────────────────────────────────
function showFeedback(data, tid) {
  chrome.storage.local.get("lastFeedbackTs", r=>{
    if (r.lastFeedbackTs && Date.now()-r.lastFeedbackTs < 7*24*60*60*1000) return;
    const t = document.createElement("div");
    t.className = "eq-toast";
    t.innerHTML = `
      <span>Was EQ helpful?</span>
      <div class="eq-toast-btns">
        <button class="eq-toast-btn" data-v="1">👍</button>
        <button class="eq-toast-btn" data-v="0">👎</button>
      </div>
    `;
    document.body.appendChild(t);
    const dismiss = () => { t.style.animation="eq-fade .3s forwards"; setTimeout(()=>t.remove(),300); };
    t.querySelectorAll(".eq-toast-btn").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const pos = btn.dataset.v==="1";
        chrome.runtime.sendMessage({type:"WEEKLY_FEEDBACK",msg:pos?"Thumbs up":"Thumbs down",rating:pos?5:1,tracking_id:tid});
        chrome.storage.local.set({lastFeedbackTs:Date.now()});
        dismiss();
      });
    });
    setTimeout(dismiss, 10000);
  });
}

// ── Send to background — false positive protection ────────────
function sendToBackground(target) {
  if (isActioning) return;
  const text = getFieldText(target).trim();
  if (!text || text.length < 8) return; // min 8 chars

  const lastText = fieldLastText.get(target)||"";
  if (text===lastText) return; // same text, already sent

  if (typeof eq_hasAnySensitivePattern==="function" && !eq_hasAnySensitivePattern(text)) return;

  const hints = typeof eq_matchedCategories==="function" ? eq_matchedCategories(text) : [];
  fieldLastText.set(target, text);

  chrome.runtime.sendMessage({
    type: "BLUR_EVENT",
    payload: {
      input:         text,
      element:       target.id||target.name||"field",
      isDiv:         target.isContentEditable,
      websiteDomain: location.hostname,
      fullURL:       location.href,
      hintCategories: hints,
    },
  });
}

// Debounce per field
function scheduleCheck(target) {
  if (isActioning) return;
  const existing = fieldTimers.get(target);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(()=>{
    fieldTimers.delete(target);
    sendToBackground(target);
  }, DEBOUNCE_MS);
  fieldTimers.set(target, timer);
}

// Event listeners
document.addEventListener("input", e=>{
  if (!isActioning && isInput(e.target)) {
    scheduleCheck(e.target);
    if (!getFieldText(e.target).trim()) fieldLastText.delete(e.target);
  }
}, true);

document.addEventListener("blur", e=>{
  if (isActioning||!isInput(e.target)) return;
  const existing = fieldTimers.get(e.target);
  if (existing) { clearTimeout(existing); fieldTimers.delete(e.target); }
  sendToBackground(e.target);
}, true);

document.addEventListener("keydown", e=>{
  if (!isActioning&&isInput(e.target)&&(e.key==="Enter"||e.key==="Tab")) {
    const existing = fieldTimers.get(e.target);
    if (existing) { clearTimeout(existing); fieldTimers.delete(e.target); }
    setTimeout(()=>sendToBackground(e.target), 50);
  }
}, true);

// ── Handle SHOW_ALERT from background ─────────────────────────
chrome.runtime.onMessage.addListener(msg=>{
  if (msg.type!=="SHOW_ALERT") return;
  const {sensitiveData, tracking_id} = msg;
  if (!Array.isArray(sensitiveData)||!sensitiveData.length) return;

  const norm = sensitiveData.map(d=>({
    value:             d.value||"",
    type:              d.type||"Sensitive",
    category:          d.category||"Personal",
    risk_level:        d.risk_level||"medium",
    score:             d.score??5,
    masked:            d.masked,
    dummy_replacement: d.dummy_replacement,
    severity:          d.severity||3,
    tracking_id,
  }));

  const fresh = norm.filter(d=>d.value&&!isAlreadySeen(d.value));
  if (!fresh.length) return;
  fresh.forEach(d=>markSeen(d.value));

  const fields = allFields();
  const tf = fields.find(f=>fresh.some(d=>getFieldText(f).includes(d.value)));
  if (tf) placeDot(tf, fresh, tracking_id);
});