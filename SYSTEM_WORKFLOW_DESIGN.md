# Cricket Decision Intelligence Platform — Full Interactive Workflow Design

**Status:** Design proposal for review (no code yet)
**Goal:** Turn the three surfaces from "namesake displays" into **playable, real-time, AI-driven decision games** where the user takes actions and the system responds with real logic.

---

## 0. The core problem today

| Surface | What exists | What's missing (the "no logic") |
|---|---|---|
| Auction War Room | ML bid *recommendation* + budgets display | No auction **loop**: bid does nothing → no rivals, no SOLD, no next lot, no budget change |
| Pre-Match Planner | Win-prob + XI optimizer (one-shot) | No **planning session**: can't lock an XI, set strategy, and carry it into a match |
| Live Match | Ball-by-ball sim + ML win-prob (built) | No **tactical decisions by the user** (bowling change, batting intent) that affect outcome |

**The fix is one idea applied three times: a real-time game loop driven by autonomous AI agents.** The user is one actor; the AI agents are the other 9 franchises / the opposition captain. Everything reacts.

---

## 1. The Agentic Engine (shared core)

A lightweight **agent** = a persona + a policy that reads state and emits an action. No heavy LLM needed — each agent uses the **existing ML models** (valuation, win-prob) plus a strategy profile. (An optional LLM "explainer" can narrate *why* an agent acted.)

```
Agent = {
  identity:  franchise / role,
  persona:   {aggression, budget_discipline, role_priorities, risk_appetite},
  policy(state) -> action            # uses ML valuation / win-prob
  explain(action) -> short reasoning # optional LLM or template
}
```

Three agent types:
- **Rival Bidder Agent** (auction) — decides counter-bid vs drop-out.
- **Opposition Captain Agent** (live) — picks bowler / sets field / sets batting intent.
- **Advisor Agent** (all surfaces) — the user's AI coach; recommends, never forces.

A single **Tick Engine** drives time: each tick, the engine asks the relevant agents for actions, applies them to state, runs the ML model, persists, and pushes the new state to the UI over WebSocket.

```
[Tick Engine] --tick--> [Agents decide] --> [Apply to state] --> [ML model] --> [DB] --> [WebSocket push] --> [UI updates]
        ^------------------------------------ user action injects here ------------------------------------|
```

---

## 2. Auction War Room — full interactive flow ⭐ (the priority)

### The play loop (what the user experiences)
1. Auction opens → **Lot #1** appears at base price. Advisor agent shows: AI fair value, max-bid, BID/PASS, squad impact.
2. A **countdown** starts (e.g. 8s "going once…"). This is the real-time heartbeat.
3. User clicks **Bid** (price goes up one increment, user becomes highest bidder). Countdown resets.
4. **Rival agents react**: each of the other 9 franchises evaluates the lot against *its own* budget/needs/valuation and may counter-bid. Counter-bids reset the countdown. Bid history scrolls live.
5. Bidding war continues until either: nobody counters before the countdown ends, or everyone hits their max.
6. **Resolution:**
   - Highest bidder wins → player **SOLD** → winner's budget debited, squad slot + role counts updated, overseas slot consumed.
   - RTM: if the player's previous franchise has Right-To-Match, they may match the price.
   - No bids at base → **UNSOLD**.
7. Engine **advances to the next lot**. Repeat until the lot queue is empty → **auction summary** (squad built, money spent, AI grade).

### Rival Bidder Agent policy (real logic, not random)
```
maxBid(agent, player) = ai_fair_value(player)            # existing ML valuation
                        × (1 + need_premium(agent))       # role gaps raise it
                        × persona.aggression               # 0.8 cautious … 1.3 aggressive
                        capped at budget_discipline × remaining_budget
decision: if current_price + increment <= maxBid AND has_slot AND (overseas_ok)
          → counter-bid (probabilistic, so it's not robotic)
          else → drop out of this lot
```
This reuses `get_bid_recommendation` / `predict_player_valuation` that already exist — the recommendation engine becomes the **agents' brain**.

### State machine (per lot)
```
PRESENTED → BIDDING → (GOING_ONCE → GOING_TWICE) → SOLD | UNSOLD → next lot
                ^_______ any new bid resets to BIDDING _______|
```

### Real-time mechanism
- WebSocket `/ws/auction/{session}` already exists. The Tick Engine drives the countdown server-side and broadcasts `lot_presented`, `bid_placed`, `going_once`, `sold`, `next_lot`.
- Front-end already subscribes and invalidates queries on `auction_update` — we extend the message types.

### Backend pieces to add
- `auction_engine.py`: countdown/tick loop, rival-agent step, resolve-lot, advance-lot.
- Endpoints: `POST /auction/{session}/open`, `/bid` (exists), `/pass`, `/advance`; engine emits WS events.
- `team_auction_states` updates on SOLD (budget, counts) — tables already exist.

---

## 3. Pre-Match Planner — planning session flow

### The play loop
1. User picks a match → sees opponent, venue, pitch, conditions.
2. **AI XI recommendation** (exists) → user can **swap players** in/out of the XI (drag), with live re-scoring.
3. User sets **strategy sliders**: batting intent (anchor↔aggressive), bowling plan (pace/spin split), toss decision.
4. **Win-probability updates live** as the user changes the XI/strategy (re-runs the prematch model).
5. User **locks the plan** → it's saved and **carried into the Live Match** as the starting setup.

### Real logic
- Each XI edit re-runs `optimize_playing_xi` scoring + `predict_prematch_win_prob`, so the number moves with the user's choices — cause and effect the user can feel.
- Matchup matrix (exists) highlights danger/threat pairings to inform the choices.

---

## 4. Live Match — tactical decision flow

### The play loop (extends the sim already built)
1. Start from the locked pre-match XI (or quick-start a chase).
2. Ball-by-ball **auto-play / next-ball** (built). ML win-prob updates each ball (built).
3. **User tactical actions** (new, the "action"):
   - **Bowling change**: pick the next bowler (Advisor agent recommends best matchup); affects next over's outcome distribution.
   - **Batting intent**: defensive / balanced / attack — shifts the run/wicket probabilities.
4. **Opposition Captain Agent** responds on its turn (sets its bowler / field), so it's a contest.
5. Momentum, alerts, and recommendations (exist) update live; match resolves to a result (built).

### Real logic
- The user's intent + bowler choice **modulate the outcome distribution** the simulator samples from, so decisions visibly change win-prob — not cosmetic.
- Opposition agent uses the live win-prob model to make *its* choices, creating a real back-and-forth.

---

## 5. What is real vs mock

| Real (logic-driven) | Mock / dummy (acceptable for now) |
|---|---|
| ML valuation, win-prob, XI optimizer (trained models) | Player nationality / pace-vs-spin / WK (source data is uniform — flagged earlier) |
| Auction loop, budgets, SOLD/UNSOLD, squad counts | Ball outcomes use a realistic **distribution** (not a real ball feed) |
| Rival/opposition agent decisions (ML + persona) | Agent personas are hand-authored profiles |
| Real-time countdown + WebSocket push | "Crowd"/commentary flavor text is templated |

**Real-time** here = a **server-driven tick loop + WebSocket push**, not a live external data feed. That is genuinely real-time and interactive — which is what's missing today.

---

## 6. Proposed build sequence (after you approve)

1. **Auction engine** (highest impact): tick/countdown + rival agents + SOLD/advance + WS events + budget updates. → *Bidding becomes a real game.*
2. **Live tactical layer**: bowling-change + batting-intent actions feeding the sim + opposition agent.
3. **Pre-match planning session**: editable XI + strategy sliders + live win-prob + lock-and-carry into Live.
4. **Advisor agent polish + optional LLM narration** across all three.

---

## 7. One open decision for you
- **Auction tempo:** fully **auto** (agents bid on a timer, you jump in) — more "live auction" feel — **or** **turn-based** (you act, then agents respond, no timer) — calmer, easier to follow. *(Recommended: auto with adjustable speed, like the live sim.)*
