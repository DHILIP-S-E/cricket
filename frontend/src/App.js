import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { TooltipProvider } from "./components/ui/tooltip";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AgentPanel } from "./components/AgentPanel";
import { Shell } from "./components/layout/Shell";
import { LoginView } from "./custom-pages/auth/LoginView";
import { Dashboard } from "./pages/Dashboard";
import { AuctionRoom } from "./pages/AuctionRoom";
import { PreMatch } from "./pages/PreMatch";
import { LiveMatch } from "./pages/LiveMatch";
import { Players } from "./pages/Players";
import { Tournaments } from "./pages/Tournaments";
export default function App() {
    return (_jsx(TooltipProvider, { delayDuration: 300, children: _jsxs(BrowserRouter, { children: [_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginView, {}) }), _jsxs(Route, { element: _jsx(ProtectedRoute, { children: _jsx(Shell, {}) }), children: [_jsx(Route, { index: true, element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "auction", element: _jsx(AuctionRoom, {}) }), _jsx(Route, { path: "prematch/:matchId?", element: _jsx(PreMatch, {}) }), _jsx(Route, { path: "live/:matchId?", element: _jsx(LiveMatch, {}) }), _jsx(Route, { path: "players", element: _jsx(Players, {}) }), _jsx(Route, { path: "tournaments", element: _jsx(Tournaments, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }), _jsx(AgentPanel, {})] }) }));
}
