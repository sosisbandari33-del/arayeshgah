"""خطاهای دامنه‌ی کسب‌وکار (مستقل از لایه‌ی HTTP و FastAPI)"""


class DomainError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class FieldValidationError(DomainError):
    """خطای اعتبارسنجی ورودی به تفکیک هر فیلد (HTTP 422)"""

    def __init__(self, errors: dict[str, str], message: str | None = None):
        self.errors = errors
        summary = message or next(iter(errors.values()), "داده‌های ورودی نامعتبر است.")
        super().__init__(summary)


class ValidationDomainError(DomainError):
    """خطای نقض قوانین کسب‌وکار روی ورودی معتبر"""


class ConflictDomainError(DomainError):
    """خطای تداخل بازه‌ی زمانی یا رزرو همزمان"""


class NotFoundDomainError(DomainError):
    """خطای یافت نشدن موجودیت (خدمت یا نوبت)"""
