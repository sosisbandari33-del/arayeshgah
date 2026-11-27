VERSION = "004_working_hours_and_time_offs"


def upgrade(cursor):
    # جدول ساعت کاری هفتگی: 0=شنبه الی 6=جمعه
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS working_hours (
            day_of_week INTEGER PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6),
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            is_closed INTEGER NOT NULL DEFAULT 0
        )
    """)

    cursor.execute("SELECT COUNT(*) FROM working_hours")
    if cursor.fetchone()[0] == 0:
        # پیش‌فرض: شنبه (0) تا پنج‌شنبه (5) ساعت 10:00 تا 20:00 باز، و جمعه (6) تعطیل
        default_days = [
            (0, "10:00", "20:00", 0),
            (1, "10:00", "20:00", 0),
            (2, "10:00", "20:00", 0),
            (3, "10:00", "20:00", 0),
            (4, "10:00", "20:00", 0),
            (5, "10:00", "20:00", 0),
            (6, "10:00", "20:00", 1),
        ]
        cursor.executemany(
            "INSERT INTO working_hours (day_of_week, start_time, end_time, is_closed) VALUES (?, ?, ?, ?)",
            default_days,
        )

    # جدول تعطیلی تاریخ خاص و مرخصی چندساعته در یک روز
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS time_offs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            is_full_day INTEGER NOT NULL DEFAULT 0,
            start_time TEXT,
            end_time TEXT,
            reason TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
        )
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_time_offs_date
        ON time_offs (date)
    """)
