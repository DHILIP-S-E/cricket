import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "../lib/query";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Activity, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Play, Pause, SkipForward, RotateCcw, Zap,
} from "lucide-react";
import { liveApi } from "../api/cricket";
import { useWebSocket } from "../api/websocket";
import {
  Card, CardHeader, Stat, Badge, PageHeader, Spinner, EmptyState,
  RiskMeter, WinProbBar,
} from "../components/ui";
import { MatchPicker } from "../components/MatchPicker";
import { CoachAdvisorCard } from "../components/CoachAdvisorCard";
import { useTheme } from "../context/ThemeContext";

export function LiveMatch() {
  const { matchId } = useParams<{ matchId: string }>();
  const mid = matchId ?? "";
  const qc = useQueryClient();
  const [liveConnected, setLiveConnected] = useState(false);

  // ─── Interactive simulation controls (the server drives the ball clock) ───
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(900);
  const [lastBall, setLastBall] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [oppPlan, setOppPlan] = useState<string | null>(null);

  // Each pushed ball updates the live indicators and refreshes the rich
  // read models (score / chart / recommendations) — no client polling loop.
  const handleMsg = useCallback((msg: Record<string, unknown>) => {
    switch (msg.type) {
      case "connected":
        setLiveConnected(true);
        break;
      case "live_state": {
        const lb = msg.last_ball as { label?: string; runs?: number; wicket?: boolean; extra?: boolean } | null;
        if (lb) setLastBall(lb.wicket ? "W" : lb.extra ? `${lb.label} (extra)` : String(lb.runs ?? ""));
        if (msg.opposition_plan) setOppPlan(String(msg.opposition_plan));
        if (msg.innings_over) { setOutcome(String(msg.outcome ?? "Innings complete")); setPlaying(false); }
        qc.invalidateQueries({ queryKey: ["live", mid] });
        break;
      }
      case "live_reset":
        setPlaying(false); setOutcome(null); setLastBall(null); setOppPlan(null);
        qc.invalidateQueries({ queryKey: ["live", mid] });
        break;
    }
  }, [qc, mid]);

  const { send } = useWebSocket(`/ws/live/${mid}`, handleMsg, !!mid);

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      send({ action: p ? "pause" : "play" });
      return !p;
    });
  }, [send]);
  const doStart = useCallback(() => {
    setOutcome(null); setLastBall(null);
    send({ action: "start" });
  }, [send]);
  const doStep = useCallback(() => send({ action: "step" }), [send]);
  const doReset = useCallback(() => send({ action: "reset" }), [send]);
  const setSpeed = useCallback((v: number) => {
    setSpeedMs(v);
    send({ action: "speed", interval: v / 1000 });
  }, [send]);

  const { data: stateRes, isLoading } = useQuery({
    queryKey: ["live", mid, "state"],
    queryFn: () => liveApi.state(mid),
    enabled: !!mid,
  });

  const { data: wpRes } = useQuery({
    queryKey: ["live", mid, "wp"],
    queryFn: () => liveApi.winProbability(mid),
    enabled: !!mid,
  });

  const { data: recRes } = useQuery({
    queryKey: ["live", mid, "rec"],
    queryFn: () => liveApi.recommendations(mid),
    enabled: !!mid,
  });

  const { data: advisorRes } = useQuery({
    queryKey: ["live", mid, "advisor"],
    queryFn: () => liveApi.advisor(mid),
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
    return <div className="h-full flex items-center justify-center bg-surface"><Spinner size={32} /></div>;
  }

  const state = stateRes?.data;
  const wp = wpRes?.data;
  const rec = recRes?.data;

  if (!state) {
    return (
      <div className="h-full flex flex-col bg-surface">
        <PageHeader title="Live Match" subtitle="Ball-by-ball tactical engine" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-brand-muted flex items-center justify-center">
              <Zap size={26} className="text-brand" />
            </div>
            <h3 className="text-lg font-extrabold text-text-primary mb-1">Simulate this match yourself</h3>
            <p className="text-sm text-text-secondary mb-5 max-w-sm">
              Start a ball-by-ball chase. The ML model recomputes the win probability after every delivery.
            </p>
            <button
              onClick={doStart}
              disabled={!liveConnected}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Play size={16} />
              {liveConnected ? "Start Simulation" : "Connecting…"}
            </button>
          </div>
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
    <div className="flex flex-col h-full bg-surface text-text-primary">
      <PageHeader
        title="Live Match Dashboard"
        subtitle={`${state.batting_team_name} vs ${state.bowling_team_name}`}
        right={
          <div className="flex items-center gap-3">
            {lastBall && (
              <div className={`flex items-center justify-center w-8 h-8 rounded-lg font-black font-mono text-sm ${
                lastBall === "W" ? "bg-red-500/15 text-red-500"
                : lastBall === "4" || lastBall === "6" ? "bg-brand/15 text-brand"
                : "bg-surface-elevated text-text-secondary"
              }`}>{lastBall}</div>
            )}
            <div className="flex items-center gap-1.5 text-xs">
              <div className={`w-2 h-2 rounded-full ${liveConnected ? "bg-brand animate-pulse" : "bg-text-tertiary"}`} />
              <span className="text-text-secondary font-medium">{liveConnected ? "Connected" : "Connecting..."}</span>
            </div>
          </div>
        }
      />

      {/* Simulation control bar */}
      <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-card border border-surface-border">
        <button
          onClick={togglePlay}
          disabled={!!outcome}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
          {playing ? "Pause" : "Auto-play"}
        </button>
        <button
          onClick={doStep}
          disabled={playing || !!outcome}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-text-primary text-xs font-semibold hover:bg-surface transition-colors disabled:opacity-40"
        >
          <SkipForward size={13} /> Next Ball
        </button>
        <button
          onClick={doReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-text-secondary text-xs font-semibold hover:text-text-primary transition-colors"
        >
          <RotateCcw size={13} /> Reset
        </button>

        {oppPlan && (
          <div className="flex items-center gap-1.5 ml-2 px-2 py-1 rounded-lg bg-surface-elevated border border-surface-border">
            <Zap size={11} className="text-amber-500" />
            <span className="text-[10px] text-text-secondary font-bold">
              Opposition: <span className={
                oppPlan === "attack" ? "text-red-500" : oppPlan === "contain" ? "text-brand" : "text-text-primary"
              }>{oppPlan === "attack" ? "Attacking — chasing wickets" : oppPlan === "contain" ? "Containing — drying up runs" : "Balanced"}</span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] text-text-secondary uppercase font-bold tracking-wider">Speed</span>
          {[{ l: "0.5x", v: 1600 }, { l: "1x", v: 900 }, { l: "2x", v: 400 }, { l: "Fast", v: 150 }].map((s) => (
            <button
              key={s.v}
              onClick={() => setSpeed(s.v)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                speedMs === s.v ? "bg-brand text-white" : "bg-surface-elevated text-text-secondary hover:text-text-primary"
              }`}
            >{s.l}</button>
          ))}
        </div>
      </div>

      {/* Match result banner */}
      {outcome && (
        <div className="mx-4 mt-3 flex items-center justify-between px-4 py-3 rounded-xl bg-brand/10 border border-brand/30">
          <p className="text-sm font-extrabold text-brand">🏆 {outcome}</p>
          <button
            onClick={doStart}
            className="text-xs font-bold text-brand hover:underline"
          >Simulate again →</button>
        </div>
      )}

      {/* Alert banner */}
      {rec?.alert && (
        <div className="mx-4 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 animate-fade-in">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-600 dark:text-amber-300 font-semibold">{rec.alert}</p>
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
            <CoachAdvisorCard title="AI Tactical Advisor" advice={advisorRes?.data} />
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
    <div className="card shadow-sm border border-surface-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-text-secondary uppercase tracking-wider font-bold">{state.batting_team_name}</p>
            <p className="text-3xl font-extrabold font-mono text-text-primary">
              {state.batting_team_score}
              <span className="text-xl text-text-tertiary">/{state.batting_team_wickets}</span>
            </p>
            <p className="text-xs text-text-secondary font-mono mt-0.5">Over {over} · CRR {state.current_run_rate.toFixed(2)}</p>
          </div>

          {state.innings_number === 2 && state.target_runs && (
            <>
              <div className="w-px h-12 bg-surface-border" />
              <div>
                <p className="text-xs text-text-secondary font-medium">Target</p>
                <p className="text-2xl font-bold font-mono text-amber-500">{state.target_runs}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary font-medium">Need</p>
                <p className="text-2xl font-bold font-mono text-text-primary">
                  {state.runs_required}
                  <span className="text-sm text-text-secondary font-normal"> off {state.balls_remaining}b</span>
                </p>
                <p className="text-xs text-text-secondary font-mono">RRR {state.required_run_rate?.toFixed(2)}</p>
              </div>
            </>
          )}
        </div>

        <div className="text-right">
          <p className="text-xs text-text-secondary uppercase tracking-wider font-bold">Win Probability</p>
          <p className="text-2xl font-black font-mono text-brand">
            {Math.round((state.win_probability ?? 0.5) * 100)}%
          </p>
          <p className="text-xs text-text-secondary">{state.batting_team_name}</p>
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
  const { colorMode, getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  
  const MomentumIcon = momentum === "Rising" ? TrendingUp : momentum === "Falling" ? TrendingDown : Minus;
  const momentumColor = momentum === "Rising" ? "text-brand" : momentum === "Falling" ? "text-red-500" : "text-text-secondary";

  const labelColor = colorMode === "dark" ? "#9ca3af" : "#475569";
  const gridColor = colorMode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const tooltipBg = colorMode === "dark" ? "#161b22" : "#ffffff";
  const tooltipBorder = colorMode === "dark" ? "#30363d" : "#e2e8f0";

  return (
    <Card>
      <CardHeader
        title="Win Probability Tracker"
        subtitle={battingTeam}
        right={
          <div className={`flex items-center gap-1 text-xs font-semibold ${momentumColor}`}>
            <MomentumIcon size={12} />
            <span>{momentum ?? "Stable"}</span>
          </div>
        }
      />
      <div className="mb-4">
        <WinProbBar team1={battingTeam} prob1={currentProb} team2={bowlingTeam} />
      </div>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
            <defs>
              <linearGradient id="probGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={themeColors.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={themeColors.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="ball" tick={{ fontSize: 9, fill: labelColor }} interval={5} stroke={gridColor} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: labelColor }} stroke={gridColor} />
            <Tooltip
              contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: labelColor }}
              formatter={(v: number) => [`${v}%`, "Win Prob"]}
            />
            <ReferenceLine y={50} stroke={gridColor} strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="prob"
              stroke={themeColors.primary}
              strokeWidth={2}
              fill="url(#probGrad)"
              dot={false}
              activeDot={{ r: 4, fill: themeColors.primary }}
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
    <Card className="border-l-4 border-l-brand relative overflow-hidden">
      <CardHeader title="Bowl Next Over Suggestion" />
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-lg font-extrabold text-text-primary leading-tight">{rec.recommended_bowler_name}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge label={`${rec.confidence} confidence`} variant={rec.confidence === "High" ? "green" : "amber"} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-text-secondary uppercase tracking-wider font-bold">Wicket prob</p>
          <p className="text-xl font-black font-mono text-amber-500">
            {Math.round(rec.wicket_probability * 100)}%
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3 bg-surface-elevated border border-surface-border rounded-xl p-2.5">
        <Stat label="Exp. Runs" value={rec.expected_runs_this_over.toFixed(1)} />
        <Stat label="Wicket Prob" value={`${Math.round(rec.wicket_probability * 100)}%`} color="text-amber-500" />
      </div>
      <p className="text-xs text-text-secondary leading-relaxed">{rec.reasoning}</p>

      {rec.alternatives?.length > 0 && (
        <div className="mt-3 border-t border-surface-border/50 pt-2">
          <p className="stat-label mb-1.5 font-bold">Alternatives</p>
          <div className="space-y-1">
            {rec.alternatives.slice(0, 2).map((alt: any) => (
              <div key={alt.player_id} className="flex justify-between text-xs text-text-secondary">
                <span className="font-medium">{alt.player_name}</span>
                <span className="font-mono font-bold text-text-primary">{Math.round(alt.composite_score * 100)}pts</span>
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
      <CardHeader title="Batting Strategy Simulation" />
      <div className="mb-4">
        <RiskMeter level={rec.batting_risk_level} />
      </div>
      <p className="text-xs text-text-secondary leading-relaxed">{rec.batting_strategy}</p>
      {rec.field_placement_note && (
        <div className="mt-3 p-2.5 rounded-xl bg-surface-elevated border border-surface-border">
          <p className="text-xs text-text-secondary italic"><strong className="text-text-primary not-italic font-bold">Field Note:</strong> {rec.field_placement_note}</p>
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
        {batter.is_on_strike && <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />}
      </div>
      <p className="text-sm font-extrabold text-text-primary mb-2">{batter.full_name}</p>
      <div className="grid grid-cols-3 gap-2 text-center bg-surface-elevated/40 border border-surface-border rounded-lg p-2">
        <div>
          <p className="text-[9px] text-text-secondary font-bold">R</p>
          <p className="text-base font-bold font-mono text-text-primary">{batter.runs_scored}</p>
        </div>
        <div>
          <p className="text-[9px] text-text-secondary font-bold">B</p>
          <p className="text-base font-bold font-mono text-text-primary">{batter.balls_faced}</p>
        </div>
        <div>
          <p className="text-[9px] text-text-secondary font-bold">SR</p>
          <p className={`text-base font-black font-mono ${
            (batter.strike_rate ?? 0) > 150 ? "text-brand"
            : (batter.strike_rate ?? 0) < 100 ? "text-red-500"
            : "text-amber-500"
          }`}>
            {batter.strike_rate?.toFixed(0) ?? "—"}
          </p>
        </div>
      </div>
      <div className="flex gap-3 mt-2 text-[10px] text-text-secondary font-medium">
        <span>{batter.fours} × 4s</span>
        <span>{batter.sixes} × 6s</span>
        {batter.dots_in_row > 2 && (
          <span className="text-amber-500 font-bold">{batter.dots_in_row} dot balls</span>
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
      <p className="text-sm font-extrabold text-text-primary mb-2">{bowler.full_name}</p>
      <div className="grid grid-cols-4 gap-1 text-center bg-surface-elevated/40 border border-surface-border rounded-lg p-2">
        {[
          { label: "O", val: bowler.overs_bowled },
          { label: "R", val: bowler.runs_conceded },
          { label: "W", val: bowler.wickets },
          { label: "ECO", val: bowler.economy?.toFixed(1) ?? "—" },
        ].map(({ label, val }) => (
          <div key={label}>
            <p className="text-[9px] text-text-secondary font-bold">{label}</p>
            <p className="text-sm font-black font-mono text-text-primary">{val}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
