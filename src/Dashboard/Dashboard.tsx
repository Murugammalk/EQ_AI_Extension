import { useState, useEffect, useCallback } from "react";
import { useUser } from "../context/UserContext";
import "./Dashboard.css";

interface RiskCounts {
  high: number;
  medium: number;
  low: number;
}
interface ExposureItem {
  label: string;
  percentage: number;
}
interface ActionItem {
  action: string;
  data_type: string;
  score: number;
  value?: string;
  ts: number;
}

const ACTION_LABEL: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  mask: { label: "Masked", color: "#60a5fa", icon: "🔒" },
  replace: { label: "Replaced", color: "#a78bfa", icon: "🔄" },
  remove: { label: "Removed", color: "#f87171", icon: "🗑" },
  ignored: { label: "Ignored", color: "#6b7280", icon: "👁" },
};

const CAT_COLOR: Record<string, string> = {
  Financial: "#f5c842",
  Personal: "#60a5fa",
  Medical: "#f87171",
  Organizational: "#a78bfa",
};

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export const Dashboard: React.FC = () => {
  const { user } = useUser();
  const [site, setSite] = useState("—");
  const [riskCounts, setRiskCounts] = useState<RiskCounts>({
    high: 0,
    medium: 0,
    low: 0,
  });
  const [exposure, setExposure] = useState<ExposureItem[]>([
    { label: "Financial", percentage: 0 },
    { label: "Personal", percentage: 0 },
    { label: "Medical", percentage: 0 },
    { label: "Organizational", percentage: 0 },
  ]);
  const [history, setHistory] = useState<ActionItem[]>([]);
  const [score, setScore] = useState(0);
  const [date, setDate] = useState(
    new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  );

  const loadData = useCallback(() => {
    chrome.storage.local.get(
      ["websiteDomain", "riskCounts", "riskDate", "exposureData"],
      (r) => {
        if (r.websiteDomain) setSite(r.websiteDomain);
        if (r.riskCounts) setRiskCounts(r.riskCounts);
        if (r.riskDate) setDate(r.riskDate);
        if (r.exposureData) {
          try {
            const d: ExposureItem[] = JSON.parse(r.exposureData);
            setExposure(d);
            const avg = d.reduce((s, i) => s + i.percentage, 0) / d.length;
            setScore(Math.round(avg));
          } catch {}
        }
      },
    );
    chrome.runtime.sendMessage({ type: "GET_STATS" }, (res) => {
      if (res?.history) setHistory(res.history);
    });
  }, []);

  useEffect(() => {
    loadData();
    const handler = (msg: any) => {
      if (msg.type === "riskCountsUpdate") setRiskCounts(msg.data);
      if (msg.type === "exposureUpdate") setExposure(msg.data);
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [loadData]);

  const total = riskCounts.high + riskCounts.medium + riskCounts.low;
  const cx = 52,
    cy = 52,
    r = 40,
    circ = 2 * Math.PI * r;
  const highArc = total ? (riskCounts.high / total) * circ : 0;
  const medArc = total ? (riskCounts.medium / total) * circ : 0;
  const lowArc = total ? (riskCounts.low / total) * circ : 0;

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12
      ? "Good morning"
      : greetingHour < 18
        ? "Good afternoon"
        : "Good evening";
  const firstName = user?.username?.split(" ")[0] || "there";

  return (
    <div className="dashboard eq-page">
      {/* ── Top bar ── */}
      <div className="dash-topbar">
        <div className="dash-greeting">
          <span className="dash-greeting-text">
            {greeting}, <span className="gold-text">{firstName}</span>
          </span>
          <span className="dash-site">{site}</span>
        </div>
        <div
          className={`dash-status ${total > 0 ? "dash-status--alert" : "dash-status--safe"}`}
        >
          <span className="dash-status-dot" />
          {total > 0 ? `${total} detected` : "All clear"}
        </div>
      </div>

      {/* ── Score row: donut + risk pills ── */}
      <div className="dash-score-row">
        {/* Donut */}
        <div className="dash-donut-wrap">
          <svg width="104" height="104" viewBox="0 0 104 104">
            <defs>
              <linearGradient id="dg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#d43333" />
                <stop offset="100%" stopColor="#8b1a1a" />
              </linearGradient>
            </defs>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="rgba(245,200,66,0.06)"
              strokeWidth="12"
            />
            {total > 0 ? (
              <>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke="#f87171"
                  strokeWidth="12"
                  strokeDasharray={`${highArc} ${circ - highArc}`}
                  strokeDashoffset={circ * 0.25}
                  strokeLinecap="butt"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="12"
                  strokeDasharray={`${medArc} ${circ - medArc}`}
                  strokeDashoffset={circ * 0.25 - highArc}
                  strokeLinecap="butt"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="12"
                  strokeDasharray={`${lowArc} ${circ - lowArc}`}
                  strokeDashoffset={circ * 0.25 - highArc - medArc}
                  strokeLinecap="butt"
                />
              </>
            ) : (
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="url(#dg)"
                strokeWidth="12"
                strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
                strokeDashoffset={circ * 0.25}
                strokeLinecap="butt"
                opacity="0.25"
              />
            )}
            <text
              x={cx}
              y={cy - 6}
              textAnchor="middle"
              fill="#f5f0e8"
              fontSize="18"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              {score}%
            </text>
            <text
              x={cx}
              y={cy + 10}
              textAnchor="middle"
              fill="rgba(245,240,232,0.35)"
              fontSize="9"
              fontFamily="Inter, sans-serif"
            >
              EXPOSURE
            </text>
          </svg>
        </div>

        {/* Risk pills */}
        <div className="dash-risk-pills">
          <div className="risk-pill risk-pill--high">
            <span className="risk-pill-num">{riskCounts.high}</span>
            <span className="risk-pill-label">High</span>
          </div>
          <div className="risk-pill risk-pill--med">
            <span className="risk-pill-num">{riskCounts.medium}</span>
            <span className="risk-pill-label">Medium</span>
          </div>
          <div className="risk-pill risk-pill--low">
            <span className="risk-pill-num">{riskCounts.low}</span>
            <span className="risk-pill-label">Low</span>
          </div>
          <div className="risk-date">{date}</div>
        </div>
      </div>

      {/* ── Exposure bars ── */}
      <div className="dash-section">
        <div className="dash-section-title">
          <span>Data Exposure</span>
          <span className="dash-section-sub">by category</span>
        </div>
        <div className="dash-bars eq-card">
          {exposure.map((item) => (
            <div key={item.label} className="dash-bar-row">
              <span
                className="dash-bar-dot"
                style={{ background: CAT_COLOR[item.label] || "#ca3838" }}
              />
              <span className="dash-bar-name">{item.label}</span>
              <div className="dash-bar-track">
                <div
                  className="dash-bar-fill"
                  style={{
                    width: `${item.percentage}%`,
                    background: CAT_COLOR[item.label] || "var(--gold-grad)",
                  }}
                />
              </div>
              <span className="dash-bar-pct">{item.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recent actions feed ── */}
      <div className="dash-section">
        <div className="dash-section-title">
          <span>Recent Actions</span>
          <span className="dash-section-sub">this session</span>
        </div>
        {history.length === 0 ? (
          <div className="dash-empty eq-card">
            <span className="dash-empty-icon">🛡</span>
            <span className="dash-empty-text">
              No actions yet — EQ is watching
            </span>
          </div>
        ) : (
          <div className="dash-feed eq-card">
            {history.slice(0, 6).map((item, i) => {
              const meta = ACTION_LABEL[item.action] || {
                label: item.action,
                color: "#888",
                icon: "•",
              };
              return (
                <div key={i} className="dash-feed-row">
                  <span className="dash-feed-icon">{meta.icon}</span>
                  <div className="dash-feed-info">
                    <span className="dash-feed-value">
                      {item.value
                        ? item.value.length > 18
                          ? item.value.slice(0, 18) + "…"
                          : item.value
                        : item.data_type}
                    </span>
                    <span className="dash-feed-cat">{item.data_type}</span>
                  </div>
                  <div className="dash-feed-right">
                    <span
                      className="dash-feed-action"
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    <span className="dash-feed-time">{timeAgo(item.ts)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Tip card ── */}
      <div className="dash-tip eq-card eq-card--glow">
        <span className="dash-tip-icon">💡</span>
        <span className="dash-tip-text">
          {score > 50
            ? "High exposure detected. Consider masking sensitive data before sharing."
            : score > 20
              ? "Moderate exposure. Review your recent actions to stay protected."
              : "Great job! Your data exposure is low. Keep using EQ."}
        </span>
      </div>
    </div>
  );
};
export default Dashboard;
