import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Gavel, Activity, BarChart2, Users, Trophy, LayoutDashboard, LogOut,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const NAV = [
  { to: "/",            label: "Dashboard",        icon: LayoutDashboard, end: true },
  { to: "/auction",     label: "Auction War Room", icon: Gavel },
  { to: "/prematch",    label: "Pre-Match Planner", icon: BarChart2 },
  { to: "/live",        label: "Live Match",        icon: Activity },
  { to: "/players",     label: "Players",           icon: Users },
  { to: "/tournaments", label: "Tournaments",       icon: Trophy },
];

export function Shell() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-[#0f1117] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-[#161b22] border-r border-[#30363d] flex flex-col">

        {/* Logo */}
        <div className="px-4 py-4 border-b border-[#30363d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#238636] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">C</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-100 leading-tight">Cricket IQ</p>
              <p className="text-[10px] text-gray-500 leading-tight">Decision Platform</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#1a3a20] text-[#22c55e]"
                    : "text-gray-400 hover:text-gray-100 hover:bg-[#1c2128]"
                }`
              }
            >
              {() => (
                <>
                  <Icon size={15} className="flex-shrink-0" />
                  <span>{label}</span>
                  {label === "Live Match" && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-[#30363d]">
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-100 hover:bg-[#1c2128] transition-colors w-full"
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Page content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
