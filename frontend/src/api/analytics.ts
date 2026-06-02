import { api } from "./api_base";
import type { APIResponse } from "../types/cricket";

export interface PlatformSummary {
  total_matches: number;
  total_balls: number;
  total_players: number;
  total_matchups: number;
  total_tournaments: number;
  total_seasons: number;
}

export interface TopBatter {
  name: string; role: string; innings: number;
  total_runs: number; avg: number; sr: number;
  fours: number; sixes: number; fifties: number; highest: number;
}

export interface TopBowler {
  name: string; role: string; innings: number;
  total_wickets: number; economy: number;
  avg: number; overs: number; dots: number;
}

export interface TeamStat {
  name: string; short_name: string; color: string | null;
  played: number; wins: number; losses: number; win_pct: number;
}

export interface PhaseRunRate {
  phase: string; over: number; avg_rpo: number;
}

export interface WicketType {
  type: string; count: number; pct: number;
}

export interface InningsScore {
  score_range: string; count: number;
}

export interface AgentAnswer {
  answer: string;
  insight?: string;
  data: Record<string, unknown>[];
  type: string;
}

export const analyticsApi = {
  summary:      () => api.get<APIResponse<PlatformSummary>>("/analytics/summary"),
  topBatters:   (limit = 15) => api.get<APIResponse<TopBatter[]>>(`/analytics/top-batters?limit=${limit}`),
  topBowlers:   (limit = 15) => api.get<APIResponse<TopBowler[]>>(`/analytics/top-bowlers?limit=${limit}`),
  teamStats:    () => api.get<APIResponse<TeamStat[]>>("/analytics/team-stats"),
  phaseRates:   () => api.get<APIResponse<PhaseRunRate[]>>("/analytics/run-rate-phases"),
  wicketTypes:  () => api.get<APIResponse<WicketType[]>>("/analytics/wicket-types"),
  inningsScores:() => api.get<APIResponse<InningsScore[]>>("/analytics/innings-scores"),
  ask:          (q: string) => api.get<APIResponse<AgentAnswer>>(`/analytics/agent/ask?q=${encodeURIComponent(q)}`),
};
