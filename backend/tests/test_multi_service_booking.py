from datetime import date, timedelta


def _next_friday_str() -> str:
    d = date.today() + timedelta(days=1)
    while d.weekday() != 4:  # 4 = Friday
        d += timedelta(days=1)
    return d.strftime("%Y-%m-%d")


def test_scenario_1_multi_service_90min_working_hours_boundary_r6_r8(
    client, admin_headers, future_date
):
    """
    سناریوی ۱: انتخاب اصلاح مو (۳۰ دقیقه) + اصلاح مو و ریش (۶۰ دقیقه) = ۹۰ دقیقه در ساعت کاری ۱۰ تا ۲۰.
    - ۱۸:۳۰ (تا ۲۰:۰۰) مجاز و نمایش داده می‌شود.
    - ۱۹:۰۰ (تا ۲۰:۳۰) و ۱۹:۳۰ (تا ۲۱:۰۰) نمایش داده نمی‌شوند و در بک‌اند هم رد می‌شوند.
    """
    slots_res = client.get(
        "/api/slots", params={"date": future_date, "service_ids": "1,2"}
    )
    assert slots_res.status_code == 200
    body = slots_res.json()
    assert body["total_duration"] == 90
    assert body["total_price"] == 600000

    times = [s["time"] for s in body["slots"]]
    assert "10:00" in times
    assert "18:30" in times
    assert "19:00" not in times
    assert "19:30" not in times
    assert all(s["is_available"] is True for s in body["slots"])

    slot_1830 = next(s for s in body["slots"] if s["time"] == "18:30")
    assert slot_1830["end_time"] == "20:00"

    # دور زدن فرم برای ثبت در ۱۹:۰۰ و ۱۹:۳۰ باید با ۴۰۰ رد شود
    for invalid_start in ("19:00", "19:30"):
        bad_res = client.post(
            "/api/appointments",
            json={
                "customer_name": "رضا محمدی",
                "customer_phone": "09121112233",
                "service_ids": [1, 2],
                "date": future_date,
                "start_time": invalid_start,
            },
        )
        assert bad_res.status_code == 400

    # ثبت معتبر در ۱۸:۳۰
    ok_res = client.post(
        "/api/appointments",
        json={
            "customer_name": "رضا محمدی",
            "customer_phone": "09121112233",
            "service_ids": [1, 2],
            "date": future_date,
            "start_time": "18:30",
        },
    )
    assert ok_res.status_code == 200
    appt = ok_res.json()["appointment"]
    assert appt["start_time"] == "18:30"
    assert appt["end_time"] == "20:00"
    assert appt["total_duration"] == 90
    assert appt["total_price"] == 600000
    assert appt["service_ids"] == [1, 2]
    assert appt["service_name"] == "اصلاح مو + اصلاح مو و ریش"

    # حفاظت حذف برای هر دو خدمتِ داخل نوبت چندخدمتی (حتی خدمت دوم)
    del_svc2 = client.delete("/api/admin/services/2", headers=admin_headers)
    assert del_svc2.status_code == 409


def test_scenario_2_custom_35min_duration_end_of_day_boundary_r6_r8(
    client, admin_headers, future_date
):
    """
    سناریوی ۲: خدمت ۳۵ دقیقه‌ای در ساعت کاری ۱۰:۰۰ تا ۲۰:۰۰.
    - ۱۹:۰۰ (تا ۱۹:۳۵) مجاز است.
    - ۱۹:۳۰ (تا ۲۰:۰۵) به دلیل خروج ۵ دقیقه‌ای از ۲۰:۰۰ نمایش داده نمی‌شود و بک‌اند رد می‌کند.
    """
    svc_res = client.post(
        "/api/admin/services",
        headers=admin_headers,
        json={"name": "اصلاح ویژه ۳۵ دقیقه‌ای", "price": 320000, "duration": 35},
    )
    assert svc_res.status_code == 201
    svc_35_id = svc_res.json()["service"]["id"]

    slots_res = client.get(
        "/api/slots", params={"date": future_date, "service_ids": str(svc_35_id)}
    )
    assert slots_res.status_code == 200
    times = [s["time"] for s in slots_res.json()["slots"]]
    assert "19:00" in times
    assert "19:30" not in times

    reject_1930 = client.post(
        "/api/appointments",
        json={
            "customer_name": "مهدی کریمی",
            "customer_phone": "09123334455",
            "service_ids": [svc_35_id],
            "date": future_date,
            "start_time": "19:30",
        },
    )
    assert reject_1930.status_code == 400

    allow_1900 = client.post(
        "/api/appointments",
        json={
            "customer_name": "مهدی کریمی",
            "customer_phone": "09123334455",
            "service_ids": [svc_35_id],
            "date": future_date,
            "start_time": "19:00",
        },
    )
    assert allow_1900.status_code == 200
    assert allow_1900.json()["appointment"]["end_time"] == "19:35"


def test_scenario_3_partial_leave_14_to_16_with_25_plus_35_min_services_r7_r8(
    client, admin_headers, future_date
):
    """
    سناریوی ۳: مرخصی ساعتی ۱۴:۰۰ تا ۱۶:۰۰؛ انتخاب دو خدمت ۲۵ + ۳۵ دقیقه‌ای = ۶۰ دقیقه.
    - ۱۳:۰۰ (تا ۱۴:۰۰) و ۱۶:۰۰ (تا ۱۷:۰۰) مجازند.
    - ۱۳:۳۰ (تا ۱۴:۳۰) و ۱۴:۰۰ تا ۱۵:۳۰ نمایش داده نمی‌شوند و در بک‌اند رد می‌شوند.
    """
    s25 = client.post(
        "/api/admin/services",
        headers=admin_headers,
        json={"name": "پیرایش سریع ۲۵", "price": 200000, "duration": 25},
    ).json()["service"]["id"]
    s35 = client.post(
        "/api/admin/services",
        headers=admin_headers,
        json={"name": "اصلاح کامل ۳۵", "price": 300000, "duration": 35},
    ).json()["service"]["id"]

    leave_res = client.post(
        "/api/admin/time-offs",
        headers=admin_headers,
        json={
            "date": future_date,
            "is_full_day": False,
            "start_time": "14:00",
            "end_time": "16:00",
            "reason": "مرخصی ناهار",
        },
    )
    assert leave_res.status_code == 201

    slots_res = client.get(
        "/api/slots", params={"date": future_date, "service_ids": f"{s25},{s35}"}
    )
    assert slots_res.status_code == 200
    times = [s["time"] for s in slots_res.json()["slots"]]

    assert "13:00" in times
    assert "16:00" in times
    for blocked in ("13:30", "14:00", "14:30", "15:00", "15:30"):
        assert blocked not in times

    # ارسال مستقیم در ۱۳:۳۰ (ورود ۳۰ دقیقه‌ای به مرخصی) باید رد شود
    bad_1330 = client.post(
        "/api/appointments",
        json={
            "customer_name": "کاوه علوی",
            "customer_phone": "09124445566",
            "service_ids": [s25, s35],
            "date": future_date,
            "start_time": "13:30",
        },
    )
    assert bad_1330.status_code == 400

    # ثبت در ۱۳:۰۰ (پایان دقیق ۱۴:۰۰) و ۱۶:۰۰ (شروع دقیق پس از مرخصی) مجاز است
    ok_1300 = client.post(
        "/api/appointments",
        json={
            "customer_name": "کاوه علوی",
            "customer_phone": "09124445566",
            "service_ids": [s25, s35],
            "date": future_date,
            "start_time": "13:00",
        },
    )
    assert ok_1300.status_code == 200
    assert ok_1300.json()["appointment"]["end_time"] == "14:00"

    ok_1600 = client.post(
        "/api/appointments",
        json={
            "customer_name": "امیر حسینی",
            "customer_phone": "09125556677",
            "service_ids": [s25, s35],
            "date": future_date,
            "start_time": "16:00",
        },
    )
    assert ok_1600.status_code == 200
    assert ok_1600.json()["appointment"]["end_time"] == "17:00"


def test_scenario_4_existing_appointment_overlap_real_duration_r5_r8(
    client, admin_headers, future_date
):
    """
    سناریوی ۴:
    - نوبت فعال ۶۰ دقیقه‌ای در ۱۱:۰۰ (اشغال ۱۱:۰۰ تا ۱۲:۰۰):
      * خدمت ۹۰ دقیقه‌ای در ۱۰:۰۰، ۱۰:۳۰، ۱۱:۰۰ و ۱۱:۳۰ غیرمجاز؛ در ۱۲:۰۰ مجاز است.
      * خدمت ۲۵ دقیقه‌ای در ۱۰:۳۰ (۱۰:۳۰ تا ۱۰:۵۵) مجاز است.
    - نوبت ۳۵ دقیقه‌ای در ۱۰:۰۰ (۱۰:۰۰ تا ۱۰:۳۵) باعث غیرمجاز شدن ۱۰:۳۰ (۵ دقیقه همپوشانی) و مجاز ماندن ۱۱:۰۰ می‌شود.
    """
    s25 = client.post(
        "/api/admin/services",
        headers=admin_headers,
        json={"name": "خدمت ۲۵ دقیقه‌ای", "price": 180000, "duration": 25},
    ).json()["service"]["id"]
    s35 = client.post(
        "/api/admin/services",
        headers=admin_headers,
        json={"name": "خدمت ۳۵ دقیقه‌ای", "price": 240000, "duration": 35},
    ).json()["service"]["id"]

    # ۱. ثبت نوبت ۶۰ دقیقه‌ای (شناسه ۲) در ساعت ۱۱:۰۰ (۱۱:۰۰ تا ۱۲:۰۰)
    res_1100 = client.post(
        "/api/appointments",
        json={
            "customer_name": "مشتری اول",
            "customer_phone": "09121002000",
            "service_ids": [2],
            "date": future_date,
            "start_time": "11:00",
        },
    )
    assert res_1100.status_code == 200
    assert res_1100.json()["appointment"]["end_time"] == "12:00"

    # بررسی اسلات‌ها برای خدمت ۹۰ دقیقه‌ای (شناسه ۳ — رنگ مو)
    slots_90 = [
        s["time"]
        for s in client.get(
            "/api/slots", params={"date": future_date, "service_ids": "3"}
        ).json()["slots"]
    ]
    for overlapped in ("10:00", "10:30", "11:00", "11:30"):
        assert overlapped not in slots_90
    assert "12:00" in slots_90

    # دور زدن فرم برای ۹۰ دقیقه‌ای در ۱۰:۰۰ (۱۰:۰۰ تا ۱۱:۳۰) باید رد شود
    bad_1000 = client.post(
        "/api/appointments",
        json={
            "customer_name": "مشتری دوم",
            "customer_phone": "09121003000",
            "service_ids": [3],
            "date": future_date,
            "start_time": "10:00",
        },
    )
    assert bad_1000.status_code == 400

    # برای خدمت ۲۵ دقیقه‌ای، ساعت ۱۰:۳۰ (۱۰:۳۰ تا ۱۰:۵۵) قبل از ۱۱:۰۰ جا می‌شود
    slots_25_before = [
        s["time"]
        for s in client.get(
            "/api/slots", params={"date": future_date, "service_ids": str(s25)}
        ).json()["slots"]
    ]
    assert "10:30" in slots_25_before

    # ۲. ثبت نوبت ۳۵ دقیقه‌ای در ۱۰:۰۰ (۱۰:۰۰ تا ۱۰:۳۵) -> اکنون ۱۰:۳۰ باید ۵ دقیقه همپوشانی داشته باشد و بسته شود
    res_1000_35 = client.post(
        "/api/appointments",
        json={
            "customer_name": "مشتری سوم",
            "customer_phone": "09121004000",
            "service_ids": [s35],
            "date": future_date,
            "start_time": "10:00",
        },
    )
    assert res_1000_35.status_code == 200
    assert res_1000_35.json()["appointment"]["end_time"] == "10:35"

    slots_25_after = [
        s["time"]
        for s in client.get(
            "/api/slots", params={"date": future_date, "service_ids": str(s25)}
        ).json()["slots"]
    ]
    assert "10:30" not in slots_25_after
    assert "12:00" in slots_25_after

    reject_1030 = client.post(
        "/api/appointments",
        json={
            "customer_name": "مشتری چهارم",
            "customer_phone": "09121005000",
            "service_ids": [s25],
            "date": future_date,
            "start_time": "10:30",
        },
    )
    assert reject_1030.status_code == 400


def test_scenario_5_friday_and_specific_holiday_reject_multi_service_r7(
    client, admin_headers, future_date
):
    """سناریوی ۵: روز جمعه‌ی تعطیل و تاریخ تعطیل خاص هیچ ساعتی نشان نمی‌دهند و بک‌اند هم رد می‌کند."""
    friday_str = _next_friday_str()
    fri_slots = client.get(
        "/api/slots", params={"date": friday_str, "service_ids": "1,4"}
    ).json()
    assert fri_slots["is_closed_day"] is True
    assert fri_slots["slots"] == []

    fri_book = client.post(
        "/api/appointments",
        json={
            "customer_name": "سروش رضوی",
            "customer_phone": "09127778899",
            "service_ids": [1, 4],
            "date": friday_str,
            "start_time": "11:00",
        },
    )
    assert fri_book.status_code == 400

    # تعطیلی تاریخ خاص
    client.post(
        "/api/admin/time-offs",
        headers=admin_headers,
        json={"date": future_date, "is_full_day": True, "reason": "تعطیلی رسمی"},
    )
    hol_slots = client.get(
        "/api/slots", params={"date": future_date, "service_ids": "1,4"}
    ).json()
    assert hol_slots["is_closed_day"] is True
    assert hol_slots["slots"] == []

    hol_book = client.post(
        "/api/appointments",
        json={
            "customer_name": "سروش رضوی",
            "customer_phone": "09127778899",
            "service_ids": [1, 4],
            "date": future_date,
            "start_time": "11:00",
        },
    )
    assert hol_book.status_code == 400


def test_scenario_6_cancel_multi_service_appointment_frees_all_covered_slots_r4_r5(
    client, admin_headers, future_date
):
    """سناریوی ۶: لغو نوبت ۹۰ دقیقه‌ای (۱۰:۰۰ تا ۱۱:۳۰) بدون حذف رکورد تمام بازه‌های ۱۰:۰۰، ۱۰:۳۰ و ۱۱:۰۰ را آزاد می‌کند."""
    booked = client.post(
        "/api/appointments",
        json={
            "customer_name": "بهرام صادقی",
            "customer_phone": "09128889900",
            "service_ids": [1, 2],
            "date": future_date,
            "start_time": "10:00",
        },
    )
    assert booked.status_code == 200
    appt_id = booked.json()["appointment"]["id"]

    before_cancel = [
        s["time"]
        for s in client.get(
            "/api/slots", params={"date": future_date, "service_ids": "1"}
        ).json()["slots"]
    ]
    assert "10:00" not in before_cancel
    assert "10:30" not in before_cancel
    assert "11:00" not in before_cancel
    assert "11:30" in before_cancel

    cancel_res = client.patch(
        f"/api/appointments/{appt_id}/cancel", headers=admin_headers
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["appointment"]["status"] == "لغو شده"

    after_cancel = [
        s["time"]
        for s in client.get(
            "/api/slots", params={"date": future_date, "service_ids": "1"}
        ).json()["slots"]
    ]
    assert "10:00" in after_cancel
    assert "10:30" in after_cancel
    assert "11:00" in after_cancel


def test_multi_service_validation_errors_return_422(client, admin_headers, future_date):
    """بررسی خطاهای ۴۲۲ برای آرایه‌ی خالی خدمات، خدمت تکراری، خدمت غیرفعال یا ناموجود"""
    # غیرفعال کردن خدمت ۴
    client.patch(
        "/api/admin/services/4/status",
        headers=admin_headers,
        json={"is_active": False},
    )

    for bad_ids in ([], [1, 1], [1, 4], [1, 999], [-2]):
        res = client.post(
            "/api/appointments",
            json={
                "customer_name": "فرهاد امامی",
                "customer_phone": "09126667788",
                "service_ids": bad_ids,
                "date": future_date,
                "start_time": "10:00",
            },
        )
        assert res.status_code == 422
        assert "service_ids" in res.json()["errors"]

    for bad_query in ("", "1,1", "1,4", "1,999", "abc"):
        q_res = client.get(
            "/api/slots", params={"date": future_date, "service_ids": bad_query}
        )
        assert q_res.status_code == 422
        assert "service_ids" in q_res.json()["errors"]
