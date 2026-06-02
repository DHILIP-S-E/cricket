# Cricket Decision Intelligence Platform
## Enterprise System Design Document
### Version 1.0 — Architecture & Product Specification

---

## EXECUTIVE SUMMARY

This document defines the complete system architecture, domain model, AI/ML strategy, data schema strategy, synthetic data generation spec, and MVP roadmap for an AI-powered Cricket Decision Intelligence Platform targeting professional T20 franchise teams (IPL, BBL, PSL, CPL, SA20, etc.).

The platform covers three primary decision surfaces:
- **Auction Intelligence Engine** — real-time squad optimization during live auctions
- **Pre-Match Playing XI Engine** — optimal team selection before each match
- **Live Match Decision Engine** — ball-by-ball tactical recommendations

The core principle: every recommendation must update **instantly** when the world changes. A player is sold, a budget shrinks, a wicket falls, a pitch changes — the platform responds in under 1 second.

---

## PHASE 1 — DOMAIN DECOMPOSITION

### 1.1 Entity Map

#### TEAM DOMAIN
| Entity | Description |
|--------|-------------|
| Franchise | The IPL/T20 franchise organization |
| Squad | List of players contracted to a franchise for a season |
| PlayingXI | 11-player subset selected for a specific match |
| TeamComposition | Batting/bowling/all-rounder balance of a squad |
| TeamBudget | Purse remaining during auction or season financials |
| RoleQuota | Required count per role (e.g., min 1 wicketkeeper) |
| OverseasQuota | Max overseas players allowed (typically 4 in IPL) |

#### PLAYER DOMAIN
| Entity | Description |
|--------|-------------|
| Player | Core player identity record |
| PlayerProfile | Age, nationality, playing role, batting/bowling style |
| PlayerContract | Contract type, base price, final auction price |
| PlayerAvailability | Match-by-match availability (injury, national duty, personal) |
| PlayerForm | Recent performance metric (rolling last N matches) |
| PlayerInjuryRecord | Historical injuries, recovery timelines, current status |
| PlayerWorkload | Overs bowled, matches played, rest days — for injury prediction |
| PlayerMatchup | Head-to-head statistics between specific batter-bowler pairs |
| PlayerRating | AI-computed aggregate rating (0–100) |
| PlayerValuation | Fair market value, predicted price, budget efficiency score |

#### PERFORMANCE DOMAIN
| Entity | Description |
|--------|-------------|
| BattingPerformance | Innings-level batting stats per match |
| BowlingPerformance | Innings-level bowling stats per match |
| FieldingPerformance | Catches, run-outs, direct hits per match |
| PowerplayPerformance | Overs 1–6 batting/bowling stats |
| MiddleOversPerformance | Overs 7–15 batting/bowling stats |
| DeathOversPerformance | Overs 16–20 batting/bowling stats |
| PartnershipRecord | Partnership runs between two specific batters |
| PressureIndex | Performance in high-pressure situations (last 5 overs, chasing, etc.) |

#### MATCH DOMAIN
| Entity | Description |
|--------|-------------|
| Match | Core match record |
| Innings | Batting/bowling innings of a match |
| Over | Individual over within an innings |
| Ball | Ball-by-ball delivery record |
| Toss | Toss result and decision |
| ScoreCard | Live/historical match scorecard |
| MatchMomentum | Computed momentum swing over time |
| WinProbability | Ball-by-ball computed win probability |

#### TOURNAMENT DOMAIN
| Entity | Description |
|--------|-------------|
| Tournament | IPL, BBL, PSL, etc. |
| Season | Year-specific season of a tournament |
| PointsTable | Live standings during a season |
| PlayoffScenario | Permutations of playoff qualification |
| FixtureSchedule | All fixtures, dates, venues for a season |

#### VENUE DOMAIN
| Entity | Description |
|--------|-------------|
| Venue | Cricket ground |
| VenuePitchProfile | Historical pitch behavior (pace, spin, bounce, average scores) |
| PitchReport | Match-day pitch report from curator/expert |
| VenueWeatherHistory | Historical weather patterns at venue |
| LiveWeather | Real-time weather conditions during match |
| VenueStats | Average first/second innings scores, win% by toss decision |
| BoundaryDimensions | Ground dimensions, short sides, boundary lengths |

#### AUCTION DOMAIN
| Entity | Description |
|--------|-------------|
| AuctionSession | A live auction event |
| AuctionLot | Individual player lot in the auction |
| Bid | Individual bid event |
| BidResult | Final sold/unsold result per lot |
| TeamAuctionState | Real-time: remaining budget, slots filled, squad state |
| AuctionQueue | Upcoming players yet to go under the hammer |
| RTMRight | Right-to-Match card available to a franchise |
| AuctionStrategy | Pre-computed target list with priority tiers |
| BudgetAllocation | Budget split per role/tier in planning |

#### TACTICAL DOMAIN
| Entity | Description |
|--------|-------------|
| BowlingPlan | Planned bowling attack for a match |
| FieldPlacement | Field configuration for a specific batter/situation |
| BattingOrder | Optimal batting position 1–11 |
| PowerplayStrategy | Targeted approach for powerplay overs |
| DeathBowlingPlan | Last 5-over bowling assignments |
| MatchupExploitation | Tactical plan based on known batter-bowler matchups |
| CaptainDecision | Real-time decision recommendation for captain |

#### SCOUTING DOMAIN
| Entity | Description |
|--------|-------------|
| ScoutingReport | Analyst-generated report on a player |
| DomesticLeaguePlayer | Player from TNPL, KPL, Ranji, U19 etc. |
| PotentialRating | AI-predicted future peak rating |
| HiddenTalentScore | Composite undervalue detection score |
| ComparisonBenchmark | Similar established players used for projection |

#### REAL-TIME MATCH DOMAIN
| Entity | Description |
|--------|-------------|
| LiveMatchState | Current score, wickets, overs, RRR, CRR |
| LiveBatterState | Balls faced, runs scored, phase, form in current innings |
| LiveBowlerState | Overs bowled today, wickets, economy in this match |
| LivePartnershipState | Current partnership run rate, balls |
| LiveMomentumVector | Computed momentum direction and magnitude |
| NextBallPrediction | Most likely delivery type and outcome |
| BallSimulationResult | Output of Monte Carlo over the next N balls |

---

## PHASE 2 — ENTITY DETAIL & LIFECYCLE

### Player
**Purpose:** Core identity of every cricketer in the system.
**Why needed:** All three use cases operate on players. Auction bids players. Playing XI selects players. Live engine tracks players.
**Use Cases:** UC1 (Auction), UC2 (Playing XI), UC3 (Live)
**Dependencies:** PlayerProfile, PlayerContract, PlayerAvailability, PlayerForm
**Lifecycle:** Created during data ingestion. Updated when new matches are played. Availability updated daily. Form is a rolling computation.

### PlayerMatchup
**Purpose:** Head-to-head statistics between a specific batter and a specific bowler.
**Why needed:** This is the core engine of T20 tactical intelligence. Knowing Kohli averages 12 against Bumrah in powerplay changes everything — team selection, bowling order, field placement.
**Use Cases:** UC2 (Playing XI selection), UC3 (Live — who bowls to whom)
**Dependencies:** Player (two foreign keys), Ball records for computation
**Lifecycle:** Computed from all historical Ball records. Updated after each match. Requires minimum ball threshold (e.g., 12 balls) to be statistically meaningful.

### AuctionSession
**Purpose:** Tracks the live state of a running auction.
**Why needed:** Auction recommendations must respond to real-time changes — a player being sold, a team's budget dropping, a queue reshuffling.
**Use Cases:** UC1 (Auction)
**Dependencies:** TeamAuctionState for all 10 teams, AuctionQueue
**Lifecycle:** Created at start of auction. Updated after every lot closes. Destroyed / archived at auction end.

### LiveMatchState
**Purpose:** The single source of truth for what is happening in a live match right now.
**Why needed:** UC3 requires sub-second updates. Every recommendation — bowler selection, field placement, batting strategy — derives from the current state.
**Use Cases:** UC3 (Live)
**Dependencies:** Innings, Over, Ball, LiveBatterState, LiveBowlerState
**Lifecycle:** Created at toss. Updated after every ball. Archived to ScoreCard at match end.

### VenuePitchProfile
**Purpose:** Historical aggregate of how pitches at a venue behave across conditions.
**Why needed:** Playing XI selection and strategy planning fundamentally changes between spin-friendly Chennai and pace-friendly Perth. Venue IQ is non-negotiable.
**Use Cases:** UC2 (Playing XI), UC3 (Live strategy)
**Dependencies:** Venue, Match (historical)
**Lifecycle:** Computed periodically from historical match data. Supplemented by match-day PitchReport.

---

## PHASE 3 — AI/ML PROBLEM IDENTIFICATION

### Problem 1: Player Valuation
**Problem Type:** Regression
**Input Category:** Historical performance stats, age, role, form, injury history, IPL-specific stats
**Output Category:** Fair market value (INR), confidence interval
**Training Requirements:** Historical auction prices + career stats from 2008–present
**Real-time Requirements:** No (pre-auction computation)
**Notes:** Must handle "domestic-only" players with no IPL history. Use comparable player benchmarks.

---

### Problem 2: Squad Optimization (Auction)
**Problem Type:** Combinatorial Optimization (Integer Linear Programming)
**Input Category:** Available player pool, player valuations, budget, role constraints, overseas quota, squad size
**Output Category:** Optimal squad composition, ranked alternative squads, budget allocation
**Training Requirements:** None — this is a solver, not a learned model
**Real-time Requirements:** <1 second re-solve when any input changes
**Notes:** OR-Tools / Gurobi solve this exactly. Do NOT use ML for this. This is not a prediction problem — it's an optimization problem.

---

### Problem 3: Win Probability (Pre-Match)
**Problem Type:** Binary Classification (win/loss)
**Input Category:** Playing XI for both teams, venue, pitch, weather, toss, recent form, historical H2H
**Output Category:** Win probability (0–1)
**Training Requirements:** Historical match outcomes with same input features, 5000+ T20 matches
**Real-time Requirements:** On-demand (before match)
**Model Recommendation:** CatBoost (handles categorical features like venue, player names natively)

---

### Problem 4: Playing XI Optimization
**Problem Type:** Combinatorial Optimization + ML scoring
**Input Category:** Squad of 15–18 players, venue, opponent, pitch, weather, toss outcome
**Output Category:** Best 11 players + batting order + impact player
**Training Requirements:** Historical Playing XI decisions + match outcomes
**Real-time Requirements:** Under 30 seconds
**Notes:** Two-stage: (1) ML scores each player for this specific matchup. (2) Optimizer picks best 11 under constraints (min 5 bowling options, 1 WK, balance).

---

### Problem 5: Live Win Probability
**Problem Type:** Regression (updated every ball)
**Input Category:** Current score, wickets, overs, run rate, required run rate, batter/bowler state, venue par score
**Output Category:** Win probability for batting team (0–1)
**Training Requirements:** Ball-by-ball historical data from 50,000+ T20 innings
**Real-time Requirements:** <200ms per ball
**Model Recommendation:** LightGBM (fast inference, excellent on tabular)

---

### Problem 6: Bowler Recommendation (Live)
**Problem Type:** Ranking / Recommendation
**Input Category:** Current matchup (who is batting), bowler availability, overs remaining for each bowler, phase (PP/middle/death), match situation, historical matchup stats
**Output Category:** Ranked list of bowlers for next over + expected runs conceded + wicket probability
**Training Requirements:** Ball-by-ball data, historical bowler-batter matchup outcomes
**Real-time Requirements:** <500ms
**Model Recommendation:** Monte Carlo simulation over next 6 balls per bowler candidate

---

### Problem 7: Batting Strategy (Live)
**Problem Type:** Policy Optimization
**Input Category:** Balls remaining, wickets remaining, runs needed, current batter profile, bowler on strike, field placement, match pressure
**Output Category:** Recommended risk level (0–10), target zone, strike rotation probability
**Training Requirements:** Historical shot selections + outcomes in similar situations
**Real-time Requirements:** <500ms
**Model Recommendation:** Situational lookup + Monte Carlo simulation

---

### Problem 8: Matchup Score (Batter vs Bowler)
**Problem Type:** Multi-output Classification
**Input Category:** Batter profile, bowler profile, phase, venue, pitch type, conditions
**Output Category:** Boundary probability, wicket probability, dot ball probability, runs per ball
**Training Requirements:** Ball-by-ball historical data, minimum 12-ball threshold per matchup
**Real-time Requirements:** Pre-computed, served from lookup table

---

### Problem 9: Injury / Workload Risk
**Problem Type:** Classification (Low/Medium/High risk)
**Input Category:** Recent matches played, overs bowled (bowlers), rest days, travel distance, historical injury flag, age
**Output Category:** Injury risk score + recommended rest flag
**Training Requirements:** Historical injury records linked to workload data
**Real-time Requirements:** Daily batch computation

---

### Problem 10: Player Scouting (Undervalue Detection)
**Problem Type:** Anomaly Detection / Regression
**Input Category:** Domestic league stats, age, position on learning curve, performance vs peer group
**Output Category:** Potential rating (0–100), undervalue score, comparable established players
**Training Requirements:** Domestic stats of players who later became IPL stars (retrospective labeling)
**Real-time Requirements:** Weekly batch

---

### Problem 11: Opponent Playing XI Prediction
**Problem Type:** Multi-label Classification
**Input Category:** Opponent squad, venue, pitch, recent team trends, key player injuries
**Output Category:** Most likely XI with probability per player
**Training Requirements:** Historical team selection decisions
**Real-time Requirements:** Pre-match (hours before)

---

### Problem 12: Season Simulation
**Problem Type:** Monte Carlo Simulation
**Input Category:** All team squads, fixture schedule, venue data
**Output Category:** Championship probability per team, playoff probability, expected final standing
**Training Requirements:** Match outcome model (feeds the simulator)
**Real-time Requirements:** Batch (hours to run 10,000 seasons)

---

## PHASE 4 — COMPONENT TECHNOLOGY DECISIONS

### Rules Engine
**Used for:**
- Squad constraint validation (overseas quota, role counts, squad size limits)
- Auction eligibility rules (RTM, base price floors)
- Playing XI constraint enforcement (must have wicketkeeper, min bowling options)
- League-specific rule changes per year

**Why rules engine, not ML:** These are deterministic logical constraints, not learned patterns. They never change during inference. An ML model that "learns" that you can't pick 5 overseas players is wasteful — just code the rule.

**Technology:** Custom rule evaluator in Python (Pydantic models + validation logic)

---

### Optimization Engine (Solver)
**Used for:**
- Auction squad optimization (UC1)
- Playing XI composition selection (UC2)
- Bowling allocation across overs (UC3)

**Why solver, not ML:** This is a constrained combinatorial optimization problem with a clear objective function (maximize win probability) and hard constraints (budget, roster size, overseas limit). Solvers find the mathematically provable optimal solution. ML can only approximate.

**Technology:** Google OR-Tools (free, open-source, Python native, <1 second solve for this problem size)

---

### Machine Learning (Gradient Boosting)
**Used for:**
- Win probability prediction (pre-match)
- Live win probability (ball-by-ball)
- Player performance scoring for matchups
- Injury risk classification
- Opponent XI prediction

**Why gradient boosting (CatBoost/LightGBM), not neural networks:**
- Cricket data is tabular, not image/text — gradient boosting dominates here
- CatBoost handles categorical features (player names, venues) without encoding
- LightGBM is faster for real-time inference
- Both are interpretable — franchise analysts need to understand WHY

---

### Simulation Engine (Monte Carlo)
**Used for:**
- Live match decision engine (bowler/batting recommendations)
- Season simulation
- Win probability in edge cases where ML lacks training data

**Why Monte Carlo, not pure ML:**
- For decisions like "who should bowl the 18th over", you need to explore consequences — what happens if Bumrah bowls vs if Shami bowls. ML predicts a static probability; Monte Carlo simulates branching outcomes.
- 1000 simulations × 2 over scenarios runs in <500ms with LightGBM as the simulator's base model.

---

### Recommendation Engine
**Used for:**
- Auction player suggestions (ranked list of alternatives)
- Playing XI variations
- Field placement patterns

**Technology:** Solver output + ML scoring + business rules, presented as a ranked list with confidence and reasoning.

---

### Reinforcement Learning
**Used for (Phase 4 only, not MVP):**
- Captain decision support
- Dynamic bowling change policy
- Death over batting strategy

**Why RL, not supervised:**
- RL learns sequential decision policies — "given state S, take action A, observe reward R"
- T20 cricket is a Markov Decision Process: each ball is a state, each tactical decision is an action, run differential is the reward
- BUT: requires massive training data and careful reward design. MVP first.

---

## PHASE 5 — FULL SYSTEM ARCHITECTURE

### 5.1 System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (React + TypeScript)                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────────────┐   │
│  │ Auction War  │ │ Pre-Match    │ │ Live Match             │   │
│  │ Room         │ │ Planner      │ │ Dashboard              │   │
│  └──────────────┘ └──────────────┘ └───────────────────────┘   │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────────────┐   │
│  │ Player       │ │ Squad        │ │ Analytics              │   │
│  │ Scouting     │ │ Builder      │ │ Dashboard              │   │
│  └──────────────┘ └──────────────┘ └───────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST + WebSocket
┌──────────────────────────────▼──────────────────────────────────┐
│  BACKEND API (FastAPI + Python)                                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ Auction Service │  │ Match Service    │  │ Player Service│  │
│  └─────────────────┘  └──────────────────┘  └───────────────┘  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ Recommendation  │  │ Simulation       │  │ Auth / RBAC   │  │
│  │ Service         │  │ Service          │  │ Service       │  │
│  └─────────────────┘  └──────────────────┘  └───────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
┌──────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
│ DECISION ENGINE   │ │ INFERENCE LAYER │ │ REAL-TIME STREAM│
│ ┌───────────────┐ │ │ ┌─────────────┐ │ │ ┌─────────────┐ │
│ │ Rules Engine  │ │ │ │ CatBoost    │ │ │ │ WebSocket   │ │
│ │ OR-Tools      │ │ │ │ LightGBM    │ │ │ │ Server      │ │
│ │ Solver        │ │ │ │ Model Store │ │ │ │             │ │
│ └───────────────┘ │ │ └─────────────┘ │ │ └─────────────┘ │
│ ┌───────────────┐ │ │ ┌─────────────┐ │ │ ┌─────────────┐ │
│ │ Monte Carlo   │ │ │ │ Feature     │ │ │ │ Kafka/Redis │ │
│ │ Simulator     │ │ │ │ Store       │ │ │ │ Pub-Sub     │ │
│ └───────────────┘ │ │ └─────────────┘ │ │ └─────────────┘ │
└───────────────────┘ └─────────────────┘ └─────────────────┘
           │                   │                   │
┌──────────▼───────────────────▼───────────────────▼──────────────┐
│  DATA LAYER                                                       │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ PostgreSQL       │  │ Redis Cache      │  │ S3 / Object   │  │
│  │ (Primary DB)     │  │ (Live State)     │  │ Store (Models)│  │
│  └─────────────────┘  └──────────────────┘  └───────────────┘  │
└──────────────────────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────────┐
│  DATA PIPELINE                                                    │
│  ┌────────────────┐  ┌───────────────┐  ┌──────────────────┐   │
│  │ Data Ingestion │  │ Feature Eng.  │  │ Training Pipeline│   │
│  │ (Cricsheet,    │  │ (dbt / Pandas)│  │ (MLflow)         │   │
│  │  Cricbuzz,     │  │               │  │                  │   │
│  │  Synthetic)    │  │               │  │                  │   │
│  └────────────────┘  └───────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Data Flow — Auction Engine

```
Player Lot Announced
        │
        ▼
Retrieve player from Feature Store
        │
        ▼
ML Model: Score player for THIS team's needs
(CatBoost: player_score given squad_context)
        │
        ▼
Rules Engine: Validate constraints
(overseas slots, role counts, budget)
        │
        ▼
OR-Tools Solver: Re-optimize full squad
(objective: maximize win_probability)
        │
        ▼
Output: Bid recommendation, max bid, alternatives
        │
  ┌─────┴──────┐
  │ Player Sold│
  │ to another │
  ▼            ▼
Update         Update
TeamState      AuctionQueue
        │
        ▼
Trigger re-solve (< 1 second)
        │
        ▼
Update recommendations for next lot
```

### 5.3 Data Flow — Live Match Engine

```
Ball Delivered
      │
      ▼
Ingest ball data (WebSocket / API)
      │
      ▼
Update LiveMatchState
      │
      ├─────────────────────────────────┐
      ▼                                 ▼
LightGBM Win Probability          Monte Carlo Simulator
(current state → P(win))          (1000 next-over simulations)
      │                                 │
      ▼                                 ▼
Win Prob updated on UI            Bowler ranking updated
      │                                 │
      └──────────────┬──────────────────┘
                     ▼
          Recommendations pushed
          via WebSocket to UI
          (< 500ms total)
```

---

## PHASE 6 — MODEL RECOMMENDATIONS

### Model 1: Player Valuation
**Algorithm:** CatBoost Regressor
**Why:** Mixed categorical + numerical features. Handles "player_name" as categorical natively. Target: IPL auction price (log-transformed).
**Tradeoff:** Requires labeled auction price history. For new domestic players, use peer-group averaging.

### Model 2: Win Probability (Pre-Match)
**Algorithm:** CatBoost Classifier
**Why:** Strong category support (venue, team, players). XGBoost alternative if speed is priority.
**Features:** Team strength ratings, recent form, venue history, head-to-head record, pitch type, weather
**Tradeoff:** Pre-match prediction accuracy tops out ~70% even with perfect data — cricket is inherently uncertain.

### Model 3: Live Win Probability
**Algorithm:** LightGBM Regressor
**Why:** Fastest inference on tabular data. Crucial for <200ms ball-by-ball updates.
**Features:** Score, wickets, overs, RRR, CRR, batter strike rate in this innings, recent scoring rate (last 3 overs)
**Tradeoff:** Needs 50,000+ innings of ball-by-ball data. Use Cricsheet (free) as primary source.

### Model 4: Bowler Recommendation
**Algorithm:** Monte Carlo Simulation driven by LightGBM ball outcome model
**Simulation:** For each candidate bowler, simulate 1000 versions of their over. Pick bowler with lowest expected runs + highest wicket probability.
**Tradeoff:** Computationally heavier than pure ML. Mitigated by parallelizing simulations.

### Model 5: Playing XI Optimization
**Algorithm:** Two-stage — CatBoost player scoring + OR-Tools selection
**Stage 1:** Score each squad player (expected contribution given match context)
**Stage 2:** Select 11 that maximizes total score under constraints
**Tradeoff:** Stage 1 accuracy limits Stage 2. Poor player scoring → wrong XI even with perfect solver.

### Model 6: Matchup Engine
**Algorithm:** Pre-computed lookup table (empirical Bayes smoothed)
**Approach:** For each batter-bowler pair with 12+ balls, compute boundary%, wicket%, dot%, runs/ball with Bayesian smoothing toward league average for small samples.
**Tradeoff:** Sparse data problem for domestic players. Fallback: use bowler-type vs batter-type aggregate.

---

## PHASE 7 — MVP ROADMAP

### MVP Version 1 (Weeks 1–8)
**Theme: Auction Intelligence**

**Features:**
- Player database with synthetic data (300+ players)
- Player valuation model (CatBoost)
- Auction War Room UI — live squad tracking
- OR-Tools solver for squad optimization
- Real-time re-solve when player is sold
- Bid recommendation with max price
- Budget tracking and slot tracker (overseas, roles)
- Manual player availability toggle

**Data Requirements:**
- Synthetic dataset: 300 players × 50 features
- Historical auction prices (synthetic, following real IPL patterns)
- Player performance synthetic data (career stats, form)

**Complexity:** Medium
**Expected Accuracy:** Squad optimization — mathematically optimal. Player valuation ~60% accuracy on synthetic.
**Risks:**
- Constraint modeling complexity (RTM rights, tie-breaker rules)
- Real auction is faster than expected — UI must update in <1 second
- Player data sparsity for domestic-only players

---

### MVP Version 2 (Weeks 9–16)
**Theme: Pre-Match Intelligence**

**Features:**
- Playing XI recommendation engine
- Opponent XI predictor
- Matchup intelligence grid (batter vs bowler matrix)
- Win probability display (pre-match)
- Venue and pitch intelligence module
- Toss recommendation
- Batting order optimizer
- Weather integration (manual input for MVP)

**Data Requirements:**
- Ball-by-ball data for 2000+ T20 matches (Cricsheet)
- Venue pitch profiles (historical)
- Team selection history (2018–2024 seasons)

**Complexity:** High
**Expected Accuracy:** Win probability 62–68%. Playing XI recommendation qualitative validation.
**Risks:**
- Matchup data too sparse for domestic-only players
- Pitch reports are subjective — need structured input format
- Weather integration dependency

---

### MVP Version 3 (Weeks 17–24)
**Theme: Live Match Engine**

**Features:**
- Real-time match state ingestion
- Ball-by-ball win probability chart
- Bowler recommendation with rationale
- Batting strategy recommendation
- Field placement suggestion
- Live matchup override alerts
- Partnership danger alerts
- Phase completion summary (powerplay, middle, death)

**Data Requirements:**
- Live ball-by-ball feed (Cricbuzz unofficial API / manual entry for MVP)
- 50,000+ innings of historical ball-by-ball data for simulation model
- Trained LightGBM live win probability model

**Complexity:** Very High
**Expected Accuracy:** Win probability MAE < 8%. Bowler recommendation: directionally correct 70%+.
**Risks:**
- Real-time data feed reliability is the single biggest dependency
- Monte Carlo latency — must be <500ms for UX
- Model overconfidence in unusual match situations (super overs, rain D/L, etc.)

---

### Production Version (Weeks 25–40)
**Theme: Enterprise Grade + Advanced AI**

**Features:**
- Full data pipeline from real Cricbuzz / ESPNcricinfo
- Reinforcement Learning captain assistant
- Injury / workload prediction system
- Scouting engine (undervalue detection, domestic league analysis)
- Season simulator with 10,000-season Monte Carlo
- Auction War Room Game Theory engine (force opponents to overspend)
- Multi-franchise support with access control
- Audit log of all AI recommendations vs actual decisions
- Feedback loop — franchise decisions used to retrain models

**Data Requirements:**
- Real ball-by-ball data (Cricsheet full dataset)
- Real IPL auction records (2008–2024)
- Player injury records (from public sources + manual curation)
- Domestic league data (TNPL, Ranji, etc.)

**Risks:**
- Data licensing costs
- Reinforcement Learning reward shaping difficulty
- Model drift mid-season requiring online retraining

---

## SECTION 8 — SYNTHETIC DATA GENERATION SPECIFICATION

### 8.1 Why Synthetic Data First

Real IPL/T20 data requires either scraping (legal grey area) or licensed APIs (expensive). For MVP development and testing, a high-fidelity synthetic dataset is essential. The data must:
- Follow realistic statistical distributions (not random noise)
- Encode real cricket patterns (spin dominates in Chennai, pace in Perth)
- Maintain internal consistency (a 200-strike-rate batter should have realistic boundary rates)

---

### 8.2 Player Table — Synthetic Data Fields

| Field | Type | Distribution / Rule |
|-------|------|---------------------|
| player_id | UUID | Auto-generated |
| full_name | String | Realistic cricket name from regional namespaces |
| nationality | Enum | India 65%, Australia 10%, England 10%, WI 5%, NZ 5%, SA 5% |
| age | Int | Normal(27, 4), clipped [18, 40] |
| playing_role | Enum | Top-order Batter, Middle-order Batter, Batting All-rounder, Bowling All-rounder, Wicket-keeper Batter, Pace Bowler, Spin Bowler |
| batting_style | Enum | Right-hand 75%, Left-hand 25% |
| bowling_style | Enum | Right-arm Fast, Right-arm Medium, Left-arm Fast, Right-arm Offbreak, Left-arm Orthodox, Leg-spin |
| base_price_cr | Float | Tiers: 0.20, 0.50, 1.0, 1.5, 2.0 — role-dependent |
| ipl_caps | Int | Poisson(20) for established, 0 for domestic-only |
| international_caps | Int | Poisson(30) for established |
| career_batting_avg_t20 | Float | Normal(28, 8) for batters, Normal(15, 6) for bowlers |
| career_strike_rate | Float | Normal(135, 18) for batters |
| career_bowling_avg | Float | Normal(24, 5) for pace, Normal(26, 6) for spin |
| career_economy | Float | Normal(8.2, 1.1) |
| injury_prone_flag | Boolean | 15% probability |
| last_injury_days_ago | Int | Exponential(90) if injury_prone_flag |
| domestic_league_name | Enum | TNPL, KPL, MPL, Ranji, Vijay Hazare, BBL, PSL, CPL |
| potential_rating | Float | Normal(65, 15), clipped [40, 100] |
| current_form_score | Float | Normal(0.5, 0.15), clipped [0.1, 1.0] |

---

### 8.3 Match Table — Synthetic Data Fields

| Field | Type | Distribution / Rule |
|-------|------|---------------------|
| match_id | UUID | Auto-generated |
| tournament | Enum | IPL, BBL, PSL, CPL, T20I, SA20 |
| season_year | Int | 2018–2024 |
| team1_id | FK | Team |
| team2_id | FK | Team |
| venue_id | FK | Venue |
| toss_winner | FK | Team |
| toss_decision | Enum | Bat 40%, Field 60% (IPL realistic) |
| team1_score | Int | Normal(175, 22) |
| team2_score | Int | Normal(172, 22) |
| winner | FK | Team |
| win_margin_runs | Int | If batting team wins: Normal(15, 12) |
| win_margin_wickets | Int | If chasing team wins: Normal(4, 2), clipped [1,8] |
| pitch_type | Enum | Batting-friendly 30%, Bowling-friendly 20%, Balanced 50% |
| dew_factor | Boolean | 35% (night matches) |

---

### 8.4 Ball Table — Synthetic Data Fields (Core of all ML models)

| Field | Type | Distribution / Rule |
|-------|------|---------------------|
| ball_id | UUID | Auto-generated |
| match_id | FK | Match |
| innings | Int | 1 or 2 |
| over_number | Int | 0–19 |
| ball_number | Int | 0–5 (+ extras) |
| batter_id | FK | Player |
| bowler_id | FK | Player |
| non_striker_id | FK | Player |
| runs_off_bat | Int | 0: 35%, 1: 30%, 2: 8%, 3: 1%, 4: 16%, 6: 8% (phase-adjusted) |
| extras | Int | Wide/no-ball: 6% of deliveries |
| wicket_flag | Boolean | 5.5% per ball (phase-adjusted — higher in powerplay) |
| wicket_type | Enum | Caught 48%, Bowled 20%, LBW 17%, Run-out 10%, Others 5% |
| shot_type | Enum | Drive, Pull, Sweep, Slog, Defensive, Flick, Cut |
| line | Enum | Stumps, Outside Off, Outside Leg, Wide |
| length | Enum | Full, Good, Short, Yorker |
| speed_kmh | Float | Normal(140, 8) for pace, Normal(95, 5) for spin |
| cumulative_score | Int | Computed |
| cumulative_wickets | Int | Computed |
| required_runs | Int | Innings 2 only |
| win_probability_after | Float | Model-computed, used as training label |

---

### 8.5 Venue Table — Synthetic Data Fields

| Field | Type | Distribution / Rule |
|-------|------|---------------------|
| venue_id | UUID | |
| venue_name | String | Real IPL venues modeled |
| city | String | |
| country | String | |
| capacity | Int | |
| avg_first_innings_score | Float | e.g., Wankhede: 182, Chepauk: 158 |
| avg_second_innings_score | Float | |
| pace_assistance_rating | Float | 1–10, e.g., Chepauk: 4, Wankhede: 7 |
| spin_assistance_rating | Float | 1–10, e.g., Chepauk: 9, Wankhede: 4 |
| dew_probability | Float | Night match dew factor |
| boundary_short_side_m | Int | |
| boundary_long_side_m | Int | |
| powerplay_avg_score | Float | |
| death_overs_avg_per_over | Float | |

---

### 8.6 PlayerMatchup Table — Synthetic Data Fields

| Field | Type | Distribution / Rule |
|-------|------|---------------------|
| matchup_id | UUID | |
| batter_id | FK | Player |
| bowler_id | FK | Player |
| balls_faced | Int | Sum of historical balls |
| runs_scored | Int | Sum |
| dismissals | Int | Sum |
| boundary_count | Int | Sum |
| six_count | Int | Sum |
| dot_ball_count | Int | Sum |
| strike_rate | Float | Computed |
| dismissal_rate | Float | Computed |
| boundary_rate | Float | Computed |
| phase | Enum | Powerplay, Middle, Death, All |
| confidence_level | Enum | Low (<12 balls), Medium (12–50), High (50+) |

---

### 8.7 AuctionSession Table — Synthetic Data Fields

| Field | Type | Distribution / Rule |
|-------|------|---------------------|
| session_id | UUID | |
| tournament | String | IPL 2024 etc. |
| status | Enum | Pending, Active, Paused, Completed |
| current_lot_player_id | FK | Player |
| current_base_price | Float | |
| current_bid_amount | Float | |
| current_highest_bidder | FK | Team |

### TeamAuctionState (per team per session)
| Field | Type | Rule |
|-------|------|------|
| team_id | FK | |
| session_id | FK | |
| remaining_budget_cr | Float | Starts at purse (90 Cr typical) |
| players_bought | JSON Array | Player IDs |
| overseas_slots_used | Int | Max 4 allowed |
| wk_count | Int | Constraint: ≥1 |
| batter_count | Int | |
| bowler_count | Int | |
| all_rounder_count | Int | |
| squad_size | Int | Max 25 |
| rtm_available | Boolean | |

---

## SECTION 9 — FRONTEND SCREENS & DATA FLOWS

### Screen 1: Auction War Room

**Purpose:** Real-time auction decision support dashboard for franchise management team.

**Layout:**
- Left panel: Current player under auction (photo placeholder, stats, AI valuation, recommended max bid)
- Center panel: Live squad builder (slots filling up as players are bought — color coded by role)
- Right panel: Budget tracker, upcoming queue, team-by-team budget remaining
- Bottom panel: Alternative player suggestions (ranked by value if current player goes above budget)

**Data Flowing In (WebSocket):**
- AuctionSession.current_lot_player_id
- All TeamAuctionState records (10 teams)
- AuctionQueue (next 10 players)

**Data Flowing Out (from Backend to UI):**
- Bid recommendation (max price, confidence, reasoning)
- Alternative player list (top 5 if current is won by another team)
- Budget safety zones (green/amber/red)

**Real-Time Trigger:** When any player is sold → backend triggers solver re-run → pushes new recommendations via WebSocket → UI updates in <1 second.

**User Roles:**
- Franchise Owner: view recommendations, approve/override bid
- Head Analyst: full access, can adjust weights
- Support Analyst: read-only

---

### Screen 2: Pre-Match Planning Room

**Purpose:** Day-before / match-morning team selection and strategy planning.

**Layout:**
- Left panel: Squad selector — drag players into Playing XI slots
- Center panel: Win probability gauge (updates as XI changes)
- Right panel: Matchup intelligence matrix (12×5 batter vs bowler heat map)
- Top bar: Opponent predicted XI with probability bars
- Bottom: Phase-by-phase strategy plan (Powerplay / Middle / Death)

**Data Flowing In:**
- My squad (PlayerProfile + PlayerForm + PlayerAvailability)
- Opponent squad (same)
- VenuePitchProfile
- LiveWeather (or forecast)
- TossOutcome (once known)

**Data Flowing Out (Backend):**
- Recommended Playing XI
- Win probability (0–100%)
- Impact Player recommendation
- Batting order
- Bowling allocation per phase

**User Interaction:**
- User can toggle a player as unavailable → XI re-optimizes instantly
- User can change toss decision → strategy updates
- User can view matchup detail (click any cell in heat map)

---

### Screen 3: Live Match Dashboard

**Purpose:** Ball-by-ball tactical intelligence during the match.

**Layout:**
- Top: Live scorecard (compact)
- Left panel: Win probability curve (updates each ball)
- Center: Current recommendation card (bowling/batting)
- Right panel: Batter vs bowler matchup live stats
- Bottom: Alert feed (momentum shifts, partnership danger, over milestones)

**Data Flowing In (WebSocket, every ball):**
- Ball event: runs, wicket, extras
- LiveMatchState update
- LiveBatterState, LiveBowlerState

**Data Flowing Out (Backend → UI):**
- Updated win probability
- Bowler recommendation for next over
- Field placement suggestion (text: "Move fine leg to deep square leg")
- Batting risk level (1–10) for batting team
- Momentum indicator (rising/falling/stable)

---

## SECTION 10 — ROLES & ACCESS CONTROL

| Role | Access |
|------|--------|
| Franchise Owner | View all recommendations, approve auction bids |
| Head Analyst | Full read/write, can override AI recommendations |
| Support Analyst | Read-only on all dashboards |
| Captain | Live match dashboard only (during match) |
| Scout | Player scouting module only |
| Data Engineer | Admin — data pipeline management |

---

## SECTION 11 — IDENTIFIED RISKS & MITIGATIONS

### Data Risks
| Risk | Mitigation |
|------|------------|
| Cricsheet data has gaps for domestic leagues | Supplement with synthetic data for domestic players |
| Ball-by-ball data missing for older matches | Use only 2015+ data. Impute missing deliveries. |
| Player name variations across datasets | Create canonical player_id mapping layer |
| Injury data is not public | Build manual curation workflow for known injuries |

### Model Risks
| Risk | Mitigation |
|------|------------|
| Win probability model overconfident in unusual situations | Calibrate probabilities. Add uncertainty bands. |
| Player valuation model biased toward IPL stars | Explicit domestic league adjustment features |
| Matchup engine sparse data | Bayesian smoothing toward population average |
| Live engine latency exceeds 500ms | Profile Monte Carlo bottlenecks. Reduce simulation count to 500 if needed. |

### Product Risks
| Risk | Mitigation |
|------|------------|
| Franchise staff don't trust AI recommendations | Always show reasoning behind every recommendation |
| Auction is faster than system can update | Pre-compute top-N alternatives before each lot |
| Playing XI override creates confusion | All overrides are logged. System shows impact of override on win probability. |

---

## SECTION 12 — TECHNOLOGY STACK SUMMARY

| Layer | Technology | Reason |
|-------|------------|--------|
| Frontend | React + TypeScript + Tailwind CSS | Fast development, strong typing, component ecosystem |
| State Management | Zustand | Lightweight, real-time state updates for live match |
| Real-time | WebSocket (FastAPI native) | Ball-by-ball updates, auction live updates |
| Backend API | FastAPI (Python) | Async, fast, native ML ecosystem |
| Optimization Engine | Google OR-Tools | Free, fast, Python native, proven for sports optimization |
| ML Framework | CatBoost + LightGBM | Best-in-class for tabular cricket data |
| Model Training | MLflow | Experiment tracking, model versioning |
| Primary Database | PostgreSQL | Relational, ACID, excellent for analytical queries |
| Cache / Live State | Redis | Sub-millisecond reads for LiveMatchState |
| Message Queue | Redis Pub/Sub (MVP) → Kafka (Production) | Real-time ball events distribution |
| Synthetic Data | Python Faker + NumPy + custom distributions | Realistic statistical profiles |
| Deployment | Docker + docker-compose (MVP) | Simple, reproducible, easy to demo |
| Data Pipeline | Pandas + dbt (MVP) → Apache Spark (Production) | Feature engineering at scale |

---

*Document Version 1.0 | Cricket Decision Intelligence Platform | Enterprise Architecture*
