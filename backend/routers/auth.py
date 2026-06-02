from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from core.database import get_db
from schemas.response import APIResponse
from schemas.token import RefreshRequest, TokenResponse
from schemas.user import UserCreate
from services.user.auth_service import login, refresh_tokens, register

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=APIResponse[TokenResponse])
def register_user(data: UserCreate, db: Session = Depends(get_db)):
    tokens = register(db, data)
    return APIResponse(data=tokens, message="Registered successfully")


@router.post("/login", response_model=APIResponse[TokenResponse])
def login_user(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    tokens = login(db, form.username, form.password)
    return APIResponse(data=tokens, message="Login successful")


@router.post("/refresh", response_model=APIResponse[TokenResponse])
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    tokens = refresh_tokens(db, body.refresh_token)
    return APIResponse(data=tokens)
