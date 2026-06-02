import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Activity, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { liveApi } from "../api/cricket";
import { useWebSocket } from "../api/websocket";
import {
  Card, CardHeader, Stat, Badge, PageHeader, Spinner, EmptyState,
  RiskMeter, WinProbBar,
} from "../components/ui";
import { MatchPicker } from "../components/MatchPicker";

export function LiveMatch() {
  const { matchId } = useParams<{ matchId: string }>();
  const mid = matchId ?? "";
  const qc = useQueryClient();
  const [liveConnected, setLiveConnected] = useState(false);

  useWebSocket(`/ws/live/${mid}`, (msg) => {
    if (msg.type === "connected") setLiveConnected(true);
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
    return (
      <MatchPicker
        title="Live Match"
        subtitle="Select a match to open the ball-by-ball tactical engine"
        basePath="/live"
      />
    );
  }

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Spinner size={32} /></div>;
  }

  const state = stateRes?.data;
  const wp = wpRes?.data;
  const rec = recRes?.data;

  if (!state) {
    return (
      <div className="h-full flex flex-col">
        <PageHeader title="Live Match" subtitle="Ball-by-ball tactical engine" />
        <div className="flex-1 flex items-center justify-center">
          <EmptyState message="No live match state. Start the match via the API." icon={<Activity size={32} />} />
        </div>
      </div>
    );
  }

  const winProb = rec?.win_probability ?? state.win_probability ?? 0.5;
  const history = wp?.history ?? [];
  const chartData = history.map(h => ({
    ball: `${h.over_number}.${h.ball_number}`,
    prob: Math.round(h.batting_team_win_prob * 100),
    score: h.score,
  }));

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Live Match Dashboard"
        subtitle={`${state.batting_team_name} vs ${state.bowling_team_name}`}
        right={
          <div className="flex items-center gap-1.5 text-xs">
            <div className={`w-2 h-2 rounded-full ${liveConnected ? "bg-signal-green animate-pulse" : "bg-gray-600"}`} />
            <span className="text-gray-500">{liveConnected ? "Live" : "Connecting..."}</span>
          </div>
        }
      />

      {/* Alert banner */}
      {rec?.alert && (
        <div className="mx-4 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-900/30 border border-amber-800 animate-fade-in">
          <AlertTriangle size={14} className="text-signal-amber flex-shrink-0" />
          <p className="text-sm text-amber-300">{rec.alert}</p>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-12 gap-4">

          {/* TOP — Live Scorecard */}
          <div className="col-span-12">
            <ScorecardBar state={state} />
          </div>

          {/* LEFT — Win Probability Chart */}
          <div className="col-span-5">
            <WinProbChart
              data={chartData}
              currentProb={winProb}
              battingTeam={state.batting_team_name}
              bowlingTeam={state.bowling_team_name}
              momentum={rec?.momentum ?? state.momentum}
            />
          </div>

          {/* CENTRE — Recommendations */}
          <div className="col-span-4 space-y-4">
            {rec?.bowler_recommendation && (
              <BowlerRecCard rec={rec.bowler_recommendation} />
            )}
            {rec && (
              <BattingStratCard rec={rec} />
            )}
          </div>

          {/* RIGHT — Live player stats */}
          <div className="col-span-3 space-y-4">
            {state.striker && <BatterCard batter={state.striker} title="On Strike" />}
            {state.non_striker && <BatterCard batter={state.non_striker} title="Non Striker" />}
            {state.current_bowler && <BowlerCard bowler={state.current_bowler} />}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Scorecard Bar ────────────────────────────────────────────────────────────

function ScorecardBar({ state }: { state: any }) {
  const over = `${state.current_over}.${state.current_ball}`;
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">{state.batting_team_name}</p>
            <p className="text-3xl font-bold font-mono text-gray-100">
              {state.batting_team_score}
              <span className="text-xl text-gray-500">/{state.batting_team_wickets}</span>
            </p>
            <p className="text-xs text-gray-500 font-mono mt-0.5">Over {over} · CRR {state.current_run_rate.toFixed(2)}</p>
          </div>

          {state.innings_number === 2 && state.target_runs && (
            <>
              <div className="w-px h-12 bg-surface-border" />
              <div>
                <p className="text-xs text-gray-500">Target</p>
                <p className="text-2xl font-bold font-mono text-signal-amber">{state.target_runs}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Need</p>
                <p className="text-2xl font-bold font-mono text-gray-100">
                  {state.runs_required}
                  <span className="text-sm text-gray-500"> off {state.balls_remaining}b</span>
                </p>
                <p className="text-xs text-gray-500 font-mono">RRR {state.required_run_rate?.toFixed(2)}</p>
              </div>
            </>
          )}
        </div>

        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Win Probability</p>
          <p className="text-2xl font-bold font-mono text-signal-green">
            {Math.round((state.win_probability ?? 0.5) * 100)}%
          </p>
          <p className="text-xs text-gray-500">{state.batting_team_name}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Win Probability Chart ────────────────────────────────────────────────────

function WinProbChart({ data, currentProb, battingTeam, bowlingTeam, momentum }: {
  data: Array<{ ball: string; prob: number; score: number }>;
  currentProb: number;
  battingTeam: string;
  bowlingTeam: string;
  momentum: string | null | undefined;
}) {
  const MomentumIcon = momentum === "Rising" ? TrendingUp : momentum === "Falling" ? TrendingDown : Minus;
  const momentumColor = momentum === "Rising" ? "text-signal-green" : momentum === "Falling" ? "text-signal-red" : "text-gray-400";

  return (
    <Card>
      <CardHeader
        title="Win Probability"
        subtitle={battingTeam}
        right={
          <div className={`flex items-center gap-1 text-xs ${momentumColor}`}>
            <MomentumIcon size={12} />
            <span>{momentum ?? "Stable"}</span>
          </div>
        }
      />
      <div className="mb-3">
        <WinProbBar team1={battingTeam} prob1={currentProb} team2={bowlingTeam} />
      </div>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
            <defs>
              <linearGradient id="probGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="ball" tick={{ fontSize: 9, fill: "#6b7280" }} interval={5} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#6b7280" }} />
            <Tooltip
              contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "#9ca3af" }}
              formatter={(v: number) => [`${v}%`, "Win Prob"]}
            />
            <ReferenceLine y={50} stroke="#30363d" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="prob"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#probGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#22c55e" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState message="Waiting for match data..." />
      )}
    </Card>
  );
}

// ─── Bowler Recommendation ────────────────────────────────────────────────────

function BowlerRecCard({ rec }: { rec: any }) {
  return (
    <Card className="border-l-2 border-l-signal-green">
      <CardHeader title="Bowl Next Over" />
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-lg font-bold text-gray-100">{rec.recommended_bowler_name}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge label={`${rec.confidence} confidence`} variant={rec.confidence === "High" ? "green" : "amber"} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Wicket prob</p>
          <p className="text-xl font-bold font-mono text-signal-amber">
            {Math.round(rec.wicket_probability * 100)}%
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3 bg-surface-elevated rounded-lg p-2">
        <Stat label="Exp. runs" value={rec.expected_runs_this_over.toFixed(1)} />
        <Stat label="Wicket prob" value={`${Math.round(rec.wicket_probability * 100)}%`} color="text-signal-amber" />
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{rec.reasoning}</p>

      {rec.alternatives?.length > 0 && (
        <div className="mt-3">
          <p className="stat-label mb-1.5">Alternatives</p>
          <div className="space-y-1">
            {rec.alternatives.slice(0, 2).map((alt: any) => (
              <div key={alt.player_id} className="flex justify-between text-xs text-gray-400">
                <span>{alt.player_name}</span>
                <span className="font-mono">{Math.round(alt.composite_score * 100)}pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Batting Strategy Card ────────────────────────────────────────────────────

function BattingStratCard({ rec }: { rec: any }) {
  return (
    <Card>
      <CardHeader title="Batting Strategy" />
      <div className="mb-3">
        <RiskMeter level={rec.batting_risk_level} />
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">{rec.batting_strategy}</p>
      {rec.field_placement_note && (
        <div className="mt-2 p-2 rounded-lg bg-surface-elevated">
          <p className="text-xs text-gray-500 italic">Field: {rec.field_placement_note}</p>
        </div>
      )}
    </Card>
  );
}

// ─── Batter Card ──────────────────────────────────────────────────────────────

function BatterCard({ batter, title }: { batter: any; title: string }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <p className="stat-label">{title}</p>
        {batter.is_on_strike && <div className="w-2 h-2 rounded-full bg-signal-green animate-pulse-slow" />}
      </div>
      <p className="text-sm font-semibold text-gray-100 mb-2">{batter.full_name}</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-gray-600">R</p>
          <p className="text-base font-bold font-mono text-gray-100">{batter.runs_scored}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">B</p>
          <p className="text-base font-bold font-mono text-gray-100">{batter.balls_faced}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">SR</p>
          <p className={`text-base font-bold font-mono ${
            (batter.strike_rate ?? 0) > 150 ? "text-signal-green"
            : (batter.strike_rate ?? 0) < 100 ? "text-signal-red"
            : "text-signal-amber"
          }`}>
            {batter.strike_rate?.toFixed(0) ?? "—"}
          </p>
        </div>
      </div>
      <div className="flex gap-3 mt-2 text-xs text-gray-500">
        <span>{batter.fours} ×4</span>
        <span>{batter.sixes} ×6</span>
        {batter.dots_in_row > 2 && (
          <span className="text-signal-amber">{batter.dots_in_row} dots</span>
        )}
      </div>
    </Card>
  );
}

// ─── Bowler Card ──────────────────────────────────────────────────────────────

function BowlerCard({ bowler }: { bowler: any }) {
  return (
    <Card>
      <p className="stat-label mb-2">Current Bowler</p>
      <p className="text-sm font-semibold text-gray-100 mb-2">{bowler.full_name}</p>
      <div className="grid grid-cols-4 gap-1 text-center">
        {[
          { label: "O", val: bowler.overs_bowled },
          { label: "R", val: bowler.runs_conceded },
          { label: "W", val: bowler.wickets },
          { label: "ECO", val: bowler.economy?.toFixed(1) ?? "—" },
        ].map(({ label, val }) => (
          <div key={label}>
            <p className="text-[10px] text-gray-600">{label}</p>
            <p className="text-sm font-bold font-mono text-gray-200">{val}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
