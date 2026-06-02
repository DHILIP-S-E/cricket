"""
Parse a single Cricsheet JSON match file into our internal schema dicts.

Returns a ParsedMatch dataclass — no DB calls here, pure data transformation.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .constants import (
    EVENT_TO_TOURNAMENT,
    TEAM_CANONICAL,
    WICKET_TYPE_MAP,
    POWERPLAY_OVERS,
    MIDDLE_OVERS,
    DEATH_OVERS,
)

logger = logging.getLogger(__name__)


@dataclass
class ParsedPlayer:
    full_name: str
    cricsheet_id: str  # from registry


@dataclass
class ParsedBall:
    innings_number: int
    over_number: int
    ball_number: int        # 0-indexed legal delivery within over
    raw_ball_index: int     # raw index in deliveries list (includes extras)
    batter_name: str
    bowler_name: str
    non_striker_name: str
    runs_off_bat: int
    extras_runs: int
    extras_type: str | None  # Wide, NoBall, Bye, LegBye
    is_wicket: bool
    wicket_type: str | None
    dismissed_player_name: str | None
    fielder_name: str | None
    is_powerplay: bool
    is_middle_overs: bool
    is_death_overs: bool
    cumulative_score: int
    cumulative_wickets: int


@dataclass
class ParsedInnings:
    innings_number: int
    batting_team: str
    bowling_team: str
    balls: list[ParsedBall] = field(default_factory=list)
    total_runs: int = 0
    total_wickets: int = 0
    total_overs: float = 0.0
    powerplay_runs: int = 0
    powerplay_wickets: int = 0
    middle_overs_runs: int = 0
    middle_overs_wickets: int = 0
    death_overs_runs: int = 0
    death_overs_wickets: int = 0
    extras: int = 0
    wides: int = 0
    no_balls: int = 0
    byes: int = 0
    leg_byes: int = 0


@dataclass
class ParsedMatch:
    # Source metadata
    file_path: str
    cricsheet_match_id: str

    # Tournament / Season
    tournament_name: str   # our tournament_name_enum value
    event_name: str        # raw event name
    season_year: int
    match_type: str        # League / Final / etc.
    match_number: int | None

    # Match info
    city: str | None
    venue_name: str
    match_date: str        # ISO date string

    # Teams
    team1_name: str
    team2_name: str
    toss_winner: str | None
    toss_decision: str | None   # Bat / Field

    # Outcome
    winner: str | None
    win_margin_runs: int | None
    win_margin_wickets: int | None
    no_result: bool

    # Officials
    umpire1: str | None
    umpire2: str | None
    match_referee: str | None

    # Players registry: cricsheet_id → name
    players: dict[str, ParsedPlayer]

    # Innings
    innings: list[ParsedInnings] = field(default_factory=list)


def _resolve_tournament(info: dict) -> str:
    """Map Cricsheet event name to our tournament enum value."""
    event = info.get("event", {})
    if isinstance(event, dict):
        event_name = event.get("name", "")
    else:
        event_name = str(event)
    return EVENT_TO_TOURNAMENT.get(event_name, "T20I")


def _resolve_match_type(info: dict) -> tuple[str, int | None]:
    """Return (match_type, match_number)."""
    event = info.get("event", {})
    if not isinstance(event, dict):
        return "League", None

    stage = event.get("stage", "").lower()
    number = event.get("match_number")
    try:
        number = int(number) if number else None
    except (ValueError, TypeError):
        number = None

    type_map = {
        "final": "Final",
        "qualifier 1": "Qualifier 1",
        "qualifier 2": "Qualifier 2",
        "eliminator": "Eliminator",
        "semi-final": "Qualifier 1",
    }
    return type_map.get(stage, "League"), number


def _parse_outcome(info: dict) -> tuple[str | None, int | None, int | None, bool]:
    """Return (winner, win_by_runs, win_by_wickets, no_result)."""
    outcome = info.get("outcome", {})
    if not isinstance(outcome, dict):
        return None, None, None, True

    result = outcome.get("result", "")
    if result in ("tie", "no result", "draw"):
        return None, None, None, result == "no result"

    winner = outcome.get("winner")
    if winner:
        winner = TEAM_CANONICAL.get(winner, winner)

    by = outcome.get("by", {})
    win_runs = by.get("runs")
    win_wkts = by.get("wickets")
    return winner, win_runs, win_wkts, False


def _build_player_registry(info: dict) -> dict[str, ParsedPlayer]:
    """Build name → ParsedPlayer from registry section."""
    registry = info.get("registry", {}).get("people", {})
    players: dict[str, ParsedPlayer] = {}
    for name, cid in registry.items():
        players[name] = ParsedPlayer(full_name=name, cricsheet_id=str(cid))
    return players


def _parse_innings(
    raw_innings: dict,
    innings_number: int,
    teams: list[str],
) -> ParsedInnings:
    batting_team_raw = raw_innings.get("team", "")
    batting_team = TEAM_CANONICAL.get(batting_team_raw, batting_team_raw)
    bowling_team_raw = next((t for t in teams if t != batting_team_raw), "")
    bowling_team = TEAM_CANONICAL.get(bowling_team_raw, bowling_team_raw)

    parsed = ParsedInnings(
        innings_number=innings_number,
        batting_team=batting_team,
        bowling_team=bowling_team,
    )

    cumulative_score = 0
    cumulative_wickets = 0
    legal_ball_in_over: dict[int, int] = {}  # over_number → count of legal deliveries

    for over_data in raw_innings.get("overs", []):
        over_number = int(over_data.get("over", 0))

        for raw_index, delivery in enumerate(over_data.get("deliveries", [])):
            runs = delivery.get("runs", {})
            runs_off_bat = int(runs.get("batter", 0))
            extras_runs = int(runs.get("extras", 0))
            total_runs = int(runs.get("total", runs_off_bat + extras_runs))

            # Extras type
            extras_dict = delivery.get("extras", {})
            if "wides" in extras_dict:
                extras_type = "Wide"
                parsed.wides += extras_dict["wides"]
            elif "noballs" in extras_dict:
                extras_type = "NoBall"
                parsed.no_balls += extras_dict.get("noballs", 1)
            elif "byes" in extras_dict:
                extras_type = "Bye"
                parsed.byes += extras_dict["byes"]
            elif "legbyes" in extras_dict:
                extras_type = "LegBye"
                parsed.leg_byes += extras_dict["legbyes"]
            elif "penalty" in extras_dict:
                extras_type = "Penalty"
            else:
                extras_type = None

            # Legal deliveries count (wides and no-balls don't count)
            is_wide = extras_type == "Wide"
            is_noball = extras_type == "NoBall"
            is_legal = not is_wide  # no-balls are legal deliveries (batter faces them)

            if is_legal:
                ball_number = legal_ball_in_over.get(over_number, 0)
                legal_ball_in_over[over_number] = ball_number + 1
            else:
                ball_number = legal_ball_in_over.get(over_number, 0)

            # Wicket
            wickets_list = delivery.get("wickets", [])
            is_wicket = len(wickets_list) > 0
            wicket_type = None
            dismissed_name = None
            fielder_name = None

            if is_wicket:
                w = wickets_list[0]
                kind = w.get("kind", "").lower()
                wicket_type = WICKET_TYPE_MAP.get(kind)
                dismissed_name = w.get("player_out")
                fielders = w.get("fielders", [])
                if fielders and isinstance(fielders[0], dict):
                    fielder_name = fielders[0].get("name")

                if wicket_type is not None:
                    cumulative_wickets += 1

            cumulative_score += total_runs

            # Phase
            is_pp = over_number in POWERPLAY_OVERS
            is_mid = over_number in MIDDLE_OVERS
            is_death = over_number in DEATH_OVERS

            ball = ParsedBall(
                innings_number=innings_number,
                over_number=over_number,
                ball_number=ball_number,
                raw_ball_index=raw_index,
                batter_name=delivery.get("batter", ""),
                bowler_name=delivery.get("bowler", ""),
                non_striker_name=delivery.get("non_striker", ""),
                runs_off_bat=runs_off_bat,
                extras_runs=extras_runs,
                extras_type=extras_type,
                is_wicket=is_wicket and wicket_type is not None,
                wicket_type=wicket_type,
                dismissed_player_name=dismissed_name,
                fielder_name=fielder_name,
                is_powerplay=is_pp,
                is_middle_overs=is_mid,
                is_death_overs=is_death,
                cumulative_score=cumulative_score,
                cumulative_wickets=cumulative_wickets,
            )
            parsed.balls.append(ball)

            # Phase run/wicket accumulators
            if is_pp:
                parsed.powerplay_runs += total_runs
                if ball.is_wicket:
                    parsed.powerplay_wickets += 1
            elif is_mid:
                parsed.middle_overs_runs += total_runs
                if ball.is_wicket:
                    parsed.middle_overs_wickets += 1
            elif is_death:
                parsed.death_overs_runs += total_runs
                if ball.is_wicket:
                    parsed.death_overs_wickets += 1

    parsed.total_runs = cumulative_score
    parsed.total_wickets = cumulative_wickets
    parsed.extras = parsed.wides + parsed.no_balls + parsed.byes + parsed.leg_byes

    # Compute total_overs from last legal delivery
    last_over = max(legal_ball_in_over.keys()) if legal_ball_in_over else 0
    last_balls = legal_ball_in_over.get(last_over, 0)
    parsed.total_overs = round(last_over + last_balls / 6, 1)

    return parsed


def parse_match_file(path: Path) -> ParsedMatch | None:
    """Parse a single Cricsheet JSON file. Returns None if unparseable."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            data: dict[str, Any] = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("Cannot read %s: %s", path, e)
        return None

    info = data.get("info", {})

    # Only process T20 matches
    if info.get("match_type", "").upper() != "T20":
        return None

    teams_raw: list[str] = info.get("teams", [])
    if len(teams_raw) < 2:
        return None

    team1 = TEAM_CANONICAL.get(teams_raw[0], teams_raw[0])
    team2 = TEAM_CANONICAL.get(teams_raw[1], teams_raw[1])

    dates = info.get("dates", [])
    match_date = dates[0] if dates else "1970-01-01"
    try:
        season_year = int(info.get("season", str(match_date[:4]))[:4])
    except (ValueError, TypeError):
        season_year = int(match_date[:4])

    toss = info.get("toss", {})
    toss_winner_raw = toss.get("winner", "")
    toss_winner = TEAM_CANONICAL.get(toss_winner_raw, toss_winner_raw) if toss_winner_raw else None
    toss_decision_raw = toss.get("decision", "")
    toss_decision = "Bat" if toss_decision_raw == "bat" else "Field" if toss_decision_raw == "field" else None

    winner, win_runs, win_wkts, no_result = _parse_outcome(info)
    tournament_name = _resolve_tournament(info)
    match_type, match_number = _resolve_match_type(info)

    event = info.get("event", {})
    event_name = event.get("name", tournament_name) if isinstance(event, dict) else str(event)

    officials = info.get("officials", {})
    umpires = officials.get("umpires", [])

    players = _build_player_registry(info)

    raw_innings = data.get("innings", [])
    innings: list[ParsedInnings] = []
    for i, inn_data in enumerate(raw_innings[:2], start=1):
        innings.append(_parse_innings(inn_data, i, teams_raw))

    # Add target_runs to innings 2
    if len(innings) == 2:
        innings[1].total_runs  # already set
        target = innings[0].total_runs + 1
        for ball in innings[1].balls:
            remaining_balls = 120 - (ball.over_number * 6 + ball.ball_number + 1)
            ball.__dict__["target"] = target
            ball.__dict__["required_runs"] = target - ball.cumulative_score
            ball.__dict__["balls_remaining"] = max(0, remaining_balls)

    return ParsedMatch(
        file_path=str(path),
        cricsheet_match_id=path.stem,
        tournament_name=tournament_name,
        event_name=event_name,
        season_year=season_year,
        match_type=match_type,
        match_number=match_number,
        city=info.get("city"),
        venue_name=info.get("venue", "Unknown"),
        match_date=match_date,
        team1_name=team1,
        team2_name=team2,
        toss_winner=toss_winner,
        toss_decision=toss_decision,
        winner=winner,
        win_margin_runs=win_runs,
        win_margin_wickets=win_wkts,
        no_result=no_result,
        umpire1=umpires[0] if len(umpires) > 0 else None,
        umpire2=umpires[1] if len(umpires) > 1 else None,
        match_referee=officials.get("match_referees", [None])[0],
        players=players,
        innings=innings,
    )
