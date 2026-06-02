from pydantic import EmailStr

from .base import OurBaseModel


class UserCreate(OurBaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None


class UserUpdate(OurBaseModel):
    full_name: str | None = None


class UserResponse(OurBaseModel):
    id: int
    email: str
    full_name: str | None = None
    is_active: bool
