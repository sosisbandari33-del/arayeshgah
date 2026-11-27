VERSION = "005_multi_service_appointments"


def _add_minutes_hhmm(start_time: str, duration_min: int) -> str:
    try:
        parts = (start_time or "10:00").split(":")
        total = int(parts[0]) * 60 + int(parts[1]) + int(duration_min)
        return f"{(total // 60) % 24:02d}:{total % 60:02d}"
    except (ValueError, IndexError):
        return start_time


def upgrade(cursor):
    cursor.execute("PRAGMA table_info(appointments)")
    existing_cols = {row[1] for row in cursor.fetchall()}

    if "end_time" not in existing_cols:
        cursor.execute("ALTER TABLE appointments ADD COLUMN end_time TEXT")
    if "total_duration" not in existing_cols:
        cursor.execute("ALTER TABLE appointments ADD COLUMN total_duration INTEGER")
    if "total_price" not in existing_cols:
        cursor.execute("ALTER TABLE appointments ADD COLUMN total_price INTEGER")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS appointment_services (
            appointment_id INTEGER NOT NULL,
            service_id INTEGER NOT NULL,
            service_name TEXT NOT NULL,
            price INTEGER NOT NULL,
            duration INTEGER NOT NULL,
            PRIMARY KEY (appointment_id, service_id),
            FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
            FOREIGN KEY (service_id) REFERENCES services(id)
        )
    """)

    cursor.execute("""
        SELECT
            a.id,
            a.service_id,
            a.service_name,
            a.start_time,
            a.end_time,
            a.total_duration,
            a.total_price,
            COALESCE(s.duration, 30) AS svc_duration,
            COALESCE(s.price, 0) AS svc_price
        FROM appointments a
        LEFT JOIN services s ON s.id = a.service_id
    """)
    rows = cursor.fetchall()

    for row in rows:
        appt_id = row[0]
        svc_id = row[1]
        svc_name = row[2]
        start_time = row[3]
        cur_end = row[4]
        cur_dur = row[5]
        cur_price = row[6]
        svc_dur = row[7]
        svc_price = row[8]

        final_dur = cur_dur if cur_dur is not None else svc_dur
        final_price = cur_price if cur_price is not None else svc_price
        final_end = cur_end if cur_end else _add_minutes_hhmm(start_time, final_dur)

        cursor.execute(
            """
            UPDATE appointments
            SET end_time = ?, total_duration = ?, total_price = ?
            WHERE id = ?
            """,
            (final_end, final_dur, final_price, appt_id),
        )

        cursor.execute(
            """
            INSERT OR IGNORE INTO appointment_services
                (appointment_id, service_id, service_name, price, duration)
            VALUES (?, ?, ?, ?, ?)
            """,
            (appt_id, svc_id, svc_name, svc_price, svc_dur),
        )
