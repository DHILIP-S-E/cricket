import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Calendar, BarChart2 } from "lucide-react";
import { tournamentApi } from "../api/cricket";
import {
  Card, CardHeader, PageHeader, Spinner, EmptyState, Badge, Stat,
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
    <div className="flex flex-col h-full">
      <PageHeader title="Tournaments & Seasons" subtitle="Season standings, fixtures and squads" />

      <div className="flex flex-1 overflow-hidden">
        {/* Tournament list */}
        <div className="w-56 flex-shrink-0 border-r border-[#30363d] overflow-y-auto">
          <div className="p-3 border-b border-[#30363d]">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Tournaments</p>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            tournaments.map(t => (
              <button
                key={t.id}
                onClick={() => { setSelectedTournament(t.id); setSelectedSeason(null); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-[#30363d] text-left hover:bg-[#1c2128] transition-colors ${selectedTournament === t.id ? "bg-[#1c2128]" : ""}`}
              >
                <Trophy size={14} className={t.is_active ? "text-[#22c55e]" : "text-gray-600"} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{t.name}</p>
                  <p className="text-[10px] text-gray-600">{t.country}</p>
                </div>
                {t.is_active && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] flex-shrink-0 animate-pulse" />
                )}
              </button>
            ))
          )}
          {!isLoading && tournaments.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-8">No tournaments found.<br />Run ingestion first.</p>
          )}
        </div>

        {/* Seasons + content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Season list */}
          {selectedTournament && (
            <div className="w-40 flex-shrink-0 border-r border-[#30363d] overflow-y-auto">
              <div className="p-3 border-b border-[#30363d]">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Seasons</p>
              </div>
              {seasons.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSeason(s.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 border-b border-[#30363d] text-left hover:bg-[#1c2128] transition-colors ${selectedSeason === s.id ? "bg-[#1c2128]" : ""}`}
                >
                  <Calendar size={12} className="text-gray-600" />
                  <span className="text-sm font-mono text-gray-300">{s.year}</span>
                  {s.is_active && <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] ml-auto" />}
                </button>
              ))}
            </div>
          )}

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-4">
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

                <TabsContent value="standings">
                  <Card>
                    <CardHeader title="Points Table" />
                    {pointsTable.length === 0 ? (
                      <EmptyState message="No standings data. Run ingestion to load match results." />
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="text-left">
                            {["#", "Team", "M", "W", "L", "Pts", "NRR"].map(h => (
                              <th key={h} className="text-[10px] text-gray-500 uppercase tracking-wider py-2 px-2 first:pl-0 font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pointsTable.map((row) => (
                            <tr key={row.franchise.id} className="border-t border-[#30363d] hover:bg-[#1c2128] transition-colors">
                              <td className="py-2 px-2 first:pl-0 text-sm text-gray-600 font-mono">{row.rank}</td>
                              <td className="py-2 px-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-gray-400 text-xs w-10">{row.franchise.short_name}</span>
                                  <span className="text-gray-200 truncate">{row.franchise.name}</span>
                                  {row.rank <= 4 && <Badge variant="green">PO</Badge>}
                                </div>
                              </td>
                              <td className="py-2 px-2 font-mono text-sm text-gray-400">{row.matches_played}</td>
                              <td className="py-2 px-2 font-mono text-sm text-[#22c55e]">{row.wins}</td>
                              <td className="py-2 px-2 font-mono text-sm text-gray-500">{row.losses}</td>
                              <td className="py-2 px-2 font-mono text-sm font-bold text-gray-100">{row.points}</td>
                              <td className={`py-2 px-2 font-mono text-sm ${row.net_run_rate >= 0 ? "text-[#22c55e]" : "text-red-400"}`}>
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
