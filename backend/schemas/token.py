from .base import OurBaseModel


class TokenResponse(OurBaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(OurBaseModel):
    refresh_token: str
