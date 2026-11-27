import os
import sqlite3

from migrations.runner import run_migrations

DB_PATH = os.path.join(os.path.dirname(__file__), "barbershop.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_connection()
    try:
        run_migrations(conn)
    finally:
        conn.close()


def _format_service_row(row) -> dict:
    item = dict(row)
    if "is_active" in item:
        item["is_active"] = bool(item["is_active"])
    if "has_appointments" in item:
        item["has_appointments"] = bool(item["has_appointments"])
    return item


def get_active_services():
    """فقط خدمات فعال برای نمایش در صفحه‌ی اصلی و فرم رزرو مشتری"""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, price, duration, is_active FROM services WHERE is_active = 1 ORDER BY id ASC"
        )
        rows = cursor.fetchall()
        return [_format_service_row(row) for row in rows]
    finally:
        conn.close()


def get_all_services_admin():
    """همه‌ی خدمات (فعال و غیرفعال) همراه با وضعیت داشتن نوبت برای پنل مدیریت"""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                s.id,
                s.name,
                s.price,
                s.duration,
                s.is_active,
                EXISTS(SELECT 1 FROM appointments a WHERE a.service_id = s.id) AS has_appointments
            FROM services s
            ORDER BY s.id ASC
        """)
        rows = cursor.fetchall()
        return [_format_service_row(row) for row in rows]
    finally:
        conn.close()


def get_service_by_id(service_id: int):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                s.id,
                s.name,
                s.price,
                s.duration,
                s.is_active,
                EXISTS(SELECT 1 FROM appointments a WHERE a.service_id = s.id) AS has_appointments
            FROM services s
            WHERE s.id = ?
            """,
            (service_id,),
        )
        row = cursor.fetchone()
        return _format_service_row(row) if row else None
    finally:
        conn.close()


def get_service_by_name(name: str):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, price, duration, is_active FROM services WHERE name = ?",
            (name,),
        )
        row = cursor.fetchone()
        return _format_service_row(row) if row else None
    finally:
        conn.close()


def create_service(name: str, price: int, duration: int):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO services (name, price, duration, is_active) VALUES (?, ?, ?, 1)",
            (name, price, duration),
        )
        conn.commit()
        new_id = cursor.lastrowid
    finally:
        conn.close()
    return get_service_by_id(new_id)


def update_service(service_id: int, name: str, price: int, duration: int):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE services SET name = ?, price = ?, duration = ? WHERE id = ?",
            (name, price, duration, service_id),
        )
        conn.commit()
    finally:
        conn.close()
    return get_service_by_id(service_id)


def set_service_active_status(service_id: int, is_active: bool):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE services SET is_active = ? WHERE id = ?",
            (1 if is_active else 0, service_id),
        )
        conn.commit()
    finally:
        conn.close()
    return get_service_by_id(service_id)


def service_has_appointments(service_id: int) -> bool:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM appointments WHERE service_id = ?",
            (service_id,),
        )
        return cursor.fetchone()[0] > 0
    finally:
        conn.close()


def delete_service(service_id: int):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM services WHERE id = ?", (service_id,))
        conn.commit()
    finally:
        conn.close()


def get_booked_slots(date_str: str):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT start_time FROM appointments WHERE date = ? AND status != 'لغو شده'",
            (date_str,),
        )
        rows = cursor.fetchall()
        return [row["start_time"] for row in rows]
    finally:
        conn.close()


def create_appointment(
    customer_name: str,
    customer_phone: str,
    service_id: int,
    service_name: str,
    date: str,
    start_time: str,
):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO appointments (customer_name, customer_phone, service_id, service_name, date, start_time, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'رزرو شده', datetime('now', 'localtime'))
            """,
            (customer_name, customer_phone, service_id, service_name, date, start_time),
        )
        conn.commit()
        new_id = cursor.lastrowid

        cursor.execute("SELECT * FROM appointments WHERE id = ?", (new_id,))
        row = cursor.fetchone()
        return dict(row)
    finally:
        conn.close()


def get_appointments_by_date(date_str: str):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, customer_name, customer_phone, service_id, service_name, date, start_time, status, created_at
            FROM appointments
            WHERE date = ?
            ORDER BY start_time ASC
            """,
            (date_str,),
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_appointment_by_id(appointment_id: int):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM appointments WHERE id = ?", (appointment_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def cancel_appointment(appointment_id: int):
    """
    قانون R4: لغو، نوبت را پاک نمی‌کند. وضعیتش «لغو شده» می‌شود و بازه‌اش دوباره آزاد می‌شود.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE appointments SET status = 'لغو شده' WHERE id = ?",
            (appointment_id,),
        )
        conn.commit()

        cursor.execute("SELECT * FROM appointments WHERE id = ?", (appointment_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_admin_count() -> int:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM admin_users")
        return cursor.fetchone()[0]
    finally:
        conn.close()


def get_admin_by_phone(phone: str):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, phone, password_hash, created_at FROM admin_users WHERE phone = ?",
            (phone,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_admin_by_id(admin_id: int):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, phone, created_at FROM admin_users WHERE id = ?",
            (admin_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_admin_user(phone: str, password_hash: str):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO admin_users (phone, password_hash, created_at)
            VALUES (?, ?, datetime('now', 'localtime'))
            """,
            (phone, password_hash),
        )
        conn.commit()
        new_id = cursor.lastrowid
        cursor.execute(
            "SELECT id, phone, created_at FROM admin_users WHERE id = ?",
            (new_id,),
        )
        row = cursor.fetchone()
        return dict(row)
    finally:
        conn.close()
