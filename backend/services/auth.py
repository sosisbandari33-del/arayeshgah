import base64
import hashlib
import hmac
import json
import re
import secrets
import time

from config import get_settings
from database import (
    create_admin_user,
    get_admin_by_id,
    get_admin_by_phone,
    get_admin_count,
)
from services.appointments import PHONE_PATTERN, normalize_digits
from services.errors import FieldValidationError, UnauthorizedDomainError

PBKDF2_ITERATIONS = 600_000


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(encoded: str) -> bytes:
    padding = "=" * (-len(encoded) % 4)
    return base64.urlsafe_b64decode((encoded + padding).encode("ascii"))


def hash_password(password: str) -> str:
    """هش کردن امن رمز عبور با PBKDF2-HMAC-SHA256 و salt تصادفی"""
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """مقایسه‌ی امن رمز عبور ورودی با هش ذخیره‌شده"""
    try:
        scheme, iter_str, salt_hex, hash_hex = stored_hash.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        iterations = int(iter_str)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
    except (ValueError, TypeError):
        return False

    candidate = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )
    return hmac.compare_digest(candidate, expected)


def ensure_initial_admin():
    """ایجاد حساب اولیه‌ی مدیر از روی فایل تنظیمات (.env) در صورتی که مدیری وجود نداشته باشد"""
    if get_admin_count() > 0:
        return

    settings = get_settings()
    if not settings.admin_phone or not settings.admin_password:
        return

    clean_phone = re.sub(r"[\s-]+", "", normalize_digits(settings.admin_phone))
    if not PHONE_PATTERN.fullmatch(clean_phone):
        return

    create_admin_user(clean_phone, hash_password(settings.admin_password))


def create_access_token(admin_id: int, phone: str) -> str:
    """ساخت توکن امضاشده‌ی HMAC-SHA256 با زمان انقضا"""
    settings = get_settings()
    if not settings.auth_secret_key:
        raise UnauthorizedDomainError(
            "کلید امضای نشست در تنظیمات سرور (.env) تعریف نشده است."
        )

    payload = {
        "sub": admin_id,
        "phone": phone,
        "exp": int(time.time()) + settings.token_ttl_seconds,
    }
    payload_b64 = _b64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    signature = hmac.new(
        settings.auth_secret_key.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    sig_b64 = _b64url_encode(signature)
    return f"{payload_b64}.{sig_b64}"


def verify_access_token(token: str) -> dict:
    """بررسی امضا، تاریخ انقضا و وجود مدیر در دیتابیس"""
    settings = get_settings()
    if not settings.auth_secret_key:
        raise UnauthorizedDomainError("تنظیمات امنیتی سرور کامل نیست.")

    parts = (token or "").split(".")
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise UnauthorizedDomainError(
            "نشست کاری معتبر نیست. لطفاً دوباره وارد حساب مدیریت شوید."
        )

    payload_b64, sig_b64 = parts
    expected_sig = hmac.new(
        settings.auth_secret_key.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()

    try:
        provided_sig = _b64url_decode(sig_b64)
    except Exception as err:
        raise UnauthorizedDomainError(
            "نشست کاری معتبر نیست. لطفاً دوباره وارد حساب مدیریت شوید."
        ) from err

    if not hmac.compare_digest(provided_sig, expected_sig):
        raise UnauthorizedDomainError(
            "نشست کاری معتبر نیست. لطفاً دوباره وارد حساب مدیریت شوید."
        )

    try:
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        admin_id = int(payload["sub"])
        exp = int(payload["exp"])
    except Exception as err:
        raise UnauthorizedDomainError(
            "نشست کاری معتبر نیست. لطفاً دوباره وارد حساب مدیریت شوید."
        ) from err

    if exp <= int(time.time()):
        raise UnauthorizedDomainError(
            "نشست کاری شما منقضی شده است. لطفاً دوباره وارد شوید."
        )

    admin = get_admin_by_id(admin_id)
    if not admin:
        raise UnauthorizedDomainError(
            "حساب مدیریت معتبر نیست. لطفاً دوباره وارد شوید."
        )

    return {"id": admin["id"], "phone": admin["phone"]}


def login_admin_logic(phone: str, password: str) -> dict:
    """اعتبارسنجی ورودی ورود (422) و احراز هویت مدیر (401)"""
    field_errors: dict[str, str] = {}

    normalized_phone = normalize_digits((phone or "").strip())
    clean_phone = re.sub(r"[\s-]+", "", normalized_phone)
    if not clean_phone:
        field_errors["phone"] = "وارد کردن شماره موبایل الزامی است."
    elif not PHONE_PATTERN.fullmatch(clean_phone):
        field_errors["phone"] = "شماره موبایل باید ۱۱ رقم بوده و با ۰۹ شروع شود."

    if not password or not password.strip():
        field_errors["password"] = "وارد کردن رمز عبور الزامی است."

    if field_errors:
        raise FieldValidationError(field_errors)

    admin = get_admin_by_phone(clean_phone)
    if not admin or not verify_password(password, admin["password_hash"]):
        raise UnauthorizedDomainError("شماره موبایل یا رمز عبور اشتباه است.")

    access_token = create_access_token(admin["id"], admin["phone"])
    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "admin": {
            "id": admin["id"],
            "phone": admin["phone"],
        },
    }
