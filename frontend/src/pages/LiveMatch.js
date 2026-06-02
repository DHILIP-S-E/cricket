import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, } from "recharts";
import { Activity, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { liveApi } from "../api/cricket";
import { useWebSocket } from "../api/websocket";
import { Card, CardHeader, Stat, Badge, PageHeader, Spinner, EmptyState, RiskMeter, WinProbBar, } from "../components/ui";
export function LiveMatch() {
    const { matchId } = useParams();
    const mid = matchId ?? "";
    const qc = useQueryClient();
    const [liveConnected, setLiveConnected] = useState(false);
    useWebSocket(`/ws/live/${mid}`, (msg) => {
        if (msg.type === "connected")
            setLiveConnected(true);
        if (msg.type === "ball_update") {
            qc.invalidateQueries({ queryKey: ["live", mid] });
        }
    }, !!mid);
    const { data: stateRes, isLoading } = useQuery({
        queryKey: ["live", mid, "state"],
        queryFn: () => liveApi.state(mid),
        refetchInterval: 8000,
        enabled: !!mid,
    });
    const { data: wpRes } = useQuery({
        queryKey: ["live", mid, "wp"],
        queryFn: () => liveApi.winProbability(mid),
        refetchInterval: 8000,
        enabled: !!mid,
    });
    const { data: recRes } = useQuery({
        queryKey: ["live", mid, "rec"],
        queryFn: () => liveApi.recommendations(mid),
        refetchInterval: 8000,
        enabled: !!mid,
    });
    if (!mid) {
        return (_jsx("div", { className: "h-full flex items-center justify-center text-gray-600", children: _jsx("p", { children: "No match selected. Navigate to /live/:matchId" }) }));
    }
    if (isLoading) {
        return _jsx("div", { className: "h-full flex items-center justify-center", children: _jsx(Spinner, { size: 32 }) });
    }
    const state = stateRes?.data;
    const wp = wpRes?.data;
    const rec = recRes?.data;
    if (!state) {
        return (_jsxs("div", { className: "h-full flex flex-col", children: [_jsx(PageHeader, { title: "Live Match", subtitle: "Ball-by-ball tactical engine" }), _jsx("div", { className: "flex-1 flex items-center justify-center", children: _jsx(EmptyState, { message: "No live match state. Start the match via the API.", icon: _jsx(Activity, { size: 32 }) }) })] }));
    }
    const winProb = rec?.win_probability ?? state.win_probability ?? 0.5;
    const history = wp?.history ?? [];
    const chartData = history.map(h => ({
        ball: `${h.over_number}.${h.ball_number}`,
        prob: Math.round(h.batting_team_win_prob * 100),
        score: h.score,
    }));
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsx(PageHeader, { title: "Live Match Dashboard", subtitle: `${state.batting_team_name} vs ${state.bowling_team_name}`, right: _jsxs("div", { className: "flex items-center gap-1.5 text-xs", children: [_jsx("div", { className: `w-2 h-2 rounded-full ${liveConnected ? "bg-signal-green animate-pulse" : "bg-gray-600"}` }), _jsx("span", { className: "text-gray-500", children: liveConnected ? "Live" : "Connecting..." })] }) }), rec?.alert && (_jsxs("div", { className: "mx-4 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-900/30 border border-amber-800 animate-fade-in", children: [_jsx(AlertTriangle, { size: 14, className: "text-signal-amber flex-shrink-0" }), _jsx("p", { className: "text-sm text-amber-300", children: rec.alert })] })), _jsx("div", { className: "flex-1 overflow-auto p-4", children: _jsxs("div", { className: "grid grid-cols-12 gap-4", children: [_jsx("div", { className: "col-span-12", children: _jsx(ScorecardBar, { state: state }) }), _jsx("div", { className: "col-span-5", children: _jsx(WinProbChart, { data: chartData, currentProb: winProb, battingTeam: state.batting_team_name, bowlingTeam: state.bowling_team_name, momentum: rec?.momentum ?? state.momentum }) }), _jsxs("div", { className: "col-span-4 space-y-4", children: [rec?.bowler_recommendation && (_jsx(BowlerRecCard, { rec: rec.bowler_recommendation })), rec && (_jsx(BattingStratCard, { rec: rec }))] }), _jsxs("div", { className: "col-span-3 space-y-4", children: [state.striker && _jsx(BatterCard, { batter: state.striker, title: "On Strike" }), state.non_striker && _jsx(BatterCard, { batter: state.non_striker, title: "Non Striker" }), state.current_bowler && _jsx(BowlerCard, { bowler: state.current_bowler })] })] }) })] }));
}
// ─── Scorecard Bar ────────────────────────────────────────────────────────────
function ScorecardBar({ state }) {
    const over = `${state.current_over}.${state.current_ball}`;
    return (_jsx("div", { className: "card", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-6", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-500 uppercase tracking-wider", children: state.batting_team_name }), _jsxs("p", { className: "text-3xl font-bold font-mono text-gray-100", children: [state.batting_team_score, _jsxs("span", { className: "text-xl text-gray-500", children: ["/", state.batting_team_wickets] })] }), _jsxs("p", { className: "text-xs text-gray-500 font-mono mt-0.5", children: ["Over ", over, " \u00B7 CRR ", state.current_run_rate.toFixed(2)] })] }), state.innings_number === 2 && state.target_runs && (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-px h-12 bg-surface-border" }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-500", children: "Target" }), _jsx("p", { className: "text-2xl font-bold font-mono text-signal-amber", children: state.target_runs })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-500", children: "Need" }), _jsxs("p", { className: "text-2xl font-bold font-mono text-gray-100", children: [state.runs_required, _jsxs("span", { className: "text-sm text-gray-500", children: [" off ", state.balls_remaining, "b"] })] }), _jsxs("p", { className: "text-xs text-gray-500 font-mono", children: ["RRR ", state.required_run_rate?.toFixed(2)] })] })] }))] }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-xs text-gray-500 uppercase tracking-wider", children: "Win Probability" }), _jsxs("p", { className: "text-2xl font-bold font-mono text-signal-green", children: [Math.round((state.win_probability ?? 0.5) * 100), "%"] }), _jsx("p", { className: "text-xs text-gray-500", children: state.batting_team_name })] })] }) }));
}
// ─── Win Probability Chart ────────────────────────────────────────────────────
function WinProbChart({ data, currentProb, battingTeam, bowlingTeam, momentum }) {
    const MomentumIcon = momentum === "Rising" ? TrendingUp : momentum === "Falling" ? TrendingDown : Minus;
    const momentumColor = momentum === "Rising" ? "text-signal-green" : momentum === "Falling" ? "text-signal-red" : "text-gray-400";
    return (_jsxs(Card, { children: [_jsx(CardHeader, { title: "Win Probability", subtitle: battingTeam, right: _jsxs("div", { className: `flex items-center gap-1 text-xs ${momentumColor}`, children: [_jsx(MomentumIcon, { size: 12 }), _jsx("span", { children: momentum ?? "Stable" })] }) }), _jsx("div", { className: "mb-3", children: _jsx(WinProbBar, { team1: battingTeam, prob1: currentProb, team2: bowlingTeam }) }), data.length > 0 ? (_jsx(ResponsiveContainer, { width: "100%", height: 160, children: _jsxs(AreaChart, { data: data, margin: { top: 4, right: 4, bottom: 4, left: -20 }, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "probGrad", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "5%", stopColor: "#22c55e", stopOpacity: 0.3 }), _jsx("stop", { offset: "95%", stopColor: "#22c55e", stopOpacity: 0 })] }) }), _jsx(XAxis, { dataKey: "ball", tick: { fontSize: 9, fill: "#6b7280" }, interval: 5 }), _jsx(YAxis, { domain: [0, 100], tick: { fontSize: 9, fill: "#6b7280" } }), _jsx(Tooltip, { contentStyle: { background: "#161b22", border: "1px solid #30363d", borderRadius: 8, fontSize: 11 }, labelStyle: { color: "#9ca3af" }, formatter: (v) => [`${v}%`, "Win Prob"] }), _jsx(ReferenceLine, { y: 50, stroke: "#30363d", strokeDasharray: "3 3" }), _jsx(Area, { type: "monotone", dataKey: "prob", stroke: "#22c55e", strokeWidth: 2, fill: "url(#probGrad)", dot: false, activeDot: { r: 4, fill: "#22c55e" } })] }) })) : (_jsx(EmptyState, { message: "Waiting for match data..." }))] }));
}
// ─── Bowler Recommendation ────────────────────────────────────────────────────
function BowlerRecCard({ rec }) {
    return (_jsxs(Card, { className: "border-l-2 border-l-signal-green", children: [_jsx(CardHeader, { title: "Bowl Next Over" }), _jsxs("div", { className: "flex items-start justify-between mb-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-lg font-bold text-gray-100", children: rec.recommended_bowler_name }), _jsx("div", { className: "flex items-center gap-2 mt-1", children: _jsx(Badge, { label: `${rec.confidence} confidence`, variant: rec.confidence === "High" ? "green" : "amber" }) })] }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-xs text-gray-500", children: "Wicket prob" }), _jsxs("p", { className: "text-xl font-bold font-mono text-signal-amber", children: [Math.round(rec.wicket_probability * 100), "%"] })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3 mb-3 bg-surface-elevated rounded-lg p-2", children: [_jsx(Stat, { label: "Exp. runs", value: rec.expected_runs_this_over.toFixed(1) }), _jsx(Stat, { label: "Wicket prob", value: `${Math.round(rec.wicket_probability * 100)}%`, color: "text-signal-amber" })] }), _jsx("p", { className: "text-xs text-gray-500 leading-relaxed", children: rec.reasoning }), rec.alternatives?.length > 0 && (_jsxs("div", { className: "mt-3", children: [_jsx("p", { className: "stat-label mb-1.5", children: "Alternatives" }), _jsx("div", { className: "space-y-1", children: rec.alternatives.slice(0, 2).map((alt) => (_jsxs("div", { className: "flex justify-between text-xs text-gray-400", children: [_jsx("span", { children: alt.player_name }), _jsxs("span", { className: "font-mono", children: [Math.round(alt.composite_score * 100), "pts"] })] }, alt.player_id))) })] }))] }));
}
// ─── Batting Strategy Card ────────────────────────────────────────────────────
function BattingStratCard({ rec }) {
    return (_jsxs(Card, { children: [_jsx(CardHeader, { title: "Batting Strategy" }), _jsx("div", { className: "mb-3", children: _jsx(RiskMeter, { level: rec.batting_risk_level }) }), _jsx("p", { className: "text-xs text-gray-400 leading-relaxed", children: rec.batting_strategy }), rec.field_placement_note && (_jsx("div", { className: "mt-2 p-2 rounded-lg bg-surface-elevated", children: _jsxs("p", { className: "text-xs text-gray-500 italic", children: ["Field: ", rec.field_placement_note] }) }))] }));
}
// ─── Batter Card ──────────────────────────────────────────────────────────────
function BatterCard({ batter, title }) {
    return (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("p", { className: "stat-label", children: title }), batter.is_on_strike && _jsx("div", { className: "w-2 h-2 rounded-full bg-signal-green animate-pulse-slow" })] }), _jsx("p", { className: "text-sm font-semibold text-gray-100 mb-2", children: batter.full_name }), _jsxs("div", { className: "grid grid-cols-3 gap-2 text-center", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-600", children: "R" }), _jsx("p", { className: "text-base font-bold font-mono text-gray-100", children: batter.runs_scored })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-600", children: "B" }), _jsx("p", { className: "text-base font-bold font-mono text-gray-100", children: batter.balls_faced })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-600", children: "SR" }), _jsx("p", { className: `text-base font-bold font-mono ${(batter.strike_rate ?? 0) > 150 ? "text-signal-green"
                                    : (batter.strike_rate ?? 0) < 100 ? "text-signal-red"
                                        : "text-signal-amber"}`, children: batter.strike_rate?.toFixed(0) ?? "—" })] })] }), _jsxs("div", { className: "flex gap-3 mt-2 text-xs text-gray-500", children: [_jsxs("span", { children: [batter.fours, " \u00D74"] }), _jsxs("span", { children: [batter.sixes, " \u00D76"] }), batter.dots_in_row > 2 && (_jsxs("span", { className: "text-signal-amber", children: [batter.dots_in_row, " dots"] }))] })] }));
}
// ─── Bowler Card ──────────────────────────────────────────────────────────────
function BowlerCard({ bowler }) {
    return (_jsxs(Card, { children: [_jsx("p", { className: "stat-label mb-2", children: "Current Bowler" }), _jsx("p", { className: "text-sm font-semibold text-gray-100 mb-2", children: bowler.full_name }), _jsx("div", { className: "grid grid-cols-4 gap-1 text-center", children: [
                    { label: "O", val: bowler.overs_bowled },
                    { label: "R", val: bowler.runs_conceded },
                    { label: "W", val: bowler.wickets },
                    { label: "ECO", val: bowler.economy?.toFixed(1) ?? "—" },
                ].map(({ label, val }) => (_jsxs("div", { children: [_jsx("p", { className: "text-[10px] text-gray-600", children: label }), _jsx("p", { className: "text-sm font-bold font-mono text-gray-200", children: val })] }, label))) })] }));
}
