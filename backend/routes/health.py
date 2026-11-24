from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/test")
def test_endpoint():
    return {"message": "سلام، بک‌اند کار می‌کند"}
