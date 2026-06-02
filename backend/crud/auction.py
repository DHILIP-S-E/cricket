from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from models import (
    AuctionSession, AuctionLot, Bid, TeamAuctionState,
    AuctionStrategy, Player, Franchise,
)


def get_session(db: Session, session_id: UUID) -> AuctionSession | None:
    return (
        db.query(AuctionSession)
        .options(
            joinedload(AuctionSession.season),
            joinedload(AuctionSession.current_lot_player),
        )
        .filter(AuctionSession.id == session_id)
        .first()
    )


def get_active_sessions(db: Session) -> list[AuctionSession]:
    return (
        db.query(AuctionSession)
        .filter(AuctionSession.status == "Active")
        .all()
    )


def get_all_team_states(db: Session, session_id: UUID) -> list[TeamAuctionState]:
    return (
        db.query(TeamAuctionState)
        .options(joinedload(TeamAuctionState.franchise))
        .filter(TeamAuctionState.session_id == session_id)
        .all()
    )


def get_team_state(
    db: Session, session_id: UUID, franchise_id: UUID
) -> TeamAuctionState | None:
    return (
        db.query(TeamAuctionState)
        .filter(
            TeamAuctionState.session_id == session_id,
            TeamAuctionState.franchise_id == franchise_id,
        )
        .first()
    )


def get_current_lot(db: Session, session_id: UUID) -> AuctionLot | None:
    session = db.query(AuctionSession).filter(AuctionSession.id == session_id).first()
    if not session or not session.current_lot_player_id:
        return None
    return (
        db.query(AuctionLot)
        .options(joinedload(AuctionLot.player))
        .filter(
            AuctionLot.session_id == session_id,
            AuctionLot.player_id == session.current_lot_player_id,
        )
        .first()
    )


def get_lots(
    db: Session,
    session_id: UUID,
    is_sold: bool | None = None,
    page: int = 1,
    size: int = 50,
) -> tuple[list[AuctionLot], int]:
    query = (
        db.query(AuctionLot)
        .options(
            joinedload(AuctionLot.player),
            joinedload(AuctionLot.sold_to),
        )
        .filter(AuctionLot.session_id == session_id)
    )
    if is_sold is not None:
        query = query.filter(AuctionLot.is_sold == is_sold)
    query = query.order_by(AuctionLot.lot_number)
    total = query.count()
    lots = query.offset((page - 1) * size).limit(size).all()
    return lots, total


def get_upcoming_lots(db: Session, session_id: UUID, limit: int = 10) -> list[AuctionLot]:
    return (
        db.query(AuctionLot)
        .options(joinedload(AuctionLot.player))
        .filter(
            AuctionLot.session_id == session_id,
            AuctionLot.is_sold == False,
            AuctionLot.is_unsold == False,
        )
        .order_by(AuctionLot.lot_number)
        .limit(limit)
        .all()
    )


def get_lot_bids(db: Session, lot_id: UUID) -> list[Bid]:
    return (
        db.query(Bid)
        .options(joinedload(Bid.franchise))
        .filter(Bid.lot_id == lot_id)
        .order_by(Bid.bid_time.desc())
        .all()
    )


def create_bid(db: Session, lot_id: UUID, franchise_id: UUID, amount: float, is_rtm: bool = False) -> Bid:
    bid = Bid(
        lot_id=lot_id,
        franchise_id=franchise_id,
        bid_amount_cr=amount,
        is_rtm=is_rtm,
    )
    db.add(bid)
    db.flush()

    # Update session current bid
    lot = db.query(AuctionLot).filter(AuctionLot.id == lot_id).first()
    if lot:
        session = db.query(AuctionSession).filter(AuctionSession.id == lot.session_id).first()
        if session:
            session.current_bid_amount_cr = amount
            session.current_highest_bidder_id = franchise_id

    db.commit()
    return bid


def get_auction_strategy(
    db: Session, session_id: UUID, franchise_id: UUID
) -> list[AuctionStrategy]:
    return (
        db.query(AuctionStrategy)
        .options(joinedload(AuctionStrategy.target_player))
        .filter(
            AuctionStrategy.session_id == session_id,
            AuctionStrategy.franchise_id == franchise_id,
        )
        .order_by(AuctionStrategy.priority)
        .all()
    )
