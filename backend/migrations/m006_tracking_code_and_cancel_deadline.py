import secrets

VERSION = "006_tracking_code_and_cancel_deadline"


def _generate_unique_6digit(existing_codes: set[str]) -> str:
    while True:
        code = f"{100000 + secrets.randbelow(900000)}"
        if code not in existing_codes:
            existing_codes.add(code)
            return code


def upgrade(cursor):
    cursor.execute("PRAGMA table_info(appointments)")
    existing_cols = {row[1] for row in cursor.fetchall()}

    if "tracking_code" not in existing_cols:
        cursor.execute("ALTER TABLE appointments ADD COLUMN tracking_code TEXT")

    cursor.execute(
        "SELECT tracking_code FROM appointments WHERE tracking_code IS NOT NULL AND tracking_code != ''"
    )
    used_codes = {row[0] for row in cursor.fetchall()}

    cursor.execute(
        "SELECT id FROM appointments WHERE tracking_code IS NULL OR tracking_code = '' ORDER BY id ASC"
    )
    missing_rows = cursor.fetchall()
    for row in missing_rows:
        code = _generate_unique_6digit(used_codes)
        cursor.execute(
            "UPDATE appointments SET tracking_code = ? WHERE id = ?",
            (code, row[0]),
        )

    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_tracking_code
        ON appointments (tracking_code)
        WHERE tracking_code IS NOT NULL
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)

    cursor.execute(
        "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('cancel_deadline_hours', '2')"
    )
