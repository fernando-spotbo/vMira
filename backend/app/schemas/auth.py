from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, pattern=r"^\+7\d{10}$")  # Russian phone: +7XXXXXXXXXX
    password: str = Field(..., min_length=8, max_length=128)
    consent_personal_data: bool = Field(..., description="152-FZ: separate consent for personal data processing")


class LoginRequest(BaseModel):
    email: EmailStr | None = None
    phone: str | None = None
    password: str


class PhoneSmsRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\+7\d{10}$")


class PhoneVerifyRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\+7\d{10}$")
    code: str = Field(..., min_length=4, max_length=6)


class VkAuthRequest(BaseModel):
    code: str
    redirect_uri: str
    state: str  # CSRF state token


class YandexAuthRequest(BaseModel):
    code: str
    state: str  # CSRF state token


class GoogleAuthRequest(BaseModel):
    credential: str  # Google ID token


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(..., min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UpdateUserRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    language: str | None = Field(default=None, pattern=r"^(ru|en)$")


class UserResponse(BaseModel):
    id: str
    name: str
    email: str | None
    phone: str | None
    avatar_url: str | None
    plan: str
    language: str
    created_at: str

    model_config = {"from_attributes": True}
