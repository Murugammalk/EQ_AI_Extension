import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import "./Me.css";

const BASE_API = import.meta.env.VITE_BASE_API ?? "http://127.0.0.1:5000";
const WEB_BASE =
  import.meta.env.VITE_WEB_BASE ?? "https://eqai.innometrixtechub.in";
const AUTH_CHANGED_EVENT = "eq-auth-changed";

const openTab = (path: string) =>
  chrome.tabs?.create({ url: `${WEB_BASE}${path}` });

const formatDate = (value: number) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 12.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Z"
      fill="currentColor"
      opacity="0.92"
    />
    <path
      d="M4.75 19.25c0-3.18 3.25-5.75 7.25-5.75s7.25 2.57 7.25 5.75"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const CrownIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M5 18.25h14l1-9-5.1 4.1L12 6.25l-2.9 7.1L4 9.25l1 9Z"
      fill="currentColor"
      opacity="0.92"
    />
  </svg>
);

const ChartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M5.75 18.25V13.5m6.25 4.75V9.5m6.25 8.75V6.75"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M4.75 18.25h14.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      opacity="0.5"
    />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 8.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="m19.25 12 .98-1.7-1.85-3.2-1.96.34a6.74 6.74 0 0 0-1.48-.86l-.6-1.9h-3.68l-.6 1.9c-.52.2-1.02.49-1.47.86l-1.97-.34-1.84 3.2.97 1.7a7.6 7.6 0 0 0 0 1.72l-.97 1.7 1.84 3.2 1.97-.34c.45.37.95.66 1.47.86l.6 1.9h3.68l.6-1.9c.52-.2 1.02-.49 1.48-.86l1.96.34 1.85-3.2-.98-1.7c.1-.57.1-1.15 0-1.72Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.7"
    />
  </svg>
);

const StarIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="m12 4.5 2.2 4.46 4.93.72-3.56 3.47.84 4.9L12 15.73l-4.41 2.32.84-4.9-3.56-3.47 4.93-.72L12 4.5Z"
      fill="currentColor"
      opacity="0.92"
    />
  </svg>
);

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M7.75 12h8.5m0 0-3.5-3.5m3.5 3.5-3.5 3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Me: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const [loggingOut, setLoggingOut] = useState(false);
  const displayName = user?.username || user?.email?.split("@")[0] || "Guest";
  const initial = displayName[0]?.toUpperCase() || "?";
  const loginTs = Number(localStorage.getItem("eq_login_ts"));
  const hasLoginTs = Number.isFinite(loginTs) && loginTs > 0;
  const memberSince = hasLoginTs ? formatDate(loginTs) : "Recently joined";
  const sessionDays = hasLoginTs
    ? Math.max(1, Math.floor((Date.now() - loginTs) / 86400000))
    : 0;

  const handleSignOut = async () => {
    setLoggingOut(true);

    try {
      await fetch(`${BASE_API}/Extension/Logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      console.warn("[EQ] Logout network error (proceeding anyway):", e);
    } finally {
      localStorage.removeItem("user");
      localStorage.removeItem("eq_login_ts");
      localStorage.removeItem("eq_relogin_required");
      chrome.storage?.local?.remove(["user_email", "user_name"]);
      setUser(null);
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      setLoggingOut(false);
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="me-page eq-page">
      <section className="me-hero eq-card eq-card--glow">
        <div className="me-hero-top">
          <div className="me-hero-chip">
            <ProfileIcon />
            <span>My Account</span>
          </div>
          <div className="me-badge">Free plan</div>
        </div>

        <div className="me-profile-row">
          <div className="me-avatar">
            <span className="me-avatar-letter">{initial}</span>
            <div className="me-avatar-ring" />
            <div className="me-avatar-status" />
          </div>

          <div className="me-info">
            <span className="me-name">{displayName}</span>
            <span className="me-email">{user?.email || "-"}</span>
            <span className="me-status-line">Privacy Guard active</span>
          </div>
        </div>

        <div className="me-metrics">
          <div className="me-metric">
            <span className="me-metric-label">Member since</span>
            <span className="me-metric-value">{memberSince}</span>
          </div>
          <div className="me-metric">
            <span className="me-metric-label">Secure session</span>
            <span className="me-metric-value">
              {sessionDays > 0 ? `${sessionDays} day${sessionDays > 1 ? "s" : ""}` : "Today"}
            </span>
          </div>
        </div>
      </section>

      <button className="me-premium eq-card eq-card--glow" onClick={() => openTab("/subscription")}>
        <div className="me-premium-accent" />
        <div className="me-premium-left">
          <span className="me-premium-icon">
            <CrownIcon />
          </span>
          <div>
            <div className="me-premium-title">Unlock Premium protection</div>
            <div className="me-premium-sub">
              Unlimited scans, smarter analytics, and priority support
            </div>
          </div>
        </div>
        <span className="me-premium-arrow">
          <ArrowIcon />
        </span>
      </button>

      <div className="me-section-head">
        <span className="me-section-title">Quick actions</span>
        <span className="me-section-sub">Open the tools you use most</span>
      </div>

      <div className="me-links eq-card">
        <button className="me-link-row" onClick={() => openTab("/dashboard")}>
          <span className="me-link-icon me-link-icon--dashboard">
            <ChartIcon />
          </span>
          <span className="me-link-copy">
            <span className="me-link-label">Full Dashboard</span>
            <span className="me-link-desc">
              Review exposure trends and privacy actions
            </span>
          </span>
          <span className="me-link-arr">
            <ArrowIcon />
          </span>
        </button>
        <button className="me-link-row" onClick={() => openTab("/settings")}>
          <span className="me-link-icon me-link-icon--settings">
            <SettingsIcon />
          </span>
          <span className="me-link-copy">
            <span className="me-link-label">Account Settings</span>
            <span className="me-link-desc">
              Manage preferences, alerts, and account details
            </span>
          </span>
          <span className="me-link-arr">
            <ArrowIcon />
          </span>
        </button>
        <button className="me-link-row" onClick={() => navigate("/rateus")}>
          <span className="me-link-icon me-link-icon--rate">
            <StarIcon />
          </span>
          <span className="me-link-copy">
            <span className="me-link-label">Rate EQ of AI</span>
            <span className="me-link-desc">
              Share feedback to help us improve detection quality
            </span>
          </span>
          <span className="me-link-arr">
            <ArrowIcon />
          </span>
        </button>
      </div>

      <div className="me-footer">
        <div className="me-version">EQ of AI v2.0</div>
        <div className="me-version">Privacy Guard enabled</div>
      </div>

      <button
        className="me-signout"
        onClick={handleSignOut}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <>
            <span className="eq-spinner" /> Signing out...
          </>
        ) : (
          "Sign out"
        )}
      </button>
    </div>
  );
};

export default Me;
