from fastapi import APIRouter, Depends

from routes.auth import require_admin
from schemas import AdminAccountUpdateRequest, GeneralSettingsUpdateRequest
from services.settings import (
    get_admin_settings_logic,
    get_public_settings_logic,
    update_admin_account_logic,
    update_general_settings_logic,
)

router = APIRouter(prefix="/api", tags=["settings"])


@router.get("/settings/public")
def get_public_settings():
    return get_public_settings_logic()


@router.get("/admin/settings")
def get_admin_settings(admin: dict = Depends(require_admin)):
    return get_admin_settings_logic(admin_id=admin["id"])


@router.put("/admin/settings")
def update_general_settings(
    payload: GeneralSettingsUpdateRequest,
    _admin: dict = Depends(require_admin),
):
    return update_general_settings_logic(
        salon_name=payload.salon_name,
        cancel_deadline_hours=payload.cancel_deadline_hours,
    )


@router.put("/admin/account")
def update_admin_account(
    payload: AdminAccountUpdateRequest,
    admin: dict = Depends(require_admin),
):
    return update_admin_account_logic(
        admin_id=admin["id"],
        phone=payload.phone,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
