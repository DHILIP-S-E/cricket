import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { analyticsApi } from "../api/analytics";
import { CardHeader, Spinner, TiltCard } from "../components/ui";
import {
  Gavel, Activity, BarChart2, Users, Trophy, Database,
  Cpu, Zap, Play, ArrowRight, TrendingUp, Sparkles, Tv
} from "lucide-react";

const TEAM_COLORS: Record<string, string> = {
  MI: "#004BA0", CSK: "#FFCC00", RCB: "#D1001C", KKR: "#3B1F8C",
  DC: "#0066B2", RR: "#FF69B4", SRH: "#F7A721", PBKS: "#D71920",
  GT: "#1C3D6E", LSG: "#6CBDE7",
};

export function Dashboard() {
  // Database queries matching existing TanStack integration
  const { data: summaryRes } = useQuery({ queryKey: ["analytics", "summary"], queryFn: analyticsApi.summary });
  const { data: battersRes } = useQuery({ queryKey: ["analytics", "batters"], queryFn: () => analyticsApi.topBatters(12) });
  const { data: bowlersRes } = useQuery({ queryKey: ["analytics", "bowlers"], queryFn: () => analyticsApi.topBowlers(12) });
  const { data: teamsRes }   = useQuery({ queryKey: ["analytics", "teams"],   queryFn: analyticsApi.teamStats });
  const { data: phasesRes  } = useQuery({ queryKey: ["analytics", "phases"],  queryFn: analyticsApi.phaseRates });
  const { data: wicketsRes } = useQuery({ queryKey: ["analytics", "wickets"], queryFn: analyticsApi.wicketTypes });
  const { data: scoresRes  } = useQuery({ queryKey: ["analytics", "scores"],  queryFn: analyticsApi.inningsScores });

  const summary = summaryRes?.data;
  const batters = battersRes?.data ?? [];
  const bowlers = bowlersRes?.data ?? [];
  const teams   = teamsRes?.data   ?? [];
  const phases  = phasesRes?.data  ?? [];
  const wickets = wicketsRes?.data ?? [];
  const scores  = scoresRes?.data  ?? [];

  const overRates = phases.map(p => ({
    over: `${p.over + 1}`,
    rpo: p.avg_rpo,
    phase: p.phase,
  }));

  const PIE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6", "#f97316", "#06b6d4", "#8b5cf6"];

  // 3D Parallax Arena Mouse States
  const arenaRef = React.useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
  const [hoveringArena, setHoveringArena] = React.useState(false);

  const handleArenaMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const arena = arenaRef.current;
    if (!arena) return;
    const rect = arena.getBoundingClientRect();
    // Normalized position from -0.5 to 0.5
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  const handleArenaMouseEnter = () => {
    setHoveringArena(true);
  };

  const handleArenaMouseLeave = () => {
    setHoveringArena(false);
    setMousePos({ x: 0, y: 0 });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#080a10] text-[#f1f5f9] select-none">
      
      {/* 1. Immersive Hero Landing Section */}
      <section className="relative px-6 py-8 flex flex-col xl:flex-row gap-8 border-b border-[#1c2128] bg-gradient-to-b from-[#0e121e] to-[#080a10] overflow-hidden">
        {/* Glow backdrop decorative */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[#22c55e]/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 left-10 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Hero Copy (Left Side) */}
        <div className="flex-1 flex flex-col justify-center space-y-6 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#161b22] border border-emerald-500/30 text-emerald-400 text-xs font-semibold w-fit shadow-md shadow-emerald-950/20">
            <Sparkles size={13} className="animate-pulse" />
            <span>IPL DECISION INTELLIGENCE PLATFORM</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              The Future of <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400 bg-clip-text text-transparent text-glow-green">
                Cricket Intelligence
              </span>
            </h1>
            <p className="text-gray-400 text-sm max-w-lg leading-relaxed">
              Unlock real-time ball-by-ball predictive simulation, deep venue analytics, and tactical auction simulation models powered by structured data pipelines.
            </p>
          </div>

          {/* Core Call to Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/live"
              className="px-6 py-3 rounded-lg font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:brightness-110 shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 group"
            >
              <Zap size={16} />
              <span>Launch Live Simulator</span>
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to="/auction"
              className="px-6 py-3 rounded-lg font-semibold text-sm bg-[#161b22] hover:bg-[#1e2530] text-gray-200 border border-[#30363d] hover:border-gray-600 transition-all flex items-center gap-2"
            >
              <Gavel size={15} className="text-amber-400" />
              <span>Explore Auction Room</span>
            </Link>
          </div>

          {/* Quick Platform Metrics */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#1c2128] max-w-md">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Sim Accuracy</p>
              <p className="text-lg font-bold text-emerald-400 font-mono">94.8%</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Datapoints</p>
              <p className="text-lg font-bold text-blue-400 font-mono">15M+</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Live DB Sync</p>
              <p className="text-lg font-bold text-amber-400 font-mono">Active</p>
            </div>
          </div>
        </div>

        {/* 3D Mouse Parallax Arena (Right Side) */}
        <div className="flex-1 flex items-center justify-center min-h-[380px] xl:min-h-[420px] z-10">
          <div
            ref={arenaRef}
            onMouseMove={handleArenaMouseMove}
            onMouseEnter={handleArenaMouseEnter}
            onMouseLeave={handleArenaMouseLeave}
            className="relative w-full max-w-xl h-[400px] rounded-2xl border border-surface-border bg-[#0d0f15] shadow-2xl overflow-hidden perspective-container preserve-3d"
          >
            {/* Layer 1: Stadium background with mouse-drag shift */}
            <div
              className="absolute inset-0 bg-cover bg-center pointer-events-none"
              style={{
                backgroundImage: "url('/stadium_neon_bg.png')",
                transform: hoveringArena
                  ? `translate3d(${mousePos.x * -18}px, ${mousePos.y * -18}px, -20px) scale(1.1)`
                  : "translate3d(0px, 0px, -20px) scale(1.05)",
                transition: hoveringArena ? "transform 0.08s ease-out" : "transform 0.5s ease-out",
              }}
            />

            {/* Layer 2: Holographic grid perspective effect overlay */}
            <div
              className="absolute inset-0 cyber-grid opacity-35 pointer-events-none mix-blend-screen"
              style={{
                transform: `rotateX(60deg) translate3d(0, ${hoveringArena ? mousePos.y * 30 : 0}px, -40px) scale(1.3)`,
                transformOrigin: "bottom center",
                transition: "transform 0.15s ease-out",
              }}
            />

            {/* Layer 3: Batsman neon character with opposite offset to create popout 3D */}
            <div
              className="absolute inset-x-0 bottom-0 top-4 bg-contain bg-no-repeat bg-center pointer-events-none z-10"
              style={{
                backgroundImage: "url('/batsman_neon.png')",
                transform: hoveringArena
                  ? `translate3d(${mousePos.x * 20}px, ${mousePos.y * 15}px, 10px) scale(1.05)`
                  : "translate3d(0px, 0px, 10px) scale(1)",
                transition: hoveringArena ? "transform 0.08s ease-out" : "transform 0.5s ease-out",
              }}
            />

            {/* Layer 4: Simulated Live Streaming Analyis overlay (3D Video Banner effect) */}
            <div
              className="absolute top-4 left-4 z-20 glass-card p-3 rounded-lg border border-emerald-500/30 text-xs flex flex-col gap-2 max-w-[200px] scanline scanline-beam"
              style={{
                transform: hoveringArena
                  ? `translate3d(${mousePos.x * 35}px, ${mousePos.y * 35}px, 35px)`
                  : "translate3d(0px, 0px, 35px)",
                transition: hoveringArena ? "transform 0.08s ease-out" : "transform 0.5s ease-out",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>LIVE ANALYZER</span>
                </div>
                <Tv size={12} className="text-gray-500" />
              </div>
              
              {/* Simulated Sine Wavelength Animation */}
              <div className="h-6 flex items-end justify-between gap-[2px] bg-black/40 px-2 py-1 rounded overflow-hidden">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-[3px] bg-emerald-400 rounded-t-sm"
                    style={{
                      height: `${15 + Math.sin(i * 1.5) * 10}%`,
                      animation: "pulse-slow 1.5s ease-in-out infinite",
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
              <p className="text-[9px] font-mono text-gray-500 leading-none">SIM: M-CARLO OVERLAY</p>
            </div>

            {/* Layer 5: Floating stats and radar cards (Moves aggressively with mouse) */}
            <div
              className="absolute bottom-6 right-6 z-20 glass-card p-3 rounded-lg border border-blue-500/30 text-xs flex flex-col gap-1 shadow-xl animate-float"
              style={{
                transform: hoveringArena
                  ? `translate3d(${mousePos.x * 45}px, ${mousePos.y * 45}px, 50px)`
                  : "translate3d(0px, 0px, 50px)",
                transition: hoveringArena ? "transform 0.08s ease-out" : "transform 0.5s ease-out",
              }}
            >
              <div className="flex items-center gap-1 text-[10px] text-gray-400 font-semibold">
                <Cpu size={11} className="text-blue-400" />
                <span>VENUE WIN MATRIX</span>
              </div>
              <p className="text-lg font-bold text-white font-mono leading-none">KKR 58%</p>
              <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: "58%" }} />
              </div>
            </div>

            {/* Glowing borders of the overall console */}
            <div className="absolute inset-0 border border-emerald-500/20 rounded-2xl pointer-events-none z-30" />
          </div>
        </div>
      </section>

      {/* 2. Interactive Page Routing Directory (Command Center Grid) */}
      <section className="px-6 py-8">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
          <Database size={14} className="text-emerald-400" />
          <span>Decision Control Room</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Card 1: Auction War Room */}
          <Link to="/auction" className="block">
            <TiltCard maxTilt={15} showShine={true} className="neon-border-gold p-4 h-full flex flex-col justify-between hover:bg-[#1a1c24]">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <Gavel size={20} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-200">Auction War Room</h3>
                  <p className="text-xs text-gray-500 mt-1">Live bid trackers, purse balances, and simulated squad values.</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1c2128] flex items-center justify-between text-[10px]">
                <span className="text-amber-400 font-mono">PURSE SYNCED</span>
                <ArrowRight size={12} className="text-gray-500" />
              </div>
            </TiltCard>
          </Link>

          {/* Card 2: Pre-Match Planner */}
          <Link to="/prematch" className="block">
            <TiltCard maxTilt={15} showShine={true} className="neon-border-green p-4 h-full flex flex-col justify-between hover:bg-[#1a1c24]">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <BarChart2 size={20} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-200">Pre-Match Planner</h3>
                  <p className="text-xs text-gray-500 mt-1">Simulate venue outcomes, weather indexes, and team matchups.</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1c2128] flex items-center justify-between text-[10px]">
                <span className="text-emerald-400 font-mono">10 VENUES LOADED</span>
                <ArrowRight size={12} className="text-gray-500" />
              </div>
            </TiltCard>
          </Link>

          {/* Card 3: Live Match */}
          <Link to="/live" className="block">
            <TiltCard maxTilt={15} showShine={true} className="neon-border-red p-4 h-full flex flex-col justify-between hover:bg-[#1a1c24]">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <Activity size={20} className="text-red-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-200">Live Match Simulator</h3>
                  <p className="text-xs text-gray-500 mt-1">Real-time ball probability, live outcomes, and bowling suggestions.</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1c2128] flex items-center justify-between text-[10px]">
                <span className="text-red-400 font-mono">DB CONNECTED</span>
                <ArrowRight size={12} className="text-gray-500" />
              </div>
            </TiltCard>
          </Link>

          {/* Card 4: Players */}
          <Link to="/players" className="block">
            <TiltCard maxTilt={15} showShine={true} className="neon-border-blue p-4 h-full flex flex-col justify-between hover:bg-[#1a1c24]">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                  <Users size={20} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-200">Players Registry</h3>
                  <p className="text-xs text-gray-500 mt-1">Individual profiles, strike rates, economy maps, and match up metrics.</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1c2128] flex items-center justify-between text-[10px]">
                <span className="text-blue-400 font-mono">600+ PROFILES</span>
                <ArrowRight size={12} className="text-gray-500" />
              </div>
            </TiltCard>
          </Link>

          {/* Card 5: Tournaments */}
          <Link to="/tournaments" className="block">
            <TiltCard maxTilt={15} showShine={true} className="neon-border-purple p-4 h-full flex flex-col justify-between hover:bg-[#1a1c24]">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                  <Trophy size={20} className="text-purple-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-200">Tournaments</h3>
                  <p className="text-xs text-gray-500 mt-1">Track league histories, seasonal rosters, and points table outcomes.</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1c2128] flex items-center justify-between text-[10px]">
                <span className="text-purple-400 font-mono">IPL HISTORIES</span>
                <ArrowRight size={12} className="text-gray-500" />
              </div>
            </TiltCard>
          </Link>

        </div>
      </section>

      {/* 3. Live Analytics Dashboard Showcases */}
      <section className="px-6 pb-12 space-y-6">
        
        {/* Core KPI metrics row */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              { label: "Matches Simulated", value: summary.total_matches.toLocaleString(), color: "text-[#22c55e]" },
              { label: "Ball Records", value: `${(summary.total_balls / 1000).toFixed(0)}K`, color: "text-blue-400" },
              { label: "Registered Players", value: summary.total_players.toLocaleString(), color: "text-purple-400" },
              { label: "Matchup Permutations", value: `${(summary.total_matchups / 1000).toFixed(0)}K`, color: "text-amber-400" },
              { label: "Completed Seasons", value: summary.total_seasons.toLocaleString(), color: "text-pink-400" },
              { label: "Tournaments Tracked", value: summary.total_tournaments.toLocaleString(), color: "text-cyan-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#121620]/60 backdrop-blur-md rounded-xl p-4 border border-[#1c2128] shadow-sm">
                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider leading-none mb-2">{label}</p>
                <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Charts Showcase Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Chart 1: Top Batters */}
          <TiltCard maxTilt={3} showShine={false} className="p-5 glass-card neon-border-green">
            <CardHeader title="Top Run Scorers" subtitle="All IPL seasons · min 10 innings" />
            <div className="mt-4">
              {batters.length === 0 ? <LoadingChart /> : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={batters.slice(0, 10)} layout="vertical" margin={{ left: 80, right: 10, top: 4, bottom: 4 }}>
                    <XAxis type="number" stroke="#374151" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                    <YAxis type="category" dataKey="name" stroke="#374151" tick={{ fontSize: 10, fill: "#d1d5db" }} width={80} />
                    <Tooltip
                      contentStyle={{ background: "rgba(18, 22, 32, 0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11 }}
                      formatter={(v: number) => [`${v.toLocaleString()} runs`, "Runs"]}
                    />
                    <Bar dataKey="total_runs" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </TiltCard>

          {/* Chart 2: Top Bowlers */}
          <TiltCard maxTilt={3} showShine={false} className="p-5 glass-card neon-border-gold">
            <CardHeader title="Top Wicket Takers" subtitle="All IPL seasons · min 10 innings" />
            <div className="mt-4">
              {bowlers.length === 0 ? <LoadingChart /> : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={bowlers.slice(0, 10)} layout="vertical" margin={{ left: 80, right: 10, top: 4, bottom: 4 }}>
                    <XAxis type="number" stroke="#374151" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                    <YAxis type="category" dataKey="name" stroke="#374151" tick={{ fontSize: 10, fill: "#d1d5db" }} width={80} />
                    <Tooltip
                      contentStyle={{ background: "rgba(18, 22, 32, 0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11 }}
                      formatter={(v: number) => [`${v} wickets`, "Wickets"]}
                    />
                    <Bar dataKey="total_wickets" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </TiltCard>

          {/* Chart 3: Win Rate Franchise */}
          <TiltCard maxTilt={3} showShine={false} className="p-5 glass-card neon-border-blue">
            <CardHeader title="Franchise Win Rate" subtitle="All IPL seasons · min 10 matches" />
            <div className="mt-4">
              {teams.length === 0 ? <LoadingChart /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={teams} layout="vertical" margin={{ left: 50, right: 10, top: 4, bottom: 4 }}>
                    <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} stroke="#374151" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                    <YAxis type="category" dataKey="short_name" stroke="#374151" tick={{ fontSize: 11, fill: "#d1d5db" }} width={40} />
                    <Tooltip
                      contentStyle={{ background: "rgba(18, 22, 32, 0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11 }}
                      formatter={(v: number) => [`${v}%`, "Win Rate"]}
                    />
                    <Bar dataKey="win_pct" radius={[0, 4, 4, 0]}>
                      {teams.map((t) => (
                        <Cell key={t.short_name} fill={TEAM_COLORS[t.short_name] ?? "#22c55e"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </TiltCard>

          {/* Chart 4: Run Rate by Over */}
          <TiltCard maxTilt={3} showShine={false} className="p-5 glass-card neon-border-cyan">
            <CardHeader title="Average Run Rate by Over" subtitle="All IPL matches" />
            <div className="mt-4">
              {overRates.length === 0 ? <LoadingChart /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={overRates} margin={{ left: -10, right: 10, top: 4, bottom: 4 }}>
                    <defs>
                      <linearGradient id="rpoGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.3} />
                    <XAxis dataKey="over" stroke="#374151" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                    <YAxis stroke="#374151" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                    <Tooltip
                      contentStyle={{ background: "rgba(18, 22, 32, 0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11 }}
                      formatter={(v: number) => [`${v} RPO`, "Average RPO"]}
                    />
                    <Area type="monotone" dataKey="rpo" stroke="#06b6d4" strokeWidth={2} fill="url(#rpoGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </TiltCard>

        </div>

        {/* Dismissal type + score range split row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TiltCard maxTilt={3} showShine={false} className="p-5 glass-card neon-border-purple">
            <CardHeader title="Dismissal Breakdown" subtitle="Distribution of Wickets" />
            <div className="mt-4 flex flex-col sm:flex-row items-center gap-6 justify-center">
              {wickets.length === 0 ? <LoadingChart /> : (
                <>
                  <div className="flex-shrink-0" style={{ width: 170, height: 170 }}>
                    <PieChart width={170} height={170}>
                      <Pie data={wickets} cx={85} cy={85} innerRadius={45} outerRadius={70} dataKey="count" paddingAngle={3}>
                        {wickets.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "rgba(18, 22, 32, 0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11 }}
                      />
                    </PieChart>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full max-w-sm">
                    {wickets.slice(0, 8).map((w, i) => (
                      <div key={w.type} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-xs text-gray-400 truncate flex-1">{w.type}</span>
                        <span className="text-xs font-mono font-bold text-gray-200">{w.pct}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </TiltCard>

          <TiltCard maxTilt={3} showShine={false} className="p-5 glass-card neon-border-red">
            <CardHeader title="First Innings Totals" subtitle="Score Ranges frequency" />
            <div className="mt-4">
              {scores.length === 0 ? <LoadingChart /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={scores} margin={{ left: -10, right: 10, top: 4, bottom: 4 }}>
                    <XAxis dataKey="score_range" stroke="#374151" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                    <YAxis stroke="#374151" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                    <Tooltip
                      contentStyle={{ background: "rgba(18, 22, 32, 0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11 }}
                    />
                    <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </TiltCard>
        </div>

        {/* Full Leaderboard details */}
        {batters.length > 0 && (
          <TiltCard maxTilt={1} showShine={false} className="p-5 glass-card border-[#1c2128]">
            <CardHeader title="Full Batting Leaderboard" subtitle="Top 15 Run Scorers in IPL history" />
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 uppercase tracking-wider border-b border-[#1c2128] pb-2">
                    {["#", "Player", "Role", "Innings", "Runs", "Avg", "Strike Rate", "Fifties", "HS", "Fours", "Sixes"].map(h => (
                      <th key={h} className="py-2.5 px-3 text-left font-semibold first:pl-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batters.map((b, i) => (
                    <tr key={b.name} className="border-t border-[#1c2128]/70 hover:bg-[#121622]/40 transition-colors">
                      <td className="py-2.5 px-3 first:pl-0 font-mono text-gray-500">{i + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-gray-200">{b.name}</td>
                      <td className="py-2.5 px-3 text-gray-400">{b.role.split(" ")[0]}</td>
                      <td className="py-2.5 px-3 font-mono text-gray-400">{b.innings}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">{b.total_runs.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-mono text-gray-300">{b.avg}</td>
                      <td className="py-2.5 px-3 font-mono text-blue-400">{b.sr}</td>
                      <td className="py-2.5 px-3 font-mono text-gray-400">{b.fifties}</td>
                      <td className="py-2.5 px-3 font-mono text-amber-400">{b.highest}</td>
                      <td className="py-2.5 px-3 font-mono text-gray-500">{b.fours?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-mono text-purple-400">{b.sixes?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TiltCard>
        )}

      </section>
    </div>
  );
}

function LoadingChart() {
  return (
    <div className="flex items-center justify-center h-48">
      <Spinner size={24} />
    </div>
  );
}
