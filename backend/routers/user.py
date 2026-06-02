from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user, require_admin
from crud.user import list_users, update_user
from models.user import User
from schemas.response import APIResponse, PaginatedResponse
from schemas.user import UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=APIResponse[UserResponse])
def get_me(current_user: User = Depends(get_current_user)):
    return APIResponse(data=UserResponse.model_validate(current_user))


@router.patch("/me", response_model=APIResponse[UserResponse])
def update_me(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = update_user(db, current_user, data)
    return APIResponse(data=UserResponse.model_validate(updated))


@router.get("/", response_model=PaginatedResponse[UserResponse])
def get_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),  # Super Admin / Data Engineer only
):
    skip = (page - 1) * size
    users, total = list_users(db, skip=skip, limit=size)
    return PaginatedResponse(
        data=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        size=size,
    )
