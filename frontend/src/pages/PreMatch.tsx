import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { prematchApi } from "../api/cricket";
import {
  Card, CardHeader, Stat, Badge, ConfidenceBadge, RoleBadge,
  PageHeader, Spinner, EmptyState, WinProbBar,
} from "../components/ui";
import { Star } from "lucide-react";
import { MatchPicker } from "../components/MatchPicker";

const FRANCHISE_ID = import.meta.env.VITE_FRANCHISE_ID ?? "";
const SEASON_ID = import.meta.env.VITE_SEASON_ID ?? "";

export function PreMatch() {
  const { matchId } = useParams<{ matchId: string }>();
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
    return (
      <MatchPicker
        title="Pre-Match Planner"
        subtitle="Select a match to view win probability and XI recommendation"
        basePath="/prematch"
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
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
            ) : !FRANCHISE_ID ? (
              <Card>
                <EmptyState message="Set VITE_FRANCHISE_ID and VITE_SEASON_ID to get XI recommendation" />
              </Card>
            ) : (
              <Card><EmptyState message="XI recommendation unavailable" /></Card>
            )}
          </div>

          {/* Key Factors + Impact Player */}
          <div className="col-span-5 space-y-4">
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
        <CardHeader title="Pre-Match Win Probability" subtitle="Based on venue, form, head-to-head, and toss" />
        <ConfidenceBadge confidence={wp.confidence} />
      </div>
      <WinProbBar team1={wp.team1_name} prob1={wp.team1_win_prob} team2={wp.team2_name} />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="text-center p-3 rounded-lg bg-surface-elevated">
          <p className="text-xs text-gray-500 mb-1">{wp.team1_name}</p>
          <p className="text-3xl font-bold font-mono text-signal-green">
            {Math.round(wp.team1_win_prob * 100)}%
          </p>
        </div>
        <div className="text-center p-3 rounded-lg bg-surface-elevated">
          <p className="text-xs text-gray-500 mb-1">{wp.team2_name}</p>
          <p className="text-3xl font-bold font-mono text-blue-400">
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
      <div className="flex items-center justify-between mb-3">
        <CardHeader title="Recommended Playing XI" subtitle={xi.reasoning?.slice(0, 80) + "..."} />
        <div className="flex gap-1">
          <button onClick={() => setView("list")} className={`px-2 py-1 rounded text-xs ${view === "list" ? "bg-surface-elevated text-gray-200" : "text-gray-500 hover:text-gray-300"}`}>List</button>
          <button onClick={() => setView("grid")} className={`px-2 py-1 rounded text-xs ${view === "grid" ? "bg-surface-elevated text-gray-200" : "text-gray-500 hover:text-gray-300"}`}>Grid</button>
        </div>
      </div>

      {view === "list" ? (
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Role</th>
              <th className="text-right">AI Score</th>
            </tr>
          </thead>
          <tbody>
            {xi.recommended_xi.map((p: any) => (
              <tr key={p.player_id} className="group">
                <td className="font-mono text-gray-500 text-xs">{p.batting_position}</td>
                <td>
                  <span className="text-gray-200 font-medium">{p.full_name}</span>
                  {p.is_overseas && <Badge label="OS" variant="purple" />}
                </td>
                <td><RoleBadge role={p.playing_role} /></td>
                <td className="text-right font-mono text-xs text-signal-green">{p.ai_score.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {xi.recommended_xi.map((p: any) => (
            <div key={p.player_id} className="p-2 rounded-lg bg-surface-elevated border border-surface-border text-center">
              <p className="text-xs text-gray-500 mb-1">#{p.batting_position}</p>
              <p className="text-xs font-medium text-gray-200 leading-tight">{p.full_name.split(" ").pop()}</p>
              <div className="mt-1"><RoleBadge role={p.playing_role} /></div>
              {p.is_overseas && <div className="mt-1"><Badge label="OS" variant="purple" /></div>}
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
      <CardHeader title="Key Factors" />
      <ul className="space-y-2">
        {factors.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
            <span className="text-signal-green mt-0.5">→</span>
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
    <Card className="border-l-2 border-l-signal-amber">
      <CardHeader
        title="Impact Player"
        subtitle="Recommended substitute"
        right={<Star size={14} className="text-signal-amber" />}
      />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-bold text-gray-100">{player.full_name}</p>
          <div className="mt-1"><RoleBadge role={player.playing_role} /></div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">AI Score</p>
          <p className="text-2xl font-bold font-mono text-signal-amber">{player.ai_score?.toFixed(0)}</p>
        </div>
      </div>
    </Card>
  );
}

// ─── XI Stats Card ────────────────────────────────────────────────────────────

function XIStatsCard({ xi }: { xi: any }) {
  return (
    <Card>
      <CardHeader title="XI Composition" />
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total AI Score" value={xi.total_ai_score.toFixed(0)} />
        <Stat label="Bowling Options" value={xi.bowling_options} color={xi.bowling_options >= 5 ? "text-signal-green" : "text-signal-red"} />
        <Stat label="Overseas" value={`${xi.overseas_count}/4`} />
        <Stat label="Players" value={xi.recommended_xi.length} />
      </div>
    </Card>
  );
}
