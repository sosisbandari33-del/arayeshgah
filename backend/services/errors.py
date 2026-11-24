"""خطاهای دامنه‌ی کسب‌وکار (مستقل از لایه‌ی HTTP و FastAPI)"""


class DomainError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class ValidationDomainError(DomainError):
    """خطای اعتبارسنجی ورودی یا نقض قوانین کسب‌وکار"""


class ConflictDomainError(DomainError):
    """خطای تداخل بازه‌ی زمانی یا رزرو همزمان"""


class NotFoundDomainError(DomainError):
    """خطای یافت نشدن موجودیت (خدمت یا نوبت)"""
