import { api } from "./api_base";
// ─── Players ─────────────────────────────────────────────────────────────────
export const playersApi = {
    list: (params) => {
        const qs = new URLSearchParams();
        if (params?.q)
            qs.set("q", params.q);
        if (params?.playing_role)
            qs.set("playing_role", params.playing_role);
        if (params?.nationality)
            qs.set("nationality", params.nationality);
        if (params?.page)
            qs.set("page", String(params.page));
        if (params?.size)
            qs.set("size", String(params.size));
        return api.get(`/players?${qs}`);
    },
    get: (id) => api.get(`/players/${id}`),
    form: (id) => api.get(`/players/${id}/form`),
    valuation: (id) => api.get(`/players/${id}/valuation`),
    matchups: (id, as_role, phase) => api.get(`/players/${id}/matchups?as_role=${as_role}&phase=${phase ?? "All"}`),
};
// ─── Auction ─────────────────────────────────────────────────────────────────
export const auctionApi = {
    activeSessions: () => api.get("/auction/sessions/active"),
    session: (id) => api.get(`/auction/sessions/${id}`),
    teamStates: (sessionId) => api.get(`/auction/sessions/${sessionId}/teams`),
    teamState: (sessionId, franchiseId) => api.get(`/auction/sessions/${sessionId}/teams/${franchiseId}`),
    currentLot: (sessionId) => api.get(`/auction/sessions/${sessionId}/current-lot`),
    recommendation: (sessionId, franchiseId) => api.get(`/auction/sessions/${sessionId}/recommendation/${franchiseId}`),
    queue: (sessionId) => api.get(`/auction/sessions/${sessionId}/queue`),
    lots: (sessionId) => api.get(`/auction/sessions/${sessionId}/lots`),
    placeBid: (lotId, franchiseId, amount, isRtm = false) => api.post("/auction/bids", { lot_id: lotId, franchise_id: franchiseId, bid_amount_cr: amount, is_rtm: isRtm }),
};
// ─── Live Match ───────────────────────────────────────────────────────────────
export const liveApi = {
    state: (matchId) => api.get(`/live/${matchId}/state`),
    winProbability: (matchId) => api.get(`/live/${matchId}/win-probability`),
    recommendations: (matchId) => api.get(`/live/${matchId}/recommendations`),
    bowlerRec: (matchId) => api.get(`/live/${matchId}/bowler-recommendation`),
};
// ─── Pre-Match ────────────────────────────────────────────────────────────────
export const prematchApi = {
    winProbability: (matchId) => api.get(`/prematch/${matchId}/win-probability`),
    xiRecommendation: (matchId, franchiseId, seasonId) => api.get(`/prematch/${matchId}/xi-recommendation?franchise_id=${franchiseId}&season_id=${seasonId}`),
};
// ─── Tournaments ──────────────────────────────────────────────────────────────
export const tournamentApi = {
    list: () => api.get("/tournaments"),
    seasons: (tournamentId) => api.get(`/tournaments/${tournamentId}/seasons`),
    pointsTable: (seasonId) => api.get(`/tournaments/seasons/${seasonId}/points-table`),
};
