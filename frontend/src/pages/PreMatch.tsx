import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "../lib/query";
import { prematchApi } from "../api/cricket";
import {
  Card, CardHeader, Stat, Badge, ConfidenceBadge, RoleBadge,
  PageHeader, Spinner, EmptyState, WinProbBar,
} from "../components/ui";
import { Star } from "lucide-react";
import { MatchPicker } from "../components/MatchPicker";
import { CoachAdvisorCard } from "../components/CoachAdvisorCard";
import { useTheme } from "../context/ThemeContext";

const FRANCHISE_ID = import.meta.env.VITE_FRANCHISE_ID ?? "";
const SEASON_ID = import.meta.env.VITE_SEASON_ID ?? "";

export function PreMatch() {
  const { matchId } = useParams<{ matchId: string }>();
  const mid = matchId ?? "";
  const { franchise: themeFranchise } = useTheme();

  // Fallback to active theme if env VITE_FRANCHISE_ID is empty
  const activeFranchiseId = FRANCHISE_ID || themeFranchise;

  const { data: wpRes, isLoading: wpLoading } = useQuery({
    queryKey: ["prematch", mid, "wp"],
    queryFn: () => prematchApi.winProbability(mid),
    enabled: !!mid,
  });

  const { data: xiRes, isLoading: xiLoading } = useQuery({
    queryKey: ["prematch", mid, "xi", activeFranchiseId],
    queryFn: () => prematchApi.xiRecommendation(mid, activeFranchiseId, SEASON_ID),
    enabled: !!mid && !!activeFranchiseId && !!SEASON_ID,
  });

  const { data: advisorRes } = useQuery({
    queryKey: ["prematch", mid, "advisor"],
    queryFn: () => prematchApi.advisor(mid),
    enabled: !!mid,
  });

  const wp = wpRes?.data;
  const xi = xiRes?.data;

  if (!mid) {
    return (
      <MatchPicker
        title="Pre-Match Planner"
        subtitle="Select a match to view win probability and XI recommendation"
        basePath="/prematch"
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface text-text-primary">
      <PageHeader
        title="Pre-Match Planner"
        subtitle={wp ? `${wp.team1_name} vs ${wp.team2_name}` : "Loading match..."}
      />

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-12 gap-4">

          {/* Win Probability */}
          <div className="col-span-12">
            {wpLoading ? (
              <Card><div className="flex justify-center py-6"><Spinner /></div></Card>
            ) : wp ? (
              <WinProbabilityCard wp={wp} />
            ) : (
              <Card><EmptyState message="Win probability unavailable" /></Card>
            )}
          </div>

          {/* Playing XI Recommendation */}
          <div className="col-span-7">
            {xiLoading ? (
              <Card><div className="flex justify-center py-8"><Spinner /></div></Card>
            ) : xi ? (
              <PlayingXICard xi={xi} />
            ) : !activeFranchiseId ? (
              <Card>
                <EmptyState message="Set VITE_FRANCHISE_ID and VITE_SEASON_ID to get XI recommendation" />
              </Card>
            ) : (
              <Card><EmptyState message="XI recommendation unavailable" /></Card>
            )}
          </div>

          {/* Key Factors + Impact Player */}
          <div className="col-span-5 space-y-4">
            <CoachAdvisorCard title="AI Coach Briefing" advice={advisorRes?.data} />
            {wp?.key_factors && wp.key_factors.length > 0 && (
              <KeyFactorsCard factors={wp.key_factors} />
            )}
            {xi?.impact_player_recommendation && (
              <ImpactPlayerCard player={xi.impact_player_recommendation} />
            )}
            {xi && <XIStatsCard xi={xi} />}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Win Probability Card ─────────────────────────────────────────────────────

function WinProbabilityCard({ wp }: { wp: any }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <CardHeader title="Pre-Match Win Probability Model" subtitle="Based on venue statistics, franchise form, head-to-head records, and weather toss indexes" />
        <ConfidenceBadge confidence={wp.confidence} />
      </div>
      <WinProbBar team1={wp.team1_name} prob1={wp.team1_win_prob} team2={wp.team2_name} />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="text-center p-4 rounded-xl bg-surface-elevated border border-surface-border shadow-inner">
          <p className="text-xs text-text-secondary mb-1 font-bold">{wp.team1_name}</p>
          <p className="text-3xl font-black font-mono text-brand">
            {Math.round(wp.team1_win_prob * 100)}%
          </p>
        </div>
        <div className="text-center p-4 rounded-xl bg-surface-elevated border border-surface-border shadow-inner">
          <p className="text-xs text-text-secondary mb-1 font-bold">{wp.team2_name}</p>
          <p className="text-3xl font-black font-mono text-blue-500 dark:text-blue-400">
            {Math.round(wp.team2_win_prob * 100)}%
          </p>
        </div>
      </div>
    </Card>
  );
}

// ─── Playing XI Card ──────────────────────────────────────────────────────────

function PlayingXICard({ xi }: { xi: any }) {
  const [view, setView] = useState<"list" | "grid">("list");

  return (
    <Card>
      <div className="flex items-center justify-between mb-3 border-b border-surface-border/50 pb-2">
        <CardHeader title="Recommended Playing XI Squad" subtitle={xi.reasoning?.slice(0, 100) + "..."} />
        <div className="flex gap-1 bg-surface-elevated border border-surface-border rounded-lg p-0.5">
          <button 
            onClick={() => setView("list")} 
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              view === "list" 
                ? "bg-surface text-text-primary border border-surface-border shadow-sm" 
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            List
          </button>
          <button 
            onClick={() => setView("grid")} 
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              view === "grid" 
                ? "bg-surface text-text-primary border border-surface-border shadow-sm" 
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Grid
          </button>
        </div>
      </div>

      {view === "list" ? (
        <table className="data-table w-full text-xs">
          <thead>
            <tr className="text-text-secondary font-bold border-b border-surface-border">
              <th>#</th>
              <th>Player Name</th>
              <th>Playing Role</th>
              <th className="text-right">AI Score</th>
            </tr>
          </thead>
          <tbody>
            {xi.recommended_xi.map((p: any) => (
              <tr key={p.player_id} className="group border-t border-surface-border/50 hover:bg-surface-elevated/45 transition-colors">
                <td className="font-mono text-text-tertiary text-xs py-2">{p.batting_position}</td>
                <td className="py-2">
                  <span className="text-text-primary font-bold">{p.full_name}</span>
                  {p.is_overseas && <span className="ml-1.5"><Badge label="OS" variant="purple" /></span>}
                </td>
                <td className="py-2"><RoleBadge role={p.playing_role} /></td>
                <td className="text-right font-mono text-xs text-brand font-bold py-2">{p.ai_score.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {xi.recommended_xi.map((p: any) => (
            <div key={p.player_id} className="p-2.5 rounded-xl bg-surface-elevated border border-surface-border text-center hover:border-brand/40 transition-colors shadow-sm">
              <p className="text-[10px] text-text-tertiary mb-1 font-semibold font-mono">#{p.batting_position}</p>
              <p className="text-xs font-extrabold text-text-primary leading-tight truncate">{p.full_name.split(" ").pop()}</p>
              <div className="mt-1.5"><RoleBadge role={p.playing_role} /></div>
              {p.is_overseas && <div className="mt-1.5"><Badge label="Overseas" variant="purple" /></div>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Key Factors Card ─────────────────────────────────────────────────────────

function KeyFactorsCard({ factors }: { factors: string[] }) {
  return (
    <Card>
      <CardHeader title="Key Match Factors" />
      <ul className="space-y-2 mt-2">
        {factors.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-xs text-text-secondary leading-relaxed font-medium">
            <span className="text-brand font-black mt-0.5">→</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ─── Impact Player Card ───────────────────────────────────────────────────────

function ImpactPlayerCard({ player }: { player: any }) {
  return (
    <Card className="border-l-4 border-l-brand relative overflow-hidden bg-brand-muted/5">
      <CardHeader
        title="Impact Player Simulation"
        subtitle="Recommended substitute tactical asset"
        right={<Star size={14} className="text-brand animate-spin-slow" />}
      />
      <div className="flex items-center justify-between mt-2">
        <div>
          <p className="text-sm font-extrabold text-text-primary leading-none">{player.full_name}</p>
          <div className="mt-1.5"><RoleBadge role={player.playing_role} /></div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-text-secondary uppercase tracking-wider font-bold">AI Score</p>
          <p className="text-xl font-black font-mono text-brand">{player.ai_score?.toFixed(0)}</p>
        </div>
      </div>
    </Card>
  );
}

// ─── XI Stats Card ────────────────────────────────────────────────────────────

function XIStatsCard({ xi }: { xi: any }) {
  return (
    <Card>
      <CardHeader title="XI Selection Composition" />
      <div className="grid grid-cols-2 gap-3 mt-2">
        <Stat label="Cumulative AI Score" value={xi.total_ai_score.toFixed(0)} />
        <Stat label="Bowling Options" value={xi.bowling_options} color={xi.bowling_options >= 5 ? "text-brand" : "text-red-500"} />
        <Stat label="Overseas Limits" value={`${xi.overseas_count}/4`} />
        <Stat label="Squad Selected" value={xi.recommended_xi.length} />
      </div>
    </Card>
  );
}
