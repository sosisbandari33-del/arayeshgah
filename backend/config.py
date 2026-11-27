"""لایه‌ی متمرکز خواندن تنظیمات محیطی (.env)
طبق قانون AGENT_RULES.md، خواندن مستقیم متغیرهای محیطی فقط در این فایل مجاز است.
"""

from dataclasses import dataclass
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
ENV_CANDIDATES = (BACKEND_DIR / ".env", PROJECT_ROOT / ".env")


def _parse_dotenv_files() -> dict[str, str]:
    values: dict[str, str] = {}
    for env_path in reversed(ENV_CANDIDATES):
        if not env_path.is_file():
            continue
        for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key:
                values[key] = val
    return values


@dataclass(frozen=True)
class Settings:
    admin_phone: str
    admin_password: str
    auth_secret_key: str
    token_ttl_seconds: int = 86400


def get_settings() -> Settings:
    file_values = {} if os.environ.get("SKIP_DOTENV") == "1" else _parse_dotenv_files()

    def read_var(name: str, default: str = "") -> str:
        if name in os.environ:
            return os.environ[name]
        return file_values.get(name, default)

    ttl_raw = read_var("AUTH_TOKEN_TTL_SECONDS", "86400")
    try:
        ttl_seconds = int(ttl_raw)
    except ValueError:
        ttl_seconds = 86400

    return Settings(
        admin_phone=read_var("ADMIN_PHONE", "").strip(),
        admin_password=read_var("ADMIN_PASSWORD", ""),
        auth_secret_key=read_var("AUTH_SECRET_KEY", "").strip(),
        token_ttl_seconds=ttl_seconds,
    )
