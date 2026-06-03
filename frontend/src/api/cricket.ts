import { api } from "./api_base";
import type {
  APIResponse, PaginatedResponse,
  Player, PlayerProfile, PlayerForm, PlayerValuation, PlayerMatchup,
  AuctionSession, AuctionLot, TeamAuctionState, BidRecommendation, AuctionQueueItem,
  LiveMatchState, LiveRecommendations, WinProbHistoryPoint, WhatIfScenario, WhatIfResult,
  WinProbability, PlayingXIRecommendation,
  Tournament, Season, PointsTableRow, Match,
} from "../types/cricket";

// ─── Players ─────────────────────────────────────────────────────────────────

export const playersApi = {
  list: (params?: { q?: string; playing_role?: string; nationality?: string; page?: number; size?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.playing_role) qs.set("playing_role", params.playing_role);
    if (params?.nationality) qs.set("nationality", params.nationality);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.size) qs.set("size", String(params.size));
    return api.get<PaginatedResponse<Player>>(`/players?${qs}`);
  },
  get: (id: string) => api.get<APIResponse<PlayerProfile>>(`/players/${id}`),
  form: (id: string) => api.get<APIResponse<PlayerForm>>(`/players/${id}/form`),
  valuation: (id: string) => api.get<APIResponse<PlayerValuation>>(`/players/${id}/valuation`),
  matchups: (id: string, as_role: "batter" | "bowler", phase?: string) =>
    api.get<APIResponse<PlayerMatchup[]>>(`/players/${id}/matchups?as_role=${as_role}&phase=${phase ?? "All"}`),
};

// ─── Auction ─────────────────────────────────────────────────────────────────

export const auctionApi = {
  activeSessions: () => api.get<APIResponse<AuctionSession[]>>("/auction/sessions/active"),
  session: (id: string) => api.get<APIResponse<AuctionSession>>(`/auction/sessions/${id}`),
  teamStates: (sessionId: string) => api.get<APIResponse<TeamAuctionState[]>>(`/auction/sessions/${sessionId}/teams`),
  teamState: (sessionId: string, franchiseId: string) =>
    api.get<APIResponse<TeamAuctionState>>(`/auction/sessions/${sessionId}/teams/${franchiseId}`),
  currentLot: (sessionId: string) => api.get<APIResponse<AuctionLot>>(`/auction/sessions/${sessionId}/current-lot`),
  recommendation: (sessionId: string, franchiseId: string) =>
    api.get<APIResponse<BidRecommendation>>(`/auction/sessions/${sessionId}/recommendation/${franchiseId}`),
  queue: (sessionId: string) => api.get<APIResponse<AuctionQueueItem[]>>(`/auction/sessions/${sessionId}/queue`),
  lots: (sessionId: string) => api.get<APIResponse<AuctionLot[]>>(`/auction/sessions/${sessionId}/lots`),
  placeBid: (lotId: string, franchiseId: string, amount: number, isRtm = false) =>
    api.post<APIResponse<unknown>>("/auction/bids", { lot_id: lotId, franchise_id: franchiseId, bid_amount_cr: amount, is_rtm: isRtm }),
  // Interactive auction engine (live game loop)
  open: (sessionId: string, franchiseId: string) =>
    api.post<APIResponse<AuctionEngineState>>(`/auction/sessions/${sessionId}/open?franchise_id=${franchiseId}`, {}),
  tick: (sessionId: string) =>
    api.post<APIResponse<AuctionEngineState>>(`/auction/sessions/${sessionId}/tick`, {}),
  engineBid: (sessionId: string, franchiseId: string, amount: number) =>
    api.post<APIResponse<AuctionEngineState>>(`/auction/sessions/${sessionId}/user-bid`,
      { lot_id: "00000000-0000-0000-0000-000000000000", franchise_id: franchiseId, bid_amount_cr: amount, is_rtm: false }),
  passLot: (sessionId: string) =>
    api.post<APIResponse<AuctionEngineState>>(`/auction/sessions/${sessionId}/pass`, {}),
  advisor: (sessionId: string, franchiseId: string) =>
    api.get<APIResponse<AdvisorResult>>(`/auction/sessions/${sessionId}/advisor?franchise_id=${franchiseId}`),
  setAutopilot: (sessionId: string, on: boolean) =>
    api.post<APIResponse<AuctionEngineState>>(`/auction/sessions/${sessionId}/autopilot?on=${on}`, {}),
};

export interface AdvisorResult {
  available: boolean;       // true when a live LLM produced the advice
  advice: string;
  call: "BID" | "HOLD" | "PASS";
  provider: string;         // "gemini" | "anthropic" | "openai" | "none"
}

export interface AuctionEngineEvent {
  actor: string;
  action: string;       // "presented" | "bid" | "SOLD" | "UNSOLD"
  amount: number | null;
  player: string;
}

export interface AuctionSeat {
  franchise_id: string;
  franchise_name: string;
  user_name: string | null;
  autopilot: boolean;
}

export interface AuctionEngineState {
  phase: "idle" | "bidding" | "sold" | "unsold" | "finished";
  lot: { lot_number: number; player_id: string; player_name: string; playing_role: string; base_price_cr: number } | null;
  current_price_cr: number | null;
  next_price_cr: number | null;
  increment_cr: number;
  highest_bidder_id: string | null;
  highest_bidder_name: string | null;
  user_is_highest: boolean;
  countdown: number;
  max_countdown: number;
  events: AuctionEngineEvent[];
  last_result: { player_name: string; price_cr: number | null; sold_to_name: string | null; sold: boolean } | null;
  finished: boolean;
  seats: AuctionSeat[];
  user_franchise_id: string | null;
  total_sold: number;
  total_unsold: number;
}

// ─── Live Match ───────────────────────────────────────────────────────────────

export const liveApi = {
  state: (matchId: string) => api.get<APIResponse<LiveMatchState>>(`/live/${matchId}/state`),
  winProbability: (matchId: string) =>
    api.get<APIResponse<{ current: number; batting_team_name: string; history: WinProbHistoryPoint[] }>>(`/live/${matchId}/win-probability`),
  recommendations: (matchId: string) => api.get<APIResponse<LiveRecommendations>>(`/live/${matchId}/recommendations`),
  bowlerRec: (matchId: string) => api.get<APIResponse<unknown>>(`/live/${matchId}/bowler-recommendation`),
  advisor: (matchId: string) => api.get<APIResponse<CoachAdvice>>(`/live/${matchId}/advisor`),
  simulate: (scenario: WhatIfScenario) =>
    api.post<APIResponse<WhatIfResult>>("/live/simulate", scenario),
  // Interactive ball-by-ball simulation
  simStart: (matchId: string) => api.post<APIResponse<SimStep>>(`/live/${matchId}/sim/start`, {}),
  simStep: (matchId: string) => api.post<APIResponse<SimStep>>(`/live/${matchId}/sim/step`, {}),
  simReset: (matchId: string) => api.post<APIResponse<unknown>>(`/live/${matchId}/sim/reset`, {}),
};

export interface SimStep {
  match_id: string;
  innings_over: boolean;
  outcome: string | null;
  win_probability: number;
  score?: number;
  wickets?: number;
  over?: number;
  ball?: number;
  runs_required?: number;
  balls_remaining?: number;
  target?: number;
  last_ball?: { label: string; runs: number; wicket: boolean; extra: boolean } | null;
  opposition_plan?: string | null;   // "attack" | "contain" | "balanced"
}

// ─── Pre-Match ────────────────────────────────────────────────────────────────

export interface CoachAdvice {
  available: boolean;
  advice: string;
  provider: string;
}

export const prematchApi = {
  winProbability: (matchId: string) => api.get<APIResponse<WinProbability>>(`/prematch/${matchId}/win-probability`),
  advisor: (matchId: string) => api.get<APIResponse<CoachAdvice>>(`/prematch/${matchId}/advisor`),
  xiRecommendation: (matchId: string, franchiseId: string, seasonId: string) =>
    api.get<APIResponse<PlayingXIRecommendation>>(
      `/prematch/${matchId}/xi-recommendation?franchise_id=${franchiseId}&season_id=${seasonId}`
    ),
};

// ─── AI Scout (Gemini tool-using agent) ────────────────────────────────────────

export interface ScoutStep { tool: string; args: Record<string, unknown>; result: unknown }
export interface ScoutAnswer { available: boolean; answer: string; provider: string; steps: ScoutStep[] }

export const scoutApi = {
  ask: (question: string) => api.post<APIResponse<ScoutAnswer>>("/scout/ask", { question }),
};

// ─── Tournaments ──────────────────────────────────────────────────────────────

export const tournamentApi = {
  list: () => api.get<APIResponse<Tournament[]>>("/tournaments"),
  seasons: (tournamentId: string) => api.get<APIResponse<Season[]>>(`/tournaments/${tournamentId}/seasons`),
  pointsTable: (seasonId: string) => api.get<APIResponse<PointsTableRow[]>>(`/tournaments/seasons/${seasonId}/points-table`),
  matches: (seasonId: string, params?: { franchise_id?: string; page?: number; size?: number }) => {
    const qs = new URLSearchParams();
    if (params?.franchise_id) qs.set("franchise_id", params.franchise_id);
    qs.set("page", String(params?.page ?? 1));
    qs.set("size", String(params?.size ?? 100));
    return api.get<PaginatedResponse<Match>>(`/tournaments/seasons/${seasonId}/matches?${qs}`);
  },
};
