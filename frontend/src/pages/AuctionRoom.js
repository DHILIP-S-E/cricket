import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gavel, TrendingUp, AlertCircle, ChevronRight } from "lucide-react";
import { auctionApi } from "../api/cricket";
import { useWebSocket } from "../api/websocket";
import { Card, CardHeader, Stat, Badge, ConfidenceBadge, RoleBadge, BudgetMeter, PageHeader, EmptyState, } from "../components/ui";
const SESSION_ID = import.meta.env.VITE_AUCTION_SESSION_ID ?? "";
const FRANCHISE_ID = import.meta.env.VITE_FRANCHISE_ID ?? "";
export function AuctionRoom() {
    const qc = useQueryClient();
    const [liveConnected, setLiveConnected] = useState(false);
    // Live WebSocket — refresh data on any auction event
    useWebSocket(`/ws/auction/${SESSION_ID}`, (msg) => {
        if (msg.type === "connected")
            setLiveConnected(true);
        if (msg.type === "auction_update") {
            qc.invalidateQueries({ queryKey: ["auction"] });
        }
    }, !!SESSION_ID);
    const { data: sessionRes } = useQuery({
        queryKey: ["auction", "session", SESSION_ID],
        queryFn: () => auctionApi.session(SESSION_ID),
        refetchInterval: 5000,
        enabled: !!SESSION_ID,
    });
    const { data: currentLotRes } = useQuery({
        queryKey: ["auction", "current-lot", SESSION_ID],
        queryFn: () => auctionApi.currentLot(SESSION_ID),
        refetchInterval: 3000,
        enabled: !!SESSION_ID,
    });
    const { data: recRes } = useQuery({
        queryKey: ["auction", "rec", SESSION_ID, FRANCHISE_ID],
        queryFn: () => auctionApi.recommendation(SESSION_ID, FRANCHISE_ID),
        refetchInterval: 5000,
        enabled: !!SESSION_ID && !!FRANCHISE_ID,
    });
    const { data: teamsRes } = useQuery({
        queryKey: ["auction", "teams", SESSION_ID],
        queryFn: () => auctionApi.teamStates(SESSION_ID),
        refetchInterval: 5000,
        enabled: !!SESSION_ID,
    });
    const { data: queueRes } = useQuery({
        queryKey: ["auction", "queue", SESSION_ID],
        queryFn: () => auctionApi.queue(SESSION_ID),
        refetchInterval: 10000,
        enabled: !!SESSION_ID,
    });
    const session = sessionRes?.data;
    const lot = currentLotRes?.data;
    const rec = recRes?.data;
    const teams = teamsRes?.data ?? [];
    const queue = queueRes?.data ?? [];
    const myTeam = teams.find(t => t.franchise_id === FRANCHISE_ID);
    if (!SESSION_ID) {
        return (_jsx("div", { className: "h-full flex items-center justify-center", children: _jsxs("div", { className: "text-center", children: [_jsx(Gavel, { size: 48, className: "mx-auto text-gray-600 mb-3" }), _jsx("p", { className: "text-gray-400 text-sm", children: "Set VITE_AUCTION_SESSION_ID in your .env to connect" })] }) }));
    }
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsx(PageHeader, { title: "Auction War Room", subtitle: session?.name ?? "Loading...", right: _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-xs", children: [_jsx("div", { className: `w-2 h-2 rounded-full ${liveConnected ? "bg-signal-green animate-pulse-slow" : "bg-gray-600"}` }), _jsx("span", { className: "text-gray-500", children: liveConnected ? "Live" : "Connecting..." })] }), session && (_jsxs("div", { className: "text-xs text-gray-500", children: ["Sold: ", _jsx("span", { className: "text-gray-300 font-mono", children: session.total_players_sold }), " ", "\u00B7 Unsold: ", _jsx("span", { className: "text-gray-300 font-mono", children: session.total_players_unsold })] }))] }) }), _jsx("div", { className: "flex-1 overflow-auto", children: _jsxs("div", { className: "grid grid-cols-12 gap-4 p-4 min-h-full", children: [_jsxs("div", { className: "col-span-4 space-y-4", children: [lot ? (_jsx(CurrentLotCard, { lot: lot, rec: rec })) : (_jsx(Card, { children: _jsx(EmptyState, { message: "No active lot", icon: _jsx(Gavel, { size: 32 }) }) })), myTeam && _jsx(MySquadCard, { team: myTeam })] }), _jsxs("div", { className: "col-span-5 space-y-4", children: [_jsx(SquadSlotGrid, { team: myTeam }), _jsx(TeamBudgetsCard, { teams: teams, myFranchiseId: FRANCHISE_ID })] }), _jsx("div", { className: "col-span-3 space-y-4", children: _jsx(QueueCard, { items: queue }) })] }) })] }));
}
// ─── Current Lot Card ─────────────────────────────────────────────────────────
function CurrentLotCard({ lot, rec }) {
    const player = lot.player;
    const shouldBid = rec?.should_bid;
    return (_jsxs(Card, { children: [_jsx(CardHeader, { title: `Lot #${lot.lot_number}`, subtitle: "Current player under the hammer", right: _jsx("div", { className: "live-dot" }) }), _jsxs("div", { className: "flex items-start gap-3 mb-4", children: [_jsx("div", { className: "w-12 h-12 rounded-lg bg-surface-elevated flex items-center justify-center text-2xl", children: "\uD83C\uDFCF" }), _jsxs("div", { children: [_jsx("h2", { className: "text-base font-bold text-gray-100", children: player.full_name }), _jsxs("div", { className: "flex items-center gap-1.5 mt-1 flex-wrap", children: [_jsx(RoleBadge, { role: player.playing_role }), _jsx(Badge, { label: player.nationality, variant: player.nationality === "India" ? "blue" : "purple" }), player.ipl_caps > 0 && _jsx(Badge, { label: `${player.ipl_caps} IPL caps`, variant: "gray" })] })] })] }), _jsxs("div", { className: "grid grid-cols-3 gap-3 mb-4 bg-surface-elevated rounded-lg p-3", children: [_jsx(Stat, { label: "Base Price", value: `₹${lot.base_price_cr}`, sub: "Cr" }), rec && _jsx(Stat, { label: "AI Fair Value", value: `₹${rec.fair_value_cr.toFixed(1)}`, sub: "Cr", color: "text-signal-green" }), rec && _jsx(Stat, { label: "Max Bid", value: `₹${rec.recommended_max_bid_cr.toFixed(1)}`, sub: "Cr", color: "text-signal-amber" })] }), rec && (_jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "flex justify-between text-xs text-gray-500 mb-1", children: [_jsxs("span", { children: ["Low: \u20B9", rec.confidence_low_cr.toFixed(1), " Cr"] }), _jsx(ConfidenceBadge, { confidence: rec.confidence }), _jsxs("span", { children: ["High: \u20B9", rec.confidence_high_cr.toFixed(1), " Cr"] })] }), _jsxs("div", { className: "h-1.5 bg-surface-border rounded-full relative", children: [_jsx("div", { className: "absolute h-full bg-signal-green/30 rounded-full", style: {
                                    left: `${(rec.confidence_low_cr / (rec.confidence_high_cr * 1.5)) * 100}%`,
                                    width: `${((rec.confidence_high_cr - rec.confidence_low_cr) / (rec.confidence_high_cr * 1.5)) * 100}%`,
                                } }), _jsx("div", { className: "absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-signal-green border border-surface", style: { left: `${(rec.fair_value_cr / (rec.confidence_high_cr * 1.5)) * 100}%` } })] })] })), rec && (_jsxs("div", { className: `rounded-lg p-3 border ${shouldBid ? "bg-green-900/20 border-green-800" : "bg-red-900/20 border-red-800"}`, children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [shouldBid
                                ? _jsx(TrendingUp, { size: 14, className: "text-signal-green" })
                                : _jsx(AlertCircle, { size: 14, className: "text-signal-red" }), _jsx("span", { className: `text-sm font-bold ${shouldBid ? "text-signal-green" : "text-signal-red"}`, children: shouldBid ? "BID" : "PASS" })] }), _jsx("p", { className: "text-xs text-gray-400 leading-relaxed", children: rec.reasoning }), rec.squad_impact && (_jsx("p", { className: "text-xs text-gray-500 mt-1.5 italic", children: rec.squad_impact }))] }))] }));
}
// ─── My Squad Card ────────────────────────────────────────────────────────────
function MySquadCard({ team }) {
    return (_jsxs(Card, { children: [_jsx(CardHeader, { title: "My Squad", subtitle: team.franchise_name }), _jsxs("div", { className: "grid grid-cols-2 gap-3 mb-3", children: [_jsx(BudgetMeter, { remaining: team.remaining_budget_cr, total: team.initial_purse_cr, label: "Budget remaining" }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "stat-label", children: "Squad" }), _jsxs("p", { className: "text-lg font-bold font-mono text-gray-100", children: [team.squad_size, _jsxs("span", { className: "text-gray-600", children: ["/", team.squad_size_max] })] })] })] }), _jsx("div", { className: "grid grid-cols-4 gap-2 text-center text-xs", children: [
                    { label: "WK", val: team.wk_count, need: 1 },
                    { label: "BAT", val: team.batter_count, need: 4 },
                    { label: "BWL", val: team.bowler_count, need: 4 },
                    { label: "ALR", val: team.all_rounder_count, need: 2 },
                ].map(({ label, val, need }) => (_jsxs("div", { className: `rounded-md p-2 ${val >= need ? "bg-surface-elevated" : "bg-red-900/20 border border-red-900"}`, children: [_jsx("p", { className: "text-gray-500 text-[10px]", children: label }), _jsx("p", { className: `font-mono font-bold ${val >= need ? "text-gray-200" : "text-signal-red"}`, children: val })] }, label))) }), _jsxs("div", { className: "mt-2 flex items-center justify-between text-xs text-gray-500", children: [_jsxs("span", { children: ["Overseas: ", team.overseas_slots_used, "/", team.overseas_slots_max] }), team.rtm_available && _jsx(Badge, { label: `RTM ×${team.rtm_count}`, variant: "purple" })] })] }));
}
// ─── Squad Slot Grid ──────────────────────────────────────────────────────────
function SquadSlotGrid({ team }) {
    if (!team)
        return _jsx(Card, { children: _jsx(EmptyState, { message: "Squad data unavailable" }) });
    const bought = team.players_bought ?? [];
    return (_jsxs(Card, { children: [_jsx(CardHeader, { title: "Live Squad Builder", subtitle: `${bought.length} players acquired` }), _jsx("div", { className: "grid grid-cols-5 gap-1.5 max-h-64 overflow-y-auto", children: Array.from({ length: team.squad_size_max }).map((_, i) => {
                    const player = bought[i];
                    return (_jsx("div", { className: `rounded-md p-1.5 text-center text-[10px] border transition-colors ${player
                            ? "bg-surface-elevated border-surface-border"
                            : "border-dashed border-surface-border opacity-40"}`, children: player ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-gray-300 truncate font-medium leading-tight", children: player.player_id?.slice(0, 6) ?? "—" }), _jsxs("p", { className: "text-gray-600 mt-0.5", children: ["\u20B9", Number(player.price_cr ?? 0).toFixed(1)] })] })) : (_jsxs("p", { className: "text-gray-700 mt-1", children: ["Slot ", i + 1] })) }, i));
                }) })] }));
}
// ─── Team Budgets ─────────────────────────────────────────────────────────────
function TeamBudgetsCard({ teams, myFranchiseId }) {
    const sorted = [...teams].sort((a, b) => b.remaining_budget_cr - a.remaining_budget_cr);
    const maxBudget = Math.max(...sorted.map(t => t.initial_purse_cr), 1);
    return (_jsxs(Card, { children: [_jsx(CardHeader, { title: "All Team Budgets" }), _jsx("div", { className: "space-y-2", children: sorted.map(t => (_jsxs("div", { className: `flex items-center gap-3 p-2 rounded-lg ${t.franchise_id === myFranchiseId ? "bg-surface-elevated" : ""}`, children: [_jsx("span", { className: "text-xs font-mono text-gray-400 w-10 flex-shrink-0", children: t.franchise_short_name }), _jsx("div", { className: "flex-1", children: _jsx("div", { className: "flex items-center gap-1 mb-1", children: _jsx("div", { className: "h-1.5 rounded-full bg-signal-green", style: { width: `${(t.remaining_budget_cr / maxBudget) * 100}%` } }) }) }), _jsxs("span", { className: "text-xs font-mono text-gray-300 w-16 text-right flex-shrink-0", children: ["\u20B9", t.remaining_budget_cr.toFixed(0), " Cr"] }), _jsxs("span", { className: "text-xs text-gray-600 w-8 text-right flex-shrink-0", children: [t.squad_size, "p"] })] }, t.franchise_id))) })] }));
}
// ─── Queue Card ───────────────────────────────────────────────────────────────
function QueueCard({ items }) {
    return (_jsxs(Card, { children: [_jsx(CardHeader, { title: "Upcoming Queue", subtitle: `${items.length} players remaining` }), _jsxs("div", { className: "space-y-1.5", children: [items.slice(0, 8).map((item, i) => (_jsxs("div", { className: "flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-elevated transition-colors", children: [_jsx("span", { className: "text-xs text-gray-600 w-5 text-right font-mono", children: i + 1 }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm text-gray-200 truncate font-medium", children: item.player.full_name }), _jsx("p", { className: "text-[10px] text-gray-500", children: item.player.playing_role })] }), _jsxs("div", { className: "text-right flex-shrink-0", children: [_jsxs("p", { className: "text-xs font-mono text-gray-400", children: ["\u20B9", item.base_price_cr] }), item.ai_value_estimate_cr && (_jsxs("p", { className: "text-[10px] text-signal-green font-mono", children: ["~\u20B9", item.ai_value_estimate_cr.toFixed(1)] }))] }), _jsx(ChevronRight, { size: 12, className: "text-gray-600 flex-shrink-0" })] }, item.lot_number))), items.length === 0 && _jsx(EmptyState, { message: "Queue is empty" })] })] }));
}
