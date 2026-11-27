VERSION = "003_add_service_is_active"


def upgrade(cursor):
    cursor.execute("PRAGMA table_info(services)")
    existing_columns = {row[1] for row in cursor.fetchall()}
    if "is_active" not in existing_columns:
        cursor.execute(
            "ALTER TABLE services ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1"
        )
