from fastapi import APIRouter, Depends

from routes.auth import require_admin
from schemas import AppointmentCreate
from services.appointments import (
    book_appointment_logic,
    cancel_appointment_logic,
    get_daily_slots_logic,
    list_appointments_logic,
)

router = APIRouter(prefix="/api", tags=["appointments"])


@router.get("/slots")
def get_daily_slots(date: str):
    return get_daily_slots_logic(date)


@router.post("/appointments")
def book_appointment(appointment_data: AppointmentCreate):
    return book_appointment_logic(
        customer_name=appointment_data.customer_name,
        customer_phone=appointment_data.customer_phone,
        service_id=appointment_data.service_id,
        date_str=appointment_data.date,
        start_time=appointment_data.start_time,
    )


@router.get("/appointments")
def list_appointments(date: str, _admin: dict = Depends(require_admin)):
    return list_appointments_logic(date)


@router.patch("/appointments/{appointment_id}/cancel")
def cancel_appointment_endpoint(
    appointment_id: int, _admin: dict = Depends(require_admin)
):
    return cancel_appointment_logic(appointment_id)
