import database


def test_migration_003_applied_and_initial_services_active(client, admin_headers):
    conn = database.get_connection()
    try:
        versions = {
            row[0]
            for row in conn.execute("SELECT version FROM schema_migrations").fetchall()
        }
        assert "003_add_service_is_active" in versions
    finally:
        conn.close()

    admin_list = client.get("/api/admin/services", headers=admin_headers)
    assert admin_list.status_code == 200
    items = admin_list.json()
    assert len(items) == 4
    assert all(item["is_active"] is True for item in items)
    assert all(item["has_appointments"] is False for item in items)


def test_admin_add_and_edit_services_with_custom_durations(client, admin_headers):
    # افزودن خدمت جدید با مدت دلخواه
    create_res = client.post(
        "/api/admin/services",
        headers=admin_headers,
        json={"name": "پاک‌سازی صورت", "price": 420000, "duration": 45},
    )
    assert create_res.status_code == 201
    created = create_res.json()["service"]
    assert created["name"] == "پاک‌سازی صورت"
    assert created["price"] == 420000
    assert created["duration"] == 45
    assert created["is_active"] is True

    # ویرایش خدمات اولیه به مدت‌های دلخواه ۲۵ دقیقه و ۳۵ دقیقه
    edit_1 = client.put(
        "/api/admin/services/1",
        headers=admin_headers,
        json={"name": "اصلاح مو", "price": 270000, "duration": 25},
    )
    assert edit_1.status_code == 200
    assert edit_1.json()["service"]["duration"] == 25

    edit_2 = client.put(
        "/api/admin/services/2",
        headers=admin_headers,
        json={"name": "اصلاح مو و ریش", "price": 380000, "duration": 35},
    )
    assert edit_2.status_code == 200
    assert edit_2.json()["service"]["duration"] == 35

    # بازتاب فوری در لیست عمومی مشتریان
    public_services = client.get("/api/services").json()
    assert len(public_services) == 5
    by_id = {s["id"]: s for s in public_services}
    assert by_id[1]["duration"] == 25
    assert by_id[2]["duration"] == 35
    assert by_id[created["id"]]["name"] == "پاک‌سازی صورت"


def test_deactivated_service_hidden_from_public_and_rejected_in_booking(
    client, admin_headers, future_date
):
    # غیرفعال کردن خدمت شماره ۳
    deact_res = client.patch(
        "/api/admin/services/3/status",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert deact_res.status_code == 200
    assert deact_res.json()["service"]["is_active"] is False

    # در لیست عمومی (صفحه‌ی اصلی و فرم رزرو) نباید دیده شود
    public_ids = [s["id"] for s in client.get("/api/services").json()]
    assert 3 not in public_ids

    # در لیست مدیریت همچنان با وضعیت غیرفعال دیده می‌شود
    admin_by_id = {
        s["id"]: s
        for s in client.get("/api/admin/services", headers=admin_headers).json()
    }
    assert admin_by_id[3]["is_active"] is False

    # تلاش برای ثبت نوبت روی خدمت غیرفعال باید با کد 422 رد شود
    book_inactive = client.post(
        "/api/appointments",
        json={
            "customer_name": "مشتری تست",
            "customer_phone": "09121234567",
            "service_id": 3,
            "date": future_date,
            "start_time": "11:00",
        },
    )
    assert book_inactive.status_code == 422
    assert "service_id" in book_inactive.json()["errors"]

    # فعال‌سازی مجدد و بازگشت به لیست عمومی
    react_res = client.patch(
        "/api/admin/services/3/status",
        headers=admin_headers,
        json={"is_active": True},
    )
    assert react_res.status_code == 200
    assert 3 in [s["id"] for s in client.get("/api/services").json()]


def test_service_with_appointments_cannot_be_deleted_only_deactivated(
    client, admin_headers, future_date
):
    # ثبت یک نوبت روی خدمت شماره ۱
    appt = client.post(
        "/api/appointments",
        json={
            "customer_name": "علی کریمی",
            "customer_phone": "09123334455",
            "service_id": 1,
            "date": future_date,
            "start_time": "10:00",
        },
    ).json()["appointment"]

    # تلاش برای حذف خدمتی که نوبت دارد باید رد شود (409) و پاک نشود
    del_used = client.delete("/api/admin/services/1", headers=admin_headers)
    assert del_used.status_code == 409
    assert "غیرفعال" in del_used.json()["detail"]

    # حتی اگر آن نوبت لغو شده باشد (چون رکورد در دیتابیس حفظ می‌شود) باز هم پاک نمی‌شود
    client.patch(f"/api/appointments/{appt['id']}/cancel", headers=admin_headers)
    del_cancelled = client.delete("/api/admin/services/1", headers=admin_headers)
    assert del_cancelled.status_code == 409

    # اما غیرفعال کردن آن مجاز است
    deact = client.patch(
        "/api/admin/services/1/status",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert deact.status_code == 200
    assert deact.json()["service"]["is_active"] is False

    # خدمتی که هیچ نوبتی ندارد قابل حذف کامل است
    temp_service = client.post(
        "/api/admin/services",
        headers=admin_headers,
        json={"name": "خدمت موقت بدون نوبت", "price": 100000, "duration": 15},
    ).json()["service"]
    del_unused = client.delete(
        f"/api/admin/services/{temp_service['id']}", headers=admin_headers
    )
    assert del_unused.status_code == 200
    admin_ids = [
        s["id"]
        for s in client.get("/api/admin/services", headers=admin_headers).json()
    ]
    assert temp_service["id"] not in admin_ids


def test_service_validation_errors_return_422_per_field(client, admin_headers):
    bad_all = client.post(
        "/api/admin/services",
        headers=admin_headers,
        json={"name": "   ", "price": 0, "duration": -10},
    )
    assert bad_all.status_code == 422
    assert set(bad_all.json()["errors"].keys()) == {"name", "price", "duration"}

    # نام تکراری باید با 422 روی فیلد name رد شود
    dup_name = client.post(
        "/api/admin/services",
        headers=admin_headers,
        json={"name": "اصلاح مو", "price": 250000, "duration": 25},
    )
    assert dup_name.status_code == 422
    assert "name" in dup_name.json()["errors"]


def test_admin_service_endpoints_require_login_return_401(client):
    assert client.get("/api/admin/services").status_code == 401
    assert (
        client.post(
            "/api/admin/services",
            json={"name": "تست", "price": 100000, "duration": 20},
        ).status_code
        == 401
    )
    assert (
        client.put(
            "/api/admin/services/1",
            json={"name": "تست", "price": 100000, "duration": 20},
        ).status_code
        == 401
    )
    assert (
        client.patch("/api/admin/services/1/status", json={"is_active": False}).status_code
        == 401
    )
    assert client.delete("/api/admin/services/1").status_code == 401
