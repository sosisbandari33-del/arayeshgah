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


@pytest.fixture
def client(tmp_path, monkeypatch):
    """ساخت کلاینت تست HTTP با دیتابیس SQLite موقت و کاملاً جدا از دیتابیس اصلی"""
    test_db_path = tmp_path / "test_barbershop.db"
    monkeypatch.setattr(database, "DB_PATH", str(test_db_path))
    database.init_db()
    return TestClient(main.app)


@pytest.fixture
def future_date():
    return (date.today() + timedelta(days=3)).strftime("%Y-%m-%d")


@pytest.fixture
def past_date():
    return (date.today() - timedelta(days=2)).strftime("%Y-%m-%d")
