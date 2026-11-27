from pydantic import BaseModel, Field


class AppointmentCreate(BaseModel):
    customer_name: str = Field(..., description="نام و نام خانوادگی مشتری")
    customer_phone: str = Field(..., description="شماره موبایل مشتری")
    service_ids: list[int] | None = Field(default=None, description="فهرست شناسه‌های خدمات انتخابی")
    service_id: int | None = Field(default=None, description="شناسه خدمت انتخابی (سازگاری تک‌خدمت)")
    date: str = Field(..., description="تاریخ نوبت با فرمت YYYY-MM-DD")
    start_time: str = Field(..., description="ساعت نوبت با فرمت HH:MM")


class AppointmentTrackingRequest(BaseModel):
    customer_phone: str = Field(..., description="شماره موبایل مشتری")
    tracking_code: str = Field(..., description="کد پیگیری ۶ رقمی نوبت")


class AdminLoginRequest(BaseModel):
    phone: str = Field(..., description="شماره موبایل مدیر")
    password: str = Field(..., description="رمز عبور مدیر")


class ServiceUpsertRequest(BaseModel):
    name: str = Field(..., description="نام خدمت")
    price: int = Field(..., description="قیمت خدمت به تومان")
    duration: int = Field(..., description="مدت زمان خدمت به دقیقه")


class ServiceStatusRequest(BaseModel):
    is_active: bool = Field(..., description="وضعیت فعال یا غیرفعال بودن خدمت")


class WorkingHourDayItem(BaseModel):
    day_of_week: int = Field(..., description="روز هفته: ۰=شنبه تا ۶=جمعه")
    start_time: str = Field(..., description="ساعت شروع با فرمت HH:MM")
    end_time: str = Field(..., description="ساعت پایان با فرمت HH:MM")
    is_closed: bool = Field(..., description="آیا این روز هفته تعطیل است؟")


class WorkingHoursUpdateRequest(BaseModel):
    days: list[WorkingHourDayItem] = Field(..., description="لیست تنظیمات ۷ روز هفته")


class TimeOffCreateRequest(BaseModel):
    date: str = Field(..., description="تاریخ تعطیلی یا مرخصی با فرمت YYYY-MM-DD")
    is_full_day: bool = Field(default=False, description="آیا کل روز تعطیل است؟")
    start_time: str | None = Field(default=None, description="ساعت شروع مرخصی ساعتی (HH:MM)")
    end_time: str | None = Field(default=None, description="ساعت پایان مرخصی ساعتی (HH:MM)")
    reason: str = Field(default="", description="توضیح اختیاری")
