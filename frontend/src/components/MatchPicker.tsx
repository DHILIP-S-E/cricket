import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "../lib/query";
import { Calendar, ChevronRight, Search } from "lucide-react";
import { tournamentApi } from "../api/cricket";
import { Card, CardHeader, PageHeader, Spinner, EmptyState, Badge } from "./ui";
import type { Match } from "../types/cricket";

const SEASON_ID = import.meta.env.VITE_SEASON_ID ?? "";

/**
 * Lets the user pick a match to open in the Pre-Match Planner or Live view.
 * Both routes accept an optional :matchId; this fills the gap when none is set.
 */
export function MatchPicker({
  title,
  subtitle,
  basePath,
}: {
  title: string;
  subtitle: string;
  basePath: "/prematch" | "/live";
}) {
  const navigate = useNavigate();
  const [seasonId, setSeasonId] = useState<string>(SEASON_ID);
  const [q, setQ] = useState("");

  const { data: tournamentsRes } = useQuery({
    queryKey: ["tournaments"],
    queryFn: tournamentApi.list,
  });
  const tournamentId = tournamentsRes?.data?.[0]?.id;

  const { data: seasonsRes } = useQuery({
    queryKey: ["seasons", tournamentId],
    queryFn: () => tournamentApi.seasons(tournamentId!),
    enabled: !!tournamentId,
  });
  const seasons = useMemo(
    () => [...(seasonsRes?.data ?? [])].sort((a, b) => b.year - a.year),
    [seasonsRes]
  );

  // Default to env season, else the most recent one once seasons load.
  const effectiveSeason = seasonId || seasons[0]?.id || "";

  const { data: matchesRes, isLoading } = useQuery({
    queryKey: ["matches", effectiveSeason],
    queryFn: () => tournamentApi.matches(effectiveSeason, { size: 100 }),
    enabled: !!effectiveSeason,
  });

  const matches = useMemo(() => {
    const all = matchesRes?.data ?? [];
    const term = q.trim().toLowerCase();
    const filtered = term
      ? all.filter(
          (m) =>
            m.team1.name.toLowerCase().includes(term) ||
            m.team2.name.toLowerCase().includes(term) ||
            m.team1.short_name.toLowerCase().includes(term) ||
            m.team2.short_name.toLowerCase().includes(term) ||
            m.venue.city.toLowerCase().includes(term)
        )
      : all;
    return [...filtered].sort(
      (a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime()
    );
  }, [matchesRes, q]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title={title} subtitle={subtitle} />

      <div className="flex-1 overflow-auto p-4">
        <Card>
          <CardHeader title="Select a match" subtitle="Pick a fixture to open" />

          {/* Season + search controls */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-500" />
              <select
                value={effectiveSeason}
                onChange={(e) => setSeasonId(e.target.value)}
                className="bg-surface-elevated border border-surface-border rounded-md px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-signal-green"
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.tournament_name} {s.year}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <Search size={14} className="text-gray-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search team or city…"
                className="bg-surface-elevated border border-surface-border rounded-md px-2 py-1.5 text-sm text-gray-200 w-full focus:outline-none focus:border-signal-green"
              />
            </div>
            <span className="text-xs text-gray-500">{matches.length} matches</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : matches.length === 0 ? (
            <EmptyState message="No matches for this season" />
          ) : (
            <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto">
              {matches.map((m) => (
                <MatchRow key={m.id} match={m} onClick={() => navigate(`${basePath}/${m.id}`)} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function MatchRow({ match: m, onClick }: { match: Match; onClick: () => void }) {
  const date = new Date(m.match_date).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const result = m.no_result
    ? "No result"
    : m.winner
    ? `${m.winner.short_name} won${
        m.win_margin_runs
          ? ` by ${m.win_margin_runs} runs`
          : m.win_margin_wickets
          ? ` by ${m.win_margin_wickets} wkts`
          : ""
      }`
    : m.is_completed
    ? "Tied"
    : "Upcoming";

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-elevated transition-colors text-left border border-transparent hover:border-surface-border"
    >
      <span className="text-[10px] text-gray-600 font-mono w-14 flex-shrink-0">
        {m.match_number ? `#${m.match_number}` : ""}
        <br />
        {date}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-200">{m.team1.short_name}</span>
          <span className="text-gray-600 text-xs">vs</span>
          <span className="font-medium text-gray-200">{m.team2.short_name}</span>
          {m.match_type !== "MatchTypeEnum.League" && m.match_type !== "League" && (
            <Badge label={m.match_type.replace("MatchTypeEnum.", "")} variant="purple" />
          )}
        </div>
        <p className="text-[11px] text-gray-500 truncate">
          {m.venue.name}, {m.venue.city} · {result}
        </p>
      </div>
      <ChevronRight size={14} className="text-gray-600 flex-shrink-0" />
    </button>
  );
}
