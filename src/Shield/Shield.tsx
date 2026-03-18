import { useState, useEffect } from "react";
import "./Shield.css";

interface Cats {
  personal: boolean;
  financial: boolean;
  medical: boolean;
}

const SHIELDS = [
  {
    key: "personal" as keyof Cats,
    icon: "👤",
    label: "Personal",
    desc: "Name, email, phone, Aadhaar, DOB, address",
    examples: ["john@email.com", "+91 98765 43210", "Aadhaar 1234 5678 9012"],
  },
  {
    key: "financial" as keyof Cats,
    icon: "💳",
    label: "Financial",
    desc: "Cards, UPI, GSTIN, IFSC, PAN, bank accounts",
    examples: ["4111-1111-1111-1111", "user@upi", "ABCDE1234F"],
  },
  {
    key: "medical" as keyof Cats,
    icon: "🩺",
    label: "Medical",
    desc: "Diagnoses, prescriptions, patient IDs, reports",
    examples: ["Blood group A+", "Metformin 500mg", "Patient #12345"],
  },
];

export const Shield: React.FC = () => {
  const [cats, setCats] = useState<Cats>({
    personal: true,
    financial: true,
    medical: true,
  });
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    chrome.storage.sync.get(["personal", "financial", "medical"], (res) => {
      setCats({
        personal: res.personal ?? true,
        financial: res.financial ?? true,
        medical: res.medical ?? true,
      });
    });
  }, []);

  const toggle = (key: keyof Cats) => {
    const next = { ...cats, [key]: !cats[key] };
    setCats(next);
    // Save to chrome.storage.sync — background.js reads this and sends
    // disabled_categories to backend, which skips those categories entirely
    chrome.storage.sync.set({ [key]: next[key] }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  };

  const activeCount = Object.values(cats).filter(Boolean).length;

  return (
    <div className="shield-page eq-page">
      {/* ── Header ── */}
      <div className="shield-header">
        <div className="shield-header-left">
          <div className="shield-header-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 2L3 5v5c0 4.418 3.134 8.109 7 9 3.866-.891 7-4.582 7-9V5L10 2Z"
                fill="url(#sg)"
              />
              <path
                d="M7 10l2 2 4-4"
                stroke="#0a0a0f"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient
                  id="sg"
                  x1="0"
                  y1="0"
                  x2="20"
                  y2="20"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#ca3838" />
                  <stop offset="1" stopColor="#8b2121" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <div className="shield-header-title">Protection Rules</div>
            <div className="shield-header-sub">
              {activeCount} of 3 categories active
            </div>
          </div>
        </div>
        {saved && <span className="shield-saved">Saved ✓</span>}
      </div>

      {/* ── Status bar ── */}
      <div className="shield-status-bar">
        {SHIELDS.map((s) => (
          <div
            key={s.key}
            className={`shield-status-dot-wrap ${cats[s.key] ? "active" : "inactive"}`}
            title={s.label}
          >
            <div className="shield-status-pip" />
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Category cards ── */}
      <div className="shield-cards">
        {SHIELDS.map(({ key, icon, label, desc, examples }) => {
          const on = cats[key];
          const open = expanded === key;
          return (
            <div
              key={key}
              className={`shield-card eq-card ${on ? "shield-card--on" : "shield-card--off"}`}
            >
              <div className="shield-card-row">
                <span className="shield-card-icon">{icon}</span>
                <div className="shield-card-info">
                  <span className="shield-card-label">{label}</span>
                  <span className="shield-card-desc">{desc}</span>
                </div>
                <label className="eq-toggle">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(key)}
                  />
                  <span className="eq-toggle-track" />
                  <span className="eq-toggle-thumb" />
                </label>
              </div>

              <button
                className="shield-expand-btn"
                onClick={() => setExpanded(open ? null : key)}
              >
                {open ? "Hide examples ↑" : "See examples ↓"}
              </button>

              {open && (
                <div className="shield-examples">
                  {examples.map((ex, i) => (
                    <span key={i} className="shield-example-chip">
                      {ex}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Info box ── */}
      <div className="shield-info eq-card">
        <span className="shield-info-icon">ℹ</span>
        <span className="shield-info-text">
          Disabled categories are skipped entirely on the backend — no API calls
          are made, saving quota and improving speed.
        </span>
      </div>

      {/* ── External links ── */}
      <div className="shield-links">
        <a
          href="#"
          className="shield-link"
          onClick={(e) => {
            e.preventDefault();
            chrome.tabs.create({
              url:
                (window as any).__EQ_WEB__?.settings ||
                "https://eqai.innometrixtechub.in/settings",
            });
          }}
        >
          All Settings →
        </a>
        <a
          href="#"
          className="shield-link shield-link--gold"
          onClick={(e) => {
            e.preventDefault();
            chrome.tabs.create({
              url:
                (window as any).__EQ_WEB__?.subscription ||
                "https://eqai.innometrixtechub.in/subscription",
            });
          }}
        >
          💎 Upgrade Premium
        </a>
      </div>
    </div>
  );
};
export default Shield;
