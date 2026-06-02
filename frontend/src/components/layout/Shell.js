import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Gavel, Activity, BarChart2, Users, Trophy, LayoutDashboard, LogOut, } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
const NAV = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/auction", label: "Auction War Room", icon: Gavel },
    { to: "/prematch", label: "Pre-Match Planner", icon: BarChart2 },
    { to: "/live", label: "Live Match", icon: Activity },
    { to: "/players", label: "Players", icon: Users },
    { to: "/tournaments", label: "Tournaments", icon: Trophy },
];
export function Shell() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    return (_jsxs("div", { className: "flex h-screen bg-[#0f1117] overflow-hidden", children: [_jsxs("aside", { className: "w-56 flex-shrink-0 bg-[#161b22] border-r border-[#30363d] flex flex-col", children: [_jsx("div", { className: "px-4 py-4 border-b border-[#30363d]", children: _jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-[#238636] flex items-center justify-center flex-shrink-0", children: _jsx("span", { className: "text-white text-sm font-bold", children: "C" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-bold text-gray-100 leading-tight", children: "Cricket IQ" }), _jsx("p", { className: "text-[10px] text-gray-500 leading-tight", children: "Decision Platform" })] })] }) }), _jsx("nav", { className: "flex-1 px-2 py-3 space-y-0.5 overflow-y-auto", children: NAV.map(({ to, label, icon: Icon, end }) => (_jsx(NavLink, { to: to, end: end, className: ({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                ? "bg-[#1a3a20] text-[#22c55e]"
                                : "text-gray-400 hover:text-gray-100 hover:bg-[#1c2128]"}`, children: () => (_jsxs(_Fragment, { children: [_jsx(Icon, { size: 15, className: "flex-shrink-0" }), _jsx("span", { children: label }), label === "Live Match" && (_jsx("span", { className: "ml-auto w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" }))] })) }, to))) }), _jsx("div", { className: "px-2 py-3 border-t border-[#30363d]", children: _jsxs("button", { onClick: () => { logout(); navigate("/login"); }, className: "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-100 hover:bg-[#1c2128] transition-colors w-full", children: [_jsx(LogOut, { size: 15 }), _jsx("span", { children: "Logout" })] }) })] }), _jsx("main", { className: "flex-1 overflow-hidden flex flex-col", children: _jsx(Outlet, {}) })] }));
}
