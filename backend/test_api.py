import os
import sys
import sqlite3
import tempfile
import unittest
from datetime import date, timedelta

from fastapi import HTTPException
from pydantic import ValidationError

# اطمینان از در دسترس بودن ماژول‌های پوشه backend هنگام اجرا از ریشه پروژه
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

import database  # noqa: E402
import main  # noqa: E402


class BarbershopBackendTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = database.DB_PATH
        database.DB_PATH = os.path.join(self.temp_dir.name, "test_barbershop.db")
        database.init_db()
        self.future_date = (date.today() + timedelta(days=3)).strftime("%Y-%m-%d")
        self.past_date = (date.today() - timedelta(days=2)).strftime("%Y-%m-%d")

    def tearDown(self):
        database.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def test_foreign_keys_enabled_and_initial_services_match_prd(self):
        conn = database.get_connection()
        try:
            fk_enabled = conn.execute("PRAGMA foreign_keys").fetchone()[0]
            self.assertEqual(fk_enabled, 1)
        finally:
            conn.close()

        services = main.list_services()
        self.assertEqual(len(services), 4)
        expected = [
            ("اصلاح مو", 250000, 30),
            ("اصلاح مو و ریش", 350000, 60),
            ("رنگ مو", 900000, 90),
            ("شست‌وشو و حالت‌دهی", 150000, 30),
        ]
        actual = [(s["name"], s["price"], s["duration"]) for s in services]
        self.assertEqual(actual, expected)

    def test_foreign_key_constraint_enforced_at_db_level(self):
        with self.assertRaises(sqlite3.IntegrityError):
            database.create_appointment(
                customer_name="تست کلید خارجی",
                customer_phone="09121234567",
                service_id=9999,
                service_name="نامعتبر",
                date=self.future_date,
                start_time="10:00",
            )

    def test_rule_r1_slots_and_working_hours(self):
        result = main.get_daily_slots(self.future_date)
        self.assertEqual(result["date"], self.future_date)
        self.assertEqual(len(result["slots"]), 20)
        self.assertEqual(result["slots"][0]["time"], "10:00")
        self.assertEqual(result["slots"][-1]["time"], "19:30")

        for bad_time in ("09:30", "10:15", "20:00"):
            payload = main.AppointmentCreate(
                customer_name="علی رضایی",
                customer_phone="09121234567",
                service_id=1,
                date=self.future_date,
                start_time=bad_time,
            )
            with self.assertRaises(HTTPException) as ctx:
                main.book_appointment(payload)
            self.assertEqual(ctx.exception.status_code, 400)

    def test_rule_r2_double_booking_and_strict_date_format(self):
        payload = main.AppointmentCreate(
            customer_name="علی رضایی",
            customer_phone="09121234567",
            service_id=1,
            date=self.future_date,
            start_time="11:00",
        )
        first = main.book_appointment(payload)
        self.assertTrue(first["success"])

        # رزرو مجدد همان ساعت باید رد شود
        with self.assertRaises(HTTPException) as ctx:
            main.book_appointment(payload)
        self.assertEqual(ctx.exception.status_code, 400)

        # تاریخ بدون صفر پیشوند (مثل 2026-5-7) نباید بتواند قانون R2 را دور بزند
        non_padded_date = "2027-5-7"
        bad_date_payload = main.AppointmentCreate(
            customer_name="محمد کریمی",
            customer_phone="09129876543",
            service_id=1,
            date=non_padded_date,
            start_time="11:00",
        )
        with self.assertRaises(HTTPException) as ctx:
            main.book_appointment(bad_date_payload)
        self.assertEqual(ctx.exception.status_code, 400)

        # تست محافظت شاخص یکتایی دیتابیس در حالت همزمانی (Race Condition)
        with self.assertRaises(sqlite3.IntegrityError):
            database.create_appointment(
                customer_name="مشتری دوم",
                customer_phone="09120001122",
                service_id=1,
                service_name="اصلاح مو",
                date=self.future_date,
                start_time="11:00",
            )

    def test_rule_r3_past_booking_rejected(self):
        past_slots = main.get_daily_slots(self.past_date)
        self.assertTrue(all(s["is_past"] and not s["is_available"] for s in past_slots["slots"]))

        payload = main.AppointmentCreate(
            customer_name="علی رضایی",
            customer_phone="09121234567",
            service_id=1,
            date=self.past_date,
            start_time="12:00",
        )
        with self.assertRaises(HTTPException) as ctx:
            main.book_appointment(payload)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_rule_r4_cancel_preserves_record_and_frees_slot(self):
        payload = main.AppointmentCreate(
            customer_name="مشتری اول",
            customer_phone="09121112233",
            service_id=2,
            date=self.future_date,
            start_time="14:00",
        )
        created = main.book_appointment(payload)["appointment"]

        cancelled = main.cancel_appointment_endpoint(created["id"])
        self.assertTrue(cancelled["success"])
        self.assertEqual(cancelled["appointment"]["status"], "لغو شده")

        # رکورد حذف نشده و در لیست نوبت‌های روز باقی مانده است
        day_appointments = main.list_appointments(self.future_date)
        self.assertEqual(len(day_appointments), 1)
        self.assertEqual(day_appointments[0]["status"], "لغو شده")

        # بازه آزاد شده و مشتری دوم می‌تواند همان ساعت را رزرو کند
        second_payload = main.AppointmentCreate(
            customer_name="مشتری دوم",
            customer_phone="09124445566",
            service_id=1,
            date=self.future_date,
            start_time="14:00",
        )
        second = main.book_appointment(second_payload)
        self.assertTrue(second["success"])
        self.assertEqual(len(main.list_appointments(self.future_date)), 2)

    def test_name_and_phone_validation(self):
        # نام ۵۰ کاراکتری همراه با فاصله در ابتدا و انتها باید پذیرفته و تمیز شود
        exact_50 = "ا" * 50
        valid_payload = main.AppointmentCreate(
            customer_name=f"  {exact_50}  ",
            customer_phone="۰۹۱۲ ۱۲۳-۴۵۶۷",
            service_id=1,
            date=self.future_date,
            start_time="15:00",
        )
        saved = main.book_appointment(valid_payload)["appointment"]
        self.assertEqual(saved["customer_name"], exact_50)
        self.assertEqual(saved["customer_phone"], "09121234567")

        # نام فقط فاصله باید رد شود
        with self.assertRaises(ValidationError):
            main.AppointmentCreate(
                customer_name="     ",
                customer_phone="09121234567",
                service_id=1,
                date=self.future_date,
                start_time="15:30",
            )

        # نام ۵۱ کاراکتری باید رد شود
        with self.assertRaises(ValidationError):
            main.AppointmentCreate(
                customer_name="ب" * 51,
                customer_phone="09121234567",
                service_id=1,
                date=self.future_date,
                start_time="15:30",
            )

        # شماره موبایل حاوی حروف باید رد شود
        bad_phone_payload = main.AppointmentCreate(
            customer_name="سارا احمدی",
            customer_phone="0912abc3456789",
            service_id=1,
            date=self.future_date,
            start_time="15:30",
        )
        with self.assertRaises(HTTPException) as ctx:
            main.book_appointment(bad_phone_payload)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_missing_date_validation_handler_message(self):
        import asyncio
        import json
        from fastapi.exceptions import RequestValidationError

        exc = RequestValidationError([{"type": "missing", "loc": ("query", "date"), "msg": "Field required"}])
        response = asyncio.run(main.validation_exception_handler(None, exc))
        self.assertEqual(response.status_code, 400)
        body = json.loads(response.body.decode("utf-8"))
        self.assertEqual(body["detail"], "ارسال پارامتر تاریخ الزامی است.")


if __name__ == "__main__":
    unittest.main()
