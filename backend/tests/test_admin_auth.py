import database
from conftest import TEST_ADMIN_PASSWORD, TEST_ADMIN_PHONE


def test_admin_seeded_with_hashed_password_and_migrations_recorded(client):
    conn = database.get_connection()
    try:
        versions = {
            row[0]
            for row in conn.execute("SELECT version FROM schema_migrations").fetchall()
        }
        assert "001_initial_schema" in versions
        assert "002_create_admin_users" in versions
    finally:
        conn.close()

    admin = database.get_admin_by_phone(TEST_ADMIN_PHONE)
    assert admin is not None
    assert admin["password_hash"].startswith("pbkdf2_sha256$")
    assert TEST_ADMIN_PASSWORD not in admin["password_hash"]


def test_admin_login_success_and_me_endpoint(client):
    login_res = client.post(
        "/api/auth/login",
        json={"phone": TEST_ADMIN_PHONE, "password": TEST_ADMIN_PASSWORD},
    )
    assert login_res.status_code == 200
    body = login_res.json()
    assert body["success"] is True
    assert body["token_type"] == "bearer"
    assert body["admin"]["phone"] == TEST_ADMIN_PHONE
    assert isinstance(body["access_token"], str) and len(body["access_token"]) > 20

    me_res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["admin"]["phone"] == TEST_ADMIN_PHONE


def test_admin_login_success_with_persian_digits(client):
    persian_phone = "۰۹۱۲ ۰۰۰-۰۰۰۰"
    login_res = client.post(
        "/api/auth/login",
        json={"phone": persian_phone, "password": TEST_ADMIN_PASSWORD},
    )
    assert login_res.status_code == 200
    assert login_res.json()["admin"]["phone"] == TEST_ADMIN_PHONE


def test_admin_login_wrong_password_or_unknown_phone_returns_401(client):
    wrong_pass_res = client.post(
        "/api/auth/login",
        json={"phone": TEST_ADMIN_PHONE, "password": "wrong-password"},
    )
    assert wrong_pass_res.status_code == 401
    assert "اشتباه" in wrong_pass_res.json()["detail"]

    unknown_phone_res = client.post(
        "/api/auth/login",
        json={"phone": "09129999999", "password": TEST_ADMIN_PASSWORD},
    )
    assert unknown_phone_res.status_code == 401


def test_admin_login_invalid_fields_return_422(client):
    bad_res = client.post(
        "/api/auth/login",
        json={"phone": "123", "password": "   "},
    )
    assert bad_res.status_code == 422
    errors = bad_res.json()["errors"]
    assert set(errors.keys()) == {"phone", "password"}


def test_admin_endpoints_rejected_without_login_including_cancel(
    client, admin_headers, future_date
):
    # ثبت نوبت توسط مشتری بدون نیاز به ورود
    created = client.post(
        "/api/appointments",
        json={
            "customer_name": "مشتری تست",
            "customer_phone": "09123334455",
            "service_id": 1,
            "date": future_date,
            "start_time": "12:00",
        },
    ).json()["appointment"]

    # ۱. دریافت لیست نوبت‌ها بدون ورود باید رد شود (401)
    unauth_list = client.get("/api/appointments", params={"date": future_date})
    assert unauth_list.status_code == 401

    # ۲. لغو نوبت بدون ورود باید رد شود (401)
    unauth_cancel = client.patch(f"/api/appointments/{created['id']}/cancel")
    assert unauth_cancel.status_code == 401

    # ۳. لغو نوبت با توکن جعلی هم باید رد شود (401)
    forged_cancel = client.patch(
        f"/api/appointments/{created['id']}/cancel",
        headers={"Authorization": "Bearer invalid.forgedtoken"},
    )
    assert forged_cancel.status_code == 401

    # ۴. بررسی نشست بدون توکن باید رد شود (401)
    unauth_me = client.get("/api/auth/me")
    assert unauth_me.status_code == 401

    # اطمینان از اینکه نوبت در دیتابیس دست‌نخورده و فعال باقی مانده است
    day_items = client.get(
        "/api/appointments", params={"date": future_date}, headers=admin_headers
    ).json()
    assert len(day_items) == 1
    assert day_items[0]["status"] == "رزرو شده"
