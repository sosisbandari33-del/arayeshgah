from fastapi import APIRouter, Depends, Header

from schemas import AdminLoginRequest
from services.auth import login_admin_logic, verify_access_token
from services.errors import UnauthorizedDomainError

router = APIRouter(prefix="/api/auth", tags=["auth"])


def require_admin(authorization: str | None = Header(default=None)) -> dict:
    """وابستگی محافظ مسیرهای مدیریتی — رد هر درخواست بدون ورود با کد 401"""
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedDomainError(
            "برای دسترسی به بخش مدیریت باید ابتدا وارد حساب خود شوید."
        )
    token = authorization[len("Bearer ") :].strip()
    if not token:
        raise UnauthorizedDomainError(
            "برای دسترسی به بخش مدیریت باید ابتدا وارد حساب خود شوید."
        )
    return verify_access_token(token)


@router.post("/login")
def login_admin(payload: AdminLoginRequest):
    return login_admin_logic(phone=payload.phone, password=payload.password)


@router.get("/me")
def get_current_admin(admin: dict = Depends(require_admin)):
    return {"admin": admin}
