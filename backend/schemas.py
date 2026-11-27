from pydantic import BaseModel, Field


class AppointmentCreate(BaseModel):
    customer_name: str = Field(..., description="نام و نام خانوادگی مشتری")
    customer_phone: str = Field(..., description="شماره موبایل مشتری")
    service_id: int = Field(..., description="شناسه خدمت انتخابی")
    date: str = Field(..., description="تاریخ نوبت با فرمت YYYY-MM-DD")
    start_time: str = Field(..., description="ساعت نوبت با فرمت HH:MM")


class AdminLoginRequest(BaseModel):
    phone: str = Field(..., description="شماره موبایل مدیر")
    password: str = Field(..., description="رمز عبور مدیر")


class ServiceUpsertRequest(BaseModel):
    name: str = Field(..., description="نام خدمت")
    price: int = Field(..., description="قیمت خدمت به تومان")
    duration: int = Field(..., description="مدت زمان خدمت به دقیقه")


class ServiceStatusRequest(BaseModel):
    is_active: bool = Field(..., description="وضعیت فعال یا غیرفعال بودن خدمت")
