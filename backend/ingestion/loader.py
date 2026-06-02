"""
Insert parsed Cricsheet matches into PostgreSQL.
Uses psycopg2 bulk operations for performance.
Entity caches avoid repeated DB lookups across the session.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

import psycopg2
import psycopg2.extras
from psycopg2.extras import execute_values

from .constants import TEAM_SHORT_NAME, BASE_PRICE_BY_ROLE
from .parser import ParsedMatch, ParsedInnings, ParsedBall, ParsedPlayer

logger = logging.getLogger(__name__)


class IngestionSession:
    """Stateful session that holds entity caches and a DB connection."""

    def __init__(self, db_url: str):
        self.conn = psycopg2.connect(db_url)
        self.conn.autocommit = False

        # In-memory caches: key → UUID string
        self._tournament: dict[str, str] = {}   # name → id
        self._season: dict[tuple, str] = {}      # (tournament_id, year) → id
        self._venue: dict[str, str] = {}         # name → id
        self._franchise: dict[str, str] = {}     # canonical_name → id
        self._player: dict[str, str] = {}        # cricsheet_id → id

        self._load_existing_entities()

    def _load_existing_entities(self) -> None:
        """Pre-populate caches from existing DB data."""
        with self.conn.cursor() as cur:
            cur.execute("SELECT name::text, id::text FROM tournaments")
            self._tournament = {r[0]: r[1] for r in cur.fetchall()}

            cur.execute("SELECT tournament_id::text, year, id::text FROM seasons")
            self._season = {(r[0], r[1]): r[2] for r in cur.fetchall()}

            cur.execute("SELECT name, id::text FROM venues")
            self._venue = {r[0]: r[1] for r in cur.fetchall()}

            cur.execute("SELECT name, id::text FROM franchises")
            self._franchise = {r[0]: r[1] for r in cur.fetchall()}

            cur.execute("SELECT cricsheet_id, id::text FROM players WHERE cricsheet_id IS NOT NULL")
            self._player = {r[0]: r[1] for r in cur.fetchall()}

        logger.info(
            "Cache loaded: %d tournaments, %d seasons, %d venues, %d franchises, %d players",
            len(self._tournament), len(self._season), len(self._venue),
            len(self._franchise), len(self._player),
        )

    # ------------------------------------------------------------------ #
    # Entity upserts
    # ------------------------------------------------------------------ #

    def _upsert_tournament(self, cur, name: str, event_name: str) -> str:
        if name in self._tournament:
            return self._tournament[name]
        tid = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO tournaments (id, name, full_name, country, format)
            VALUES (%s, %s::tournament_name_enum, %s, 'International', 'T20')
            ON CONFLICT DO NOTHING
            """,
            (tid, name, event_name),
        )
        self._tournament[name] = tid
        return tid

    def _upsert_season(self, cur, tournament_id: str, year: int) -> str:
        key = (tournament_id, year)
        if key in self._season:
            return self._season[key]
        sid = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO seasons (id, tournament_id, year, total_purse_cr)
            VALUES (%s, %s, %s, 90.0)
            ON CONFLICT (tournament_id, year) DO UPDATE SET year=EXCLUDED.year
            RETURNING id
            """,
            (sid, tournament_id, year),
        )
        row = cur.fetchone()
        sid = str(row[0])
        self._season[key] = sid
        return sid

    def _upsert_venue(self, cur, name: str, city: str | None) -> str:
        if name in self._venue:
            return self._venue[name]
        vid = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO venues (id, name, city, country)
            VALUES (%s, %s, %s, 'Unknown')
            ON CONFLICT DO NOTHING
            """,
            (vid, name, city or name),
        )
        self._venue[name] = vid
        return vid

    def _upsert_franchise(self, cur, canonical_name: str, tournament_id: str) -> str:
        if canonical_name in self._franchise:
            return self._franchise[canonical_name]
        fid = str(uuid.uuid4())
        short = TEAM_SHORT_NAME.get(canonical_name, canonical_name[:4].upper())
        cur.execute(
            """
            INSERT INTO franchises (id, name, short_name, tournament_id)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT DO NOTHING
            """,
            (fid, canonical_name, short, tournament_id),
        )
        self._franchise[canonical_name] = fid
        return fid

    def _upsert_player(self, cur, player: ParsedPlayer) -> str:
        if player.cricsheet_id in self._player:
            return self._player[player.cricsheet_id]
        pid = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO players (id, full_name, nationality, playing_role, batting_style, bowling_style, cricsheet_id)
            VALUES (%s, %s, 'Other'::nationality_enum, 'Top-order Batter'::playing_role_enum,
                    'Right-hand'::batting_style_enum, 'None'::bowling_style_enum, %s)
            ON CONFLICT (cricsheet_id) DO NOTHING
            """,
            (pid, player.full_name, player.cricsheet_id),
        )
        self._player[player.cricsheet_id] = pid
        return pid

    def _get_player_id_by_name(self, name: str, players_registry: dict[str, ParsedPlayer]) -> str | None:
        """Resolve player name → our UUID via registry lookup."""
        pp = players_registry.get(name)
        if pp:
            return self._player.get(pp.cricsheet_id)
        return None

    # ------------------------------------------------------------------ #
    # Main load method
    # ------------------------------------------------------------------ #

    def load_match(self, match: ParsedMatch) -> bool:
        """
        Insert a single parsed match and all its data.
        Returns True on success, False if already exists.
        """
        try:
            with self.conn.cursor() as cur:
                # Check if already loaded
                cur.execute(
                    "SELECT id FROM matches WHERE cricsheet_match_id = %s",
                    (match.cricsheet_match_id,),
                )
                if cur.fetchone():
                    return False

                # Entities
                t_id = self._upsert_tournament(cur, match.tournament_name, match.event_name)
                s_id = self._upsert_season(cur, t_id, match.season_year)
                v_id = self._upsert_venue(cur, match.venue_name, match.city)
                f1_id = self._upsert_franchise(cur, match.team1_name, t_id)
                f2_id = self._upsert_franchise(cur, match.team2_name, t_id)

                # Players
                for player in match.players.values():
                    self._upsert_player(cur, player)

                toss_winner_id = None
                if match.toss_winner:
                    toss_winner_id = self._franchise.get(match.toss_winner)

                winner_id = None
                if match.winner:
                    winner_id = self._franchise.get(match.winner)

                # Match
                m_id = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO matches (
                        id, season_id, venue_id, team1_id, team2_id,
                        match_date, match_number, match_type,
                        toss_winner_id, toss_decision,
                        winner_id, win_margin_runs, win_margin_wickets,
                        no_result, cricsheet_match_id, is_completed
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        %s::date, %s, %s::match_type_enum,
                        %s, %s::toss_decision_enum,
                        %s, %s, %s,
                        %s, %s, %s
                    )
                    """,
                    (
                        m_id, s_id, v_id, f1_id, f2_id,
                        match.match_date, match.match_number, match.match_type,
                        toss_winner_id, match.toss_decision,
                        winner_id, match.win_margin_runs, match.win_margin_wickets,
                        match.no_result, match.cricsheet_match_id, not match.no_result,
                    ),
                )

                # Innings + Balls
                for innings in match.innings:
                    self._load_innings(cur, innings, m_id, f1_id, f2_id, match.players)

            self.conn.commit()
            return True

        except Exception as e:
            self.conn.rollback()
            logger.error("Failed to load match %s: %s", match.cricsheet_match_id, e)
            return False

    def _load_innings(
        self,
        cur,
        innings: ParsedInnings,
        match_id: str,
        f1_id: str,
        f2_id: str,
        players_registry: dict[str, ParsedPlayer],
    ) -> None:
        bat_id = self._franchise.get(innings.batting_team)
        bowl_id = self._franchise.get(innings.bowling_team)
        if not bat_id or not bowl_id:
            return

        i_id = str(uuid.uuid4())
        target = None
        if innings.innings_number == 2 and innings.balls:
            target = innings.balls[0].__dict__.get("target")

        cur.execute(
            """
            INSERT INTO innings (
                id, match_id, innings_number,
                batting_team_id, bowling_team_id,
                total_runs, total_wickets, total_overs, extras,
                wides, no_balls, byes, leg_byes,
                target_runs,
                powerplay_runs, powerplay_wickets,
                middle_overs_runs, middle_overs_wickets,
                death_overs_runs, death_overs_wickets,
                is_completed
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s,
                %s, %s, %s, %s, %s, %s,
                true
            )
            """,
            (
                i_id, match_id, innings.innings_number,
                bat_id, bowl_id,
                innings.total_runs, innings.total_wickets, innings.total_overs, innings.extras,
                innings.wides, innings.no_balls, innings.byes, innings.leg_byes,
                target,
                innings.powerplay_runs, innings.powerplay_wickets,
                innings.middle_overs_runs, innings.middle_overs_wickets,
                innings.death_overs_runs, innings.death_overs_wickets,
            ),
        )

        # Bulk insert balls
        ball_rows: list[tuple] = []
        perf_batting: dict[str, list] = {}  # player_id → [runs, balls, 4s, 6s, pos]
        perf_bowling: dict[str, dict] = {}  # player_id → stats

        for ball in innings.balls:
            batter_id = self._get_player_id_by_name(ball.batter_name, players_registry)
            bowler_id = self._get_player_id_by_name(ball.bowler_name, players_registry)
            if not batter_id or not bowler_id:
                continue

            non_striker_id = self._get_player_id_by_name(ball.non_striker_name, players_registry)
            dismissed_id = self._get_player_id_by_name(ball.dismissed_player_name or "", players_registry) if ball.dismissed_player_name else None
            fielder_id = self._get_player_id_by_name(ball.fielder_name or "", players_registry) if ball.fielder_name else None

            required_runs = ball.__dict__.get("required_runs")
            balls_remaining = ball.__dict__.get("balls_remaining")

            b_id = str(uuid.uuid4())
            ball_rows.append((
                b_id, match_id, i_id,
                innings.innings_number, ball.over_number, ball.ball_number,
                batter_id, bowler_id, non_striker_id,
                ball.runs_off_bat, ball.extras_runs, ball.extras_type,
                ball.is_wicket, ball.wicket_type,
                dismissed_id, fielder_id,
                ball.is_powerplay, ball.is_middle_overs, ball.is_death_overs,
                ball.cumulative_score, ball.cumulative_wickets,
                required_runs, balls_remaining,
            ))

            # Accumulate batting stats
            if batter_id not in perf_batting:
                perf_batting[batter_id] = [0, 0, 0, 0]  # runs, balls, 4s, 6s
            s = perf_batting[batter_id]
            s[0] += ball.runs_off_bat
            s[1] += 1
            if ball.runs_off_bat == 4:
                s[2] += 1
            elif ball.runs_off_bat == 6:
                s[3] += 1

            # Accumulate bowling stats
            if bowler_id not in perf_bowling:
                perf_bowling[bowler_id] = {"balls": 0, "runs": 0, "wkts": 0, "dots": 0}
            bp = perf_bowling[bowler_id]
            if ball.extras_type not in ("Wide",):
                bp["balls"] += 1
            bp["runs"] += ball.runs_off_bat + ball.extras_runs
            if ball.is_wicket:
                bp["wkts"] += 1
            if ball.runs_off_bat == 0 and not ball.extras_runs:
                bp["dots"] += 1

        if ball_rows:
            execute_values(
                cur,
                """
                INSERT INTO balls (
                    id, match_id, innings_id,
                    innings_number, over_number, ball_number,
                    batter_id, bowler_id, non_striker_id,
                    runs_off_bat, extras_runs, extras_type,
                    is_wicket, wicket_type,
                    dismissed_player_id, fielder_id,
                    is_powerplay, is_middle_overs, is_death_overs,
                    cumulative_score, cumulative_wickets,
                    required_runs, balls_remaining
                ) VALUES %s
                """,
                ball_rows,
                template="(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::wicket_type_enum,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            )

        # Insert batting performances
        bat_rows = []
        for pos, (pid, stats) in enumerate(perf_batting.items(), start=1):
            sr = round((stats[0] / stats[1]) * 100, 2) if stats[1] > 0 else 0.0
            bat_rows.append((
                str(uuid.uuid4()), match_id, i_id, pid, bat_id,
                pos, stats[0], stats[1], stats[2], stats[3], sr,
            ))
        if bat_rows:
            execute_values(
                cur,
                """
                INSERT INTO batting_performances
                    (id, match_id, innings_id, player_id, franchise_id,
                     batting_position, runs_scored, balls_faced, fours, sixes, strike_rate)
                VALUES %s ON CONFLICT DO NOTHING
                """,
                bat_rows,
            )

        # Insert bowling performances
        bowl_rows = []
        for pid, stats in perf_bowling.items():
            balls = stats["balls"]
            overs = round(balls // 6 + (balls % 6) / 10, 1)
            econ = round(stats["runs"] / (balls / 6), 2) if balls >= 6 else 0.0
            bowl_rows.append((
                str(uuid.uuid4()), match_id, i_id, pid, bowl_id,
                overs, stats["runs"], stats["wkts"], econ, stats["dots"],
            ))
        if bowl_rows:
            execute_values(
                cur,
                """
                INSERT INTO bowling_performances
                    (id, match_id, innings_id, player_id, franchise_id,
                     overs_bowled, runs_conceded, wickets, economy, dots)
                VALUES %s ON CONFLICT DO NOTHING
                """,
                bowl_rows,
            )

    def close(self) -> None:
        self.conn.close()
