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
    FieldValidationError,
    NotFoundDomainError,
    ValidationDomainError,
)

# مقداردهی اولیه دیتابیس
init_db()

app = FastAPI(title="سیستم نوبت‌دهی آرایشگاه")

MISSING_FIELD_MESSAGES = {
    "date": "ارسال پارامتر تاریخ الزامی است.",
    "customer_name": "نام و نام خانوادگی نمی‌تواند خالی باشد.",
    "customer_phone": "وارد کردن شماره موبایل الزامی است.",
    "service_id": "انتخاب خدمت الزامی است.",
    "start_time": "انتخاب ساعت نوبت الزامی است.",
    "appointment_id": "شناسه نوبت الزامی است.",
}

INVALID_FIELD_MESSAGES = {
    "customer_name": "نام و نام خانوادگی باید بین ۲ تا ۵۰ کاراکتر باشد.",
    "customer_phone": "شماره موبایل باید ۱۱ رقم بوده و با ۰۹ شروع شود.",
    "service_id": "خدمت انتخابی معتبر نیست.",
    "date": "فرمت تاریخ نامعتبر است (باید دقیقاً به شکل YYYY-MM-DD باشد).",
    "start_time": "ساعت انتخابی نامعتبر است.",
    "appointment_id": "شناسه نوبت نامعتبر است.",
}


@app.exception_handler(DomainError)
async def domain_exception_handler(request: Request, exc: DomainError):
    """ترجمه‌ی خطاهای دامنه‌ی کسب‌وکار به پاسخ HTTP استاندارد"""
    if isinstance(exc, FieldValidationError):
        return JSONResponse(
            status_code=422,
            content={"detail": exc.message, "errors": exc.errors},
        )
    if isinstance(exc, NotFoundDomainError):
        return JSONResponse(status_code=404, content={"detail": exc.message})
    if isinstance(exc, (ValidationDomainError, ConflictDomainError)):
        return JSONResponse(status_code=400, content={"detail": exc.message})
    return JSONResponse(status_code=400, content={"detail": exc.message})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """مدیریت خطاهای اعتبارسنجی Pydantic و بازگرداندن کد 422 با پیام فارسی برای هر فیلد"""
    field_errors: dict[str, str] = {}

    for err in exc.errors():
        loc = err.get("loc", [])
        field = str(loc[-1]) if loc else "request"
        err_type = err.get("type", "")

        if field in field_errors:
            continue

        if err_type == "missing":
            field_errors[field] = MISSING_FIELD_MESSAGES.get(
                field, "این فیلد الزامی است."
            )
        else:
            field_errors[field] = INVALID_FIELD_MESSAGES.get(
                field, "مقدار واردشده نامعتبر است."
            )

    summary = next(iter(field_errors.values()), "داده‌های ورودی نامعتبر است.")
    return JSONResponse(
        status_code=422,
        content={"detail": summary, "errors": field_errors},
    )


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
