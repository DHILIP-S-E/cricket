-- ================================================================
-- Cricket Decision Intelligence Platform
-- Migration 001 — Full Initial Schema
-- PostgreSQL 18+
-- ================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy name search

-- ================================================================
-- ENUMERATIONS
-- ================================================================

CREATE TYPE nationality_enum AS ENUM (
    'India', 'Australia', 'England', 'West Indies', 'New Zealand',
    'South Africa', 'Pakistan', 'Sri Lanka', 'Bangladesh', 'Afghanistan',
    'Zimbabwe', 'Ireland', 'Netherlands', 'Scotland', 'UAE', 'Other'
);

CREATE TYPE playing_role_enum AS ENUM (
    'Top-order Batter', 'Middle-order Batter', 'Batting All-rounder',
    'Bowling All-rounder', 'Wicket-keeper Batter', 'Pace Bowler', 'Spin Bowler'
);

CREATE TYPE batting_style_enum AS ENUM ('Right-hand', 'Left-hand');

CREATE TYPE bowling_style_enum AS ENUM (
    'Right-arm Fast', 'Right-arm Medium', 'Left-arm Fast',
    'Right-arm Offbreak', 'Left-arm Orthodox', 'Leg-spin', 'None'
);

CREATE TYPE tournament_name_enum AS ENUM (
    'IPL', 'BBL', 'PSL', 'CPL', 'T20I', 'SA20', 'ILT20', 'MLC',
    'TNPL', 'KPL', 'Ranji', 'Vijay Hazare', 'Syed Mushtaq Ali', 'Other'
);

CREATE TYPE pitch_type_enum AS ENUM (
    'Batting-friendly', 'Bowling-friendly', 'Balanced', 'Spin-friendly', 'Pace-friendly'
);

CREATE TYPE toss_decision_enum AS ENUM ('Bat', 'Field');

CREATE TYPE wicket_type_enum AS ENUM (
    'Caught', 'Bowled', 'LBW', 'Run-out', 'Stumped',
    'Hit Wicket', 'Obstructing the field', 'Handled the ball', 'Timed out'
);

CREATE TYPE auction_status_enum AS ENUM ('Pending', 'Active', 'Paused', 'Completed');

CREATE TYPE confidence_level_enum AS ENUM ('Low', 'Medium', 'High');

CREATE TYPE phase_type_enum AS ENUM ('Powerplay', 'Middle', 'Death', 'All');

CREATE TYPE user_role_enum AS ENUM (
    'Franchise Owner', 'Head Analyst', 'Support Analyst',
    'Captain', 'Scout', 'Data Engineer', 'Super Admin'
);

CREATE TYPE risk_level_enum AS ENUM ('Low', 'Medium', 'High');

CREATE TYPE domestic_league_enum AS ENUM (
    'TNPL', 'KPL', 'MPL', 'Ranji', 'Vijay Hazare', 'Syed Mushtaq Ali',
    'BBL', 'PSL', 'CPL', 'Duleep Trophy', 'Other'
);

CREATE TYPE match_type_enum AS ENUM (
    'League', 'Qualifier 1', 'Qualifier 2', 'Eliminator', 'Final', 'Friendly'
);

CREATE TYPE recommendation_type_enum AS ENUM (
    'BidRecommendation', 'PlayingXI', 'BowlerChange',
    'BattingStrategy', 'FieldPlacement', 'TossDecision',
    'ImpactPlayer', 'BowlingAllocation'
);

CREATE TYPE ingestion_status_enum AS ENUM ('Running', 'Completed', 'Failed', 'Partial');

CREATE TYPE ingestion_source_enum AS ENUM ('Cricsheet', 'Cricbuzz', 'ESPNCricinfo', 'SportRadar', 'Manual', 'Synthetic');

-- ================================================================
-- TOURNAMENT DOMAIN
-- ================================================================

CREATE TABLE tournaments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            tournament_name_enum NOT NULL,
    full_name       VARCHAR(120) NOT NULL,
    country         VARCHAR(60) NOT NULL,
    format          VARCHAR(20) NOT NULL DEFAULT 'T20',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE seasons (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id   UUID NOT NULL REFERENCES tournaments(id),
    year            INT NOT NULL,
    start_date      DATE,
    end_date        DATE,
    total_teams     INT,
    total_purse_cr  NUMERIC(8,2),  -- each team's starting purse
    is_active       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tournament_id, year)
);

CREATE INDEX idx_seasons_tournament ON seasons(tournament_id);

-- ================================================================
-- VENUE DOMAIN
-- ================================================================

CREATE TABLE venues (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                        VARCHAR(150) NOT NULL,
    city                        VARCHAR(100) NOT NULL,
    country                     VARCHAR(60) NOT NULL,
    capacity                    INT,
    avg_first_innings_score     NUMERIC(6,2),
    avg_second_innings_score    NUMERIC(6,2),
    pace_assistance_rating      NUMERIC(4,2) CHECK (pace_assistance_rating BETWEEN 1 AND 10),
    spin_assistance_rating      NUMERIC(4,2) CHECK (spin_assistance_rating BETWEEN 1 AND 10),
    dew_probability             NUMERIC(4,3) CHECK (dew_probability BETWEEN 0 AND 1),
    boundary_short_side_m       INT,
    boundary_long_side_m        INT,
    powerplay_avg_score         NUMERIC(6,2),
    death_overs_avg_per_over    NUMERIC(4,2),
    latitude                    NUMERIC(9,6),
    longitude                   NUMERIC(9,6),
    timezone                    VARCHAR(50),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE venue_pitch_profiles (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id                UUID NOT NULL REFERENCES venues(id),
    season_year             INT,  -- null = career aggregate
    pitch_type              pitch_type_enum NOT NULL,
    matches_analysed        INT NOT NULL DEFAULT 0,
    avg_first_innings_score NUMERIC(6,2),
    avg_wickets_per_innings NUMERIC(4,2),
    pace_wicket_pct         NUMERIC(5,2),
    spin_wicket_pct         NUMERIC(5,2),
    powerplay_avg_score     NUMERIC(6,2),
    death_avg_per_over      NUMERIC(4,2),
    batting_first_win_pct   NUMERIC(5,2),
    computed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_venue_pitch_venue ON venue_pitch_profiles(venue_id);

CREATE TABLE pitch_reports (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id                UUID NOT NULL,  -- FK added after matches table
    venue_id                UUID NOT NULL REFERENCES venues(id),
    report_time             TIMESTAMPTZ NOT NULL,
    pitch_type              pitch_type_enum NOT NULL,
    pace_assistance_rating  NUMERIC(4,2),
    spin_assistance_rating  NUMERIC(4,2),
    bounce_rating           NUMERIC(4,2),
    dew_expected            BOOLEAN NOT NULL DEFAULT false,
    first_innings_par_score INT,
    curator_name            VARCHAR(100),
    expert_analysis         TEXT,
    raw_notes               TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================================
-- TEAM / FRANCHISE DOMAIN
-- ================================================================

CREATE TABLE franchises (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL,
    short_name      VARCHAR(10) NOT NULL,
    tournament_id   UUID NOT NULL REFERENCES tournaments(id),
    home_venue_id   UUID REFERENCES venues(id),
    owner_name      VARCHAR(100),
    coach_name      VARCHAR(100),
    primary_color   VARCHAR(10),
    secondary_color VARCHAR(10),
    logo_url        VARCHAR(500),
    founded_year    INT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_franchises_tournament ON franchises(tournament_id);

-- ================================================================
-- PLAYER DOMAIN
-- ================================================================

CREATE TABLE players (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name       VARCHAR(150) NOT NULL,
    display_name    VARCHAR(100),
    nationality     nationality_enum NOT NULL,
    date_of_birth   DATE,
    playing_role    playing_role_enum NOT NULL,
    batting_style   batting_style_enum NOT NULL DEFAULT 'Right-hand',
    bowling_style   bowling_style_enum NOT NULL DEFAULT 'None',
    ipl_caps        INT NOT NULL DEFAULT 0,
    international_caps INT NOT NULL DEFAULT 0,
    domestic_league domestic_league_enum,
    injury_prone_flag BOOLEAN NOT NULL DEFAULT false,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    photo_url       VARCHAR(500),
    cricsheet_id    VARCHAR(50) UNIQUE,
    espn_id         VARCHAR(50) UNIQUE,
    cricbuzz_id     VARCHAR(50) UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_players_nationality ON players(nationality);
CREATE INDEX idx_players_role ON players(playing_role);
CREATE INDEX idx_players_active ON players(is_active);
CREATE INDEX idx_players_name_trgm ON players USING GIN (full_name gin_trgm_ops);

CREATE TABLE player_career_stats (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id               UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    format                  VARCHAR(20) NOT NULL DEFAULT 'T20',
    -- Batting
    batting_innings         INT NOT NULL DEFAULT 0,
    batting_not_outs        INT NOT NULL DEFAULT 0,
    batting_runs            INT NOT NULL DEFAULT 0,
    batting_avg             NUMERIC(6,2),
    batting_strike_rate     NUMERIC(6,2),
    batting_50s             INT NOT NULL DEFAULT 0,
    batting_100s            INT NOT NULL DEFAULT 0,
    batting_highest_score   INT,
    -- Bowling
    bowling_innings         INT NOT NULL DEFAULT 0,
    bowling_wickets         INT NOT NULL DEFAULT 0,
    bowling_avg             NUMERIC(6,2),
    bowling_economy         NUMERIC(5,2),
    bowling_strike_rate     NUMERIC(6,2),
    bowling_best_figures    VARCHAR(10),
    -- Fielding
    catches                 INT NOT NULL DEFAULT 0,
    run_outs                INT NOT NULL DEFAULT 0,
    stumpings               INT NOT NULL DEFAULT 0,
    -- Phase splits (T20 specific)
    powerplay_batting_avg   NUMERIC(6,2),
    powerplay_bowling_economy NUMERIC(5,2),
    death_batting_strike_rate NUMERIC(6,2),
    death_bowling_economy   NUMERIC(5,2),
    last_computed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (player_id, format)
);

CREATE TABLE player_season_stats (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id               UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    season_id               UUID NOT NULL REFERENCES seasons(id),
    franchise_id            UUID REFERENCES franchises(id),
    matches_played          INT NOT NULL DEFAULT 0,
    batting_runs            INT NOT NULL DEFAULT 0,
    batting_avg             NUMERIC(6,2),
    batting_strike_rate     NUMERIC(6,2),
    bowling_wickets         INT NOT NULL DEFAULT 0,
    bowling_economy         NUMERIC(5,2),
    bowling_avg             NUMERIC(6,2),
    player_of_match_count   INT NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (player_id, season_id)
);

CREATE TABLE player_form (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id               UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    last_n_matches          INT NOT NULL DEFAULT 5,
    form_score              NUMERIC(5,4) NOT NULL CHECK (form_score BETWEEN 0 AND 1),
    batting_avg_recent      NUMERIC(6,2),
    bowling_avg_recent      NUMERIC(6,2),
    economy_recent          NUMERIC(5,2),
    strike_rate_recent      NUMERIC(6,2),
    computed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_player_form_player ON player_form(player_id);
CREATE INDEX idx_player_form_computed ON player_form(computed_at DESC);

CREATE TABLE player_injury_records (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id           UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    injury_type         VARCHAR(100) NOT NULL,
    body_part           VARCHAR(100),
    injury_date         DATE NOT NULL,
    recovery_date       DATE,
    matches_missed      INT,
    severity            VARCHAR(20) CHECK (severity IN ('Minor', 'Moderate', 'Severe')),
    source              VARCHAR(200),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_injury_player ON player_injury_records(player_id);

CREATE TABLE player_workload (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id                   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    season_id                   UUID REFERENCES seasons(id),
    matches_last_30_days        INT NOT NULL DEFAULT 0,
    overs_bowled_last_30_days   NUMERIC(5,1) NOT NULL DEFAULT 0,
    rest_days_since_last_match  INT,
    travel_km_last_30_days      INT,
    injury_risk_score           NUMERIC(4,3) CHECK (injury_risk_score BETWEEN 0 AND 1),
    risk_level                  risk_level_enum,
    computed_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workload_player ON player_workload(player_id);

CREATE TABLE player_ratings (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id           UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE UNIQUE,
    overall_rating      NUMERIC(5,2) NOT NULL CHECK (overall_rating BETWEEN 0 AND 100),
    batting_rating      NUMERIC(5,2) CHECK (batting_rating BETWEEN 0 AND 100),
    bowling_rating      NUMERIC(5,2) CHECK (bowling_rating BETWEEN 0 AND 100),
    fielding_rating     NUMERIC(5,2) CHECK (fielding_rating BETWEEN 0 AND 100),
    powerplay_rating    NUMERIC(5,2) CHECK (powerplay_rating BETWEEN 0 AND 100),
    death_overs_rating  NUMERIC(5,2) CHECK (death_overs_rating BETWEEN 0 AND 100),
    potential_rating    NUMERIC(5,2) CHECK (potential_rating BETWEEN 0 AND 100),
    model_version       VARCHAR(20),
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE player_valuations (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id                   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    season_id                   UUID REFERENCES seasons(id),
    fair_market_value_cr        NUMERIC(6,2) NOT NULL,
    predicted_auction_price_cr  NUMERIC(6,2),
    confidence_low_cr           NUMERIC(6,2),
    confidence_high_cr          NUMERIC(6,2),
    budget_efficiency_score     NUMERIC(5,4),
    model_version               VARCHAR(20),
    computed_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_player_val_player ON player_valuations(player_id);
CREATE INDEX idx_player_val_season ON player_valuations(season_id);

-- ================================================================
-- SQUAD & PLAYING XI
-- ================================================================

CREATE TABLE squads (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    franchise_id        UUID NOT NULL REFERENCES franchises(id),
    season_id           UUID NOT NULL REFERENCES seasons(id),
    player_id           UUID NOT NULL REFERENCES players(id),
    base_price_cr       NUMERIC(6,2),
    contracted_price_cr NUMERIC(6,2),
    is_overseas         BOOLEAN NOT NULL DEFAULT false,
    is_uncapped         BOOLEAN NOT NULL DEFAULT false,
    role_in_squad       playing_role_enum,
    is_retained         BOOLEAN NOT NULL DEFAULT false,
    is_rtm              BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (franchise_id, season_id, player_id)
);

CREATE INDEX idx_squads_franchise_season ON squads(franchise_id, season_id);
CREATE INDEX idx_squads_player ON squads(player_id);

CREATE TABLE player_availability (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    squad_id                UUID NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
    match_id                UUID,  -- FK added after matches table; NULL = season-level
    is_available            BOOLEAN NOT NULL DEFAULT true,
    unavailability_reason   VARCHAR(60) CHECK (unavailability_reason IN (
        'Injury', 'National Duty', 'Personal', 'Suspended', 'Rest', 'Covid', 'Visa'
    )),
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================================
-- MATCH DOMAIN
-- ================================================================

CREATE TABLE matches (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id           UUID NOT NULL REFERENCES seasons(id),
    venue_id            UUID NOT NULL REFERENCES venues(id),
    team1_id            UUID NOT NULL REFERENCES franchises(id),
    team2_id            UUID NOT NULL REFERENCES franchises(id),
    match_date          TIMESTAMPTZ NOT NULL,
    match_number        INT,
    match_type          match_type_enum NOT NULL DEFAULT 'League',
    toss_winner_id      UUID REFERENCES franchises(id),
    toss_decision       toss_decision_enum,
    winner_id           UUID REFERENCES franchises(id),
    win_margin_runs     INT,
    win_margin_wickets  INT,
    no_result           BOOLEAN NOT NULL DEFAULT false,
    pitch_type          pitch_type_enum,
    dew_factor          BOOLEAN NOT NULL DEFAULT false,
    weather_conditions  VARCHAR(100),
    umpire1             VARCHAR(100),
    umpire2             VARCHAR(100),
    match_referee       VARCHAR(100),
    cricsheet_match_id  VARCHAR(100) UNIQUE,
    espn_match_id       VARCHAR(50) UNIQUE,
    is_completed        BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_season ON matches(season_id);
CREATE INDEX idx_matches_venue ON matches(venue_id);
CREATE INDEX idx_matches_date ON matches(match_date DESC);
CREATE INDEX idx_matches_team1 ON matches(team1_id);
CREATE INDEX idx_matches_team2 ON matches(team2_id);

-- Now we can add the FK for pitch_reports and player_availability
ALTER TABLE pitch_reports ADD CONSTRAINT fk_pitch_reports_match FOREIGN KEY (match_id) REFERENCES matches(id);
ALTER TABLE player_availability ADD CONSTRAINT fk_availability_match FOREIGN KEY (match_id) REFERENCES matches(id);

CREATE TABLE innings (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id                UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    innings_number          INT NOT NULL CHECK (innings_number IN (1, 2)),
    batting_team_id         UUID NOT NULL REFERENCES franchises(id),
    bowling_team_id         UUID NOT NULL REFERENCES franchises(id),
    total_runs              INT NOT NULL DEFAULT 0,
    total_wickets           INT NOT NULL CHECK (total_wickets BETWEEN 0 AND 10) DEFAULT 0,
    total_overs             NUMERIC(4,1) NOT NULL DEFAULT 0,
    extras                  INT NOT NULL DEFAULT 0,
    wides                   INT NOT NULL DEFAULT 0,
    no_balls                INT NOT NULL DEFAULT 0,
    byes                    INT NOT NULL DEFAULT 0,
    leg_byes                INT NOT NULL DEFAULT 0,
    target_runs             INT,
    powerplay_runs          INT,
    powerplay_wickets       INT,
    middle_overs_runs       INT,
    middle_overs_wickets    INT,
    death_overs_runs        INT,
    death_overs_wickets     INT,
    is_completed            BOOLEAN NOT NULL DEFAULT false,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (match_id, innings_number)
);

CREATE INDEX idx_innings_match ON innings(match_id);

-- BALLS — the core of all ML models. Optimized for query performance.
CREATE TABLE balls (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id                UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    innings_id              UUID NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
    innings_number          INT NOT NULL,
    over_number             INT NOT NULL CHECK (over_number BETWEEN 0 AND 19),
    ball_number             INT NOT NULL CHECK (ball_number BETWEEN 0 AND 9),
    batter_id               UUID NOT NULL REFERENCES players(id),
    bowler_id               UUID NOT NULL REFERENCES players(id),
    non_striker_id          UUID REFERENCES players(id),
    runs_off_bat            INT NOT NULL DEFAULT 0 CHECK (runs_off_bat BETWEEN 0 AND 6),
    extras_runs             INT NOT NULL DEFAULT 0,
    extras_type             VARCHAR(20) CHECK (extras_type IN ('Wide', 'NoBall', 'Bye', 'LegBye', 'Penalty')),
    is_wicket               BOOLEAN NOT NULL DEFAULT false,
    wicket_type             wicket_type_enum,
    dismissed_player_id     UUID REFERENCES players(id),
    fielder_id              UUID REFERENCES players(id),
    shot_type               VARCHAR(50),
    line                    VARCHAR(30),
    length                  VARCHAR(30),
    speed_kmh               NUMERIC(5,1),
    is_powerplay            BOOLEAN NOT NULL DEFAULT false,
    is_middle_overs         BOOLEAN NOT NULL DEFAULT false,
    is_death_overs          BOOLEAN NOT NULL DEFAULT false,
    cumulative_score        INT NOT NULL DEFAULT 0,
    cumulative_wickets      INT NOT NULL DEFAULT 0,
    required_runs           INT,
    balls_remaining         INT,
    win_probability_after   NUMERIC(5,4) CHECK (win_probability_after BETWEEN 0 AND 1),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Critical indexes for ML feature queries
CREATE INDEX idx_balls_match ON balls(match_id);
CREATE INDEX idx_balls_innings ON balls(innings_id);
CREATE INDEX idx_balls_batter ON balls(batter_id);
CREATE INDEX idx_balls_bowler ON balls(bowler_id);
CREATE INDEX idx_balls_batter_bowler ON balls(batter_id, bowler_id);  -- matchup queries
CREATE INDEX idx_balls_over ON balls(innings_id, over_number);
CREATE INDEX idx_balls_wicket ON balls(is_wicket) WHERE is_wicket = true;

-- ================================================================
-- PLAYING XI
-- ================================================================

CREATE TABLE playing_xi (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id            UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    franchise_id        UUID NOT NULL REFERENCES franchises(id),
    player_id           UUID NOT NULL REFERENCES players(id),
    batting_position    INT CHECK (batting_position BETWEEN 1 AND 11),
    is_captain          BOOLEAN NOT NULL DEFAULT false,
    is_vice_captain     BOOLEAN NOT NULL DEFAULT false,
    is_wicketkeeper     BOOLEAN NOT NULL DEFAULT false,
    is_impact_player    BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (match_id, franchise_id, player_id)
);

CREATE INDEX idx_playing_xi_match ON playing_xi(match_id, franchise_id);
CREATE INDEX idx_playing_xi_player ON playing_xi(player_id);

-- ================================================================
-- PLAYER MATCHUPS (pre-computed, refreshed nightly)
-- ================================================================

CREATE TABLE player_matchups (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batter_id           UUID NOT NULL REFERENCES players(id),
    bowler_id           UUID NOT NULL REFERENCES players(id),
    phase               phase_type_enum NOT NULL DEFAULT 'All',
    balls_faced         INT NOT NULL DEFAULT 0,
    runs_scored         INT NOT NULL DEFAULT 0,
    dismissals          INT NOT NULL DEFAULT 0,
    boundaries_4        INT NOT NULL DEFAULT 0,
    boundaries_6        INT NOT NULL DEFAULT 0,
    dot_balls           INT NOT NULL DEFAULT 0,
    -- Rates (stored, not generated, to allow partial updates)
    strike_rate         NUMERIC(6,2),
    dismissal_rate      NUMERIC(6,4),
    boundary_rate       NUMERIC(6,4),
    dot_ball_rate       NUMERIC(6,4),
    -- Confidence: Low <12 balls, Medium 12-50, High 50+
    confidence_level    confidence_level_enum NOT NULL DEFAULT 'Low',
    -- Bayesian smoothed rates (toward league average for small samples)
    smoothed_strike_rate    NUMERIC(6,2),
    smoothed_wicket_prob    NUMERIC(6,4),
    smoothed_boundary_prob  NUMERIC(6,4),
    last_updated        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (batter_id, bowler_id, phase)
);

CREATE INDEX idx_matchups_batter ON player_matchups(batter_id);
CREATE INDEX idx_matchups_bowler ON player_matchups(bowler_id);
CREATE INDEX idx_matchups_pair ON player_matchups(batter_id, bowler_id);

-- ================================================================
-- PERFORMANCE DOMAIN
-- ================================================================

CREATE TABLE batting_performances (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id                UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    innings_id              UUID NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
    player_id               UUID NOT NULL REFERENCES players(id),
    franchise_id            UUID NOT NULL REFERENCES franchises(id),
    batting_position        INT NOT NULL CHECK (batting_position BETWEEN 1 AND 11),
    runs_scored             INT NOT NULL DEFAULT 0,
    balls_faced             INT NOT NULL DEFAULT 0,
    fours                   INT NOT NULL DEFAULT 0,
    sixes                   INT NOT NULL DEFAULT 0,
    strike_rate             NUMERIC(6,2),
    is_not_out              BOOLEAN NOT NULL DEFAULT false,
    dismissal_type          wicket_type_enum,
    dismissed_by_id         UUID REFERENCES players(id),
    caught_by_id            UUID REFERENCES players(id),
    powerplay_runs          INT NOT NULL DEFAULT 0,
    powerplay_balls         INT NOT NULL DEFAULT 0,
    middle_overs_runs       INT NOT NULL DEFAULT 0,
    middle_overs_balls      INT NOT NULL DEFAULT 0,
    death_overs_runs        INT NOT NULL DEFAULT 0,
    death_overs_balls       INT NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (innings_id, player_id)
);

CREATE INDEX idx_batting_perf_player ON batting_performances(player_id);
CREATE INDEX idx_batting_perf_match ON batting_performances(match_id);

CREATE TABLE bowling_performances (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id                UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    innings_id              UUID NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
    player_id               UUID NOT NULL REFERENCES players(id),
    franchise_id            UUID NOT NULL REFERENCES franchises(id),
    overs_bowled            NUMERIC(4,1) NOT NULL DEFAULT 0,
    maidens                 INT NOT NULL DEFAULT 0,
    runs_conceded           INT NOT NULL DEFAULT 0,
    wickets                 INT NOT NULL DEFAULT 0,
    economy                 NUMERIC(5,2),
    dots                    INT NOT NULL DEFAULT 0,
    fours_conceded          INT NOT NULL DEFAULT 0,
    sixes_conceded          INT NOT NULL DEFAULT 0,
    wides                   INT NOT NULL DEFAULT 0,
    no_balls                INT NOT NULL DEFAULT 0,
    powerplay_overs         NUMERIC(4,1) NOT NULL DEFAULT 0,
    powerplay_runs          INT NOT NULL DEFAULT 0,
    powerplay_wickets       INT NOT NULL DEFAULT 0,
    death_overs             NUMERIC(4,1) NOT NULL DEFAULT 0,
    death_runs              INT NOT NULL DEFAULT 0,
    death_wickets           INT NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (innings_id, player_id)
);

CREATE INDEX idx_bowling_perf_player ON bowling_performances(player_id);
CREATE INDEX idx_bowling_perf_match ON bowling_performances(match_id);

CREATE TABLE fielding_performances (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id            UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    innings_id          UUID NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
    player_id           UUID NOT NULL REFERENCES players(id),
    catches             INT NOT NULL DEFAULT 0,
    run_outs_direct     INT NOT NULL DEFAULT 0,
    run_outs_indirect   INT NOT NULL DEFAULT 0,
    stumpings           INT NOT NULL DEFAULT 0,
    dropped_catches     INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (innings_id, player_id)
);

CREATE TABLE partnership_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    innings_id      UUID NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
    batter1_id      UUID NOT NULL REFERENCES players(id),
    batter2_id      UUID NOT NULL REFERENCES players(id),
    wicket_number   INT NOT NULL CHECK (wicket_number BETWEEN 1 AND 10),
    runs            INT NOT NULL DEFAULT 0,
    balls           INT NOT NULL DEFAULT 0,
    run_rate        NUMERIC(5,2),
    batter1_runs    INT NOT NULL DEFAULT 0,
    batter2_runs    INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partnership_innings ON partnership_records(innings_id);
CREATE INDEX idx_partnership_batters ON partnership_records(batter1_id, batter2_id);

-- ================================================================
-- AUCTION DOMAIN
-- ================================================================

CREATE TABLE auction_sessions (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id                   UUID NOT NULL REFERENCES seasons(id),
    name                        VARCHAR(100) NOT NULL,
    status                      auction_status_enum NOT NULL DEFAULT 'Pending',
    auction_date                DATE,
    location                    VARCHAR(100),
    current_lot_player_id       UUID REFERENCES players(id),
    current_base_price_cr       NUMERIC(6,2),
    current_bid_amount_cr       NUMERIC(6,2),
    current_highest_bidder_id   UUID REFERENCES franchises(id),
    total_players_sold          INT NOT NULL DEFAULT 0,
    total_players_unsold        INT NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auction_lots (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id              UUID NOT NULL REFERENCES auction_sessions(id) ON DELETE CASCADE,
    player_id               UUID NOT NULL REFERENCES players(id),
    lot_number              INT NOT NULL,
    set_number              INT,  -- players are auctioned in sets
    base_price_cr           NUMERIC(6,2) NOT NULL,
    final_price_cr          NUMERIC(6,2),
    sold_to_franchise_id    UUID REFERENCES franchises(id),
    is_sold                 BOOLEAN NOT NULL DEFAULT false,
    is_unsold               BOOLEAN NOT NULL DEFAULT false,
    rtm_used                BOOLEAN NOT NULL DEFAULT false,
    rtm_franchise_id        UUID REFERENCES franchises(id),
    auction_started_at      TIMESTAMPTZ,
    auction_ended_at        TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, player_id)
);

CREATE INDEX idx_auction_lots_session ON auction_lots(session_id);
CREATE INDEX idx_auction_lots_player ON auction_lots(player_id);

CREATE TABLE bids (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lot_id          UUID NOT NULL REFERENCES auction_lots(id) ON DELETE CASCADE,
    franchise_id    UUID NOT NULL REFERENCES franchises(id),
    bid_amount_cr   NUMERIC(6,2) NOT NULL,
    bid_time        TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_rtm          BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bids_lot ON bids(lot_id);
CREATE INDEX idx_bids_franchise ON bids(franchise_id);

CREATE TABLE team_auction_states (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id          UUID NOT NULL REFERENCES auction_sessions(id) ON DELETE CASCADE,
    franchise_id        UUID NOT NULL REFERENCES franchises(id),
    initial_purse_cr    NUMERIC(8,2) NOT NULL DEFAULT 90.0,
    remaining_budget_cr NUMERIC(8,2) NOT NULL,
    -- JSONB array of {player_id, price_cr, role} objects
    players_bought      JSONB NOT NULL DEFAULT '[]',
    overseas_slots_used INT NOT NULL DEFAULT 0,
    overseas_slots_max  INT NOT NULL DEFAULT 4,
    wk_count            INT NOT NULL DEFAULT 0,
    batter_count        INT NOT NULL DEFAULT 0,
    bowler_count        INT NOT NULL DEFAULT 0,
    all_rounder_count   INT NOT NULL DEFAULT 0,
    squad_size          INT NOT NULL DEFAULT 0,
    squad_size_max      INT NOT NULL DEFAULT 25,
    rtm_available       BOOLEAN NOT NULL DEFAULT false,
    rtm_count           INT NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, franchise_id)
);

CREATE INDEX idx_team_auction_session ON team_auction_states(session_id);

CREATE TABLE auction_strategies (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id          UUID NOT NULL REFERENCES auction_sessions(id),
    franchise_id        UUID NOT NULL REFERENCES franchises(id),
    target_player_id    UUID NOT NULL REFERENCES players(id),
    priority            INT NOT NULL CHECK (priority > 0),
    max_bid_cr          NUMERIC(6,2) NOT NULL,
    tier                VARCHAR(20) CHECK (tier IN ('Must-have', 'High-value', 'Backup', 'Monitor')),
    reasoning           TEXT,
    is_acquired         BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, franchise_id, target_player_id)
);

-- ================================================================
-- LIVE MATCH STATE DOMAIN
-- ================================================================

CREATE TABLE live_match_states (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id                UUID NOT NULL REFERENCES matches(id),
    innings_number          INT NOT NULL,
    current_over            INT NOT NULL DEFAULT 0,
    current_ball            INT NOT NULL DEFAULT 0,
    batting_team_id         UUID NOT NULL REFERENCES franchises(id),
    bowling_team_id         UUID NOT NULL REFERENCES franchises(id),
    batting_team_score      INT NOT NULL DEFAULT 0,
    batting_team_wickets    INT NOT NULL DEFAULT 0,
    current_run_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,
    required_run_rate       NUMERIC(5,2),
    target_runs             INT,
    runs_required           INT,
    balls_remaining         INT,
    striker_id              UUID REFERENCES players(id),
    non_striker_id          UUID REFERENCES players(id),
    current_bowler_id       UUID REFERENCES players(id),
    win_probability         NUMERIC(5,4) CHECK (win_probability BETWEEN 0 AND 1),
    momentum                VARCHAR(20) CHECK (momentum IN ('Rising', 'Falling', 'Stable')),
    last_ball_event         JSONB,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_live_state_match_innings ON live_match_states(match_id, innings_number);

CREATE TABLE live_batter_states (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id            UUID NOT NULL REFERENCES matches(id),
    player_id           UUID NOT NULL REFERENCES players(id),
    runs_scored         INT NOT NULL DEFAULT 0,
    balls_faced         INT NOT NULL DEFAULT 0,
    fours               INT NOT NULL DEFAULT 0,
    sixes               INT NOT NULL DEFAULT 0,
    current_strike_rate NUMERIC(6,2),
    is_on_strike        BOOLEAN NOT NULL DEFAULT false,
    dots_in_row         INT NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (match_id, player_id)
);

CREATE TABLE live_bowler_states (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id                UUID NOT NULL REFERENCES matches(id),
    player_id               UUID NOT NULL REFERENCES players(id),
    overs_bowled            NUMERIC(4,1) NOT NULL DEFAULT 0,
    runs_conceded           INT NOT NULL DEFAULT 0,
    wickets                 INT NOT NULL DEFAULT 0,
    current_economy         NUMERIC(5,2),
    overs_remaining         NUMERIC(4,1),
    is_current_bowler       BOOLEAN NOT NULL DEFAULT false,
    last_over_runs          INT,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (match_id, player_id)
);

CREATE TABLE live_partnership_states (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id            UUID NOT NULL REFERENCES matches(id),
    batter1_id          UUID NOT NULL REFERENCES players(id),
    batter2_id          UUID NOT NULL REFERENCES players(id),
    wicket_number       INT NOT NULL,
    runs                INT NOT NULL DEFAULT 0,
    balls               INT NOT NULL DEFAULT 0,
    run_rate            NUMERIC(5,2),
    batter1_runs        INT NOT NULL DEFAULT 0,
    batter2_runs        INT NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================================
-- WIN PROBABILITY SNAPSHOTS (ball-by-ball audit trail)
-- ================================================================

CREATE TABLE win_probability_snapshots (
    id                      UUID NOT NULL DEFAULT uuid_generate_v4(),
    match_id                UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    innings_number          INT NOT NULL,
    over_number             INT NOT NULL,
    ball_number             INT NOT NULL,
    batting_team_win_prob   NUMERIC(5,4) NOT NULL CHECK (batting_team_win_prob BETWEEN 0 AND 1),
    score_at_snapshot       INT,
    wickets_at_snapshot     INT,
    model_version           VARCHAR(20),
    computed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, computed_at)
) PARTITION BY RANGE (computed_at);

-- Partitions by year — add new ones each season
CREATE TABLE win_probability_snapshots_2024 PARTITION OF win_probability_snapshots
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE win_probability_snapshots_2025 PARTITION OF win_probability_snapshots
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE win_probability_snapshots_2026 PARTITION OF win_probability_snapshots
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE INDEX idx_win_prob_match ON win_probability_snapshots(match_id);

-- ================================================================
-- AI RECOMMENDATIONS (every AI output logged forever — audit trail)
-- ================================================================

CREATE TABLE ai_recommendations (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id                UUID REFERENCES matches(id),
    session_id              UUID REFERENCES auction_sessions(id),
    franchise_id            UUID REFERENCES franchises(id),
    recommendation_type     recommendation_type_enum NOT NULL,
    context_snapshot        JSONB NOT NULL,
    recommended_action      JSONB NOT NULL,
    confidence_score        NUMERIC(4,3) CHECK (confidence_score BETWEEN 0 AND 1),
    reasoning_text          TEXT,
    model_version           VARCHAR(20),
    was_followed            BOOLEAN,
    actual_outcome          JSONB,
    win_prob_delta          NUMERIC(5,4),  -- win prob change if followed vs not
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_recs_match ON ai_recommendations(match_id);
CREATE INDEX idx_ai_recs_session ON ai_recommendations(session_id);
CREATE INDEX idx_ai_recs_type ON ai_recommendations(recommendation_type);
CREATE INDEX idx_ai_recs_generated ON ai_recommendations(generated_at DESC);

-- ================================================================
-- SCOUTING DOMAIN
-- ================================================================

CREATE TABLE scouting_reports (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id                   UUID NOT NULL REFERENCES players(id),
    authored_by_franchise_id    UUID REFERENCES franchises(id),
    report_date                 DATE NOT NULL,
    league                      domestic_league_enum,
    summary                     TEXT NOT NULL,
    batting_analysis            TEXT,
    bowling_analysis            TEXT,
    fielding_analysis           TEXT,
    weaknesses                  TEXT,
    strengths                   TEXT,
    hidden_talent_score         NUMERIC(5,2) CHECK (hidden_talent_score BETWEEN 0 AND 100),
    undervalue_score            NUMERIC(5,2) CHECK (undervalue_score BETWEEN 0 AND 100),
    recommended_base_price_cr   NUMERIC(6,2),
    comparable_players          JSONB,  -- array of {player_id, similarity_score}
    raw_data                    JSONB,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scouting_player ON scouting_reports(player_id);
CREATE INDEX idx_scouting_league ON scouting_reports(league);

-- ================================================================
-- TOURNAMENT STANDINGS
-- ================================================================

CREATE TABLE points_table (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id       UUID NOT NULL REFERENCES seasons(id),
    franchise_id    UUID NOT NULL REFERENCES franchises(id),
    matches_played  INT NOT NULL DEFAULT 0,
    wins            INT NOT NULL DEFAULT 0,
    losses          INT NOT NULL DEFAULT 0,
    ties            INT NOT NULL DEFAULT 0,
    no_results      INT NOT NULL DEFAULT 0,
    points          INT NOT NULL DEFAULT 0,
    net_run_rate    NUMERIC(6,4) NOT NULL DEFAULT 0,
    for_runs        INT NOT NULL DEFAULT 0,
    for_overs       NUMERIC(7,1) NOT NULL DEFAULT 0,
    against_runs    INT NOT NULL DEFAULT 0,
    against_overs   NUMERIC(7,1) NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (season_id, franchise_id)
);

CREATE INDEX idx_points_table_season ON points_table(season_id);

CREATE TABLE fixture_schedule (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id       UUID NOT NULL REFERENCES seasons(id),
    match_id        UUID REFERENCES matches(id),
    team1_id        UUID NOT NULL REFERENCES franchises(id),
    team2_id        UUID NOT NULL REFERENCES franchises(id),
    scheduled_date  TIMESTAMPTZ NOT NULL,
    venue_id        UUID REFERENCES venues(id),
    match_number    INT,
    match_type      match_type_enum,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fixture_season ON fixture_schedule(season_id);
CREATE INDEX idx_fixture_date ON fixture_schedule(scheduled_date);

-- ================================================================
-- USERS (after franchises so franchise_id FK can be set)
-- ================================================================

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_superuser    BOOLEAN NOT NULL DEFAULT false,
    role            user_role_enum NOT NULL DEFAULT 'Support Analyst',
    franchise_id    UUID REFERENCES franchises(id),
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_franchise ON users(franchise_id);

-- ================================================================
-- DATA INGESTION TRACKING
-- ================================================================

CREATE TABLE data_ingestion_logs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source              ingestion_source_enum NOT NULL,
    entity_type         VARCHAR(50) NOT NULL,
    batch_reference     VARCHAR(100),
    records_processed   INT NOT NULL DEFAULT 0,
    records_inserted    INT NOT NULL DEFAULT 0,
    records_updated     INT NOT NULL DEFAULT 0,
    records_failed      INT NOT NULL DEFAULT 0,
    error_details       JSONB,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ,
    status              ingestion_status_enum NOT NULL DEFAULT 'Running',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingestion_source ON data_ingestion_logs(source);
CREATE INDEX idx_ingestion_started ON data_ingestion_logs(started_at DESC);

-- ================================================================
-- SCHEMA MIGRATIONS TRACKER
-- ================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(50) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    description TEXT
);

INSERT INTO schema_migrations (version, description)
VALUES ('001', 'Full initial schema — all 10 domains');

COMMIT;
