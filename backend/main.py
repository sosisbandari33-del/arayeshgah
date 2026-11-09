from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import datetime, date as dt_date, time as dt_time
import re

from database import (
    init_db, 
    get_all_services, 
    get_service_by_id, 
    get_booked_slots, 
    create_appointment,
    get_appointments_by_date,
    get_appointment_by_id,
    cancel_appointment
)

# مقداردهی اولیه دیتابیس
init_db()

app = FastAPI(title="سیستم نوبت‌دهی آرایشگاه")

# تنظیمات CORS برای دسترسی فرانت‌اند
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# بازه‌های کاری ۳۰ دقیقه‌ای از ساعت ۱۰:۰۰ الی ۲۰:۰۰ (طبق قانون R1)
WORKING_SLOTS = [
    "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30",
    "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30",
    "18:00", "18:30", "19:00", "19:30"
]

class AppointmentCreate(BaseModel):
    customer_name: str = Field(..., min_length=2, description="نام و نام خانوادگی مشتری")
    customer_phone: str = Field(..., description="شماره موبایل مشتری")
    service_id: int = Field(..., description="شناسه خدمت انتخابی")
    date: str = Field(..., description="تاریخ نوبت با فرمت YYYY-MM-DD")
    start_time: str = Field(..., description="ساعت نوبت با فرمت HH:MM")

@app.get("/api/test")
def test_endpoint():
    return {"message": "سلام، بک‌اند کار می‌کند"}

@app.get("/api/services")
def list_services():
    return get_all_services()

@app.get("/api/slots")
def get_daily_slots(date: str):
    """لیست بازه‌های زمانی و وضعیت پر یا خالی بودن آن‌ها برای یک روز مشخص"""
    try:
        selected_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="فرمت تاریخ نامعتبر است (باید YYYY-MM-DD باشد).")

    booked = get_booked_slots(date)
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
            "is_past": is_past
        })

    return {
        "date": date,
        "slots": slots_status
    }

@app.post("/api/appointments")
def book_appointment(appointment_data: AppointmentCreate):
    name = appointment_data.customer_name.strip()
    phone = appointment_data.customer_phone.strip()

    # اعتبارسنجی شماره موبایل
    clean_phone = re.sub(r"[^\d]", "", phone)
    if not (len(clean_phone) == 11 and clean_phone.startswith("09")):
        raise HTTPException(
            status_code=400, 
            detail="شماره موبایل نامعتبر است (باید ۱۱ رقمی و با ۰۹ شروع شود)."
        )

    # اعتبارسنجی خدمت
    service = get_service_by_id(appointment_data.service_id)
    if not service:
        raise HTTPException(status_code=404, detail="خدمت انتخابی معتبر نیست.")

    # اعتبارسنجی قانون R1: بازه‌های ۳۰ دقیقه‌ای بین ۱۰ تا ۲۰
    if appointment_data.start_time not in WORKING_SLOTS:
        raise HTTPException(
            status_code=400, 
            detail="ساعت انتخابی خارج از ساعات کاری (۱۰ تا ۲۰) یا بازه‌های ۳۰ دقیقه‌ای است."
        )

    # اعتبارسنجی تاریخ
    try:
        app_date = datetime.strptime(appointment_data.date, "%Y-%m-%d").date()
        hour, minute = map(int, appointment_data.start_time.split(":"))
        app_datetime = datetime.combine(app_date, dt_time(hour, minute))
    except ValueError:
        raise HTTPException(status_code=400, detail="فرمت تاریخ یا ساعت نامعتبر است.")

    # اعتبارسنجی قانون R3: عدم ثبت نوبت در گذشته
    if app_datetime < datetime.now():
        raise HTTPException(
            status_code=400, 
            detail="امکان ثبت نوبت برای زمان‌های گذشته وجود ندارد."
        )

    # اعتبارسنجی قانون R2: تداخل نوبت
    booked_slots = get_booked_slots(appointment_data.date)
    if appointment_data.start_time in booked_slots:
        raise HTTPException(
            status_code=400, 
            detail="این بازه زمانی قبلاً رزرو شده است. لطفاً ساعت دیگری را انتخاب کنید."
        )

    # ثبت در دیتابیس
    saved = create_appointment(
        customer_name=name,
        customer_phone=clean_phone,
        service_id=service["id"],
        service_name=service["name"],
        date=appointment_data.date,
        start_time=appointment_data.start_time
    )

    return {
        "success": True,
        "message": "نوبت شما با موفقیت ثبت شد.",
        "appointment": saved
    }

@app.get("/api/appointments")
def list_appointments(date: str):
    """برگرداندن لیست نوبت‌های یک روز مشخص مرتب شده بر اساس ساعت"""
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="فرمت تاریخ نامعتبر است (باید YYYY-MM-DD باشد).")

    return get_appointments_by_date(date)

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
            "appointment": existing
        }

    updated = cancel_appointment(appointment_id)
    return {
        "success": True,
        "message": "نوبت با موفقیت لغو شد و بازه زمانی آن آزاد گردید.",
        "appointment": updated
    }
