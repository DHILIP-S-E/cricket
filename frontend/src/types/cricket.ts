// ─── Shared ──────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  size: number;
}

export interface APIResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// ─── Player ──────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  full_name: string;
  display_name: string | null;
  nationality: string;
  date_of_birth: string | null;
  playing_role: string;
  batting_style: string;
  bowling_style: string;
  ipl_caps: number;
  international_caps: number;
  is_active: boolean;
  photo_url: string | null;
}

export interface PlayerCareerStats {
  format: string;
  batting_innings: number;
  batting_runs: number;
  batting_avg: number | null;
  batting_strike_rate: number | null;
  batting_50s: number;
  batting_100s: number;
  batting_highest_score: number | null;
  bowling_wickets: number;
  bowling_avg: number | null;
  bowling_economy: number | null;
  bowling_strike_rate: number | null;
  bowling_best_figures: string | null;
  catches: number;
}

export interface PlayerForm {
  last_n_matches: number;
  form_score: number;
  batting_avg_recent: number | null;
  strike_rate_recent: number | null;
  bowling_avg_recent: number | null;
  economy_recent: number | null;
  computed_at: string;
}

export interface PlayerRating {
  overall_rating: number;
  batting_rating: number | null;
  bowling_rating: number | null;
  fielding_rating: number | null;
  powerplay_rating: number | null;
  death_overs_rating: number | null;
  potential_rating: number | null;
}

export interface PlayerValuation {
  fair_market_value_cr: number;
  predicted_auction_price_cr: number | null;
  confidence_low_cr: number | null;
  confidence_high_cr: number | null;
  budget_efficiency_score: number | null;
  model_version: string | null;
  computed_at: string;
}

export interface PlayerProfile extends Player {
  career_stats: PlayerCareerStats | null;
  form: PlayerForm | null;
  rating: PlayerRating | null;
  valuation: PlayerValuation | null;
}

export interface PlayerMatchup {
  batter_id: string;
  bowler_id: string;
  phase: string;
  balls_faced: number;
  strike_rate: number | null;
  dismissal_rate: number | null;
  boundary_rate: number | null;
  smoothed_strike_rate: number | null;
  smoothed_wicket_prob: number | null;
  confidence_level: string;
}

// ─── Auction ─────────────────────────────────────────────────────────────────

export interface TeamAuctionState {
  franchise_id: string;
  franchise_name: string;
  franchise_short_name: string;
  initial_purse_cr: number;
  remaining_budget_cr: number;
  squad_size: number;
  squad_size_max: number;
  overseas_slots_used: number;
  overseas_slots_max: number;
  wk_count: number;
  batter_count: number;
  bowler_count: number;
  all_rounder_count: number;
  rtm_available: boolean;
  rtm_count: number;
  players_bought: Array<{ player_id: string; price_cr: number; role: string }>;
}

export interface AuctionLot {
  id: string;
  lot_number: number;
  player: Player;
  base_price_cr: number;
  final_price_cr: number | null;
  is_sold: boolean;
  is_unsold: boolean;
  sold_to_franchise_name: string | null;
  rtm_used: boolean;
}

export interface AuctionSession {
  id: string;
  season_id: string;
  name: string;
  status: string;
  total_players_sold: number;
  total_players_unsold: number;
  current_bid_amount_cr: number | null;
  current_highest_bidder_id: string | null;
}

export interface BidRecommendation {
  player_id: string;
  player_name: string;
  fair_value_cr: number;
  recommended_max_bid_cr: number;
  confidence_low_cr: number;
  confidence_high_cr: number;
  confidence: string;
  should_bid: boolean;
  reasoning: string;
  budget_after_bid_cr: number;
  squad_impact: string;
  alternatives: Player[];
}

export interface AuctionQueueItem {
  lot_number: number;
  player: Player;
  base_price_cr: number;
  ai_value_estimate_cr: number | null;
}

// ─── Live Match ───────────────────────────────────────────────────────────────

export interface LiveBatter {
  player_id: string;
  full_name: string;
  runs_scored: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  strike_rate: number | null;
  is_on_strike: boolean;
  dots_in_row: number;
}

export interface LiveBowler {
  player_id: string;
  full_name: string;
  overs_bowled: number;
  runs_conceded: number;
  wickets: number;
  economy: number | null;
  overs_remaining: number | null;
  is_current_bowler: boolean;
}

export interface LiveMatchState {
  match_id: string;
  innings_number: number;
  current_over: number;
  current_ball: number;
  batting_team_id: string;
  batting_team_name: string;
  bowling_team_id: string;
  bowling_team_name: string;
  batting_team_score: number;
  batting_team_wickets: number;
  current_run_rate: number;
  required_run_rate: number | null;
  target_runs: number | null;
  runs_required: number | null;
  balls_remaining: number | null;
  win_probability: number | null;
  momentum: string | null;
  striker: LiveBatter | null;
  non_striker: LiveBatter | null;
  current_bowler: LiveBowler | null;
  updated_at: string;
}

export interface WinProbHistoryPoint {
  over_number: number;
  ball_number: number;
  batting_team_win_prob: number;
  score: number;
  wickets: number;
}

export interface BowlerRecommendation {
  recommended_bowler_id: string;
  recommended_bowler_name: string;
  expected_runs_this_over: number;
  wicket_probability: number;
  confidence: string;
  reasoning: string;
  alternatives: Array<{ player_id: string; player_name: string; composite_score: number }>;
}

export interface LiveRecommendations {
  match_id: string;
  win_probability: number;
  momentum: string;
  bowler_recommendation: BowlerRecommendation | null;
  batting_risk_level: number;
  batting_strategy: string;
  field_placement_note: string | null;
  alert: string | null;
}

export interface WhatIfScenario {
  target: number;
  current_score: number;
  wickets_fallen: number;
  overs_completed: number;
  balls_this_over: number;
  total_overs: number;
}

export interface WhatIfResult {
  win_probability: number;
  chasing_team_win_prob: number;
  defending_team_win_prob: number;
  runs_required: number;
  balls_remaining: number;
  wickets_remaining: number;
  required_run_rate: number;
  current_run_rate: number;
  batting_risk_level: number;
  batting_strategy: string;
  alert: string | null;
}

// ─── Pre-Match ────────────────────────────────────────────────────────────────

export interface WinProbability {
  team1_id: string;
  team1_name: string;
  team1_win_prob: number;
  team2_id: string;
  team2_name: string;
  team2_win_prob: number;
  confidence: string;
  key_factors: string[];
}

export interface PlayingXIPlayer {
  player_id: string;
  full_name: string;
  playing_role: string;
  batting_position: number;
  ai_score: number;
  is_overseas: boolean;
}

export interface PlayingXIRecommendation {
  recommended_xi: PlayingXIPlayer[];
  total_ai_score: number;
  overseas_count: number;
  bowling_options: number;
  reasoning: string;
  impact_player_recommendation: PlayingXIPlayer | null;
}

// ─── Tournament ───────────────────────────────────────────────────────────────

export interface Tournament {
  id: string;
  name: string;
  full_name: string;
  country: string;
  is_active: boolean;
}

export interface Season {
  id: string;
  tournament_id: string;
  tournament_name: string;
  year: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

export interface PointsTableRow {
  rank: number;
  franchise: { id: string; name: string; short_name: string };
  matches_played: number;
  wins: number;
  losses: number;
  points: number;
  net_run_rate: number;
}

export interface MatchFranchise {
  id: string;
  name: string;
  short_name: string;
  logo_url?: string | null;
  primary_color?: string | null;
}

export interface MatchVenue {
  id: string;
  name: string;
  city: string;
  country: string;
}

export interface Match {
  id: string;
  season_id: string;
  venue: MatchVenue;
  team1: MatchFranchise;
  team2: MatchFranchise;
  match_date: string;
  match_number: number | null;
  match_type: string;
  winner: MatchFranchise | null;
  win_margin_runs: number | null;
  win_margin_wickets: number | null;
  no_result: boolean;
  is_completed: boolean;
}
