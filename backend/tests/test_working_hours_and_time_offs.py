from datetime import date, datetime, timedelta

import database
from services.schedule import python_date_to_iranian_weekday


def _next_friday_str() -> str:
    d = date.today() + timedelta(days=1)
    while d.weekday() != 4:  # 4 = Friday
        d += timedelta(days=1)
    return d.strftime("%Y-%m-%d")


def test_default_weekly_schedule_sat_to_thu_open_and_friday_closed_r7(
    client, admin_headers
):
    conn = database.get_connection()
    try:
        versions = {
            row[0]
            for row in conn.execute("SELECT version FROM schema_migrations").fetchall()
        }
        assert "004_working_hours_and_time_offs" in versions
    finally:
        conn.close()

    res = client.get("/api/admin/working-hours", headers=admin_headers)
    assert res.status_code == 200
    days = res.json()
    assert len(days) == 7

    for item in days[:6]:
        assert item["start_time"] == "10:00"
        assert item["end_time"] == "20:00"
        assert item["is_closed"] is False

    assert days[6]["day_of_week"] == 6
    assert days[6]["is_closed"] is True

    # بررسی جمعه‌ی آینده: در GET /api/slots تعطیل است و بک‌اند رزرو را رد می‌کند (R7)
    friday = _next_friday_str()
    slots_res = client.get("/api/slots", params={"date": friday})
    assert slots_res.status_code == 200
    slots_body = slots_res.json()
    assert slots_body["is_closed_day"] is True
    assert slots_body["slots"] == []

    book_friday = client.post(
        "/api/appointments",
        json={
            "customer_name": "علی رضایی",
            "customer_phone": "09121234567",
            "service_id": 1,
            "date": friday,
            "start_time": "11:00",
        },
    )
    assert book_friday.status_code == 400
    assert "تعطیل" in book_friday.json()["detail"]


def test_update_weekly_working_hours_enforces_r6(client, admin_headers, future_date):
    target_date_obj = datetime.strptime(future_date, "%Y-%m-%d").date()
    target_ir_day = python_date_to_iranian_weekday(target_date_obj)

    current = client.get("/api/admin/working-hours", headers=admin_headers).json()
    updated_payload = []
    for item in current:
        if item["day_of_week"] == target_ir_day:
            updated_payload.append(
                {
                    "day_of_week": target_ir_day,
                    "start_time": "12:00",
                    "end_time": "15:00",
                    "is_closed": False,
                }
            )
        else:
            updated_payload.append(
                {
                    "day_of_week": item["day_of_week"],
                    "start_time": item["start_time"],
                    "end_time": item["end_time"],
                    "is_closed": item["is_closed"],
                }
            )

    put_res = client.put(
        "/api/admin/working-hours",
        headers=admin_headers,
        json={"days": updated_payload},
    )
    assert put_res.status_code == 200

    slots = client.get("/api/slots", params={"date": future_date}).json()["slots"]
    assert [s["time"] for s in slots] == [
        "12:00",
        "12:30",
        "13:00",
        "13:30",
        "14:00",
        "14:30",
    ]

    # رزرو خارج از ساعت کاری جدید باید با 422 رد شود (R6)
    outside = client.post(
        "/api/appointments",
        json={
            "customer_name": "مشتری تست",
            "customer_phone": "09121234567",
            "service_id": 1,
            "date": future_date,
            "start_time": "11:00",
        },
    )
    assert outside.status_code == 422
    assert "start_time" in outside.json()["errors"]

    # رزرو داخل ساعت کاری جدید مجاز است
    inside = client.post(
        "/api/appointments",
        json={
            "customer_name": "مشتری تست",
            "customer_phone": "09121234567",
            "service_id": 1,
            "date": future_date,
            "start_time": "12:00",
        },
    )
    assert inside.status_code == 200


def test_specific_date_holiday_blocks_slots_and_booking_r7(
    client, admin_headers, future_date
):
    off_res = client.post(
        "/api/admin/time-offs",
        headers=admin_headers,
        json={
            "date": future_date,
            "is_full_day": True,
            "reason": "تعطیلی سه‌شنبه هفته بعد",
        },
    )
    assert off_res.status_code == 201
    off_id = off_res.json()["time_off"]["id"]

    slots_body = client.get("/api/slots", params={"date": future_date}).json()
    assert slots_body["is_closed_day"] is True
    assert slots_body["slots"] == []

    book_holiday = client.post(
        "/api/appointments",
        json={
            "customer_name": "سارا احمدی",
            "customer_phone": "09121234567",
            "service_id": 1,
            "date": future_date,
            "start_time": "11:00",
        },
    )
    assert book_holiday.status_code == 400
    assert "تعطیل" in book_holiday.json()["detail"]

    # پس از حذف تعطیلی، دوباره بازه‌ها آزاد می‌شوند
    del_res = client.delete(f"/api/admin/time-offs/{off_id}", headers=admin_headers)
    assert del_res.status_code == 200
    assert (
        client.get("/api/slots", params={"date": future_date}).json()["is_closed_day"]
        is False
    )


def test_partial_day_leave_blocks_overlapping_hours_only_r7(
    client, admin_headers, future_date
):
    # مرخصی چندساعته از ۱۴:۰۰ تا ۱۶:۰۰
    leave_res = client.post(
        "/api/admin/time-offs",
        headers=admin_headers,
        json={
            "date": future_date,
            "is_full_day": False,
            "start_time": "14:00",
            "end_time": "16:00",
            "reason": "مرخصی ساعتی",
        },
    )
    assert leave_res.status_code == 201

    slots = client.get("/api/slots", params={"date": future_date}).json()["slots"]
    by_time = {s["time"]: s for s in slots}

    assert by_time["13:30"]["is_available"] is True
    assert by_time["13:30"]["is_time_off"] is False

    for blocked in ("14:00", "14:30", "15:00", "15:30"):
        assert by_time[blocked]["is_available"] is False
        assert by_time[blocked]["is_time_off"] is True

    assert by_time["16:00"]["is_available"] is True
    assert by_time["16:00"]["is_time_off"] is False

    # تلاش مستقیم برای رزرو ساعت مرخصی باید در بک‌اند رد شود (R7)
    book_leave = client.post(
        "/api/appointments",
        json={
            "customer_name": "محمد امینی",
            "customer_phone": "09121234567",
            "service_id": 1,
            "date": future_date,
            "start_time": "14:30",
        },
    )
    assert book_leave.status_code == 400
    assert "مرخصی" in book_leave.json()["detail"]

    # رزرو ساعت ۱۶:۰۰ مجاز است
    book_after = client.post(
        "/api/appointments",
        json={
            "customer_name": "محمد امینی",
            "customer_phone": "09121234567",
            "service_id": 1,
            "date": future_date,
            "start_time": "16:00",
        },
    )
    assert book_after.status_code == 200


def test_warns_owner_about_existing_appointments_without_auto_cancelling(
    client, admin_headers, future_date
):
    # ثبت دو نوبت فعال در ۱۴:۳۰ و ۱۸:۳۰
    client.post(
        "/api/appointments",
        json={
            "customer_name": "مشتری اول",
            "customer_phone": "09121112233",
            "service_id": 1,
            "date": future_date,
            "start_time": "14:30",
        },
    )
    client.post(
        "/api/appointments",
        json={
            "customer_name": "مشتری دوم",
            "customer_phone": "09124445566",
            "service_id": 1,
            "date": future_date,
            "start_time": "18:30",
        },
    )

    # ۱. ثبت مرخصی ساعتی روی ۱۴:۰۰ تا ۱۶:۰۰ باید هشدار بدهد ولی نوبت را لغو نکند
    leave_res = client.post(
        "/api/admin/time-offs",
        headers=admin_headers,
        json={
            "date": future_date,
            "is_full_day": False,
            "start_time": "14:00",
            "end_time": "16:00",
            "reason": "کار فوری",
        },
    )
    assert leave_res.status_code == 201
    leave_body = leave_res.json()
    assert leave_body["warning"] is not None
    assert len(leave_body["conflicting_appointments"]) == 1
    assert leave_body["conflicting_appointments"][0]["start_time"] == "14:30"

    # ۲. کوتاه کردن ساعت کاری همان روز هفته تا ۱۸:۰۰ نیز باید هشدار بدهد بدون لغو خودکار
    target_date_obj = datetime.strptime(future_date, "%Y-%m-%d").date()
    target_ir_day = python_date_to_iranian_weekday(target_date_obj)
    current = client.get("/api/admin/working-hours", headers=admin_headers).json()
    shrunk = [
        {
            "day_of_week": d["day_of_week"],
            "start_time": d["start_time"],
            "end_time": "18:00" if d["day_of_week"] == target_ir_day else d["end_time"],
            "is_closed": d["is_closed"],
        }
        for d in current
    ]
    wh_res = client.put(
        "/api/admin/working-hours",
        headers=admin_headers,
        json={"days": shrunk},
    )
    assert wh_res.status_code == 200
    wh_body = wh_res.json()
    assert wh_body["warning"] is not None
    assert any(a["start_time"] == "18:30" for a in wh_body["conflicting_appointments"])

    # بررسی حیاتی: هیچ‌یک از دو نوبت قبلی خودکار لغو نشده‌اند!
    day_appts = client.get(
        "/api/appointments", params={"date": future_date}, headers=admin_headers
    ).json()
    assert len(day_appts) == 2
    assert all(a["status"] == "رزرو شده" for a in day_appts)


def test_schedule_validation_422_and_unauthorized_401(client, admin_headers, future_date):
    # ساعت پایان قبل یا مساوی ساعت شروع در مرخصی -> 422
    bad_leave = client.post(
        "/api/admin/time-offs",
        headers=admin_headers,
        json={
            "date": future_date,
            "is_full_day": False,
            "start_time": "16:00",
            "end_time": "14:00",
        },
    )
    assert bad_leave.status_code == 422
    assert "end_time" in bad_leave.json()["errors"]

    # عدم ورود -> 401
    assert client.get("/api/admin/working-hours").status_code == 401
    assert client.put("/api/admin/working-hours", json={"days": []}).status_code == 401
    assert client.get("/api/admin/time-offs").status_code == 401
    assert (
        client.post(
            "/api/admin/time-offs",
            json={"date": future_date, "is_full_day": True},
        ).status_code
        == 401
    )
    assert client.delete("/api/admin/time-offs/1").status_code == 401
