import * as React from "react";
import { useQuery } from "../lib/query";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { analyticsApi } from "../api/analytics";
import { CardHeader, Spinner, TiltCard } from "../components/ui";
import {
  Gavel, Activity, BarChart2, Users, Trophy, Database,
  Cpu, Zap, ArrowRight, Sparkles, Tv
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const TEAM_COLORS: Record<string, string> = {
  MI: "#004BA0", CSK: "#FFCC00", RCB: "#D1001C", KKR: "#3B1F8C",
  DC: "#0066B2", RR: "#FF69B4", SRH: "#F7A721", PBKS: "#D71920",
  GT: "#1C3D6E", LSG: "#6CBDE7",
};

export function Dashboard() {
  const { franchise, colorMode, getThemeColors } = useTheme();
  const themeColors = getThemeColors();

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

  const PIE_COLORS = [
    themeColors.primary, 
    themeColors.secondary, 
    "#3b82f6", 
    "#f59e0b", 
    "#ef4444", 
    "#a855f7", 
    "#14b8a6", 
    "#f97316", 
    "#06b6d4"
  ];

  // 3D Parallax Arena Mouse States
  const arenaRef = React.useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
  const [hoveringArena, setHoveringArena] = React.useState(false);

  const handleArenaMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const arena = arenaRef.current;
    if (!arena) return;
    const rect = arena.getBoundingClientRect();
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

  // Label configuration for dynamic charts to ensure visibility across light/dark modes
  const labelColor = colorMode === "dark" ? "#9ca3af" : "#475569";
  const gridColor = colorMode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const tooltipBg = colorMode === "dark" ? "rgba(18, 22, 32, 0.9)" : "rgba(255, 255, 255, 0.95)";
  const tooltipBorder = colorMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tooltipText = colorMode === "dark" ? "#f1f5f9" : "#0f172a";

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-surface text-text-primary select-none transition-colors duration-300">
      
      {/* 1. Immersive Hero Landing Section */}
      <section className="relative px-6 py-8 flex flex-col xl:flex-row gap-8 border-b border-surface-border bg-gradient-to-b from-surface-card to-surface overflow-hidden">
        {/* Glow backdrop decorative (Adapts to theme color) */}
        <div 
          className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none transition-all duration-700" 
          style={{ backgroundColor: `${themeColors.primary}18` }}
        />
        <div 
          className="absolute top-1/3 left-10 w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none transition-all duration-700" 
          style={{ backgroundColor: `${themeColors.secondary}10` }}
        />

        {/* Hero Copy (Left Side) */}
        <div className="flex-1 flex flex-col justify-center space-y-6 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-card border border-brand/20 text-brand text-xs font-semibold w-fit shadow-md shadow-brand/5">
            <Sparkles size={13} className="animate-pulse" />
            <span>IPL DECISION INTELLIGENCE PLATFORM</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight text-text-primary">
              The Future of <br />
              <span className="bg-gradient-to-r from-brand to-brand-hover bg-clip-text text-transparent">
                Cricket Intelligence
              </span>
            </h1>
            <p className="text-text-secondary text-sm max-w-lg leading-relaxed">
              Unlock real-time ball-by-ball predictive simulation, deep venue analytics, and tactical auction simulation models powered by structured data pipelines.
            </p>
          </div>

          {/* Core Call to Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/live"
              className="px-6 py-3 rounded-lg font-bold text-sm bg-brand text-white hover:bg-brand-hover shadow-lg shadow-brand/10 transition-all flex items-center gap-2 group"
            >
              <Zap size={16} />
              <span>Launch Live Simulator</span>
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to="/auction"
              className="px-6 py-3 rounded-lg font-semibold text-sm bg-surface-card hover:bg-surface-elevated text-text-primary border border-surface-border transition-all flex items-center gap-2"
            >
              <Gavel size={15} className="text-amber-500" />
              <span>Explore Auction Room</span>
            </Link>
          </div>

          {/* Quick Platform Metrics */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-surface-border max-w-md">
            <div>
              <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Sim Accuracy</p>
              <p className="text-lg font-bold text-brand font-mono">94.8%</p>
            </div>
            <div>
              <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Datapoints</p>
              <p className="text-lg font-bold text-blue-500 dark:text-blue-400 font-mono">15M+</p>
            </div>
            <div>
              <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Live DB Sync</p>
              <p className="text-lg font-bold text-amber-500 dark:text-amber-400 font-mono">Active</p>
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
            className="relative w-full max-w-xl h-[400px] rounded-2xl border border-surface-border bg-surface shadow-2xl overflow-hidden perspective-container preserve-3d"
          >
            {/* Layer 1: Stadium background with mouse-drag shift */}
            <div
              className="absolute inset-0 bg-cover bg-center pointer-events-none transition-transform duration-500"
              style={{
                backgroundImage: "url('/stadium_neon_bg.png')",
                transform: hoveringArena
                  ? `translate3d(${mousePos.x * -15}px, ${mousePos.y * -15}px, -20px) scale(1.1)`
                  : "translate3d(0px, 0px, -20px) scale(1.05)",
                filter: colorMode === "light" ? "brightness(1.15) contrast(0.95)" : "none",
              }}
            />

            {/* Backdrop overlay adjusting based on mode */}
            <div 
              className="absolute inset-0 pointer-events-none transition-colors duration-300" 
              style={{ backgroundColor: colorMode === "dark" ? "rgba(8, 10, 16, 0.45)" : "rgba(244, 246, 250, 0.65)" }}
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
                  ? `translate3d(${mousePos.x * 15}px, ${mousePos.y * 10}px, 10px) scale(1.03)`
                  : "translate3d(0px, 0px, 10px) scale(1)",
                filter: colorMode === "light" ? "brightness(0.9) contrast(1.1) invert(0.08)" : "none",
              }}
            />

            {/* Layer 4: Simulated Live Streaming Analysis overlay */}
            <div
              className="absolute top-4 left-4 z-20 glass-card p-3 rounded-lg border border-brand/30 text-xs flex flex-col gap-2 max-w-[200px] scanline scanline-beam"
              style={{
                transform: hoveringArena
                  ? `translate3d(${mousePos.x * 25}px, ${mousePos.y * 25}px, 35px)`
                  : "translate3d(0px, 0px, 35px)",
                transition: hoveringArena ? "transform 0.08s ease-out" : "transform 0.5s ease-out",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-brand">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand animate-ping" />
                  <span>LIVE ANALYZER</span>
                </div>
                <Tv size={12} className="text-text-secondary" />
              </div>
              
              {/* Simulated Sine Wavelength Animation */}
              <div className="h-6 flex items-end justify-between gap-[2px] bg-surface-bg/40 px-2 py-1 rounded overflow-hidden">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-[3px] bg-brand rounded-t-sm"
                    style={{
                      height: `${15 + Math.sin(i * 1.5) * 10}%`,
                      animation: "pulse-slow 1.5s ease-in-out infinite",
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
              <p className="text-[9px] font-mono text-text-secondary leading-none">SIM: M-CARLO OVERLAY</p>
            </div>

            {/* Layer 5: Floating stats card */}
            <div
              className="absolute bottom-6 right-6 z-20 glass-card p-3 rounded-lg border border-brand/20 text-xs flex flex-col gap-1 shadow-xl animate-float"
              style={{
                transform: hoveringArena
                  ? `translate3d(${mousePos.x * 35}px, ${mousePos.y * 35}px, 50px)`
                  : "translate3d(0px, 0px, 50px)",
                transition: hoveringArena ? "transform 0.08s ease-out" : "transform 0.5s ease-out",
              }}
            >
              <div className="flex items-center gap-1 text-[10px] text-text-secondary font-semibold">
                <Cpu size={11} className="text-brand" />
                <span>VENUE WIN MATRIX</span>
              </div>
              <p className="text-lg font-bold text-text-primary font-mono leading-none">WIN PROB</p>
              <div className="w-24 h-1.5 bg-surface-border rounded-full overflow-hidden">
                <div className="h-full bg-brand rounded-full" style={{ width: "58%" }} />
              </div>
            </div>

            <div className="absolute inset-0 border border-brand/20 rounded-2xl pointer-events-none z-30" />
          </div>
        </div>
      </section>

      {/* 2. Interactive Page Routing Directory */}
      <section className="px-6 py-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-4 flex items-center gap-2">
          <Database size={14} className="text-brand" />
          <span>Decision Control Room</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Card 1: Auction War Room */}
          <Link to="/auction" className="block">
            <TiltCard maxTilt={10} showShine={true} className="neon-border-gold p-4 h-full flex flex-col justify-between hover:bg-surface-elevated">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <Gavel size={20} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-text-primary">Auction War Room</h3>
                  <p className="text-xs text-text-secondary mt-1">Live bid trackers, purse balances, and simulated squad values.</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between text-[10px]">
                <span className="text-amber-500 font-semibold font-mono">PURSE SYNCED</span>
                <ArrowRight size={12} className="text-text-tertiary" />
              </div>
            </TiltCard>
          </Link>

          {/* Card 2: Pre-Match Planner */}
          <Link to="/prematch" className="block">
            <TiltCard maxTilt={10} showShine={true} className="neon-border-green p-4 h-full flex flex-col justify-between hover:bg-surface-elevated">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-brand-muted border border-brand/30 flex items-center justify-center">
                  <BarChart2 size={20} className="text-brand" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-text-primary">Pre-Match Planner</h3>
                  <p className="text-xs text-text-secondary mt-1">Simulate venue outcomes, weather indexes, and team matchups.</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between text-[10px]">
                <span className="text-brand font-semibold font-mono">10 VENUES LOADED</span>
                <ArrowRight size={12} className="text-text-tertiary" />
              </div>
            </TiltCard>
          </Link>

          {/* Card 3: Live Match */}
          <Link to="/live" className="block">
            <TiltCard maxTilt={10} showShine={true} className="neon-border-red p-4 h-full flex flex-col justify-between hover:bg-surface-elevated">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <Activity size={20} className="text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-text-primary">Live Match Simulator</h3>
                  <p className="text-xs text-text-secondary mt-1">Real-time ball probability, live outcomes, and bowling suggestions.</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between text-[10px]">
                <span className="text-red-500 font-semibold font-mono">DB CONNECTED</span>
                <ArrowRight size={12} className="text-text-tertiary" />
              </div>
            </TiltCard>
          </Link>

          {/* Card 4: Players */}
          <Link to="/players" className="block">
            <TiltCard maxTilt={10} showShine={true} className="neon-border-blue p-4 h-full flex flex-col justify-between hover:bg-surface-elevated">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                  <Users size={20} className="text-blue-500" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-text-primary">Players Registry</h3>
                  <p className="text-xs text-text-secondary mt-1">Individual profiles, strike rates, economy maps, and match up metrics.</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between text-[10px]">
                <span className="text-blue-500 font-semibold font-mono">600+ PROFILES</span>
                <ArrowRight size={12} className="text-text-tertiary" />
              </div>
            </TiltCard>
          </Link>

          {/* Card 5: Tournaments */}
          <Link to="/tournaments" className="block">
            <TiltCard maxTilt={10} showShine={true} className="neon-border-purple p-4 h-full flex flex-col justify-between hover:bg-surface-elevated">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                  <Trophy size={20} className="text-purple-500" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-text-primary">Tournaments</h3>
                  <p className="text-xs text-text-secondary mt-1">Track league histories, seasonal rosters, and points table outcomes.</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between text-[10px]">
                <span className="text-purple-500 font-semibold font-mono">IPL HISTORIES</span>
                <ArrowRight size={12} className="text-text-tertiary" />
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
              { label: "Matches Simulated", value: summary.total_matches.toLocaleString(), color: "text-brand" },
              { label: "Ball Records", value: `${(summary.total_balls / 1000).toFixed(0)}K`, color: "text-blue-500 dark:text-blue-400" },
              { label: "Registered Players", value: summary.total_players.toLocaleString(), color: "text-purple-500 dark:text-purple-400" },
              { label: "Matchup Permutations", value: `${(summary.total_matchups / 1000).toFixed(0)}K`, color: "text-amber-500" },
              { label: "Completed Seasons", value: summary.total_seasons.toLocaleString(), color: "text-pink-500" },
              { label: "Tournaments Tracked", value: summary.total_tournaments.toLocaleString(), color: "text-cyan-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-surface-card rounded-xl p-4 border border-surface-border shadow-sm">
                <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider leading-none mb-2">{label}</p>
                <p className={`text-2xl font-black font-mono ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Charts Showcase Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Chart 1: Top Batters */}
          <TiltCard maxTilt={1} showShine={false} className="p-5 glass-card">
            <CardHeader title="Top Run Scorers" subtitle="All IPL seasons · min 10 innings" />
            <div className="mt-4">
              {batters.length === 0 ? <LoadingChart /> : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={batters.slice(0, 10)} layout="vertical" margin={{ left: 80, right: 10, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis type="number" stroke={labelColor} tick={{ fontSize: 10, fill: labelColor }} />
                    <YAxis type="category" dataKey="name" stroke={labelColor} tick={{ fontSize: 10, fill: labelColor }} width={80} />
                    <Tooltip
                      contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 11, color: tooltipText }}
                      labelStyle={{ color: tooltipText }}
                      formatter={(v: number) => [`${v.toLocaleString()} runs`, "Runs"]}
                    />
                    <Bar dataKey="total_runs" fill={themeColors.primary} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </TiltCard>

          {/* Chart 2: Top Bowlers */}
          <TiltCard maxTilt={1} showShine={false} className="p-5 glass-card">
            <CardHeader title="Top Wicket Takers" subtitle="All IPL seasons · min 10 innings" />
            <div className="mt-4">
              {bowlers.length === 0 ? <LoadingChart /> : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={bowlers.slice(0, 10)} layout="vertical" margin={{ left: 80, right: 10, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis type="number" stroke={labelColor} tick={{ fontSize: 10, fill: labelColor }} />
                    <YAxis type="category" dataKey="name" stroke={labelColor} tick={{ fontSize: 10, fill: labelColor }} width={80} />
                    <Tooltip
                      contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 11, color: tooltipText }}
                      labelStyle={{ color: tooltipText }}
                      formatter={(v: number) => [`${v} wickets`, "Wickets"]}
                    />
                    <Bar dataKey="total_wickets" fill={themeColors.secondary} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </TiltCard>

          {/* Chart 3: Win Rate Franchise */}
          <TiltCard maxTilt={1} showShine={false} className="p-5 glass-card">
            <CardHeader title="Franchise Win Rate" subtitle="All IPL seasons · Highlighted Franchise active" />
            <div className="mt-4">
              {teams.length === 0 ? <LoadingChart /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={teams} layout="vertical" margin={{ left: 50, right: 10, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} stroke={labelColor} tick={{ fontSize: 10, fill: labelColor }} />
                    <YAxis type="category" dataKey="short_name" stroke={labelColor} tick={{ fontSize: 11, fill: labelColor }} width={40} />
                    <Tooltip
                      contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 11, color: tooltipText }}
                      labelStyle={{ color: tooltipText }}
                      formatter={(v: number) => [`${v}%`, "Win Rate"]}
                    />
                    <Bar dataKey="win_pct" radius={[0, 4, 4, 0]}>
                      {teams.map((t) => {
                        const isCurrentFranchise = t.short_name.toUpperCase() === franchise.toUpperCase();
                        return (
                          <Cell 
                            key={t.short_name} 
                            fill={TEAM_COLORS[t.short_name] ?? themeColors.primary} 
                            opacity={franchise === "IPL_GOLD" || isCurrentFranchise ? 1.0 : 0.45}
                            stroke={isCurrentFranchise ? themeColors.primary : "transparent"}
                            strokeWidth={2}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </TiltCard>

          {/* Chart 4: Run Rate by Over */}
          <TiltCard maxTilt={1} showShine={false} className="p-5 glass-card">
            <CardHeader title="Average Run Rate by Over" subtitle="All IPL matches" />
            <div className="mt-4">
              {overRates.length === 0 ? <LoadingChart /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={overRates} margin={{ left: -10, right: 10, top: 4, bottom: 4 }}>
                    <defs>
                      <linearGradient id="rpoGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={themeColors.primary} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={themeColors.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
                    <XAxis dataKey="over" stroke={labelColor} tick={{ fontSize: 9, fill: labelColor }} />
                    <YAxis stroke={labelColor} tick={{ fontSize: 9, fill: labelColor }} />
                    <Tooltip
                      contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 11, color: tooltipText }}
                      labelStyle={{ color: tooltipText }}
                      formatter={(v: number) => [`${v} RPO`, "Average RPO"]}
                    />
                    <Area type="monotone" dataKey="rpo" stroke={themeColors.primary} strokeWidth={2} fill="url(#rpoGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </TiltCard>

        </div>

        {/* Dismissal type + score range split row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TiltCard maxTilt={1} showShine={false} className="p-5 glass-card">
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
                        contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 11, color: tooltipText }}
                      />
                    </PieChart>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full max-w-sm">
                    {wickets.slice(0, 8).map((w, i) => (
                      <div key={w.type} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-xs text-text-secondary truncate flex-1">{w.type}</span>
                        <span className="text-xs font-mono font-bold text-text-primary">{w.pct}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </TiltCard>

          <TiltCard maxTilt={1} showShine={false} className="p-5 glass-card">
            <CardHeader title="First Innings Totals" subtitle="Score Ranges frequency" />
            <div className="mt-4">
              {scores.length === 0 ? <LoadingChart /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={scores} margin={{ left: -10, right: 10, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="score_range" stroke={labelColor} tick={{ fontSize: 9, fill: labelColor }} />
                    <YAxis stroke={labelColor} tick={{ fontSize: 9, fill: labelColor }} />
                    <Tooltip
                      contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 11, color: tooltipText }}
                      labelStyle={{ color: tooltipText }}
                    />
                    <Bar dataKey="count" fill={themeColors.secondary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </TiltCard>
        </div>

        {/* Full Leaderboard details */}
        {batters.length > 0 && (
          <TiltCard maxTilt={1} showShine={false} className="p-5 glass-card">
            <CardHeader title="Full Batting Leaderboard" subtitle="Top 15 Run Scorers in IPL history" />
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-secondary uppercase tracking-wider border-b border-surface-border pb-2">
                    {["#", "Player", "Role", "Innings", "Runs", "Avg", "Strike Rate", "Fifties", "HS", "Fours", "Sixes"].map(h => (
                      <th key={h} className="py-2.5 px-3 text-left font-bold first:pl-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batters.map((b, i) => (
                    <tr key={b.name} className="border-t border-surface-border hover:bg-surface-elevated/45 transition-colors">
                      <td className="py-2.5 px-3 first:pl-0 font-mono text-text-tertiary">{i + 1}</td>
                      <td className="py-2.5 px-3 font-extrabold text-text-primary">{b.name}</td>
                      <td className="py-2.5 px-3 text-text-secondary">{b.role.split(" ")[0]}</td>
                      <td className="py-2.5 px-3 font-mono text-text-secondary">{b.innings}</td>
                      <td className="py-2.5 px-3 font-mono font-black text-brand">{b.total_runs.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-mono text-text-primary">{b.avg}</td>
                      <td className="py-2.5 px-3 font-mono text-blue-500 dark:text-blue-400 font-semibold">{b.sr}</td>
                      <td className="py-2.5 px-3 font-mono text-text-secondary">{b.fifties}</td>
                      <td className="py-2.5 px-3 font-mono text-amber-500 font-bold">{b.highest}</td>
                      <td className="py-2.5 px-3 font-mono text-text-tertiary">{b.fours?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-mono text-purple-500 dark:text-purple-400">{b.sixes?.toLocaleString()}</td>
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
