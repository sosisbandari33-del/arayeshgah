from pydantic import BaseModel, Field, field_validator


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
