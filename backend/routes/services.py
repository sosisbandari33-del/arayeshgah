from fastapi import APIRouter

from services.catalog import list_services_logic

router = APIRouter(prefix="/api", tags=["services"])


@router.get("/services")
def list_services():
    return list_services_logic()
