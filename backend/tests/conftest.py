import os
import sys
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

# پشتیبانی از اجرای pytest هم از ریشه‌ی پروژه و هم از پوشه‌ی backend
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import database  # noqa: E402
import main  # noqa: E402

TEST_ADMIN_PHONE = "09120000000"
TEST_ADMIN_PASSWORD = "test-admin-password"
TEST_AUTH_SECRET = "pytest-isolated-hmac-secret-key-for-barbershop"


@pytest.fixture
def client(tmp_path, monkeypatch):
    """ساخت کلاینت تست HTTP با دیتابیس موقت و تنظیمات محیطی ایزوله از .env محلی"""
    monkeypatch.setenv("SKIP_DOTENV", "1")
    monkeypatch.setenv("ADMIN_PHONE", TEST_ADMIN_PHONE)
    monkeypatch.setenv("ADMIN_PASSWORD", TEST_ADMIN_PASSWORD)
    monkeypatch.setenv("AUTH_SECRET_KEY", TEST_AUTH_SECRET)

    test_db_path = tmp_path / "test_barbershop.db"
    monkeypatch.setattr(database, "DB_PATH", str(test_db_path))
    main.bootstrap_app()
    return TestClient(main.app)


@pytest.fixture
def admin_headers(client):
    """ورود با حساب مدیر تست و بازگرداندن هدر Authorization"""
    res = client.post(
        "/api/auth/login",
        json={"phone": TEST_ADMIN_PHONE, "password": TEST_ADMIN_PASSWORD},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def future_date():
    """انتخاب یک تاریخ آینده‌ی کاری (غیر از جمعه که پیش‌فرض تعطیل است)"""
    d = date.today() + timedelta(days=3)
    while d.weekday() == 4:  # 4 = Friday
        d += timedelta(days=1)
    return d.strftime("%Y-%m-%d")


@pytest.fixture
def past_date():
    """انتخاب یک تاریخ گذشته‌ی غیرجمعه"""
    d = date.today() - timedelta(days=2)
    while d.weekday() == 4:  # 4 = Friday
        d -= timedelta(days=1)
    return d.strftime("%Y-%m-%d")
