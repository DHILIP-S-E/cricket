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

  // Clean up raw database enum prefixes
  const formatTournamentName = (name: string) => {
    return name.replace("TournamentNameEnum.", "");
  };

  return (
    <div className="flex flex-col h-full bg-surface text-text-primary">
      <PageHeader title={title} subtitle={subtitle} />

      <div className="flex-1 overflow-auto p-4 bg-surface">
        <Card>
          <CardHeader title="Select a Match" subtitle="Pick a fixture to open" />

          {/* Season + search controls */}
          <div className="flex items-center gap-3 mb-4 flex-wrap bg-surface-elevated/20 p-2.5 rounded-xl border border-surface-border/50">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-text-secondary" />
              <select
                value={effectiveSeason}
                onChange={(e) => setSeasonId(e.target.value)}
                className="bg-surface border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand font-medium transition-all"
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatTournamentName(s.tournament_name)} {s.year}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <Search size={14} className="text-text-secondary" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search team or city…"
                className="bg-surface border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary w-full focus:outline-none focus:ring-1 focus:ring-brand transition-all"
              />
            </div>
            <span className="text-xs text-text-secondary font-medium font-mono">{matches.length} matches found</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : matches.length === 0 ? (
            <EmptyState message="No matches for this season" />
          ) : (
            <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
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
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-elevated transition-colors text-left border border-transparent hover:border-surface-border/50"
    >
      <span className="text-[10px] text-text-secondary font-mono w-16 flex-shrink-0 leading-tight">
        {m.match_number ? `#${m.match_number}` : ""}
        <br />
        {date}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-extrabold text-text-primary uppercase">{m.team1.short_name}</span>
          <span className="text-text-tertiary text-[10px] font-bold lowercase">vs</span>
          <span className="font-extrabold text-text-primary uppercase">{m.team2.short_name}</span>
          {m.match_type !== "MatchTypeEnum.League" && m.match_type !== "League" && (
            <span className="ml-1"><Badge label={m.match_type.replace("MatchTypeEnum.", "")} variant="purple" /></span>
          )}
        </div>
        <p className="text-[11px] text-text-secondary truncate mt-0.5">
          {m.venue.name}, {m.venue.city} · {result}
        </p>
      </div>
      <ChevronRight size={14} className="text-text-tertiary flex-shrink-0" />
    </button>
  );
}
