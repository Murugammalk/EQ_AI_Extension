import { useEffect, useState } from "react";
import { MemoryRouter, Route, Routes, Navigate } from "react-router-dom";
import { UserProvider } from "./context/UserContext";
import { FeedbackProvider } from "./context/FeedbackContext";
import { LocationProvider } from "./context/LocationContext";
import Layout from "./Home/Layout";
import { Login } from "./Login/Login";
import { Dashboard } from "./Dashboard/Dashboard";
import { Shield } from "./Shield/Shield";
import { Me } from "./Me/Me";
import { RateUs } from "./Me/RateUs";
import "./App.css";

const BASE_URL = import.meta.env.VITE_BASE_URL ?? "http://127.0.0.1:5000";

function Splash() {
  return (
    <div
      style={{
        width: "100%",
        height: "580px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        background: "var(--bg-base)",
      }}
    >
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
        <circle cx="26" cy="26" r="24" fill="url(#sp)" />
        <text
          x="26"
          y="33"
          textAnchor="middle"
          fill="#fff"
          fontSize="16"
          fontWeight="900"
          fontFamily="-apple-system,sans-serif"
        >
          EQ
        </text>
        <defs>
          <linearGradient
            id="sp"
            x1="0"
            y1="0"
            x2="52"
            y2="52"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#e63946" />
            <stop offset="0.5" stopColor="#c8922a" />
            <stop offset="1" stopColor="#f5c842" />
          </linearGradient>
        </defs>
      </svg>
      <div className="eq-spinner" style={{ width: "20px", height: "20px" }} />
    </div>
  );
}

function AuthRouter() {
  const [status, setStatus] = useState<"checking" | "auth" | "unauth">(
    "checking",
  );

  useEffect(() => {
    // No login record = never logged in → go to login immediately
    const loginTs = localStorage.getItem("eq_login_ts");
    if (!loginTs) {
      setStatus("unauth");
      return;
    }

    // Older than 30 days → force re-login
    if (Date.now() - parseInt(loginTs) > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem("user");
      localStorage.removeItem("eq_login_ts");
      setStatus("unauth");
      return;
    }

    // Has recent login → validate with backend
    fetch(`${BASE_URL}/session/validate`, {
      method: "GET",
      credentials: "include",
    })
      .then((res) => setStatus(res.ok ? "auth" : "unauth"))
      .catch(() => {
        // Offline — trust localStorage
        setStatus(localStorage.getItem("user") ? "auth" : "unauth");
      });
  }, []);

  if (status === "checking") return <Splash />;
  if (status === "unauth") return <Login />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/rateus" element={<RateUs />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/shield" element={<Shield />} />
        <Route path="/me" element={<Me />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function AuthExpiredWatcher() {
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg.type === "AUTH_EXPIRED") {
        localStorage.removeItem("user");
        localStorage.removeItem("eq_login_ts");
        window.location.reload();
      }
    };
    chrome.runtime?.onMessage?.addListener(handler);
    return () => chrome.runtime?.onMessage?.removeListener(handler);
  }, []);
  return null;
}

export default function App() {
  return (
    <MemoryRouter initialEntries={["/dashboard"]}>
      <UserProvider>
        <FeedbackProvider>
          <LocationProvider>
            <AuthExpiredWatcher />
            <AuthRouter />
          </LocationProvider>
        </FeedbackProvider>
      </UserProvider>
    </MemoryRouter>
  );
}
