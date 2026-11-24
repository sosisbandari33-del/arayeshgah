from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, date as dt_date, time as dt_time
import re
import sqlite3

from database import (
    init_db,
    get_all_services,
    get_service_by_id,
    get_booked_slots,
    create_appointment,
    get_appointments_by_date,
    get_appointment_by_id,
    cancel_appointment,
)

# مقداردهی اولیه دیتابیس
init_db()

app = FastAPI(title="سیستم نوبت‌دهی آرایشگاه")

DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
PHONE_PATTERN = re.compile(r"^09\d{9}$")


# مدیریت خطاهای اعتبارسنجی ورودی Pydantic و بازگرداندن پیام فارسی شفاف
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = "داده‌های ورودی نامعتبر است."
    if errors:
        first = errors[0]
        loc = first.get("loc", [])
        field = loc[-1] if loc else ""
        err_type = first.get("type", "")

        if err_type == "missing":
            missing_messages = {
                "date": "ارسال پارامتر تاریخ الزامی است.",
                "customer_name": "وارد کردن نام و نام خانوادگی الزامی است.",
                "customer_phone": "وارد کردن شماره موبایل الزامی است.",
                "service_id": "انتخاب خدمت الزامی است.",
                "start_time": "انتخاب ساعت نوبت الزامی است.",
            }
            msg = missing_messages.get(field, "برخی فیلدهای الزامی ارسال نشده‌اند.")
        elif field == "customer_name":
            msg = "نام و نام خانوادگی باید بین ۲ تا ۵۰ کاراکتر باشد و نمی‌تواند فقط فاصله باشد."
        elif field == "customer_phone":
            msg = "شماره موبایل نامعتبر است."
        elif field == "service_id":
            msg = "خدمت انتخابی نامعتبر است."
        elif field == "date":
            msg = "فرمت تاریخ نامعتبر است (باید YYYY-MM-DD باشد)."
        elif field == "start_time":
            msg = "ساعت انتخابی نامعتبر است."
        elif field == "appointment_id":
            msg = "شناسه نوبت نامعتبر است."
        elif "min_length" in err_type:
            msg = f"طول فیلد {field} کمتر از حد مجاز است."
        elif "max_length" in err_type:
            msg = f"طول فیلد {field} بیشتر از حد مجاز است."

    return JSONResponse(status_code=400, content={"detail": msg})


# تنظیمات استاندارد CORS برای دسترسی فرانت‌اند محلی
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        raise HTTPException(
            status_code=400,
            detail="فرمت تاریخ نامعتبر است (باید دقیقاً به شکل YYYY-MM-DD باشد).",
        )
    try:
        parsed = datetime.strptime(clean_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="تاریخ واردشده معتبر نیست.",
        )
    return parsed, parsed.strftime("%Y-%m-%d")


class AppointmentCreate(BaseModel):
    customer_name: str = Field(..., min_length=2, max_length=50, description="نام و نام خانوادگی مشتری")
    customer_phone: str = Field(..., description="شماره موبایل مشتری")
    service_id: int = Field(..., description="شناسه خدمت انتخابی")
    date: str = Field(..., description="تاریخ نوبت با فرمت YYYY-MM-DD")
    start_time: str = Field(..., description="ساعت نوبت با فرمت HH:MM")

    @field_validator("customer_name", mode="before")
    @classmethod
    def strip_customer_name(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value


@app.get("/api/test")
def test_endpoint():
    return {"message": "سلام، بک‌اند کار می‌کند"}


@app.get("/api/services")
def list_services():
    return get_all_services()


@app.get("/api/slots")
def get_daily_slots(date: str):
    """لیست بازه‌های زمانی و وضعیت پر یا خالی بودن آن‌ها برای یک روز مشخص"""
    selected_date, normalized_date = parse_strict_date(date)

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


@app.post("/api/appointments")
def book_appointment(appointment_data: AppointmentCreate):
    # اعتبارسنجی مستقل نام: حذف فاصله‌ها و بررسی سقف و کف طول نام
    name = appointment_data.customer_name.strip()
    if len(name) < 2 or len(name) > 50:
        raise HTTPException(
            status_code=400,
            detail="نام و نام خانوادگی باید بین ۲ تا ۵۰ کاراکتر باشد و نمی‌تواند فقط فاصله باشد.",
        )

    # اعتبارسنجی شماره موبایل (پشتیبانی از ارقام فارسی، عربی، فاصله و خط‌تیره؛ رد کاراکترهای غیررقمی)
    normalized_phone = normalize_digits(appointment_data.customer_phone.strip())
    clean_phone = re.sub(r"[\s-]+", "", normalized_phone)
    if not PHONE_PATTERN.fullmatch(clean_phone):
        raise HTTPException(
            status_code=400,
            detail="شماره موبایل نامعتبر است (باید ۱۱ رقمی و با ۰۹ شروع شود و شامل حروف نباشد).",
        )

    # اعتبارسنجی خدمت
    service = get_service_by_id(appointment_data.service_id)
    if not service:
        raise HTTPException(status_code=404, detail="خدمت انتخابی معتبر نیست.")

    # اعتبارسنجی قانون R1: بازه‌های ۳۰ دقیقه‌ای بین ۱۰ تا ۲۰
    if appointment_data.start_time not in WORKING_SLOTS:
        raise HTTPException(
            status_code=400,
            detail="ساعت انتخابی خارج از ساعات کاری (۱۰ تا ۲۰) یا بازه‌های ۳۰ دقیقه‌ای است.",
        )

    # اعتبارسنجی دقیق تاریخ و استانداردسازی به YYYY-MM-DD
    app_date, normalized_date = parse_strict_date(appointment_data.date)
    hour, minute = map(int, appointment_data.start_time.split(":"))
    app_datetime = datetime.combine(app_date, dt_time(hour, minute))

    # اعتبارسنجی قانون R3: عدم ثبت نوبت در گذشته
    if app_datetime < datetime.now():
        raise HTTPException(
            status_code=400,
            detail="امکان ثبت نوبت برای زمان‌های گذشته وجود ندارد.",
        )

    # اعتبارسنجی قانون R2: تداخل نوبت
    booked_slots = get_booked_slots(normalized_date)
    if appointment_data.start_time in booked_slots:
        raise HTTPException(
            status_code=400,
            detail="این بازه زمانی قبلاً رزرو شده است. لطفاً ساعت دیگری را انتخاب کنید.",
        )

    # ثبت در دیتابیس (همراه با محافظت از تداخل همزمانی دو رزرو هم‌زمان)
    try:
        saved = create_appointment(
            customer_name=name,
            customer_phone=clean_phone,
            service_id=service["id"],
            service_name=service["name"],
            date=normalized_date,
            start_time=appointment_data.start_time,
        )
    except sqlite3.IntegrityError as err:
        if "UNIQUE constraint failed" in str(err) or "idx_unique_active_slot" in str(err):
            raise HTTPException(
                status_code=400,
                detail="این بازه زمانی همین چند لحظه پیش توسط مشتری دیگری رزرو شد. لطفاً ساعت دیگری را انتخاب کنید.",
            )
        raise HTTPException(status_code=400, detail="خطا در ذخیره‌سازی اطلاعات نوبت.")

    return {
        "success": True,
        "message": "نوبت شما با موفقیت ثبت شد.",
        "appointment": saved,
    }


@app.get("/api/appointments")
def list_appointments(date: str):
    """برگرداندن لیست نوبت‌های یک روز مشخص مرتب شده بر اساس ساعت"""
    _, normalized_date = parse_strict_date(date)
    return get_appointments_by_date(normalized_date)


@app.patch("/api/appointments/{appointment_id}/cancel")
def cancel_appointment_endpoint(appointment_id: int):
    """لغو نوبت طبق قانون R4 (تغییر وضعیت به 'لغو شده' بدون حذف رکورد)"""
    existing = get_appointment_by_id(appointment_id)
    if not existing:
        raise HTTPException(status_code=404, detail="نوبت مورد نظر یافت نشد.")

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
