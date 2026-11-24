import sqlite3
from datetime import datetime, timedelta

import pytest

import database


def test_get_slots_success_for_future_date(client, future_date):
    response = client.get("/api/slots", params={"date": future_date})
    assert response.status_code == 200
    body = response.json()
    assert body["date"] == future_date
    assert len(body["slots"]) == 20
    assert body["slots"][0]["time"] == "10:00"
    assert body["slots"][-1]["time"] == "19:30"
    assert all(slot["is_available"] for slot in body["slots"])

    # پس از رزرو ساعت 11:00، همان بازه باید رزروشده و غیرآزاد نمایش داده شود
    book_res = client.post(
        "/api/appointments",
        json={
            "customer_name": "علی رضایی",
            "customer_phone": "09121234567",
            "service_id": 1,
            "date": future_date,
            "start_time": "11:00",
        },
    )
    assert book_res.status_code == 200

    slots_after = client.get("/api/slots", params={"date": future_date}).json()["slots"]
    slot_11 = next(s for s in slots_after if s["time"] == "11:00")
    assert slot_11["is_booked"] is True
    assert slot_11["is_available"] is False


def test_get_slots_marks_past_date_unavailable(client, past_date):
    response = client.get("/api/slots", params={"date": past_date})
    assert response.status_code == 200
    slots = response.json()["slots"]
    assert len(slots) == 20
    assert all(slot["is_past"] and not slot["is_available"] for slot in slots)


def test_get_slots_error_missing_date_returns_400(client):
    response = client.get("/api/slots")
    assert response.status_code == 400
    assert response.json()["detail"] == "ارسال پارامتر تاریخ الزامی است."


@pytest.mark.parametrize("bad_date", ["2027-5-7", "invalid-date", "2027-02-30"])
def test_get_slots_error_invalid_date_format_returns_400(client, bad_date):
    response = client.get("/api/slots", params={"date": bad_date})
    assert response.status_code == 400
    assert isinstance(response.json()["detail"], str)


def test_book_appointment_success_with_persian_digits_and_local_created_at(client, future_date):
    exact_50 = "ا" * 50
    before = datetime.now().replace(microsecond=0) - timedelta(seconds=5)
    response = client.post(
        "/api/appointments",
        json={
            "customer_name": f"  {exact_50}  ",
            "customer_phone": "۰۹۱۲ ۱۲۳-۴۵۶۷",
            "service_id": 1,
            "date": future_date,
            "start_time": "15:00",
        },
    )
    after = datetime.now().replace(microsecond=0) + timedelta(seconds=5)

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    appointment = body["appointment"]
    assert appointment["customer_name"] == exact_50
    assert appointment["customer_phone"] == "09121234567"
    assert appointment["status"] == "رزرو شده"

    created_dt = datetime.strptime(appointment["created_at"], "%Y-%m-%d %H:%M:%S")
    assert before <= created_dt <= after


def test_book_appointment_error_when_slot_already_booked(client, future_date):
    payload = {
        "customer_name": "مشتری اول",
        "customer_phone": "09121234567",
        "service_id": 1,
        "date": future_date,
        "start_time": "11:00",
    }
    first = client.post("/api/appointments", json=payload)
    assert first.status_code == 200

    # رزرو ساعت پر باید با پیام فارسی رد شود (قانون R2)
    second = client.post(
        "/api/appointments",
        json={**payload, "customer_name": "مشتری دوم", "customer_phone": "09129876543"},
    )
    assert second.status_code == 400
    assert "قبلاً رزرو شده" in second.json()["detail"]


def test_book_appointment_error_when_date_in_past(client, past_date):
    # رزرو در گذشته باید رد شود (قانون R3)
    response = client.post(
        "/api/appointments",
        json={
            "customer_name": "علی رضایی",
            "customer_phone": "09121234567",
            "service_id": 1,
            "date": past_date,
            "start_time": "12:00",
        },
    )
    assert response.status_code == 400
    assert "گذشته" in response.json()["detail"]


@pytest.mark.parametrize("bad_time", ["09:30", "10:15", "20:00"])
def test_book_appointment_error_outside_working_hours_r1(client, future_date, bad_time):
    response = client.post(
        "/api/appointments",
        json={
            "customer_name": "علی رضایی",
            "customer_phone": "09121234567",
            "service_id": 1,
            "date": future_date,
            "start_time": bad_time,
        },
    )
    assert response.status_code == 400


def test_book_appointment_error_non_padded_date_rejected(client):
    response = client.post(
        "/api/appointments",
        json={
            "customer_name": "محمد کریمی",
            "customer_phone": "09129876543",
            "service_id": 1,
            "date": "2027-5-7",
            "start_time": "11:00",
        },
    )
    assert response.status_code == 400


def test_book_appointment_error_nonexistent_service_returns_404(client, future_date):
    response = client.post(
        "/api/appointments",
        json={
            "customer_name": "علی رضایی",
            "customer_phone": "09121234567",
            "service_id": 999,
            "date": future_date,
            "start_time": "12:00",
        },
    )
    assert response.status_code == 404


@pytest.mark.parametrize(
    "bad_name,bad_phone",
    [
        ("     ", "09121234567"),
        ("آ", "09121234567"),
        ("ب" * 51, "09121234567"),
        ("سارا احمدی", "0912abc3456789"),
        ("سارا احمدی", "0912345"),
    ],
)
def test_book_appointment_error_invalid_name_or_phone(client, future_date, bad_name, bad_phone):
    response = client.post(
        "/api/appointments",
        json={
            "customer_name": bad_name,
            "customer_phone": bad_phone,
            "service_id": 1,
            "date": future_date,
            "start_time": "15:30",
        },
    )
    assert response.status_code == 400
    assert isinstance(response.json()["detail"], str)


def test_db_unique_index_prevents_concurrent_double_booking(client, future_date):
    database.create_appointment(
        customer_name="مشتری اول",
        customer_phone="09121112233",
        service_id=1,
        service_name="اصلاح مو",
        date=future_date,
        start_time="16:00",
    )
    with pytest.raises(sqlite3.IntegrityError):
        database.create_appointment(
            customer_name="مشتری دوم",
            customer_phone="09120001122",
            service_id=1,
            service_name="اصلاح مو",
            date=future_date,
            start_time="16:00",
        )
