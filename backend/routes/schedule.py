from fastapi import APIRouter, Depends, status

from routes.auth import require_admin
from schemas import TimeOffCreateRequest, WorkingHoursUpdateRequest
from services.appointments import validate_strict_date_value
from services.schedule import (
    create_time_off_logic,
    delete_time_off_logic,
    list_time_offs_logic,
    list_working_hours_logic,
    update_working_hours_logic,
)

router = APIRouter(prefix="/api/admin", tags=["schedule"])


@router.get("/working-hours")
def get_admin_working_hours(_admin: dict = Depends(require_admin)):
    return list_working_hours_logic()


@router.put("/working-hours")
def put_admin_working_hours(
    payload: WorkingHoursUpdateRequest, _admin: dict = Depends(require_admin)
):
    return update_working_hours_logic([item.model_dump() for item in payload.days])


@router.get("/time-offs")
def get_admin_time_offs(_admin: dict = Depends(require_admin)):
    return list_time_offs_logic()


@router.post("/time-offs", status_code=status.HTTP_201_CREATED)
def post_admin_time_off(
    payload: TimeOffCreateRequest, _admin: dict = Depends(require_admin)
):
    return create_time_off_logic(
        date_str=payload.date,
        is_full_day=payload.is_full_day,
        start_time=payload.start_time,
        end_time=payload.end_time,
        reason=payload.reason,
        date_validator_fn=validate_strict_date_value,
    )


@router.delete("/time-offs/{time_off_id}")
def remove_admin_time_off(
    time_off_id: int, _admin: dict = Depends(require_admin)
):
    return delete_time_off_logic(time_off_id)
