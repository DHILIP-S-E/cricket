import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Gavel, Activity, BarChart2, Users, Trophy, LayoutDashboard, LogOut, Sun, Moon, Sparkles,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme, type Franchise } from "../../context/ThemeContext";

const NAV = [
  { to: "/",            label: "Dashboard",        icon: LayoutDashboard, end: true },
  { to: "/auction",     label: "Auction War Room", icon: Gavel },
  { to: "/prematch",    label: "Pre-Match Planner", icon: BarChart2 },
  { to: "/live",        label: "Live Match",        icon: Activity },
  { to: "/simulator",   label: "What-If Simulator", icon: Sparkles },
  { to: "/players",     label: "Players",           icon: Users },
  { to: "/tournaments", label: "Tournaments",       icon: Trophy },
];

export function Shell() {
  const { logout } = useAuth();
  const { franchise, colorMode, setFranchise, toggleColorMode } = useTheme();
  const navigate = useNavigate();

  // Get active team initials for logo
  const getInitials = (f: Franchise) => {
    if (f === "IPL_GOLD") return "IPL";
    return f;
  };

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-surface-card border-r border-surface-border flex flex-col">

        {/* Logo and Brand */}
        <div className="px-4 py-4 border-b border-surface-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center flex-shrink-0 shadow-md shadow-brand/20 transition-all duration-300 animate-pulse-slow">
              <span className="text-white text-xs font-black tracking-wider">{getInitials(franchise)}</span>
            </div>
            <div>
              <p className="text-sm font-extrabold text-text-primary leading-tight tracking-tight">Cricket IQ</p>
              <p className="text-[10px] text-text-secondary leading-tight font-medium">Decision Platform</p>
            </div>
          </div>
        </div>

        {/* Franchise Switcher & Mode Toggler */}
        <div className="px-4 py-3 border-b border-surface-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-text-secondary uppercase tracking-wider font-extrabold">Theme Controller</span>
            <button
              onClick={toggleColorMode}
              title={colorMode === "dark" ? "Day Match Mode (Light)" : "Night Match Mode (Dark)"}
              className="p-1 rounded bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors border border-surface-border flex items-center justify-center"
            >
              {colorMode === "dark" ? (
                <Sun size={12} className="text-amber-500" />
              ) : (
                <Moon size={12} className="text-indigo-600" />
              )}
            </button>
          </div>
          <select
            value={franchise}
            onChange={(e) => setFranchise(e.target.value as Franchise)}
            className="w-full text-xs px-2.5 py-1.5 bg-surface border border-surface-border rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand font-medium transition-all"
          >
            <option value="IPL_GOLD">🏆 IPL Gold (Default)</option>
            <option value="CSK">🦁 Chennai Super Kings</option>
            <option value="MI">⚡ Mumbai Indians</option>
            <option value="RCB">👑 Royal Challengers</option>
            <option value="KKR">💜 Kolkata Knight Riders</option>
            <option value="RR">💗 Rajasthan Royals</option>
            <option value="SRH">🔥 Sunrisers Hyderabad</option>
            <option value="GT">🛡️ Gujarat Titans</option>
            <option value="LSG">🦅 Lucknow Super Giants</option>
            <option value="DC">🐅 Delhi Capitals</option>
            <option value="PBKS">🦁 Punjab Kings</option>
          </select>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-muted text-brand border border-brand/10 shadow-sm"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
                }`
              }
            >
              {() => (
                <>
                  <Icon size={15} className="flex-shrink-0" />
                  <span>{label}</span>
                  {label === "Live Match" && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-surface-border">
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors w-full"
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Page content */}
      <main className="flex-1 overflow-hidden flex flex-col bg-surface">
        <Outlet />
      </main>
    </div>
  );
}
