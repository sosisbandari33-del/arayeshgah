import re

from database import (
    get_admin_by_id,
    get_admin_by_phone,
    get_admin_full_by_id,
    get_all_app_settings,
    update_admin_credentials,
    upsert_app_settings,
)
from services.appointments import PHONE_PATTERN, normalize_digits
from services.auth import create_access_token, hash_password, verify_password
from services.errors import (
    FieldValidationError,
    NotFoundDomainError,
    ValidationDomainError,
)


def _format_settings_dict(raw: dict[str, str]) -> dict:
    return {
        "salon_name": raw.get("salon_name", ""),
        "cancel_deadline_hours": int(raw.get("cancel_deadline_hours", "0")),
    }


def get_public_settings_logic() -> dict:
    """خواندن نام آرایشگاه و مهلت لغو از دیتابیس برای نمایش عمومی به مشتریان"""
    return _format_settings_dict(get_all_app_settings())


def get_admin_settings_logic(admin_id: int) -> dict:
    """خواندن تنظیمات عمومی به همراه شماره موبایل فعلی مدیر از دیتابیس"""
    admin = get_admin_by_id(admin_id)
    if not admin:
        raise NotFoundDomainError("حساب مدیریت یافت نشد.")

    base = _format_settings_dict(get_all_app_settings())
    return {
        **base,
        "admin_phone": admin["phone"],
    }


def update_general_settings_logic(salon_name: str, cancel_deadline_hours: int) -> dict:
    """ذخیره‌ی نام آرایشگاه و مهلت لغو در دیتابیس"""
    errors: dict[str, str] = {}

    clean_name = (salon_name or "").strip()
    if not clean_name:
        errors["salon_name"] = "نام آرایشگاه نمی‌تواند خالی باشد."
    elif len(clean_name) < 2 or len(clean_name) > 80:
        errors["salon_name"] = "نام آرایشگاه باید بین ۲ تا ۸۰ کاراکتر باشد."

    if (
        isinstance(cancel_deadline_hours, bool)
        or cancel_deadline_hours < 0
        or cancel_deadline_hours > 168
    ):
        errors["cancel_deadline_hours"] = (
            "مهلت لغو نوبت باید عددی صحیح بین ۰ تا ۱۶۸ ساعت باشد."
        )

    if errors:
        raise FieldValidationError(errors)

    saved = upsert_app_settings(
        {
            "salon_name": clean_name,
            "cancel_deadline_hours": str(cancel_deadline_hours),
        }
    )

    return {
        "success": True,
        "message": "تنظیمات عمومی آرایشگاه با موفقیت ذخیره شد.",
        "settings": _format_settings_dict(saved),
    }


def update_admin_account_logic(
    admin_id: int,
    phone: str,
    current_password: str,
    new_password: str | None = None,
) -> dict:
    """
    تغییر شماره موبایل ورود و/یا رمز عبور مدیر:
    - وارد کردن رمز عبور فعلی در تمام حالت‌ها الزامی است و با هش فعلی چک می‌شود.
    - در صورت وارد کردن رمز جدید، رمز جدید هش و جایگزین می‌گردد.
    """
    admin_row = get_admin_full_by_id(admin_id)
    if not admin_row:
        raise NotFoundDomainError("حساب مدیریت یافت نشد.")

    errors: dict[str, str] = {}

    normalized_phone = normalize_digits((phone or "").strip())
    clean_phone = re.sub(r"[\s-]+", "", normalized_phone)
    if not clean_phone:
        errors["phone"] = "وارد کردن شماره موبایل الزامی است."
    elif not PHONE_PATTERN.fullmatch(clean_phone):
        errors["phone"] = "شماره موبایل باید ۱۱ رقم بوده و با ۰۹ شروع شود."
    else:
        existing_other = get_admin_by_phone(clean_phone)
        if existing_other and existing_other["id"] != admin_id:
            errors["phone"] = "این شماره موبایل قبلاً ثبت شده است."

    if not current_password or not current_password.strip():
        errors["current_password"] = "وارد کردن رمز عبور فعلی الزامی است."

    clean_new_pw = new_password if (new_password and new_password.strip()) else None
    if new_password is not None and new_password != "" and clean_new_pw is None:
        errors["new_password"] = "رمز عبور جدید نمی‌تواند فقط فاصله باشد."
    elif clean_new_pw is not None and len(clean_new_pw) < 4:
        errors["new_password"] = "رمز عبور جدید باید حداقل ۴ کاراکتر باشد."

    if errors:
        raise FieldValidationError(errors)

    if not verify_password(current_password, admin_row["password_hash"]):
        raise ValidationDomainError("رمز عبور فعلی اشتباه است.")

    new_hash = hash_password(clean_new_pw) if clean_new_pw is not None else None
    updated_admin = update_admin_credentials(
        admin_id=admin_id,
        new_phone=clean_phone,
        new_password_hash=new_hash,
    )
    fresh_token = create_access_token(updated_admin["id"], updated_admin["phone"])

    return {
        "success": True,
        "message": "اطلاعات ورود مدیر با موفقیت به‌روزرسانی شد.",
        "admin": {
            "id": updated_admin["id"],
            "phone": updated_admin["phone"],
        },
        "access_token": fresh_token,
    }
