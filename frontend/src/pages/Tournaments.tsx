import { useState } from "react";
import { useQuery } from "../lib/query";
import { Trophy, Calendar, BarChart2 } from "lucide-react";
import { tournamentApi } from "../api/cricket";
import {
  Card, CardHeader, PageHeader, Spinner, EmptyState, Badge,
} from "../components/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

export function Tournaments() {
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);

  const { data: tournamentsRes, isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: tournamentApi.list,
  });

  const { data: seasonsRes } = useQuery({
    queryKey: ["seasons", selectedTournament],
    queryFn: () => tournamentApi.seasons(selectedTournament!),
    enabled: !!selectedTournament,
  });

  const { data: ptRes } = useQuery({
    queryKey: ["points-table", selectedSeason],
    queryFn: () => tournamentApi.pointsTable(selectedSeason!),
    enabled: !!selectedSeason,
  });

  const tournaments = tournamentsRes?.data ?? [];
  const seasons = seasonsRes?.data ?? [];
  const pointsTable = ptRes?.data ?? [];

  return (
    <div className="flex flex-col h-full bg-surface text-text-primary">
      <PageHeader title="Tournaments & Seasons" subtitle="Season standings, fixtures and rosters telemetry" />

      <div className="flex flex-1 overflow-hidden">
        {/* Tournament list */}
        <div className="w-56 flex-shrink-0 border-r border-surface-border overflow-y-auto bg-surface-card/10">
          <div className="p-3 border-b border-surface-border">
            <p className="text-[10px] text-text-secondary uppercase tracking-wider font-bold">Tournaments</p>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            tournaments.map(t => (
              <button
                key={t.id}
                onClick={() => { setSelectedTournament(t.id); setSelectedSeason(null); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-surface-border text-left hover:bg-surface-elevated transition-colors ${selectedTournament === t.id ? "bg-surface-elevated" : ""}`}
              >
                <Trophy size={14} className={t.is_active ? "text-brand" : "text-text-tertiary"} />
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-text-primary truncate">{t.name}</p>
                  <p className="text-[9px] text-text-secondary font-medium">{t.country}</p>
                </div>
                {t.is_active && (
                  <div className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0 animate-pulse ml-auto" />
                )}
              </button>
            ))
          )}
          {!isLoading && tournaments.length === 0 && (
            <p className="text-xs text-text-secondary text-center py-8">No tournaments found.<br />Run ingestion first.</p>
          )}
        </div>

        {/* Seasons + content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Season list */}
          {selectedTournament && (
            <div className="w-40 flex-shrink-0 border-r border-surface-border overflow-y-auto bg-surface-card/5">
              <div className="p-3 border-b border-surface-border">
                <p className="text-[10px] text-text-secondary uppercase tracking-wider font-bold">Seasons</p>
              </div>
              {seasons.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSeason(s.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 border-b border-surface-border text-left hover:bg-surface-elevated transition-colors ${selectedSeason === s.id ? "bg-surface-elevated" : ""}`}
                >
                  <Calendar size={12} className="text-text-tertiary" />
                  <span className="text-xs font-bold font-mono text-text-secondary">{s.year}</span>
                  {s.is_active && <div className="w-1.5 h-1.5 rounded-full bg-brand ml-auto" />}
                </button>
              ))}
            </div>
          )}

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-4 bg-surface">
            {!selectedTournament && (
              <EmptyState message="Select a tournament to view seasons" icon={<Trophy size={32} />} />
            )}
            {selectedTournament && !selectedSeason && (
              <EmptyState message="Select a season to view standings" icon={<BarChart2 size={32} />} />
            )}
            {selectedSeason && (
              <Tabs defaultValue="standings">
                <TabsList>
                  <TabsTrigger value="standings">Standings</TabsTrigger>
                </TabsList>

                <TabsContent value="standings" className="mt-2">
                  <Card>
                    <CardHeader title="Points Table Standings" />
                    {pointsTable.length === 0 ? (
                      <EmptyState message="No standings data available." />
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-text-secondary font-bold">
                            {["#", "Franchise Team", "Played", "Won", "Lost", "Points", "NRR"].map(h => (
                              <th key={h} className="py-2.5 px-2 first:pl-0 font-bold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pointsTable.map((row) => (
                            <tr key={row.franchise.id} className="border-t border-surface-border hover:bg-surface-elevated/45 transition-colors">
                              <td className="py-2.5 px-2 first:pl-0 text-text-secondary font-mono font-bold">{row.rank}</td>
                              <td className="py-2.5 px-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-text-secondary font-bold text-xs w-10">{row.franchise.short_name}</span>
                                  <span className="text-text-primary font-bold truncate">{row.franchise.name}</span>
                                  {row.rank <= 4 && <span className="ml-1.5"><Badge variant="green">Playoffs</Badge></span>}
                                </div>
                              </td>
                              <td className="py-2.5 px-2 font-mono text-text-secondary font-semibold">{row.matches_played}</td>
                              <td className="py-2.5 px-2 font-mono text-brand font-bold">{row.wins}</td>
                              <td className="py-2.5 px-2 font-mono text-text-tertiary">{row.losses}</td>
                              <td className="py-2.5 px-2 font-mono font-black text-text-primary">{row.points}</td>
                              <td className={`py-2.5 px-2 font-mono font-bold ${row.net_run_rate >= 0 ? "text-brand" : "text-red-500"}`}>
                                {row.net_run_rate > 0 ? "+" : ""}{row.net_run_rate.toFixed(3)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
