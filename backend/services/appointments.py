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


def parse_strict_date(date_str: str) -> tuple[dt_date, str]:
    """اعتبارسنجی دقیق فرمت YYYY-MM-DD (با صفر پیشوند) و بازگرداندن تاریخ استاندارد"""
    clean_date = normalize_digits((date_str or "").strip())
    if not DATE_PATTERN.match(clean_date):
        raise ValidationDomainError(
            "فرمت تاریخ نامعتبر است (باید دقیقاً به شکل YYYY-MM-DD باشد)."
        )
    try:
        parsed = datetime.strptime(clean_date, "%Y-%m-%d").date()
    except ValueError as err:
        raise ValidationDomainError("تاریخ واردشده معتبر نیست.") from err
    return parsed, parsed.strftime("%Y-%m-%d")


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
    """اعتبارسنجی مستقل قوانین کسب‌وکار و ثبت نوبت جدید"""
    name = customer_name.strip()
    if len(name) < 2 or len(name) > 50:
        raise ValidationDomainError(
            "نام و نام خانوادگی باید بین ۲ تا ۵۰ کاراکتر باشد و نمی‌تواند فقط فاصله باشد."
        )

    normalized_phone = normalize_digits(customer_phone.strip())
    clean_phone = re.sub(r"[\s-]+", "", normalized_phone)
    if not PHONE_PATTERN.fullmatch(clean_phone):
        raise ValidationDomainError(
            "شماره موبایل نامعتبر است (باید ۱۱ رقمی و با ۰۹ شروع شود و شامل حروف نباشد)."
        )

    service = get_service_by_id(service_id)
    if not service:
        raise NotFoundDomainError("خدمت انتخابی معتبر نیست.")

    # اعتبارسنجی قانون R1: بازه‌های ۳۰ دقیقه‌ای بین ۱۰ تا ۲۰
    if start_time not in WORKING_SLOTS:
        raise ValidationDomainError(
            "ساعت انتخابی خارج از ساعات کاری (۱۰ تا ۲۰) یا بازه‌های ۳۰ دقیقه‌ای است."
        )

    # اعتبارسنجی دقیق تاریخ و استانداردسازی به YYYY-MM-DD
    app_date, normalized_date = parse_strict_date(date_str)
    hour, minute = map(int, start_time.split(":"))
    app_datetime = datetime.combine(app_date, dt_time(hour, minute))

    # اعتبارسنجی قانون R3: عدم ثبت نوبت در گذشته
    if app_datetime < datetime.now():
        raise ValidationDomainError("امکان ثبت نوبت برای زمان‌های گذشته وجود ندارد.")

    # اعتبارسنجی قانون R2: تداخل نوبت
    booked_slots = get_booked_slots(normalized_date)
    if start_time in booked_slots:
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
            start_time=start_time,
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
