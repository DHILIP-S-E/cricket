import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { prematchApi } from "../api/cricket";
import { Card, CardHeader, Stat, Badge, ConfidenceBadge, RoleBadge, PageHeader, Spinner, EmptyState, WinProbBar, } from "../components/ui";
import { Star } from "lucide-react";
const FRANCHISE_ID = import.meta.env.VITE_FRANCHISE_ID ?? "";
const SEASON_ID = import.meta.env.VITE_SEASON_ID ?? "";
export function PreMatch() {
    const { matchId } = useParams();
    const mid = matchId ?? "";
    const { data: wpRes, isLoading: wpLoading } = useQuery({
        queryKey: ["prematch", mid, "wp"],
        queryFn: () => prematchApi.winProbability(mid),
        enabled: !!mid,
    });
    const { data: xiRes, isLoading: xiLoading } = useQuery({
        queryKey: ["prematch", mid, "xi", FRANCHISE_ID],
        queryFn: () => prematchApi.xiRecommendation(mid, FRANCHISE_ID, SEASON_ID),
        enabled: !!mid && !!FRANCHISE_ID && !!SEASON_ID,
    });
    const wp = wpRes?.data;
    const xi = xiRes?.data;
    if (!mid) {
        return (_jsx("div", { className: "h-full flex items-center justify-center text-gray-600", children: "Navigate to /prematch/:matchId" }));
    }
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsx(PageHeader, { title: "Pre-Match Planner", subtitle: wp ? `${wp.team1_name} vs ${wp.team2_name}` : "Loading match..." }), _jsx("div", { className: "flex-1 overflow-auto p-4", children: _jsxs("div", { className: "grid grid-cols-12 gap-4", children: [_jsx("div", { className: "col-span-12", children: wpLoading ? (_jsx(Card, { children: _jsx("div", { className: "flex justify-center py-6", children: _jsx(Spinner, {}) }) })) : wp ? (_jsx(WinProbabilityCard, { wp: wp })) : (_jsx(Card, { children: _jsx(EmptyState, { message: "Win probability unavailable" }) })) }), _jsx("div", { className: "col-span-7", children: xiLoading ? (_jsx(Card, { children: _jsx("div", { className: "flex justify-center py-8", children: _jsx(Spinner, {}) }) })) : xi ? (_jsx(PlayingXICard, { xi: xi })) : !FRANCHISE_ID ? (_jsx(Card, { children: _jsx(EmptyState, { message: "Set VITE_FRANCHISE_ID and VITE_SEASON_ID to get XI recommendation" }) })) : (_jsx(Card, { children: _jsx(EmptyState, { message: "XI recommendation unavailable" }) })) }), _jsxs("div", { className: "col-span-5 space-y-4", children: [wp?.key_factors && wp.key_factors.length > 0 && (_jsx(KeyFactorsCard, { factors: wp.key_factors })), xi?.impact_player_recommendation && (_jsx(ImpactPlayerCard, { player: xi.impact_player_recommendation })), xi && _jsx(XIStatsCard, { xi: xi })] })] }) })] }));
}
// ─── Win Probability Card ─────────────────────────────────────────────────────
function WinProbabilityCard({ wp }) {
    return (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx(CardHeader, { title: "Pre-Match Win Probability", subtitle: "Based on venue, form, head-to-head, and toss" }), _jsx(ConfidenceBadge, { confidence: wp.confidence })] }), _jsx(WinProbBar, { team1: wp.team1_name, prob1: wp.team1_win_prob, team2: wp.team2_name }), _jsxs("div", { className: "grid grid-cols-2 gap-4 mt-4", children: [_jsxs("div", { className: "text-center p-3 rounded-lg bg-surface-elevated", children: [_jsx("p", { className: "text-xs text-gray-500 mb-1", children: wp.team1_name }), _jsxs("p", { className: "text-3xl font-bold font-mono text-signal-green", children: [Math.round(wp.team1_win_prob * 100), "%"] })] }), _jsxs("div", { className: "text-center p-3 rounded-lg bg-surface-elevated", children: [_jsx("p", { className: "text-xs text-gray-500 mb-1", children: wp.team2_name }), _jsxs("p", { className: "text-3xl font-bold font-mono text-blue-400", children: [Math.round(wp.team2_win_prob * 100), "%"] })] })] })] }));
}
// ─── Playing XI Card ──────────────────────────────────────────────────────────
function PlayingXICard({ xi }) {
    const [view, setView] = useState("list");
    return (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx(CardHeader, { title: "Recommended Playing XI", subtitle: xi.reasoning?.slice(0, 80) + "..." }), _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { onClick: () => setView("list"), className: `px-2 py-1 rounded text-xs ${view === "list" ? "bg-surface-elevated text-gray-200" : "text-gray-500 hover:text-gray-300"}`, children: "List" }), _jsx("button", { onClick: () => setView("grid"), className: `px-2 py-1 rounded text-xs ${view === "grid" ? "bg-surface-elevated text-gray-200" : "text-gray-500 hover:text-gray-300"}`, children: "Grid" })] })] }), view === "list" ? (_jsxs("table", { className: "data-table w-full", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "#" }), _jsx("th", { children: "Player" }), _jsx("th", { children: "Role" }), _jsx("th", { className: "text-right", children: "AI Score" })] }) }), _jsx("tbody", { children: xi.recommended_xi.map((p) => (_jsxs("tr", { className: "group", children: [_jsx("td", { className: "font-mono text-gray-500 text-xs", children: p.batting_position }), _jsxs("td", { children: [_jsx("span", { className: "text-gray-200 font-medium", children: p.full_name }), p.is_overseas && _jsx(Badge, { label: "OS", variant: "purple" })] }), _jsx("td", { children: _jsx(RoleBadge, { role: p.playing_role }) }), _jsx("td", { className: "text-right font-mono text-xs text-signal-green", children: p.ai_score.toFixed(0) })] }, p.player_id))) })] })) : (_jsx("div", { className: "grid grid-cols-3 gap-2", children: xi.recommended_xi.map((p) => (_jsxs("div", { className: "p-2 rounded-lg bg-surface-elevated border border-surface-border text-center", children: [_jsxs("p", { className: "text-xs text-gray-500 mb-1", children: ["#", p.batting_position] }), _jsx("p", { className: "text-xs font-medium text-gray-200 leading-tight", children: p.full_name.split(" ").pop() }), _jsx("div", { className: "mt-1", children: _jsx(RoleBadge, { role: p.playing_role }) }), p.is_overseas && _jsx("div", { className: "mt-1", children: _jsx(Badge, { label: "OS", variant: "purple" }) })] }, p.player_id))) }))] }));
}
// ─── Key Factors Card ─────────────────────────────────────────────────────────
function KeyFactorsCard({ factors }) {
    return (_jsxs(Card, { children: [_jsx(CardHeader, { title: "Key Factors" }), _jsx("ul", { className: "space-y-2", children: factors.map((f, i) => (_jsxs("li", { className: "flex items-start gap-2 text-sm text-gray-400", children: [_jsx("span", { className: "text-signal-green mt-0.5", children: "\u2192" }), _jsx("span", { children: f })] }, i))) })] }));
}
// ─── Impact Player Card ───────────────────────────────────────────────────────
function ImpactPlayerCard({ player }) {
    return (_jsxs(Card, { className: "border-l-2 border-l-signal-amber", children: [_jsx(CardHeader, { title: "Impact Player", subtitle: "Recommended substitute", right: _jsx(Star, { size: 14, className: "text-signal-amber" }) }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-base font-bold text-gray-100", children: player.full_name }), _jsx("div", { className: "mt-1", children: _jsx(RoleBadge, { role: player.playing_role }) })] }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-xs text-gray-500", children: "AI Score" }), _jsx("p", { className: "text-2xl font-bold font-mono text-signal-amber", children: player.ai_score?.toFixed(0) })] })] })] }));
}
// ─── XI Stats Card ────────────────────────────────────────────────────────────
function XIStatsCard({ xi }) {
    return (_jsxs(Card, { children: [_jsx(CardHeader, { title: "XI Composition" }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(Stat, { label: "Total AI Score", value: xi.total_ai_score.toFixed(0) }), _jsx(Stat, { label: "Bowling Options", value: xi.bowling_options, color: xi.bowling_options >= 5 ? "text-signal-green" : "text-signal-red" }), _jsx(Stat, { label: "Overseas", value: `${xi.overseas_count}/4` }), _jsx(Stat, { label: "Players", value: xi.recommended_xi.length })] })] }));
}
