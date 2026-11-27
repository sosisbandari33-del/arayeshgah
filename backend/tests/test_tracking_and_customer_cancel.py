from datetime import datetime
import re

import database
from services import appointments as appointments_service


def _to_persian_digits(text: str) -> str:
    persian = "۰۱۲۳۴۵۶۷۸۹"
    return "".join(persian[int(ch)] if ch.isdigit() else ch for ch in text)


def test_booking_issues_unique_6digit_tracking_code_and_migration_006_recorded(
    client, future_date
):
    conn = database.get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT version FROM schema_migrations")
        versions = {row[0] for row in cur.fetchall()}
    finally:
        conn.close()

    assert "006_tracking_code_and_cancel_deadline" in versions

    res1 = client.post(
        "/api/appointments",
        json={
            "customer_name": "سامان رضایی",
            "customer_phone": "09121112233",
            "service_ids": [1, 4],
            "date": future_date,
            "start_time": "10:00",
        },
    )
    res2 = client.post(
        "/api/appointments",
        json={
            "customer_name": "سامان رضایی",
            "customer_phone": "09121112233",
            "service_ids": [1],
            "date": future_date,
            "start_time": "12:00",
        },
    )
    assert res1.status_code == 200
    assert res2.status_code == 200

    appt1 = res1.json()["appointment"]
    appt2 = res2.json()["appointment"]

    assert re.fullmatch(r"\d{6}", appt1["tracking_code"])
    assert re.fullmatch(r"\d{6}", appt2["tracking_code"])
    assert appt1["tracking_code"] != appt2["tracking_code"]
    assert appt1["total_duration"] == 60
    assert appt1["total_price"] == 400000
    assert appt1["end_time"] == "11:00"


def test_lookup_returns_only_exact_matched_appointment_and_supports_persian_digits(
    client, future_date
):
    """مشتری با موبایل و کد پیگیری فقط همان نوبت را می‌بیند، نه نوبت‌های دیگر همان شماره موبایل"""
    r1 = client.post(
        "/api/appointments",
        json={
            "customer_name": "نرگس محمدی",
            "customer_phone": "09123456789",
            "service_ids": [1],
            "date": future_date,
            "start_time": "10:00",
        },
    ).json()["appointment"]

    r2 = client.post(
        "/api/appointments",
        json={
            "customer_name": "نرگس محمدی",
            "customer_phone": "09123456789",
            "service_ids": [2],
            "date": future_date,
            "start_time": "15:00",
        },
    ).json()["appointment"]

    lookup_res = client.post(
        "/api/appointments/lookup",
        json={
            "customer_phone": "۰۹۱۲ ۳۴۵-۶۷۸۹",
            "tracking_code": _to_persian_digits(r1["tracking_code"]),
        },
    )
    assert lookup_res.status_code == 200
    body = lookup_res.json()
    assert body["appointment"]["id"] == r1["id"]
    assert body["appointment"]["id"] != r2["id"]
    assert body["appointment"]["start_time"] == "10:00"
    assert body["can_cancel"] is True
    assert body["cancel_reason"] is None
    assert body["cancel_deadline_hours"] == 2


def test_wrong_tracking_code_or_wrong_phone_returns_404(client, future_date):
    """کد پیگیری غلط یا عدم تطابق شماره موبایل با کد پیگیری باید با ۴۰۴ رد شود"""
    booked = client.post(
        "/api/appointments",
        json={
            "customer_name": "پویا نادری",
            "customer_phone": "09121234567",
            "service_ids": [1],
            "date": future_date,
            "start_time": "11:00",
        },
    ).json()["appointment"]

    wrong_code = "999999" if booked["tracking_code"] != "999999" else "888888"

    # ۱. کد پیگیری غلط با شماره موبایل درست
    res_lookup_bad_code = client.post(
        "/api/appointments/lookup",
        json={"customer_phone": "09121234567", "tracking_code": wrong_code},
    )
    assert res_lookup_bad_code.status_code == 404

    res_cancel_bad_code = client.post(
        "/api/appointments/customer-cancel",
        json={"customer_phone": "09121234567", "tracking_code": wrong_code},
    )
    assert res_cancel_bad_code.status_code == 404

    # ۲. کد پیگیری درست ولی با شماره موبایل شخص دیگر
    res_lookup_wrong_phone = client.post(
        "/api/appointments/lookup",
        json={"customer_phone": "09129876543", "tracking_code": booked["tracking_code"]},
    )
    assert res_lookup_wrong_phone.status_code == 404

    res_cancel_wrong_phone = client.post(
        "/api/appointments/customer-cancel",
        json={"customer_phone": "09129876543", "tracking_code": booked["tracking_code"]},
    )
    assert res_cancel_wrong_phone.status_code == 404


def test_tracking_validation_errors_return_422_per_field(client):
    """فرمت نامعتبر موبایل یا کد پیگیری غیر ۶ رقمی باید خطای ۴۲۲ فیلدی برگرداند"""
    res = client.post(
        "/api/appointments/lookup",
        json={"customer_phone": "123", "tracking_code": "12ab"},
    )
    assert res.status_code == 422
    errors = res.json()["errors"]
    assert "customer_phone" in errors
    assert "tracking_code" in errors

    res_empty = client.post(
        "/api/appointments/customer-cancel",
        json={"customer_phone": "", "tracking_code": "12345"},
    )
    assert res_empty.status_code == 422
    errors_empty = res_empty.json()["errors"]
    assert "customer_phone" in errors_empty
    assert "tracking_code" in errors_empty


def test_customer_cancel_on_time_succeeds_preserves_record_and_frees_slots_r9(
    client, future_date, monkeypatch
):
    """لغو به‌موقع (حداقل ۲ ساعت قبل از نوبت) موفق است، رکورد حفظ می‌شود و بازه‌ها آزاد می‌گردند"""
    booked = client.post(
        "/api/appointments",
        json={
            "customer_name": "کیوان مرادی",
            "customer_phone": "09122223344",
            "service_ids": [1, 2],  # ۹۰ دقیقه: ۱۴:۰۰ تا ۱۵:۳۰
            "date": future_date,
            "start_time": "14:00",
        },
    ).json()["appointment"]

    # دقیقاً ۲ ساعت قبل از ۱۴:۰۰ (ساعت ۱۲:۰۰ همان روز) هنوز در مهلت مجاز لغو است
    exact_2h_before = datetime.strptime(f"{future_date} 12:00:00", "%Y-%m-%d %H:%M:%S")
    monkeypatch.setattr(appointments_service, "_now", lambda: exact_2h_before)

    lookup_ok = client.post(
        "/api/appointments/lookup",
        json={
            "customer_phone": "09122223344",
            "tracking_code": booked["tracking_code"],
        },
    ).json()
    assert lookup_ok["can_cancel"] is True

    cancel_res = client.post(
        "/api/appointments/customer-cancel",
        json={
            "customer_phone": "09122223344",
            "tracking_code": booked["tracking_code"],
        },
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["appointment"]["status"] == "لغو شده"
    assert cancel_res.json()["can_cancel"] is False

    # بازه‌های ۱۴:۰۰، ۱۴:۳۰ و ۱۵:۰۰ دوباره برای رزرو آزاد شده‌اند
    slots_after = [
        s["time"]
        for s in client.get(
            "/api/slots", params={"date": future_date, "service_ids": "1"}
        ).json()["slots"]
    ]
    assert "14:00" in slots_after
    assert "14:30" in slots_after
    assert "15:00" in slots_after

    # تلاش مجدد برای لغو نوبتِ قبلاً لغوشده باید با ۴۰۰ رد شود
    second_cancel = client.post(
        "/api/appointments/customer-cancel",
        json={
            "customer_phone": "09122223344",
            "tracking_code": booked["tracking_code"],
        },
    )
    assert second_cancel.status_code == 400


def test_late_cancellation_after_2h_deadline_and_past_time_rejected_r9(
    client, future_date, monkeypatch
):
    """لغو دیرهنگام (کمتر از ۲ ساعت مانده به نوبت یا پس از زمان نوبت) در پیگیری غیرفعال و در بک‌اند با ۴۰۰ رد می‌شود"""
    booked = client.post(
        "/api/appointments",
        json={
            "customer_name": "آرش بهرامی",
            "customer_phone": "09125554433",
            "service_ids": [1],
            "date": future_date,
            "start_time": "14:00",
        },
    ).json()["appointment"]

    # ۱. یک ساعت و ۵۹ دقیقه قبل از شروع نوبت (ساعت ۱۲:۰۱ برای نوبت ۱۴:۰۰ -> دیرتر از مهلت ۲ ساعته)
    late_dt = datetime.strptime(f"{future_date} 12:01:00", "%Y-%m-%d %H:%M:%S")
    monkeypatch.setattr(appointments_service, "_now", lambda: late_dt)

    lookup_late = client.post(
        "/api/appointments/lookup",
        json={
            "customer_phone": "09125554433",
            "tracking_code": booked["tracking_code"],
        },
    )
    assert lookup_late.status_code == 200
    late_body = lookup_late.json()
    assert late_body["can_cancel"] is False
    assert late_body["cancel_reason"] is not None
    assert "مهلت لغو" in late_body["cancel_reason"]

    # دور زدن دکمه‌ی غیرفعال فرانت‌اند و ارسال مستقیم درخواست لغو دیرهنگام باید با ۴۰۰ رد شود
    cancel_late = client.post(
        "/api/appointments/customer-cancel",
        json={
            "customer_phone": "09125554433",
            "tracking_code": booked["tracking_code"],
        },
    )
    assert cancel_late.status_code == 400
    assert "مهلت لغو" in cancel_late.json()["detail"]

    # ۲. پس از گذشت زمان شروع نوبت (ساعت ۱۵:۰۰ برای نوبت ۱۴:۰۰)
    past_dt = datetime.strptime(f"{future_date} 15:00:00", "%Y-%m-%d %H:%M:%S")
    monkeypatch.setattr(appointments_service, "_now", lambda: past_dt)

    lookup_past = client.post(
        "/api/appointments/lookup",
        json={
            "customer_phone": "09125554433",
            "tracking_code": booked["tracking_code"],
        },
    ).json()
    assert lookup_past["can_cancel"] is False
    assert "گذشته" in lookup_past["cancel_reason"]

    cancel_past = client.post(
        "/api/appointments/customer-cancel",
        json={
            "customer_phone": "09125554433",
            "tracking_code": booked["tracking_code"],
        },
    )
    assert cancel_past.status_code == 400

    # اطمینان از اینکه نوبت در دیتابیس همچنان «رزرو شده» باقی مانده است
    still_active = database.get_appointment_by_id(booked["id"])
    assert still_active["status"] == "رزرو شده"
