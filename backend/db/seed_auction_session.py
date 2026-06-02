"""
Seed a live (Active) auction session for the 2026 season so the
Auction War Room can connect.

Business logic — NOT hardcoded dummy rows:
  * 10 current IPL franchises (each already has a demo login user).
  * Team purse / squad / overseas / RTM follow current IPL mega-auction rules.
  * The auction pool is every active player who has a computed rating; each
    player's base price is derived from that rating using the real IPL base
    price slabs (₹0.30 – ₹2.00 Cr). AI fair value is left to the ML model at
    request time (player_valuations is intentionally empty).

Idempotent: re-running reuses the existing 2026 session and refreshes its lots
and team states instead of creating duplicates.

Run:  DATABASE_URL=... python db/seed_auction_session.py
Prints the SESSION_ID and a suggested FRANCHISE_ID for frontend/.env.
"""
from __future__ import annotations

import sys
from decimal import Decimal

from core.database import SessionLocal
from models import (
    AuctionSession, AuctionLot, TeamAuctionState, Player, Franchise,
)
from models.tournament import Season
from models.player import PlayerRating
from models.auction import AuctionStatusEnum

SEASON_YEAR = 2026
SESSION_NAME = "IPL 2026 Mega Auction"

# Current IPL franchises (defunct teams excluded). Same list as the user seed.
ACTIVE_SHORT_NAMES = ["CSK", "MI", "RCB", "KKR", "DC", "RR", "SRH", "PBKS", "GT", "LSG"]
# The team the local demo user "owns" in the war room.
DEFAULT_FRANCHISE_SHORT = "CSK"

# Current IPL mega-auction rules.
INITIAL_PURSE_CR = Decimal("120.00")
SQUAD_SIZE_MAX = 25
OVERSEAS_SLOTS_MAX = 8

# Real IPL base-price slabs, picked off a player's overall rating.
# (rating_threshold, base_price_cr, set_number)
BASE_PRICE_SLABS = [
    (Decimal("50"), Decimal("2.00"), 1),
    (Decimal("42"), Decimal("1.50"), 2),
    (Decimal("35"), Decimal("1.00"), 3),
    (Decimal("28"), Decimal("0.75"), 4),
    (Decimal("20"), Decimal("0.50"), 5),
    (Decimal("0"),  Decimal("0.30"), 6),
]


def slab_for(rating: Decimal) -> tuple[Decimal, int]:
    for threshold, price, set_no in BASE_PRICE_SLABS:
        if rating >= threshold:
            return price, set_no
    return Decimal("0.30"), 6


def main() -> int:
    db = SessionLocal()
    try:
        season = db.query(Season).filter(Season.year == SEASON_YEAR).first()
        if not season:
            print(f"ERROR: season {SEASON_YEAR} not found", file=sys.stderr)
            return 1

        franchises = {
            f.short_name: f
            for f in db.query(Franchise)
            .filter(Franchise.short_name.in_(ACTIVE_SHORT_NAMES))
            .all()
        }
        missing = [s for s in ACTIVE_SHORT_NAMES if s not in franchises]
        if missing:
            print(f"ERROR: franchises missing from DB: {missing}", file=sys.stderr)
            return 1

        # ── Session (idempotent) ──────────────────────────────────────
        session = (
            db.query(AuctionSession)
            .filter(
                AuctionSession.season_id == season.id,
                AuctionSession.name == SESSION_NAME,
            )
            .first()
        )
        if session is None:
            session = AuctionSession(
                season_id=season.id,
                name=SESSION_NAME,
                status=AuctionStatusEnum.Active,
                location="Bengaluru",
            )
            db.add(session)
            db.flush()
            print(f"  created session {session.id}")
        else:
            session.status = AuctionStatusEnum.Active
            # Clear prior lots so we rebuild the pool cleanly.
            db.query(AuctionLot).filter(AuctionLot.session_id == session.id).delete()
            print(f"  reusing session {session.id} (lots rebuilt)")

        # ── Team states (one per franchise) ───────────────────────────
        for short in ACTIVE_SHORT_NAMES:
            fr = franchises[short]
            ts = (
                db.query(TeamAuctionState)
                .filter(
                    TeamAuctionState.session_id == session.id,
                    TeamAuctionState.franchise_id == fr.id,
                )
                .first()
            )
            if ts is None:
                db.add(TeamAuctionState(
                    session_id=session.id,
                    franchise_id=fr.id,
                    initial_purse_cr=INITIAL_PURSE_CR,
                    remaining_budget_cr=INITIAL_PURSE_CR,
                    players_bought=[],
                    squad_size_max=SQUAD_SIZE_MAX,
                    overseas_slots_max=OVERSEAS_SLOTS_MAX,
                ))

        # ── Lots: active players with a rating, ranked by rating ──────
        ranked = (
            db.query(Player, PlayerRating)
            .join(PlayerRating, PlayerRating.player_id == Player.id)
            .filter(Player.is_active.is_(True))
            .order_by(PlayerRating.overall_rating.desc())
            .all()
        )
        if not ranked:
            print("ERROR: no rated active players to build the auction pool", file=sys.stderr)
            return 1

        for lot_no, (player, rating) in enumerate(ranked, start=1):
            price, set_no = slab_for(rating.overall_rating)
            db.add(AuctionLot(
                session_id=session.id,
                player_id=player.id,
                lot_number=lot_no,
                set_number=set_no,
                base_price_cr=price,
            ))

        # ── Current lot = the top-ranked player ───────────────────────
        top_player, top_rating = ranked[0]
        top_price, _ = slab_for(top_rating.overall_rating)
        session.current_lot_player_id = top_player.id
        session.current_base_price_cr = top_price
        session.current_bid_amount_cr = None
        session.current_highest_bidder_id = None

        db.commit()

        default_fr = franchises[DEFAULT_FRANCHISE_SHORT]
        print(f"  teams: {len(ACTIVE_SHORT_NAMES)}  lots: {len(ranked)}")
        print(f"  current lot: {top_player.full_name} @ Rs {top_price} Cr base")
        print()
        print("Add to frontend/.env:")
        print(f"  VITE_AUCTION_SESSION_ID={session.id}")
        print(f"  VITE_FRANCHISE_ID={default_fr.id}")
        print(f"  VITE_SEASON_ID={season.id}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
