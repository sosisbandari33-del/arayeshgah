from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import init_db
from routes.appointments import router as appointments_router
from routes.health import router as health_router
from routes.services import router as services_router
from services.errors import (
    ConflictDomainError,
    DomainError,
    NotFoundDomainError,
    ValidationDomainError,
)

# مقداردهی اولیه دیتابیس
init_db()

app = FastAPI(title="سیستم نوبت‌دهی آرایشگاه")


@app.exception_handler(DomainError)
async def domain_exception_handler(request: Request, exc: DomainError):
    """ترجمه‌ی خطاهای دامنه‌ی کسب‌وکار به پاسخ HTTP استاندارد"""
    if isinstance(exc, NotFoundDomainError):
        status_code = 404
    elif isinstance(exc, (ValidationDomainError, ConflictDomainError)):
        status_code = 400
    else:
        status_code = 400
    return JSONResponse(status_code=status_code, content={"detail": exc.message})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """مدیریت خطاهای اعتبارسنجی ورودی Pydantic و بازگرداندن پیام فارسی شفاف"""
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

# ثبت روترهای دریافت درخواست HTTP
app.include_router(health_router)
app.include_router(services_router)
app.include_router(appointments_router)
