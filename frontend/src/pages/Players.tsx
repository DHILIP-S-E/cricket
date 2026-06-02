import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronRight } from "lucide-react";
import { playersApi } from "../api/cricket";
import {
  Card, CardHeader, PageHeader, Spinner, EmptyState, RoleBadge, Badge, Stat, Progress,
} from "../components/ui";

const ROLES = [
  "Top-order Batter", "Middle-order Batter", "Batting All-rounder",
  "Bowling All-rounder", "Wicket-keeper Batter", "Pace Bowler", "Spin Bowler",
];

export function Players() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

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
    <div className="flex flex-col h-full">
      <PageHeader
        title="Player Database"
        subtitle={`${total.toLocaleString()} players`}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Player List */}
        <div className="w-80 flex-shrink-0 border-r border-surface-border flex flex-col">
          {/* Search & Filters */}
          <div className="p-3 border-b border-surface-border space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={q}
                onChange={e => { setQ(e.target.value); setPage(1); }}
                placeholder="Search players..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-surface-elevated border border-surface-border rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand"
              />
            </div>
            <select
              value={role}
              onChange={e => { setRole(e.target.value); setPage(1); }}
              className="w-full px-2 py-1.5 text-sm bg-surface-elevated border border-surface-border rounded-lg text-gray-400 focus:outline-none focus:border-brand"
            >
              <option value="">All Roles</option>
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 border-b border-surface-border hover:bg-surface-elevated transition-colors text-left ${selected === p.id ? "bg-surface-elevated" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">{p.full_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <RoleBadge role={p.playing_role} />
                        <span className="text-[10px] text-gray-600">{p.nationality}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-500 font-mono">{p.ipl_caps} IPL</p>
                    </div>
                    <ChevronRight size={12} className="text-gray-600 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {total > 25 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-surface-border">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="text-xs text-gray-600">{page} / {Math.ceil(total / 25)}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / 25)}
                className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Player Detail */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-gray-600">
              <p className="text-sm">Select a player to view profile</p>
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
  const cs = profile.career_stats;
  const rating = profile.rating;
  const form = profile.form;
  const val = profile.valuation;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-surface-elevated flex items-center justify-center text-3xl flex-shrink-0">🏏</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-100">{profile.full_name}</h2>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <RoleBadge role={profile.playing_role} />
              <Badge label={profile.nationality} variant={profile.nationality === "India" ? "blue" : "purple"} />
              <Badge label={profile.batting_style} variant="gray" />
              {profile.bowling_style !== "None" && <Badge label={profile.bowling_style} variant="gray" />}
            </div>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <Stat label="IPL Caps" value={profile.ipl_caps} />
              <Stat label="Intl Caps" value={profile.international_caps} />
              {val && <Stat label="Market Value" value={`₹${val.fair_market_value_cr.toFixed(1)} Cr`} color="text-signal-green" />}
            </div>
          </div>
          {rating && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-surface-elevated border-2 border-signal-green flex items-center justify-center">
                <span className="text-xl font-bold font-mono text-signal-green">{Math.round(rating.overall_rating)}</span>
              </div>
              <p className="text-[10px] text-gray-600 mt-1">Overall</p>
            </div>
          )}
        </div>
      </Card>

      {/* Career Stats */}
      {cs && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Batting" />
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Innings" value={cs.batting_innings} />
              <Stat label="Average" value={cs.batting_avg?.toFixed(1) ?? "—"} />
              <Stat label="Strike Rate" value={cs.batting_strike_rate?.toFixed(1) ?? "—"} />
              <Stat label="Runs" value={cs.batting_runs.toLocaleString()} />
              <Stat label="50s" value={cs.batting_50s} />
              <Stat label="100s" value={cs.batting_100s} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Bowling" />
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Wickets" value={cs.bowling_wickets} />
              <Stat label="Average" value={cs.bowling_avg?.toFixed(1) ?? "—"} />
              <Stat label="Economy" value={cs.bowling_economy?.toFixed(2) ?? "—"} />
              <Stat label="SR" value={cs.bowling_strike_rate?.toFixed(1) ?? "—"} />
              <Stat label="Best" value={cs.bowling_best_figures ?? "—"} />
              <Stat label="Catches" value={cs.catches} />
            </div>
          </Card>
        </div>
      )}

      {/* Ratings */}
      {rating && (
        <Card>
          <CardHeader title="AI Ratings" subtitle="Computed from career performance" />
          <div className="space-y-2.5">
            {[
              { label: "Overall", val: rating.overall_rating },
              { label: "Batting", val: rating.batting_rating },
              { label: "Bowling", val: rating.bowling_rating },
              { label: "Powerplay", val: rating.powerplay_rating },
              { label: "Death Overs", val: rating.death_overs_rating },
              { label: "Potential", val: rating.potential_rating },
            ].filter(r => r.val != null).map(({ label, val }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">{label}</span>
                  <span className="font-mono text-gray-200">{Math.round(val!)}</span>
                </div>
                <Progress
                  value={val!}
                  indicatorClass={val! >= 70 ? "bg-[#22c55e]" : val! >= 50 ? "bg-amber-400" : "bg-red-500"}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Form + Valuation */}
      {(form || val) && (
        <div className="grid grid-cols-2 gap-4">
          {form && (
            <Card>
              <CardHeader title={`Recent Form (last ${form.last_n_matches})`} />
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Form Score" value={`${Math.round(form.form_score * 100)}%`} color={form.form_score > 0.6 ? "text-signal-green" : "text-signal-amber"} />
                {form.batting_avg_recent && <Stat label="Recent Avg" value={form.batting_avg_recent.toFixed(1)} />}
                {form.strike_rate_recent && <Stat label="Recent SR" value={form.strike_rate_recent.toFixed(1)} />}
                {form.economy_recent && <Stat label="Recent Eco" value={form.economy_recent.toFixed(2)} />}
              </div>
            </Card>
          )}
          {val && (
            <Card>
              <CardHeader title="Market Valuation" />
              <div className="space-y-2">
                <Stat label="Fair Value" value={`₹${val.fair_market_value_cr.toFixed(1)} Cr`} color="text-signal-green" />
                {val.confidence_low_cr && val.confidence_high_cr && (
                  <p className="text-xs text-gray-500">
                    Range: ₹{val.confidence_low_cr.toFixed(1)} – ₹{val.confidence_high_cr.toFixed(1)} Cr
                  </p>
                )}
                {val.predicted_auction_price_cr && (
                  <Stat label="Predicted Auction Price" value={`₹${val.predicted_auction_price_cr.toFixed(1)} Cr`} />
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
