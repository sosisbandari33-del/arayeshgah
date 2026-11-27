def test_list_appointments_success_empty_and_sorted_by_time(
    client, admin_headers, future_date
):
    empty_res = client.get(
        "/api/appointments", params={"date": future_date}, headers=admin_headers
    )
    assert empty_res.status_code == 200
    assert empty_res.json() == []

    # ثبت دو نوبت خارج از ترتیب زمانی تا مرتب‌سازی صعودی بررسی شود
    client.post(
        "/api/appointments",
        json={
            "customer_name": "مشتری دیرتر",
            "customer_phone": "09121111111",
            "service_id": 1,
            "date": future_date,
            "start_time": "15:00",
        },
    )
    client.post(
        "/api/appointments",
        json={
            "customer_name": "مشتری زودتر",
            "customer_phone": "09122222222",
            "service_id": 2,
            "date": future_date,
            "start_time": "10:30",
        },
    )

    list_res = client.get(
        "/api/appointments", params={"date": future_date}, headers=admin_headers
    )
    assert list_res.status_code == 200
    items = list_res.json()
    assert [item["start_time"] for item in items] == ["10:30", "15:00"]


def test_list_appointments_error_missing_or_invalid_date_returns_422(
    client, admin_headers
):
    missing_res = client.get("/api/appointments", headers=admin_headers)
    assert missing_res.status_code == 422
    assert missing_res.json()["detail"] == "ارسال پارامتر تاریخ الزامی است."
    assert missing_res.json()["errors"]["date"] == "ارسال پارامتر تاریخ الزامی است."

    invalid_res = client.get(
        "/api/appointments", params={"date": "2027-5-7"}, headers=admin_headers
    )
    assert invalid_res.status_code == 422
    assert "date" in invalid_res.json()["errors"]


def test_cancel_appointment_success_preserves_record_and_frees_slot(
    client, admin_headers, future_date
):
    created = client.post(
        "/api/appointments",
        json={
            "customer_name": "مشتری اول",
            "customer_phone": "09121112233",
            "service_id": 2,
            "date": future_date,
            "start_time": "14:00",
        },
    ).json()["appointment"]

    cancel_res = client.patch(
        f"/api/appointments/{created['id']}/cancel", headers=admin_headers
    )
    assert cancel_res.status_code == 200
    cancel_body = cancel_res.json()
    assert cancel_body["success"] is True
    assert cancel_body["appointment"]["status"] == "لغو شده"

    # قانون R4: رکورد حذف نشده و در لیست نوبت‌های روز باقی مانده است
    day_items = client.get(
        "/api/appointments", params={"date": future_date}, headers=admin_headers
    ).json()
    assert len(day_items) == 1
    assert day_items[0]["status"] == "لغو شده"

    # بازه بلافاصله در GET /api/slots آزاد شده است
    slots = client.get("/api/slots", params={"date": future_date}).json()["slots"]
    slot_14 = next(s for s in slots if s["time"] == "14:00")
    assert slot_14["is_available"] is True
    assert slot_14["is_booked"] is False

    # مشتری دوم می‌تواند همان ساعت آزادشده را رزرو کند
    rebook_res = client.post(
        "/api/appointments",
        json={
            "customer_name": "مشتری دوم",
            "customer_phone": "09124445566",
            "service_id": 1,
            "date": future_date,
            "start_time": "14:00",
        },
    )
    assert rebook_res.status_code == 200
    assert (
        len(
            client.get(
                "/api/appointments", params={"date": future_date}, headers=admin_headers
            ).json()
        )
        == 2
    )

    # لغو مجدد همان نوبت از قبل لغوشده بدون خطا برمی‌گردد
    repeat_cancel = client.patch(
        f"/api/appointments/{created['id']}/cancel", headers=admin_headers
    )
    assert repeat_cancel.status_code == 200
    assert repeat_cancel.json()["success"] is True


def test_cancel_appointment_error_nonexistent_id_returns_404(client, admin_headers):
    response = client.patch("/api/appointments/99999/cancel", headers=admin_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "نوبت مورد نظر یافت نشد."


def test_cancel_appointment_error_invalid_id_type_returns_422(client, admin_headers):
    response = client.patch("/api/appointments/abc/cancel", headers=admin_headers)
    assert response.status_code == 422
    body = response.json()
    assert body["detail"] == "شناسه نوبت نامعتبر است."
    assert body["errors"]["appointment_id"] == "شناسه نوبت نامعتبر است."
