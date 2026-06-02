import { useState } from "react";
import { useQuery } from "../lib/query";
import { Search, ChevronRight, Star, Cpu, Award, DollarSign } from "lucide-react";
import { playersApi } from "../api/cricket";
import {
  Card, CardHeader, PageHeader, Spinner, EmptyState, RoleBadge, Badge, Stat, Progress,
} from "../components/ui";
import { useTheme } from "../context/ThemeContext";

const ROLES = [
  "Top-order Batter", "Middle-order Batter", "Batting All-rounder",
  "Bowling All-rounder", "Wicket-keeper Batter", "Pace Bowler", "Spin Bowler",
];

export function Players() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const { colorMode } = useTheme();

  const { data, isLoading } = useQuery({
    queryKey: ["players", q, role, page],
    queryFn: () => playersApi.list({ q: q || undefined, playing_role: role || undefined, page, size: 25 }),
  });

  const { data: profileRes } = useQuery({
    queryKey: ["player", selected],
    queryFn: () => playersApi.get(selected!),
    enabled: !!selected,
  });

  const players = data?.data ?? [];
  const total = data?.total ?? 0;
  const profile = profileRes?.data;

  return (
    <div className="flex flex-col h-full bg-surface text-text-primary">
      <PageHeader
        title="Player Database"
        subtitle={`${total.toLocaleString()} profiles loaded`}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Player List */}
        <div className="w-80 flex-shrink-0 border-r border-surface-border flex flex-col bg-surface-card/30">
          {/* Search & Filters */}
          <div className="p-3 border-b border-surface-border space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                value={q}
                onChange={e => { setQ(e.target.value); setPage(1); }}
                placeholder="Search players..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-surface-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand transition-all"
              />
            </div>
            <select
              value={role}
              onChange={e => { setRole(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 text-xs bg-surface border border-surface-border rounded-lg text-text-secondary focus:outline-none focus:border-brand font-medium transition-all"
            >
              <option value="">All Playing Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : players.length === 0 ? (
              <EmptyState message="No players found" />
            ) : (
              <div>
                {players.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 border-b border-surface-border hover:bg-surface-elevated/50 transition-colors text-left ${selected === p.id ? "bg-surface-elevated border-l-2 border-l-brand" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-extrabold text-text-primary truncate">{p.full_name}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <RoleBadge role={p.playing_role} />
                        <span className="text-[9px] text-text-tertiary font-medium">{p.nationality}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-text-secondary font-mono font-bold">{p.ipl_caps} IPL Caps</p>
                    </div>
                    <ChevronRight size={12} className="text-text-tertiary flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {total > 25 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-surface-border bg-surface-elevated/40">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-xs font-semibold text-text-secondary hover:text-text-primary disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="text-xs font-mono text-text-tertiary">{page} / {Math.ceil(total / 25)}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / 25)}
                className="text-xs font-semibold text-text-secondary hover:text-text-primary disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Player Detail */}
        <div className="flex-1 overflow-y-auto p-6 bg-surface">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-text-secondary">
              <div className="text-center">
                <Star size={36} className="mx-auto text-text-tertiary mb-3 animate-float" />
                <p className="text-sm font-semibold">Select a player to load their sports trading card</p>
              </div>
            </div>
          ) : !profile ? (
            <div className="flex justify-center py-12"><Spinner size={28} /></div>
          ) : (
            <PlayerDetail profile={profile} />
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerDetail({ profile }: { profile: any }) {
  const { colorMode, getThemeColors } = useTheme();
  const themeColors = getThemeColors();

  const cs = profile.career_stats;
  const rating = profile.rating;
  const form = profile.form;
  const val = profile.valuation;

  const cardBorderColor = colorMode === "dark" ? themeColors.primary : "#cfd8dc";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      
      {/* Immersive Sports Trading Card Front */}
      <div 
        className="relative rounded-2xl p-6 border-4 shadow-2xl overflow-hidden transition-all duration-500 hover:scale-[1.01]"
        style={{
          borderColor: cardBorderColor,
          boxShadow: colorMode === "dark" ? `0 15px 40px -10px ${themeColors.primary}30` : "0 15px 35px -10px rgba(0,0,0,0.1)",
          background: colorMode === "dark" 
            ? `linear-gradient(135deg, rgba(22, 27, 34, 0.95) 0%, rgba(8, 10, 16, 0.98) 100%)`
            : `linear-gradient(135deg, #ffffff 0%, #f4f6fa 100%)`,
        }}
      >
        {/* Holographic scanning overlay in Dark Mode */}
        {colorMode === "dark" && (
          <div className="absolute inset-0 scanline opacity-10 pointer-events-none" />
        )}
        
        {/* Decorative dynamic neon glow ring inside */}
        <div 
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-500" 
          style={{ backgroundColor: themeColors.primary }}
        />

        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 z-10 relative">
          
          {/* Avatar frame */}
          <div className="relative flex-shrink-0">
            <div 
              className="w-24 h-24 rounded-2xl bg-surface-elevated border-2 flex items-center justify-center text-4xl shadow-inner relative z-10"
              style={{ borderColor: cardBorderColor }}
            >
              🏏
            </div>
            {/* Pulsing ring overlay */}
            <div 
              className="absolute inset-0 rounded-2xl border-2 animate-ping opacity-25 pointer-events-none scale-105"
              style={{ borderColor: themeColors.primary }}
            />
          </div>

          {/* Info Details */}
          <div className="flex-1 text-center md:text-left space-y-3">
            <div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1.5">
                <span className="text-[10px] uppercase font-black tracking-widest text-brand">OFFICIAL PRO EVALUATION</span>
                {profile.nationality === "India" ? (
                  <Badge label="Domestic Asset" variant="blue" />
                ) : (
                  <Badge label="Overseas Import" variant="purple" />
                )}
              </div>
              <h2 className="text-2xl font-black text-text-primary tracking-tight leading-tight uppercase">{profile.full_name}</h2>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mt-2">
                <RoleBadge role={profile.playing_role} />
                <Badge label={profile.batting_style} variant="gray" />
                {profile.bowling_style !== "None" && <Badge label={profile.bowling_style} variant="gray" />}
              </div>
            </div>

            {/* Overall stats list */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-surface-border/50 max-w-sm">
              <Stat label="IPL Matches" value={profile.ipl_caps} />
              <Stat label="Intl Matches" value={profile.international_caps} />
              {val && <Stat label="AI Valuation" value={`₹${val.fair_market_value_cr.toFixed(1)} Cr`} color="text-brand" />}
            </div>
          </div>

          {/* Large Digital Rating Ring */}
          {rating && (
            <div className="flex flex-col items-center flex-shrink-0">
              <div 
                className="w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center shadow-lg relative transition-all"
                style={{ 
                  borderColor: themeColors.primary,
                  boxShadow: `0 0 15px ${themeColors.primary}40`,
                  backgroundColor: colorMode === "dark" ? "rgba(22, 27, 34, 0.8)" : "#ffffff"
                }}
              >
                <span className="text-3xl font-black font-mono text-text-primary tracking-tighter">{Math.round(rating.overall_rating)}</span>
                <span className="text-[8px] text-text-secondary uppercase font-bold tracking-wider leading-none">OVR</span>
              </div>
              <p className="text-[9px] text-text-secondary mt-2 font-extrabold uppercase tracking-widest flex items-center gap-1">
                <Award size={10} className="text-brand" />
                <span>AI CARD LEVEL</span>
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Career Stats Grid */}
      {cs && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="hover:border-brand/30 transition-colors">
            <CardHeader title="Batting Statistics Matrix" subtitle="Overall professional metrics" />
            <div className="grid grid-cols-3 gap-4 mt-2">
              <Stat label="Innings" value={cs.batting_innings} />
              <Stat label="Average" value={cs.batting_avg?.toFixed(1) ?? "—"} />
              <Stat label="Strike Rate" value={cs.batting_strike_rate?.toFixed(1) ?? "—"} color="text-brand" />
              <Stat label="Runs" value={cs.batting_runs.toLocaleString()} />
              <Stat label="50s" value={cs.batting_50s} />
              <Stat label="100s" value={cs.batting_100s} />
            </div>
          </Card>

          <Card className="hover:border-brand/30 transition-colors">
            <CardHeader title="Bowling Statistics Matrix" subtitle="Overall professional metrics" />
            <div className="grid grid-cols-3 gap-4 mt-2">
              <Stat label="Wickets" value={cs.bowling_wickets} />
              <Stat label="Average" value={cs.bowling_avg?.toFixed(1) ?? "—"} />
              <Stat label="Economy" value={cs.bowling_economy?.toFixed(2) ?? "—"} color="text-brand" />
              <Stat label="SR" value={cs.bowling_strike_rate?.toFixed(1) ?? "—"} />
              <Stat label="Best Figure" value={cs.bowling_best_figures ?? "—"} />
              <Stat label="Catches" value={cs.catches} />
            </div>
          </Card>
        </div>
      )}

      {/* Ratings Progression Bar */}
      {rating && (
        <Card className="hover:border-brand/30 transition-colors">
          <CardHeader title="AI Performance Breakdown" subtitle="Detailed situational telemetry evaluation" />
          <div className="space-y-3 mt-3">
            {[
              { label: "Overall Play Rating", val: rating.overall_rating },
              { label: "Batting Skill Index", val: rating.batting_rating },
              { label: "Bowling Skill Index", val: rating.bowling_rating },
              { label: "Powerplay Performance Rating", val: rating.powerplay_rating },
              { label: "Death Overs Clutch Rating", val: rating.death_overs_rating },
              { label: "Growth Potential Score", val: rating.potential_rating },
            ].filter(r => r.val != null).map(({ label, val }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-text-secondary font-medium">{label}</span>
                  <span className="font-mono font-bold text-text-primary">{Math.round(val!)}</span>
                </div>
                <Progress
                  value={val!}
                  indicatorClass={val! >= 70 ? "bg-brand" : val! >= 50 ? "bg-amber-500" : "bg-red-500"}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Form Score and Valuation */}
      {(form || val) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {form && (
            <Card className="hover:border-brand/30 transition-colors">
              <CardHeader title={`Recent Form Score (Last ${form.last_n_matches} Innings)`} />
              <div className="grid grid-cols-2 gap-4 mt-2">
                <Stat label="Form Efficiency" value={`${Math.round(form.form_score * 100)}%`} color={form.form_score > 0.6 ? "text-brand" : "text-amber-500"} />
                {form.batting_avg_recent && <Stat label="Recent Average" value={form.batting_avg_recent.toFixed(1)} />}
                {form.strike_rate_recent && <Stat label="Recent Strike Rate" value={form.strike_rate_recent.toFixed(1)} />}
                {form.economy_recent && <Stat label="Recent Economy" value={form.economy_recent.toFixed(2)} />}
              </div>
            </Card>
          )}

          {val && (
            <Card className="hover:border-brand/30 transition-colors">
              <CardHeader title="Market Capital Telemetry" />
              <div className="space-y-3 mt-2">
                <div className="flex items-center gap-2 p-2 bg-surface-elevated border border-surface-border rounded-xl shadow-inner">
                  <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand flex-shrink-0">
                    <DollarSign size={16} />
                  </div>
                  <div>
                    <p className="text-[9px] text-text-secondary uppercase tracking-wider font-bold">Fair Market Price</p>
                    <p className="text-base font-black font-mono text-brand">₹{val.fair_market_value_cr.toFixed(2)} Cr</p>
                  </div>
                </div>
                {val.confidence_low_cr && val.confidence_high_cr && (
                  <p className="text-xs text-text-secondary font-medium">
                    Evaluated Auction Bracket: <strong className="text-text-primary font-mono">₹{val.confidence_low_cr.toFixed(1)} Cr – ₹{val.confidence_high_cr.toFixed(1)} Cr</strong>
                  </p>
                )}
                {val.predicted_auction_price_cr && (
                  <Stat label="Predicted Auction Value" value={`₹${val.predicted_auction_price_cr.toFixed(2)} Cr`} />
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
