from datetime import datetime

import database
from services import appointments as appointments_service
from tests.conftest import TEST_ADMIN_PASSWORD, TEST_ADMIN_PHONE


def test_public_and_admin_settings_loaded_from_db_and_migration_007_recorded(
    client, admin_headers
):
    conn = database.get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT version FROM schema_migrations")
        versions = {row[0] for row in cur.fetchall()}
    finally:
        conn.close()

    assert "007_salon_settings" in versions

    pub_res = client.get("/api/settings/public")
    assert pub_res.status_code == 200
    assert pub_res.json() == {
        "salon_name": "پیرایش کلاسیک",
        "cancel_deadline_hours": 2,
    }

    adm_res = client.get("/api/admin/settings", headers=admin_headers)
    assert adm_res.status_code == 200
    assert adm_res.json() == {
        "salon_name": "پیرایش کلاسیک",
        "cancel_deadline_hours": 2,
        "admin_phone": TEST_ADMIN_PHONE,
    }


def test_update_salon_name_and_cancel_deadline_dynamically_enforces_r9(
    client, admin_headers, future_date, monkeypatch
):
    """تغییر نام آرایشگاه و مهلت لغو در تنظیمات باید بلافاصله در API عمومی و قانون R9 اثر کند"""
    upd_res = client.put(
        "/api/admin/settings",
        headers=admin_headers,
        json={"salon_name": "پیرایش مدرن آریا", "cancel_deadline_hours": 4},
    )
    assert upd_res.status_code == 200
    assert upd_res.json()["settings"] == {
        "salon_name": "پیرایش مدرن آریا",
        "cancel_deadline_hours": 4,
    }

    pub_after = client.get("/api/settings/public").json()
    assert pub_after["salon_name"] == "پیرایش مدرن آریا"
    assert pub_after["cancel_deadline_hours"] == 4

    booked = client.post(
        "/api/appointments",
        json={
            "customer_name": "شهاب حسینی",
            "customer_phone": "09123334455",
            "service_ids": [1],
            "date": future_date,
            "start_time": "15:00",
        },
    ).json()["appointment"]

    # ۳ ساعت قبل از ۱۵:۰۰ (ساعت ۱۲:۰۰): با مهلت جدید ۴ ساعته باید لغو دیرهنگام محسوب شود!
    three_hours_before = datetime.strptime(
        f"{future_date} 12:00:00", "%Y-%m-%d %H:%M:%S"
    )
    monkeypatch.setattr(appointments_service, "_now", lambda: three_hours_before)

    lookup_res = client.post(
        "/api/appointments/lookup",
        json={
            "customer_phone": "09123334455",
            "tracking_code": booked["tracking_code"],
        },
    ).json()
    assert lookup_res["cancel_deadline_hours"] == 4
    assert lookup_res["can_cancel"] is False
    assert "4 ساعت" in lookup_res["cancel_reason"]

    cancel_res = client.post(
        "/api/appointments/customer-cancel",
        json={
            "customer_phone": "09123334455",
            "tracking_code": booked["tracking_code"],
        },
    )
    assert cancel_res.status_code == 400


def test_change_admin_password_requires_correct_current_password(
    client, admin_headers
):
    """تغییر رمز بدون رمز فعلی درست باید رد شود و با رمز فعلی درست هش رمز جدید ذخیره گردد"""
    # ۱. رمز فعلی اشتباه -> رد با ۴۰۰
    wrong_cur = client.put(
        "/api/admin/account",
        headers=admin_headers,
        json={
            "phone": TEST_ADMIN_PHONE,
            "current_password": "wrong-current-password",
            "new_password": "new-secret-password-99",
        },
    )
    assert wrong_cur.status_code == 400
    assert "رمز عبور فعلی" in wrong_cur.json()["detail"]

    # ۲. تغییر موفق رمز با رمز فعلی درست
    ok_res = client.put(
        "/api/admin/account",
        headers=admin_headers,
        json={
            "phone": TEST_ADMIN_PHONE,
            "current_password": TEST_ADMIN_PASSWORD,
            "new_password": "new-secret-password-99",
        },
    )
    assert ok_res.status_code == 200
    assert "access_token" in ok_res.json()

    # اطمینان از هش بودن رمز جدید در دیتابیس (عدم ذخیره متن خام)
    admin_row = database.get_admin_by_phone(TEST_ADMIN_PHONE)
    assert admin_row["password_hash"] != "new-secret-password-99"
    assert admin_row["password_hash"].startswith("pbkdf2_sha256$")

    # ورود با رمز قبلی باید ۴۰۱ بدهد و ورود با رمز جدید ۲۰۰ بدهد
    old_login = client.post(
        "/api/auth/login",
        json={"phone": TEST_ADMIN_PHONE, "password": TEST_ADMIN_PASSWORD},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/auth/login",
        json={"phone": TEST_ADMIN_PHONE, "password": "new-secret-password-99"},
    )
    assert new_login.status_code == 200


def test_change_admin_phone_with_persian_digits_updates_login_identity(
    client, admin_headers
):
    """تغییر شماره موبایل ورود با رمز فعلی درست و پشتیبانی از ارقام فارسی"""
    res = client.put(
        "/api/admin/account",
        headers=admin_headers,
        json={
            "phone": "۰۹۱۲ ۸۸۸-۷۷۶۶",
            "current_password": TEST_ADMIN_PASSWORD,
            "new_password": None,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["admin"]["phone"] == "09128887766"

    # شماره قبلی دیگر کار نمی‌کند و شماره جدید با همان رمز قبلی وارد می‌شود
    assert (
        client.post(
            "/api/auth/login",
            json={"phone": TEST_ADMIN_PHONE, "password": TEST_ADMIN_PASSWORD},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"phone": "09128887766", "password": TEST_ADMIN_PASSWORD},
        ).status_code
        == 200
    )


def test_settings_validation_422_and_unauthorized_401(client, admin_headers):
    """اعتبارسنجی ۴۲۲ فیلدی روی تنظیمات و محافظت ۴۰۱ بدون توکن مدیر"""
    assert client.get("/api/admin/settings").status_code == 401
    assert (
        client.put(
            "/api/admin/settings",
            json={"salon_name": "تست", "cancel_deadline_hours": 2},
        ).status_code
        == 401
    )
    assert (
        client.put(
            "/api/admin/account",
            json={
                "phone": TEST_ADMIN_PHONE,
                "current_password": TEST_ADMIN_PASSWORD,
            },
        ).status_code
        == 401
    )

    bad_general = client.put(
        "/api/admin/settings",
        headers=admin_headers,
        json={"salon_name": " ", "cancel_deadline_hours": -5},
    )
    assert bad_general.status_code == 422
    assert set(bad_general.json()["errors"].keys()) == {
        "salon_name",
        "cancel_deadline_hours",
    }

    bad_account = client.put(
        "/api/admin/account",
        headers=admin_headers,
        json={"phone": "123", "current_password": "", "new_password": "12"},
    )
    assert bad_account.status_code == 422
    assert set(bad_account.json()["errors"].keys()) == {
        "phone",
        "current_password",
        "new_password",
    }
