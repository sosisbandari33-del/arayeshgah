from pydantic import BaseModel, Field


class AppointmentCreate(BaseModel):
    customer_name: str = Field(..., description="نام و نام خانوادگی مشتری")
    customer_phone: str = Field(..., description="شماره موبایل مشتری")
    service_id: int = Field(..., description="شناسه خدمت انتخابی")
    date: str = Field(..., description="تاریخ نوبت با فرمت YYYY-MM-DD")
    start_time: str = Field(..., description="ساعت نوبت با فرمت HH:MM")
