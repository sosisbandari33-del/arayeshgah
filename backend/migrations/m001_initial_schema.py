VERSION = "001_initial_schema"


def upgrade(cursor):
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            duration INTEGER NOT NULL
        )
    """)

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
            created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (service_id) REFERENCES services(id)
        )
    """)

    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_slot
        ON appointments (date, start_time)
        WHERE status != 'لغو شده'
    """)

    cursor.execute("SELECT COUNT(*) FROM services")
    count = cursor.fetchone()[0]
    if count == 0:
        initial_services = [
            ("اصلاح مو", 250000, 30),
            ("اصلاح مو و ریش", 350000, 60),
            ("رنگ مو", 900000, 90),
            ("شست‌وشو و حالت‌دهی", 150000, 30),
        ]
        cursor.executemany(
            "INSERT INTO services (name, price, duration) VALUES (?, ?, ?)",
            initial_services,
        )
