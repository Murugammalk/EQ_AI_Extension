import { useState } from "react";
import axios from "axios";
import { UAParser } from "ua-parser-js";
import { useUser } from "../context/UserContext";
import logo from "../assets/eq-logo.png";
import "./Login.css";

const BASE_URL = import.meta.env.VITE_BASE_URL ?? "http://127.0.0.1:5000";
const WEB_URL = "https://eqai.innometrixtechub.in"; // always prod website

export const Login: React.FC = () => {
  const { setUser } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getDeviceInfo = () => {
    const ua = new UAParser().getResult();
    return {
      deviceId: `${ua.os.name}-${ua.browser.name}-${window.screen.width}x${window.screen.height}`,
      browser: `${ua.browser.name} ${ua.browser.version}`,
      os: `${ua.os.name} ${ua.os.version}`,
      deviceType: ua.device.type || "Desktop",
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userAgent: navigator.userAgent,
    };
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Enter email and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await axios.post(
        `${BASE_URL}/Login/Extension`,
        { email, password, deviceInfo: getDeviceInfo() },
        { withCredentials: true },
      );
      if (res.status === 200) {
        const { user_name, user_email } = res.data;
        const finalEmail = user_email || email;
        localStorage.setItem(
          "user",
          JSON.stringify({ email: finalEmail, name: user_name }),
        );
        localStorage.setItem("eq_login_ts", Date.now().toString());
        chrome.storage?.local?.set({ user_email: finalEmail, user_name });
        setUser({ email: finalEmail, username: user_name });
        window.location.reload();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || "";
      if (msg.includes("verification"))
        setError("Email not verified. Check your inbox.");
      else setError(msg || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-glow" />
      <div className="login-box">
        <div className="login-logo-wrap">
          <div className="login-logo-ring">
            <img src={logo} alt="EQ of AI" className="login-logo-img" />
          </div>
          <div className="login-brand">
            <span className="login-brand-main">EQ of AI</span>
            <span className="login-brand-sub">Privacy Guard</span>
          </div>
        </div>

        <h1 className="login-heading">Welcome back</h1>
        <p className="login-desc">Protect your data across AI platforms</p>

        {error && <div className="login-error">{error}</div>}

        <div className="login-fields">
          <div className="login-field">
            <label className="login-label">Email</label>
            <input
              className="login-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              autoComplete="email"
            />
          </div>
          <div className="login-field">
            <div className="login-label-row">
              <label className="login-label">Password</label>
              <a
                className="login-forgot"
                href={`${WEB_URL}/forgot-password`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Forgot?
              </a>
            </div>
            <div className="login-input-wrap">
              <input
                className="login-input"
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPass(!showPass)}
              >
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>
        </div>

        <button className="login-btn" onClick={handleLogin} disabled={loading}>
          {loading ? (
            <>
              <span className="eq-spinner login-spinner-sm" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>

        <div className="login-signup">
          <span>New to EQ?</span>
          <a
            href={`${WEB_URL}/Signup`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Create account →
          </a>
        </div>
      </div>
    </div>
  );
};
export default Login;
