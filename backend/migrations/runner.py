from migrations import (
    m001_initial_schema,
    m002_create_admin_users,
    m003_add_service_is_active,
)

MIGRATIONS = [
    (m001_initial_schema.VERSION, m001_initial_schema.upgrade),
    (m002_create_admin_users.VERSION, m002_create_admin_users.upgrade),
    (m003_add_service_is_active.VERSION, m003_add_service_is_active.upgrade),
]


def run_migrations(conn):
    """اجرای ترتیبی و ثبت‌شده‌ی migrationها بدون دست زدن به داده‌های موجود"""
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
        )
    """)

    cursor.execute("SELECT version FROM schema_migrations")
    applied = {row[0] for row in cursor.fetchall()}

    for version, upgrade_fn in MIGRATIONS:
        if version in applied:
            continue
        upgrade_fn(cursor)
        cursor.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (?, datetime('now', 'localtime'))",
            (version,),
        )

    conn.commit()
