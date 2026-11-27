from database import (
    create_service,
    delete_service,
    get_active_services,
    get_all_services_admin,
    get_service_by_id,
    get_service_by_name,
    service_has_appointments,
    set_service_active_status,
    update_service,
)
from services.errors import (
    FieldValidationError,
    NotFoundDomainError,
    ResourceConflictDomainError,
)


def _validate_service_fields(
    name: str, price: int, duration: int, exclude_service_id: int | None = None
) -> str:
    errors: dict[str, str] = {}

    clean_name = (name or "").strip()
    if not clean_name:
        errors["name"] = "نام خدمت نمی‌تواند خالی باشد."
    elif len(clean_name) < 2 or len(clean_name) > 80:
        errors["name"] = "نام خدمت باید بین ۲ تا ۸۰ کاراکتر باشد."
    else:
        existing_same_name = get_service_by_name(clean_name)
        if existing_same_name and existing_same_name["id"] != exclude_service_id:
            errors["name"] = "خدمتی با این نام قبلاً ثبت شده است."

    if isinstance(price, bool) or price <= 0:
        errors["price"] = "قیمت خدمت باید عددی بزرگ‌تر از صفر باشد."

    if isinstance(duration, bool) or duration < 1 or duration > 600:
        errors["duration"] = "مدت خدمت باید بین ۱ تا ۶۰۰ دقیقه باشد."

    if errors:
        raise FieldValidationError(errors)

    return clean_name


def list_services_logic():
    """برگرداندن لیست خدمات فعال برای مشتری (صفحه‌ی اصلی و فرم رزرو)"""
    return get_active_services()


def list_all_services_admin_logic():
    """برگرداندن همه‌ی خدمات (فعال و غیرفعال) برای پنل مدیریت"""
    return get_all_services_admin()


def create_service_logic(name: str, price: int, duration: int):
    """افزودن خدمت جدید توسط مدیر"""
    clean_name = _validate_service_fields(name, price, duration)
    created = create_service(clean_name, price, duration)
    return {
        "success": True,
        "message": "خدمت جدید با موفقیت اضافه شد.",
        "service": created,
    }


def update_service_logic(service_id: int, name: str, price: int, duration: int):
    """ویرایش نام، قیمت و مدت خدمت موجود توسط مدیر"""
    existing = get_service_by_id(service_id)
    if not existing:
        raise NotFoundDomainError("خدمت مورد نظر یافت نشد.")

    clean_name = _validate_service_fields(
        name, price, duration, exclude_service_id=service_id
    )
    updated = update_service(service_id, clean_name, price, duration)
    return {
        "success": True,
        "message": "اطلاعات خدمت با موفقیت ویرایش شد.",
        "service": updated,
    }


def set_service_status_logic(service_id: int, is_active: bool):
    """غیرفعال یا فعال کردن خدمت توسط مدیر"""
    existing = get_service_by_id(service_id)
    if not existing:
        raise NotFoundDomainError("خدمت مورد نظر یافت نشد.")

    updated = set_service_active_status(service_id, is_active)
    status_text = "فعال" if is_active else "غیرفعال"
    return {
        "success": True,
        "message": f"خدمت «{updated['name']}» با موفقیت {status_text} شد.",
        "service": updated,
    }


def delete_service_logic(service_id: int):
    """حذف خدمت بدون نوبت؛ خدمتی که نوبت دارد پاک نمی‌شود و فقط قابل غیرفعال‌سازی است"""
    existing = get_service_by_id(service_id)
    if not existing:
        raise NotFoundDomainError("خدمت مورد نظر یافت نشد.")

    if service_has_appointments(service_id):
        raise ResourceConflictDomainError(
            "این خدمت دارای نوبت ثبت‌شده است و پاک نمی‌شود؛ فقط می‌توانید آن را غیرفعال کنید."
        )

    delete_service(service_id)
    return {
        "success": True,
        "message": f"خدمت «{existing['name']}» با موفقیت حذف شد.",
    }
