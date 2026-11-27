from fastapi import APIRouter, Depends, status

from routes.auth import require_admin
from schemas import ServiceStatusRequest, ServiceUpsertRequest
from services.catalog import (
    create_service_logic,
    delete_service_logic,
    list_all_services_admin_logic,
    list_services_logic,
    set_service_status_logic,
    update_service_logic,
)

router = APIRouter(prefix="/api", tags=["services"])


@router.get("/services")
def list_services():
    return list_services_logic()


@router.get("/admin/services")
def list_admin_services(_admin: dict = Depends(require_admin)):
    return list_all_services_admin_logic()


@router.post("/admin/services", status_code=status.HTTP_201_CREATED)
def create_admin_service(
    payload: ServiceUpsertRequest, _admin: dict = Depends(require_admin)
):
    return create_service_logic(
        name=payload.name, price=payload.price, duration=payload.duration
    )


@router.put("/admin/services/{service_id}")
def update_admin_service(
    service_id: int,
    payload: ServiceUpsertRequest,
    _admin: dict = Depends(require_admin),
):
    return update_service_logic(
        service_id=service_id,
        name=payload.name,
        price=payload.price,
        duration=payload.duration,
    )


@router.patch("/admin/services/{service_id}/status")
def change_admin_service_status(
    service_id: int,
    payload: ServiceStatusRequest,
    _admin: dict = Depends(require_admin),
):
    return set_service_status_logic(
        service_id=service_id, is_active=payload.is_active
    )


@router.delete("/admin/services/{service_id}")
def delete_admin_service(
    service_id: int, _admin: dict = Depends(require_admin)
):
    return delete_service_logic(service_id=service_id)
