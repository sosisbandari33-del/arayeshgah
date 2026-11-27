import os
import secrets
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
                (
                    EXISTS(SELECT 1 FROM appointments a WHERE a.service_id = s.id)
                    OR EXISTS(SELECT 1 FROM appointment_services aps WHERE aps.service_id = s.id)
                ) AS has_appointments
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
                (
                    EXISTS(SELECT 1 FROM appointments a WHERE a.service_id = s.id)
                    OR EXISTS(SELECT 1 FROM appointment_services aps WHERE aps.service_id = s.id)
                ) AS has_appointments
            FROM services s
            WHERE s.id = ?
            """,
            (service_id,),
        )
        row = cursor.fetchone()
        return _format_service_row(row) if row else None
    finally:
        conn.close()


def get_services_by_ids(service_ids: list[int]) -> list[dict]:
    if not service_ids:
        return []
    conn = get_connection()
    try:
        cursor = conn.cursor()
        placeholders = ",".join("?" for _ in service_ids)
        cursor.execute(
            f"SELECT id, name, price, duration, is_active FROM services WHERE id IN ({placeholders})",
            tuple(service_ids),
        )
        by_id = {row["id"]: _format_service_row(row) for row in cursor.fetchall()}
        return [by_id[sid] for sid in service_ids if sid in by_id]
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
            """
            SELECT (
                EXISTS(SELECT 1 FROM appointments WHERE service_id = ?)
                OR EXISTS(SELECT 1 FROM appointment_services WHERE service_id = ?)
            )
            """,
            (service_id, service_id),
        )
        return bool(cursor.fetchone()[0])
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


def _attach_appointment_services(cursor, rows) -> list[dict]:
    items = [dict(row) for row in rows]
    if not items:
        return []

    appt_ids = [item["id"] for item in items]
    placeholders = ",".join("?" for _ in appt_ids)
    cursor.execute(
        f"""
        SELECT appointment_id, service_id, service_name, price, duration
        FROM appointment_services
        WHERE appointment_id IN ({placeholders})
        ORDER BY rowid ASC
        """,
        tuple(appt_ids),
    )
    svc_map: dict[int, list[dict]] = {aid: [] for aid in appt_ids}
    for srow in cursor.fetchall():
        svc_map[srow["appointment_id"]].append(
            {
                "id": srow["service_id"],
                "name": srow["service_name"],
                "price": srow["price"],
                "duration": srow["duration"],
            }
        )

    for item in items:
        svcs = svc_map.get(item["id"], [])
        if not svcs and item.get("service_id"):
            svcs = [
                {
                    "id": item["service_id"],
                    "name": item["service_name"],
                    "price": item.get("total_price") or 0,
                    "duration": item.get("total_duration") or 30,
                }
            ]
        item["services"] = svcs
        item["service_ids"] = [s["id"] for s in svcs]
        if not item.get("total_duration"):
            item["total_duration"] = sum(s["duration"] for s in svcs) or 30
        if item.get("total_price") is None:
            item["total_price"] = sum(s["price"] for s in svcs)

    return items


def _hhmm_to_min(val: str) -> int:
    h, m = map(int, val.split(":"))
    return h * 60 + m


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


def get_active_appointment_intervals(date_str: str) -> list[dict]:
    """برگرداندن بازه‌های زمانی اشغال‌شده‌ی نوبت‌های فعال یک روز بر اساس مدت واقعی آن‌ها (قانون R5)"""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, start_time, end_time, COALESCE(total_duration, 30) AS total_duration
            FROM appointments
            WHERE date = ? AND status != 'لغو شده'
            ORDER BY start_time ASC
            """,
            (date_str,),
        )
        intervals = []
        for row in cursor.fetchall():
            start_min = _hhmm_to_min(row["start_time"])
            dur = int(row["total_duration"] or 30)
            end_min = start_min + dur
            intervals.append(
                {
                    "id": row["id"],
                    "start_time": row["start_time"],
                    "end_time": row["end_time"],
                    "start_min": start_min,
                    "end_min": end_min,
                    "total_duration": dur,
                }
            )
        return intervals
    finally:
        conn.close()


def _generate_unique_tracking_code(cursor) -> str:
    """تولید کد پیگیری ۶ رقمی تصادفی یکتا برای هر نوبت"""
    for _ in range(50):
        code = f"{100000 + secrets.randbelow(900000)}"
        cursor.execute(
            "SELECT 1 FROM appointments WHERE tracking_code = ?",
            (code,),
        )
        if cursor.fetchone() is None:
            return code
    raise RuntimeError("خطا در تولید کد پیگیری یکتا")


def create_appointment(
    customer_name: str,
    customer_phone: str,
    date: str,
    start_time: str,
    services_list: list[dict] | None = None,
    service_id: int | None = None,
    service_name: str | None = None,
    end_time: str | None = None,
    total_duration: int | None = None,
    total_price: int | None = None,
):
    if services_list is None:
        if service_id is None:
            raise ValueError("service_id or services_list is required")
        svc_row = get_service_by_id(service_id)
        inferred_dur = total_duration if total_duration is not None else (svc_row["duration"] if svc_row else 30)
        inferred_price = total_price if total_price is not None else (svc_row["price"] if svc_row else 0)
        services_list = [
            {
                "id": service_id,
                "name": service_name or (svc_row["name"] if svc_row else ""),
                "price": inferred_price,
                "duration": inferred_dur,
            }
        ]

    final_duration = total_duration if total_duration is not None else sum(s["duration"] for s in services_list)
    final_price = total_price if total_price is not None else sum(s["price"] for s in services_list)
    new_start_min = _hhmm_to_min(start_time)
    new_end_min = new_start_min + final_duration
    final_end_time = end_time or f"{(new_end_min // 60) % 24:02d}:{new_end_min % 60:02d}"

    primary_service = services_list[0]
    combined_name = " + ".join(s["name"] for s in services_list)

    conn = sqlite3.connect(DB_PATH, isolation_level=None)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")

        cursor.execute(
            """
            SELECT id, start_time, COALESCE(total_duration, 30) AS total_duration
            FROM appointments
            WHERE date = ? AND status != 'لغو شده'
            """,
            (date,),
        )
        for existing in cursor.fetchall():
            ex_start = _hhmm_to_min(existing["start_time"])
            ex_end = ex_start + int(existing["total_duration"] or 30)
            if new_start_min < ex_end and new_end_min > ex_start:
                conn.execute("ROLLBACK")
                raise sqlite3.IntegrityError("OVERLAP_CONFLICT")

        tracking_code = _generate_unique_tracking_code(cursor)

        cursor.execute(
            """
            INSERT INTO appointments (
                customer_name,
                customer_phone,
                service_id,
                service_name,
                date,
                start_time,
                end_time,
                total_duration,
                total_price,
                tracking_code,
                status,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'رزرو شده', datetime('now', 'localtime'))
            """,
            (
                customer_name,
                customer_phone,
                primary_service["id"],
                combined_name,
                date,
                start_time,
                final_end_time,
                final_duration,
                final_price,
                tracking_code,
            ),
        )
        new_id = cursor.lastrowid

        for svc in services_list:
            cursor.execute(
                """
                INSERT INTO appointment_services
                    (appointment_id, service_id, service_name, price, duration)
                VALUES (?, ?, ?, ?, ?)
                """,
                (new_id, svc["id"], svc["name"], svc["price"], svc["duration"]),
            )

        conn.execute("COMMIT")

        cursor.execute("SELECT * FROM appointments WHERE id = ?", (new_id,))
        row = cursor.fetchone()
        return _attach_appointment_services(cursor, [row])[0]
    except Exception:
        if conn.in_transaction:
            conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def get_appointments_by_date(date_str: str):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                id, customer_name, customer_phone, service_id, service_name,
                date, start_time, end_time, total_duration, total_price, tracking_code, status, created_at
            FROM appointments
            WHERE date = ?
            ORDER BY start_time ASC
            """,
            (date_str,),
        )
        rows = cursor.fetchall()
        return _attach_appointment_services(cursor, rows)
    finally:
        conn.close()


def get_appointment_by_phone_and_tracking(customer_phone: str, tracking_code: str):
    """جستجوی دقیق یک نوبت فقط با تطابق هم‌زمان شماره موبایل و کد پیگیری ۶ رقمی (قانون R9)"""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT *
            FROM appointments
            WHERE customer_phone = ? AND tracking_code = ?
            """,
            (customer_phone, tracking_code),
        )
        row = cursor.fetchone()
        if not row:
            return None
        return _attach_appointment_services(cursor, [row])[0]
    finally:
        conn.close()


def get_cancel_deadline_hours() -> int:
    """خواندن مهلت لغو نوبت (به ساعت) از جدول تنظیمات؛ پیش‌فرض ۲ ساعت قبل (قانون R9)"""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT value FROM app_settings WHERE key = 'cancel_deadline_hours'"
        )
        row = cursor.fetchone()
        if row is None:
            return 2
        return max(0, int(row["value"]))
    except (ValueError, sqlite3.Error):
        return 2
    finally:
        conn.close()


def get_appointment_by_id(appointment_id: int):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM appointments WHERE id = ?", (appointment_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return _attach_appointment_services(cursor, [row])[0]
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
        if not row:
            return None
        return _attach_appointment_services(cursor, [row])[0]
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


def get_all_working_hours():
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT day_of_week, start_time, end_time, is_closed FROM working_hours ORDER BY day_of_week ASC"
        )
        rows = cursor.fetchall()
        return [
            {
                "day_of_week": row["day_of_week"],
                "start_time": row["start_time"],
                "end_time": row["end_time"],
                "is_closed": bool(row["is_closed"]),
            }
            for row in rows
        ]
    finally:
        conn.close()


def get_working_hours_for_day(day_of_week: int):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT day_of_week, start_time, end_time, is_closed FROM working_hours WHERE day_of_week = ?",
            (day_of_week,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "day_of_week": row["day_of_week"],
            "start_time": row["start_time"],
            "end_time": row["end_time"],
            "is_closed": bool(row["is_closed"]),
        }
    finally:
        conn.close()


def save_all_working_hours(days: list[dict]):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        for item in days:
            cursor.execute(
                """
                INSERT INTO working_hours (day_of_week, start_time, end_time, is_closed)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(day_of_week) DO UPDATE SET
                    start_time = excluded.start_time,
                    end_time = excluded.end_time,
                    is_closed = excluded.is_closed
                """,
                (
                    item["day_of_week"],
                    item["start_time"],
                    item["end_time"],
                    1 if item["is_closed"] else 0,
                ),
            )
        conn.commit()
    finally:
        conn.close()
    return get_all_working_hours()


def _format_time_off_row(row) -> dict:
    item = dict(row)
    item["is_full_day"] = bool(item["is_full_day"])
    return item


def get_all_time_offs():
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, date, is_full_day, start_time, end_time, reason, created_at
            FROM time_offs
            ORDER BY date ASC, is_full_day DESC, start_time ASC, id ASC
            """
        )
        rows = cursor.fetchall()
        return [_format_time_off_row(row) for row in rows]
    finally:
        conn.close()


def get_time_offs_by_date(date_str: str):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, date, is_full_day, start_time, end_time, reason, created_at
            FROM time_offs
            WHERE date = ?
            ORDER BY is_full_day DESC, start_time ASC, id ASC
            """,
            (date_str,),
        )
        rows = cursor.fetchall()
        return [_format_time_off_row(row) for row in rows]
    finally:
        conn.close()


def get_time_off_by_id(time_off_id: int):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, date, is_full_day, start_time, end_time, reason, created_at FROM time_offs WHERE id = ?",
            (time_off_id,),
        )
        row = cursor.fetchone()
        return _format_time_off_row(row) if row else None
    finally:
        conn.close()


def create_time_off(
    date_str: str,
    is_full_day: bool,
    start_time: str | None,
    end_time: str | None,
    reason: str,
):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO time_offs (date, is_full_day, start_time, end_time, reason, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
            """,
            (
                date_str,
                1 if is_full_day else 0,
                None if is_full_day else start_time,
                None if is_full_day else end_time,
                reason,
            ),
        )
        conn.commit()
        new_id = cursor.lastrowid
    finally:
        conn.close()
    return get_time_off_by_id(new_id)


def delete_time_off(time_off_id: int):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM time_offs WHERE id = ?", (time_off_id,))
        conn.commit()
    finally:
        conn.close()


def get_active_appointments_from_date(from_date_str: str):
    """دریافت تمام نوبت‌های فعال از یک تاریخ به بعد برای بررسی تداخل با تعطیلی/تغییر ساعت کاری"""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                id, customer_name, customer_phone, service_id, service_name,
                date, start_time, end_time, COALESCE(total_duration, 30) AS total_duration,
                total_price, status
            FROM appointments
            WHERE date >= ? AND status != 'لغو شده'
            ORDER BY date ASC, start_time ASC
            """,
            (from_date_str,),
        )
        rows = cursor.fetchall()
        return _attach_appointment_services(cursor, rows)
    finally:
        conn.close()


def get_active_appointments_by_date(date_str: str):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                id, customer_name, customer_phone, service_id, service_name,
                date, start_time, end_time, COALESCE(total_duration, 30) AS total_duration,
                total_price, status
            FROM appointments
            WHERE date = ? AND status != 'لغو شده'
            ORDER BY start_time ASC
            """,
            (date_str,),
        )
        rows = cursor.fetchall()
        return _attach_appointment_services(cursor, rows)
    finally:
        conn.close()
