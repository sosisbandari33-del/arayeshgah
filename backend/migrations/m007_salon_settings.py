VERSION = "007_salon_settings"


def upgrade(cursor):
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)

    cursor.execute(
        "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('salon_name', 'پیرایش کلاسیک')"
    )
    cursor.execute(
        "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('cancel_deadline_hours', '2')"
    )
