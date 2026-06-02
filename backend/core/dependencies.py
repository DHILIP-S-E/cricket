import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from uuid import UUID

from crud.user import get_user_by_id
from models.user import User
from core.database import get_db
from core.security import decode_access_token

bearer_scheme = HTTPBearer()

# Roles allowed to perform admin-level operations
ADMIN_ROLES = {"Super Admin", "Data Engineer"}

# Roles allowed to write live match data
MATCH_WRITE_ROLES = {"Data Engineer", "Super Admin", "Head Analyst"}


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str | None = payload.get("sub")
        if user_id is None or payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = get_user_by_id(db, int(user_id))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Only Super Admin and Data Engineer can call admin endpoints."""
    if str(user.role) not in ADMIN_ROLES and not user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def require_match_write(user: User = Depends(get_current_user)) -> User:
    """Only Data Engineers and Head Analysts can write live match data."""
    if str(user.role) not in MATCH_WRITE_ROLES and not user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Live match write access requires Data Engineer or Head Analyst role",
        )
    return user


def verify_franchise_access(user: User, franchise_id: UUID) -> None:
    """
    Verify the authenticated user has write access to the given franchise.
    Super admins and Data Engineers can act on any franchise.
    Franchise-bound users (Owner, Analyst) can only act on their own franchise.
    Raises HTTP 403 if access is denied.
    """
    if user.is_superuser or str(user.role) in ADMIN_ROLES:
        return  # global access

    if user.franchise_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not linked to any franchise",
        )
    if str(user.franchise_id) != str(franchise_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to act on behalf of this franchise",
        )
