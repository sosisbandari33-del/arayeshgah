from datetime import datetime, date as dt_date, time as dt_time
import re
import sqlite3

from database import (
    get_service_by_id,
    get_booked_slots,
    create_appointment,
    get_appointments_by_date,
    get_appointment_by_id,
    cancel_appointment,
)
from services.errors import (
    ConflictDomainError,
    FieldValidationError,
    NotFoundDomainError,
    ValidationDomainError,
)

DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
PHONE_PATTERN = re.compile(r"^09\d{9}$")

# بازه‌های کاری ۳۰ دقیقه‌ای از ساعت ۱۰:۰۰ الی ۲۰:۰۰ (طبق قانون R1)
WORKING_SLOTS = [
    "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30",
    "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30",
    "18:00", "18:30", "19:00", "19:30",
]


def normalize_digits(text: str) -> str:
    """تبدیل اعداد فارسی و عربی به اعداد انگلیسی"""
    persian_digits = "۰۱۲۳۴۵۶۷۸۹"
    arabic_digits = "٠١٢٣٤٥٦٧٨٩"
    for i in range(10):
        text = text.replace(persian_digits[i], str(i)).replace(arabic_digits[i], str(i))
    return text


def validate_strict_date_value(date_str: str) -> tuple[dt_date | None, str | None, str | None]:
    """بررسی دقیق فرمت YYYY-MM-DD (با صفر پیشوند) و معتبر بودن تاریخ تقویمی"""
    clean_date = normalize_digits((date_str or "").strip())
    if not clean_date:
        return None, None, "وارد کردن تاریخ الزامی است."
    if not DATE_PATTERN.match(clean_date):
        return None, None, "فرمت تاریخ نامعتبر است (باید دقیقاً به شکل YYYY-MM-DD باشد)."
    try:
        parsed = datetime.strptime(clean_date, "%Y-%m-%d").date()
    except ValueError:
        return None, None, "تاریخ واردشده معتبر نیست."
    return parsed, parsed.strftime("%Y-%m-%d"), None


def parse_strict_date(date_str: str) -> tuple[dt_date, str]:
    """اعتبارسنجی تاریخ و پرتاب FieldValidationError برای فیلد date"""
    parsed, normalized, err_msg = validate_strict_date_value(date_str)
    if err_msg or parsed is None or normalized is None:
        raise FieldValidationError({"date": err_msg or "تاریخ واردشده معتبر نیست."})
    return parsed, normalized


def get_daily_slots_logic(date_str: str):
    """محاسبه‌ی وضعیت آزاد، رزروشده و گذشته بودن بازه‌های یک روز"""
    selected_date, normalized_date = parse_strict_date(date_str)
    booked = get_booked_slots(normalized_date)
    now = datetime.now()

    slots_status = []
    for slot in WORKING_SLOTS:
        slot_hour, slot_minute = map(int, slot.split(":"))
        slot_datetime = datetime.combine(selected_date, dt_time(slot_hour, slot_minute))

        # بررسی قانون R3: آیا زمان در گذشته است؟
        is_past = slot_datetime < now
        is_booked = slot in booked

        slots_status.append({
            "time": slot,
            "is_available": (not is_booked) and (not is_past),
            "is_booked": is_booked,
            "is_past": is_past,
        })

    return {
        "date": normalized_date,
        "slots": slots_status,
    }


def book_appointment_logic(
    customer_name: str,
    customer_phone: str,
    service_id: int,
    date_str: str,
    start_time: str,
):
    """اعتبارسنجی مستقل همه‌ی ورودی‌ها (با خطای فیلدبه‌فیلد 422) و اعمال قوانین کسب‌وکار"""
    field_errors: dict[str, str] = {}

    # ۱. اعتبارسنجی نام مشتری (قانون R10: خالی نباشد، بین ۲ تا ۵۰ کاراکتر)
    name = (customer_name or "").strip()
    if not name:
        field_errors["customer_name"] = "نام و نام خانوادگی نمی‌تواند خالی باشد."
    elif len(name) < 2 or len(name) > 50:
        field_errors["customer_name"] = "نام و نام خانوادگی باید بین ۲ تا ۵۰ کاراکتر باشد."

    # ۲. اعتبارسنجی شماره موبایل (قانون R10: ۱۱ رقم و با ۰۹ شروع شود، پشتیبانی از ارقام فارسی/عربی)
    normalized_phone = normalize_digits((customer_phone or "").strip())
    clean_phone = re.sub(r"[\s-]+", "", normalized_phone)
    if not clean_phone:
        field_errors["customer_phone"] = "وارد کردن شماره موبایل الزامی است."
    elif not PHONE_PATTERN.fullmatch(clean_phone):
        field_errors["customer_phone"] = "شماره موبایل باید ۱۱ رقم بوده و با ۰۹ شروع شود."

    # ۳. اعتبارسنجی خدمت انتخابی
    service = get_service_by_id(service_id)
    if not service:
        field_errors["service_id"] = "خدمت انتخابی معتبر نیست."

    # ۴. اعتبارسنجی تاریخ
    app_date, normalized_date, date_err = validate_strict_date_value(date_str)
    if date_err:
        field_errors["date"] = date_err

    # ۵. اعتبارسنجی ساعت انتخابی (قانون R1)
    clean_time = (start_time or "").strip()
    if not clean_time:
        field_errors["start_time"] = "انتخاب ساعت نوبت الزامی است."
    elif clean_time not in WORKING_SLOTS:
        field_errors["start_time"] = "ساعت انتخابی خارج از ساعات کاری (۱۰ تا ۲۰) یا بازه‌های ۳۰ دقیقه‌ای است."

    if field_errors:
        raise FieldValidationError(field_errors)

    assert app_date is not None and normalized_date is not None and service is not None

    hour, minute = map(int, clean_time.split(":"))
    app_datetime = datetime.combine(app_date, dt_time(hour, minute))

    # اعتبارسنجی قانون R3: عدم ثبت نوبت در گذشته
    if app_datetime < datetime.now():
        raise ValidationDomainError("امکان ثبت نوبت برای زمان‌های گذشته وجود ندارد.")

    # اعتبارسنجی قانون R2: تداخل نوبت
    booked_slots = get_booked_slots(normalized_date)
    if clean_time in booked_slots:
        raise ConflictDomainError(
            "این بازه زمانی قبلاً رزرو شده است. لطفاً ساعت دیگری را انتخاب کنید."
        )

    # ثبت در دیتابیس (همراه با محافظت از تداخل همزمانی)
    try:
        saved = create_appointment(
            customer_name=name,
            customer_phone=clean_phone,
            service_id=service["id"],
            service_name=service["name"],
            date=normalized_date,
            start_time=clean_time,
        )
    except sqlite3.IntegrityError as err:
        if "UNIQUE constraint failed" in str(err) or "idx_unique_active_slot" in str(err):
            raise ConflictDomainError(
                "این بازه زمانی همین چند لحظه پیش توسط مشتری دیگری رزرو شد. لطفاً ساعت دیگری را انتخاب کنید."
            ) from err
        raise ValidationDomainError("خطا در ذخیره‌سازی اطلاعات نوبت.") from err

    return {
        "success": True,
        "message": "نوبت شما با موفقیت ثبت شد.",
        "appointment": saved,
    }


def list_appointments_logic(date_str: str):
    """برگرداندن لیست نوبت‌های یک روز مشخص مرتب‌شده بر اساس ساعت"""
    _, normalized_date = parse_strict_date(date_str)
    return get_appointments_by_date(normalized_date)


def cancel_appointment_logic(appointment_id: int):
    """لغو نوبت طبق قانون R4 (تغییر وضعیت به 'لغو شده' بدون حذف رکورد)"""
    existing = get_appointment_by_id(appointment_id)
    if not existing:
        raise NotFoundDomainError("نوبت مورد نظر یافت نشد.")

    if existing["status"] == "لغو شده":
        return {
            "success": True,
            "message": "این نوبت قبلاً لغو شده است.",
            "appointment": existing,
        }

    updated = cancel_appointment(appointment_id)
    return {
        "success": True,
        "message": "نوبت با موفقیت لغو شد و بازه زمانی آن آزاد گردید.",
        "appointment": updated,
    }
