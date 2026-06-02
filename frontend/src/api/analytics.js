import { api } from "./api_base";
export const analyticsApi = {
    summary: () => api.get("/analytics/summary"),
    topBatters: (limit = 15) => api.get(`/analytics/top-batters?limit=${limit}`),
    topBowlers: (limit = 15) => api.get(`/analytics/top-bowlers?limit=${limit}`),
    teamStats: () => api.get("/analytics/team-stats"),
    phaseRates: () => api.get("/analytics/run-rate-phases"),
    wicketTypes: () => api.get("/analytics/wicket-types"),
    inningsScores: () => api.get("/analytics/innings-scores"),
    ask: (q) => api.get(`/analytics/agent/ask?q=${encodeURIComponent(q)}`),
};
