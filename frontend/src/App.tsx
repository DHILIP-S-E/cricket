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
  return (
    <TooltipProvider delayDuration={300}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<LoginView />} />

          {/* All platform routes inside the Shell layout */}
          <Route
            element={
              <ProtectedRoute>
                <Shell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="auction" element={<AuctionRoom />} />
            <Route path="prematch/:matchId?" element={<PreMatch />} />
            <Route path="live/:matchId?" element={<LiveMatch />} />
            <Route path="players" element={<Players />} />
            <Route path="tournaments" element={<Tournaments />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <AgentPanel />
      </BrowserRouter>
    </TooltipProvider>
  );
}
