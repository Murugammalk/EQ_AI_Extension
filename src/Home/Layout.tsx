import { Outlet, useNavigate, useLocation } from "react-router-dom";
import "./Layout.css";

const NAV = [
  {
    path: "/dashboard",
    label: "Dashboard",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect
          x="2"
          y="2"
          width="7"
          height="7"
          rx="2"
          fill={a ? "url(#g1)" : "currentColor"}
          opacity={a ? 1 : 0.4}
        />
        <rect
          x="11"
          y="2"
          width="7"
          height="7"
          rx="2"
          fill={a ? "url(#g1)" : "currentColor"}
          opacity={a ? 0.7 : 0.25}
        />
        <rect
          x="2"
          y="11"
          width="7"
          height="7"
          rx="2"
          fill={a ? "url(#g1)" : "currentColor"}
          opacity={a ? 0.7 : 0.25}
        />
        <rect
          x="11"
          y="11"
          width="7"
          height="7"
          rx="2"
          fill={a ? "url(#g1)" : "currentColor"}
          opacity={a ? 0.5 : 0.15}
        />
        <defs>
          <linearGradient
            id="g1"
            x1="0"
            y1="0"
            x2="20"
            y2="20"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#ca3838" />
            <stop offset="1" stopColor="#963838" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    path: "/shield",
    label: "Protect",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 2L3 5v5c0 4.418 3.134 8.109 7 9 3.866-.891 7-4.582 7-9V5L10 2Z"
          fill={a ? "url(#g2)" : "currentColor"}
          opacity={a ? 1 : 0.35}
        />
        <path
          d="M7 10l2 2 4-4"
          stroke={a ? "#0a0a0f" : "rgba(245,240,232,0.5)"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient
            id="g2"
            x1="0"
            y1="0"
            x2="20"
            y2="20"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#ca3838" />
            <stop offset="1" stopColor="#963838" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    path: "/me",
    label: "Me",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle
          cx="10"
          cy="7"
          r="3.5"
          fill={a ? "url(#g3)" : "currentColor"}
          opacity={a ? 1 : 0.35}
        />
        <path
          d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6"
          stroke={a ? "url(#g3)" : "currentColor"}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity={a ? 1 : 0.35}
        />
        <defs>
          <linearGradient
            id="g3"
            x1="0"
            y1="0"
            x2="20"
            y2="20"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#ca3838" />
            <stop offset="1" stopColor="#963838" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="layout">
      <div className="layout-content"><Outlet/></div>
      <nav className="layout-nav">
        {NAV.map(({path,icon,label})=>{
          const active=location.pathname===path;
          return (
            <button key={path} className={`nav-btn${active?" nav-btn--active":""}`} onClick={()=>navigate(path)}>
              {icon(active)}
              <span className="nav-label">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
