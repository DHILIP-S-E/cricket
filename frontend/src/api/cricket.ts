import { api } from "./api_base";
import type {
  APIResponse, PaginatedResponse,
  Player, PlayerProfile, PlayerForm, PlayerValuation, PlayerMatchup,
  AuctionSession, AuctionLot, TeamAuctionState, BidRecommendation, AuctionQueueItem,
  LiveMatchState, LiveRecommendations, WinProbHistoryPoint,
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
};

// ─── Live Match ───────────────────────────────────────────────────────────────

export const liveApi = {
  state: (matchId: string) => api.get<APIResponse<LiveMatchState>>(`/live/${matchId}/state`),
  winProbability: (matchId: string) =>
    api.get<APIResponse<{ current: number; batting_team_name: string; history: WinProbHistoryPoint[] }>>(`/live/${matchId}/win-probability`),
  recommendations: (matchId: string) => api.get<APIResponse<LiveRecommendations>>(`/live/${matchId}/recommendations`),
  bowlerRec: (matchId: string) => api.get<APIResponse<unknown>>(`/live/${matchId}/bowler-recommendation`),
};

// ─── Pre-Match ────────────────────────────────────────────────────────────────

export const prematchApi = {
  winProbability: (matchId: string) => api.get<APIResponse<WinProbability>>(`/prematch/${matchId}/win-probability`),
  xiRecommendation: (matchId: string, franchiseId: string, seasonId: string) =>
    api.get<APIResponse<PlayingXIRecommendation>>(
      `/prematch/${matchId}/xi-recommendation?franchise_id=${franchiseId}&season_id=${seasonId}`
    ),
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
