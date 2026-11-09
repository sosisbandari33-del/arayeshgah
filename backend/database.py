import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "barbershop.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # ساخت جدول خدمات
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            duration INTEGER NOT NULL
        )
    """)

    # ساخت جدول نوبت‌ها
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            service_id INTEGER NOT NULL,
            service_name TEXT NOT NULL,
            date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'رزرو شده',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (service_id) REFERENCES services(id)
        )
    """)
    
    # بررسی خالی بودن جدول خدمات و تزریق داده‌های اولیه
    cursor.execute("SELECT COUNT(*) FROM services")
    count = cursor.fetchone()[0]
    
    if count == 0:
        initial_services = [
            ("اصلاح مو", 250000, 30),
            ("اصلاح مو و ریش", 350000, 60),
            ("رنگ مو", 900000, 90),
            ("شست‌وشو و حالت‌دهی", 150000, 30)
        ]
        cursor.executemany(
            "INSERT INTO services (name, price, duration) VALUES (?, ?, ?)",
            initial_services
        )
        conn.commit()
        
    conn.commit()
    conn.close()

def get_all_services():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, price, duration FROM services")
    rows = cursor.fetchall()
    services = [dict(row) for row in rows]
    conn.close()
    return services

def get_service_by_id(service_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, price, duration FROM services WHERE id = ?", (service_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_booked_slots(date_str: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT start_time FROM appointments WHERE date = ? AND status != 'لغو شده'",
        (date_str,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [row["start_time"] for row in rows]

def create_appointment(customer_name: str, customer_phone: str, service_id: int, service_name: str, date: str, start_time: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO appointments (customer_name, customer_phone, service_id, service_name, date, start_time, status)
        VALUES (?, ?, ?, ?, ?, ?, 'رزرو شده')
    """, (customer_name, customer_phone, service_id, service_name, date, start_time))
    conn.commit()
    new_id = cursor.lastrowid
    
    cursor.execute("SELECT * FROM appointments WHERE id = ?", (new_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)

def get_appointments_by_date(date_str: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, customer_name, customer_phone, service_id, service_name, date, start_time, status, created_at
        FROM appointments
        WHERE date = ?
        ORDER BY start_time ASC
    """, (date_str,))
    rows = cursor.fetchall()
    appointments = [dict(row) for row in rows]
    conn.close()
    return appointments

def get_appointment_by_id(appointment_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM appointments WHERE id = ?", (appointment_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def cancel_appointment(appointment_id: int):
    """
    قانون R4: لغو، نوبت را پاک نمی‌کند. وضعیتش «لغو شده» می‌شود و بازه‌اش دوباره آزاد می‌شود.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE appointments SET status = 'لغو شده' WHERE id = ?", (appointment_id,))
    conn.commit()
    
    cursor.execute("SELECT * FROM appointments WHERE id = ?", (appointment_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None
