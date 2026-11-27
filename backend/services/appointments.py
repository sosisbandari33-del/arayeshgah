from datetime import datetime, date as dt_date, time as dt_time, timedelta
import re
import sqlite3

from database import (
    cancel_appointment,
    create_appointment,
    get_active_appointment_intervals,
    get_appointment_by_id,
    get_appointment_by_phone_and_tracking,
    get_appointments_by_date,
    get_cancel_deadline_hours,
    get_services_by_ids,
)
from services.errors import (
    ConflictDomainError,
    FieldValidationError,
    NotFoundDomainError,
    ValidationDomainError,
)
from services.schedule import (
    get_any_open_day_allowed_slots,
    get_day_schedule_context,
    is_slot_in_partial_leave,
    minutes_to_hhmm,
    parse_hhmm_to_minutes,
)

DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
PHONE_PATTERN = re.compile(r"^09\d{9}$")
TRACKING_CODE_PATTERN = re.compile(r"^\d{6}$")


def _now() -> datetime:
    """نقطه‌ی متمرکز خواندن زمان فعلی سیستم (قابل بازنویسی در تست‌های زمان‌محور)"""
    return datetime.now()


def normalize_digits(text: str) -> str:
    """تبدیل اعداد فارسی و عربی به اعداد انگلیسی"""
    persian_digits = "۰۱۲۳۴۵۶۷۸۹"
    arabic_digits = "٠١٢٣٤٥٦٧٨٩"
    for i in range(10):
        text = text.replace(persian_digits[i], str(i)).replace(arabic_digits[i], str(i))
    return text


def validate_strict_date_value(date_str: str) -> tuple[dt_date | None, str | None, str | None]:
    """بررسی دقیق فرمت YYYY-MM-DD (با صفر پیشوند) و معتبر بودن تاریخ تقویمی"""
    clean_date = normalize_digits((date_str or "").strip())
    if not clean_date:
        return None, None, "وارد کردن تاریخ الزامی است."
    if not DATE_PATTERN.match(clean_date):
        return None, None, "فرمت تاریخ نامعتبر است (باید دقیقاً به شکل YYYY-MM-DD باشد)."
    try:
        parsed = datetime.strptime(clean_date, "%Y-%m-%d").date()
    except ValueError:
        return None, None, "تاریخ واردشده معتبر نیست."
    return parsed, parsed.strftime("%Y-%m-%d"), None


def parse_strict_date(date_str: str) -> tuple[dt_date, str]:
    """اعتبارسنجی تاریخ و پرتاب FieldValidationError برای فیلد date"""
    parsed, normalized, err_msg = validate_strict_date_value(date_str)
    if err_msg or parsed is None or normalized is None:
        raise FieldValidationError({"date": err_msg or "تاریخ واردشده معتبر نیست."})
    return parsed, normalized


def _has_appointment_overlap(start_min: int, duration_min: int, intervals: list[dict]) -> bool:
    """بررسی همپوشانی بازه‌ی [start_min, start_min + duration_min) با نوبت‌های فعال (قانون R5)"""
    end_min = start_min + duration_min
    for item in intervals:
        if start_min < item["end_min"] and end_min > item["start_min"]:
            return True
    return False


def _validate_and_load_services(raw_ids: list[int]) -> tuple[list[dict] | None, str | None]:
    if not raw_ids:
        return None, "انتخاب حداقل یک خدمت الزامی است."
    if len(set(raw_ids)) != len(raw_ids):
        return None, "هر خدمت فقط یک‌بار می‌تواند در یک نوبت انتخاب شود."
    if any(sid <= 0 for sid in raw_ids):
        return None, "خدمت انتخابی معتبر نیست."

    services = get_services_by_ids(raw_ids)
    if len(services) != len(raw_ids):
        return None, "خدمت انتخابی معتبر نیست."
    if any(not svc.get("is_active", True) for svc in services):
        return None, "خدمت انتخابی معتبر نیست."
    return services, None


def _parse_service_ids_query(service_ids_param: str) -> tuple[list[dict] | None, str | None]:
    clean = normalize_digits((service_ids_param or "").strip())
    if not clean:
        return None, "انتخاب حداقل یک خدمت الزامی است."

    parts = [p.strip() for p in clean.split(",") if p.strip()]
    if not parts:
        return None, "انتخاب حداقل یک خدمت الزامی است."

    parsed_ids: list[int] = []
    for part in parts:
        if not re.fullmatch(r"-?\d+", part):
            return None, "خدمت انتخابی معتبر نیست."
        parsed_ids.append(int(part))

    return _validate_and_load_services(parsed_ids)


def get_daily_slots_logic(date_str: str, service_ids_param: str | None = None):
    """
    محاسبه‌ی زمان‌های آزاد یک روز:
    - اگر service_ids ارسال شود (منطق سطح ۲ — قوانین R5 تا R8 و R3): فقط زمان‌های شروعی برگردانده
      می‌شوند که مجموع مدت تمام خدمات انتخاب‌شده کامل در ساعت کاری جا شود، در تعطیلی یا مرخصی نباشد
      و با هیچ نوبت فعال دیگری همپوشانی نداشته باشد.
    - اگر service_ids ارسال نشود: وضعیت شبکه‌ی ۳۰ دقیقه‌ای روز با لحاظ مدت واقعی نوبت‌های ثبت‌شده برمی‌گردد.
    """
    field_errors: dict[str, str] = {}
    selected_date, normalized_date, date_err = validate_strict_date_value(date_str)
    if date_err:
        field_errors["date"] = date_err

    selected_services: list[dict] | None = None
    if service_ids_param is not None:
        selected_services, svc_err = _parse_service_ids_query(service_ids_param)
        if svc_err:
            field_errors["service_ids"] = svc_err

    if field_errors:
        raise FieldValidationError(field_errors)

    assert selected_date is not None and normalized_date is not None
    day_ctx = get_day_schedule_context(selected_date, normalized_date)

    # حالت ۱: محاسبه‌ی دقیق بر اساس یک یا چند خدمت انتخابی (فقط زمان‌های واقعاً ممکن — R5 تا R8)
    if selected_services is not None:
        total_duration = sum(s["duration"] for s in selected_services)
        total_price = sum(s["price"] for s in selected_services)

        if day_ctx["is_closed_day"]:
            return {
                "date": normalized_date,
                "is_closed_day": True,
                "closure_reason": day_ctx["closure_reason"],
                "working_hours": None,
                "total_duration": total_duration,
                "total_price": total_price,
                "slots": [],
            }

        wh = day_ctx["working_hours"]
        work_end_min = day_ctx["work_end_min"]
        partial_leaves = day_ctx["partial_leaves"]
        active_intervals = get_active_appointment_intervals(normalized_date)
        now = _now()

        fitting_slots = []
        for slot_min in day_ctx["candidate_starts"]:
            # قانون R6: شروع و پایان کامل داخل ساعت کاری روز
            if slot_min + total_duration > work_end_min:
                continue

            slot_dt = datetime.combine(selected_date, dt_time(slot_min // 60, slot_min % 60))
            # قانون R3: عدم نمایش زمان گذشته
            if slot_dt < now:
                continue

            # قانون R7: بدون همپوشانی با مرخصی ساعتی
            if is_slot_in_partial_leave(slot_min, total_duration, partial_leaves):
                continue

            # قانون R5: بدون همپوشانی با نوبت‌های فعال دیگر
            if _has_appointment_overlap(slot_min, total_duration, active_intervals):
                continue

            fitting_slots.append(
                {
                    "time": minutes_to_hhmm(slot_min),
                    "end_time": minutes_to_hhmm(slot_min + total_duration),
                    "is_available": True,
                }
            )

        return {
            "date": normalized_date,
            "is_closed_day": False,
            "closure_reason": None,
            "working_hours": {
                "start_time": wh["start_time"],
                "end_time": wh["end_time"],
            },
            "total_duration": total_duration,
            "total_price": total_price,
            "slots": fitting_slots,
        }

    # حالت ۲: نمای شبکه‌ی عمومی روز (بدون فیلتر خدمت مشخص)
    if day_ctx["is_closed_day"]:
        return {
            "date": normalized_date,
            "is_closed_day": True,
            "closure_reason": day_ctx["closure_reason"],
            "working_hours": None,
            "slots": [],
        }

    active_intervals = get_active_appointment_intervals(normalized_date)
    now = _now()
    partial_leaves = day_ctx["partial_leaves"]

    slots_status = []
    for slot in day_ctx["allowed_slots"]:
        slot_hour, slot_minute = map(int, slot.split(":"))
        slot_min = slot_hour * 60 + slot_minute
        slot_datetime = datetime.combine(selected_date, dt_time(slot_hour, slot_minute))

        is_past = slot_datetime < now
        is_booked = _has_appointment_overlap(slot_min, 30, active_intervals)
        is_time_off = is_slot_in_partial_leave(slot_min, 30, partial_leaves)

        slots_status.append(
            {
                "time": slot,
                "is_available": (not is_booked) and (not is_past) and (not is_time_off),
                "is_booked": is_booked,
                "is_past": is_past,
                "is_time_off": is_time_off,
            }
        )

    wh = day_ctx["working_hours"]
    return {
        "date": normalized_date,
        "is_closed_day": False,
        "closure_reason": None,
        "working_hours": {
            "start_time": wh["start_time"],
            "end_time": wh["end_time"],
        },
        "slots": slots_status,
    }


def book_appointment_logic(
    customer_name: str,
    customer_phone: str,
    service_ids: list[int] | None,
    service_id: int | None,
    date_str: str,
    start_time: str,
):
    """اعتبارسنجی مستقل ورودی‌ها (422) و اعمال سخت‌گیرانه‌ی قوانین R3، R5، R6، R7، R8 و R10"""
    field_errors: dict[str, str] = {}

    # ۱. اعتبارسنجی نام مشتری (قانون R10)
    name = (customer_name or "").strip()
    if not name:
        field_errors["customer_name"] = "نام و نام خانوادگی نمی‌تواند خالی باشد."
    elif len(name) < 2 or len(name) > 50:
        field_errors["customer_name"] = "نام و نام خانوادگی باید بین ۲ تا ۵۰ کاراکتر باشد."

    # ۲. اعتبارسنجی شماره موبایل (قانون R10)
    normalized_phone = normalize_digits((customer_phone or "").strip())
    clean_phone = re.sub(r"[\s-]+", "", normalized_phone)
    if not clean_phone:
        field_errors["customer_phone"] = "وارد کردن شماره موبایل الزامی است."
    elif not PHONE_PATTERN.fullmatch(clean_phone):
        field_errors["customer_phone"] = "شماره موبایل باید ۱۱ رقم بوده و با ۰۹ شروع شود."

    # ۳. اعتبارسنجی یک یا چند خدمت انتخابی (وجود و فعال بودن همه‌ی خدمات)
    selected_services: list[dict] | None = None
    if service_ids is not None:
        selected_services, svc_err = _validate_and_load_services(service_ids)
        if svc_err:
            field_errors["service_ids"] = svc_err
    elif service_id is not None:
        selected_services, svc_err = _validate_and_load_services([service_id])
        if svc_err:
            field_errors["service_id"] = svc_err
    else:
        field_errors["service_ids"] = "انتخاب حداقل یک خدمت الزامی است."

    # ۴. اعتبارسنجی تاریخ
    app_date, normalized_date, date_err = validate_strict_date_value(date_str)
    if date_err:
        field_errors["date"] = date_err

    # ۵. اعتبارسنجی فرمت و گام ۳۰ دقیقه‌ای ساعت شروع
    raw_time = (start_time or "").strip()
    slot_min, clean_time = parse_hhmm_to_minutes(raw_time)
    day_ctx = None

    if not raw_time:
        field_errors["start_time"] = "انتخاب ساعت نوبت الزامی است."
    elif slot_min is None or clean_time is None:
        field_errors["start_time"] = "فرمت ساعت انتخابی نامعتبر است (باید HH:MM باشد)."
    elif app_date is not None and normalized_date is not None:
        day_ctx = get_day_schedule_context(app_date, normalized_date)
        if not day_ctx["is_closed_day"] and slot_min not in day_ctx["candidate_starts"]:
            wh = day_ctx["working_hours"]
            field_errors["start_time"] = (
                f"ساعت انتخابی خارج از ساعات کاری این روز ({wh['start_time']} تا {wh['end_time']}) یا بازه‌های ۳۰ دقیقه‌ای است."
            )
    else:
        any_allowed = get_any_open_day_allowed_slots()
        if any_allowed and clean_time not in any_allowed:
            field_errors["start_time"] = "ساعت انتخابی خارج از ساعات کاری و بازه‌های ۳۰ دقیقه‌ای مجاز است."

    if field_errors:
        raise FieldValidationError(field_errors)

    assert (
        app_date is not None
        and normalized_date is not None
        and selected_services is not None
        and clean_time is not None
        and slot_min is not None
    )

    if day_ctx is None:
        day_ctx = get_day_schedule_context(app_date, normalized_date)

    # قانون R7: جلوگیری از ثبت نوبت در روز تعطیل هفتگی یا تاریخ تعطیل خاص
    if day_ctx["is_closed_day"]:
        raise ValidationDomainError(
            day_ctx["closure_reason"] or "این روز تعطیل است و امکان ثبت نوبت وجود ندارد."
        )

    total_duration = sum(s["duration"] for s in selected_services)
    total_price = sum(s["price"] for s in selected_services)
    end_min = slot_min + total_duration
    end_time_str = minutes_to_hhmm(end_min)

    # قوانین R6 و R8: کل مدت خدمات باید داخل ساعت کاری همان روز جا شود
    work_start_min = day_ctx["work_start_min"]
    work_end_min = day_ctx["work_end_min"]
    wh = day_ctx["working_hours"]
    if slot_min < work_start_min or end_min > work_end_min:
        raise ValidationDomainError(
            f"مدت خدمات انتخابی ({total_duration} دقیقه، تا ساعت {end_time_str}) در ساعت کاری این روز ({wh['start_time']} تا {wh['end_time']}) جا نمی‌شود."
        )

    # قوانین R7 و R8: کل مدت خدمات باید بیرون از بازه‌های مرخصی ساعتی باشد
    if is_slot_in_partial_leave(slot_min, total_duration, day_ctx["partial_leaves"]):
        raise ValidationDomainError(
            "بازه زمانی خدمات انتخابی با ساعت مرخصی آرایشگاه تداخل دارد و امکان ثبت نوبت وجود ندارد."
        )

    hour, minute = map(int, clean_time.split(":"))
    app_datetime = datetime.combine(app_date, dt_time(hour, minute))

    # قانون R3: عدم ثبت نوبت در گذشته
    if app_datetime < _now():
        raise ValidationDomainError("امکان ثبت نوبت برای زمان‌های گذشته وجود ندارد.")

    # قوانین R5 و R8: عدم همپوشانی بازه‌ی [slot_min, end_min) با هیچ نوبت فعال دیگر
    active_intervals = get_active_appointment_intervals(normalized_date)
    if _has_appointment_overlap(slot_min, total_duration, active_intervals):
        raise ConflictDomainError(
            "این بازه زمانی قبلاً رزرو شده است یا با نوبت دیگری همپوشانی دارد. لطفاً ساعت دیگری را انتخاب کنید."
        )

    # ثبت اتمیک در دیتابیس همراه با محافظت همزمانی
    try:
        saved = create_appointment(
            customer_name=name,
            customer_phone=clean_phone,
            services_list=selected_services,
            date=normalized_date,
            start_time=clean_time,
            end_time=end_time_str,
            total_duration=total_duration,
            total_price=total_price,
        )
    except sqlite3.IntegrityError as err:
        err_text = str(err)
        if (
            "OVERLAP_CONFLICT" in err_text
            or "UNIQUE constraint failed" in err_text
            or "idx_unique_active_slot" in err_text
        ):
            raise ConflictDomainError(
                "این بازه زمانی قبلاً رزرو شده است یا همین چند لحظه پیش توسط مشتری دیگری انتخاب شد. لطفاً ساعت دیگری را انتخاب کنید."
            ) from err
        raise ValidationDomainError("خطا در ذخیره‌سازی اطلاعات نوبت.") from err

    return {
        "success": True,
        "message": "نوبت شما با موفقیت ثبت شد.",
        "appointment": saved,
    }


def list_appointments_logic(date_str: str):
    """برگرداندن لیست نوبت‌های یک روز مشخص مرتب‌شده بر اساس ساعت"""
    _, normalized_date = parse_strict_date(date_str)
    return get_appointments_by_date(normalized_date)


def cancel_appointment_logic(appointment_id: int):
    """لغو نوبت طبق قانون R4 (تغییر وضعیت به 'لغو شده' بدون حذف رکورد)"""
    existing = get_appointment_by_id(appointment_id)
    if not existing:
        raise NotFoundDomainError("نوبت مورد نظر یافت نشد.")

    if existing["status"] == "لغو شده":
        return {
            "success": True,
            "message": "این نوبت قبلاً لغو شده است.",
            "appointment": existing,
        }

    updated = cancel_appointment(appointment_id)
    return {
        "success": True,
        "message": "نوبت با موفقیت لغو شد و بازه زمانی آن آزاد گردید.",
        "appointment": updated,
    }


def _validate_tracking_credentials(
    customer_phone: str, tracking_code: str
) -> tuple[str, str]:
    field_errors: dict[str, str] = {}

    normalized_phone = normalize_digits((customer_phone or "").strip())
    clean_phone = re.sub(r"[\s-]+", "", normalized_phone)
    if not clean_phone:
        field_errors["customer_phone"] = "وارد کردن شماره موبایل الزامی است."
    elif not PHONE_PATTERN.fullmatch(clean_phone):
        field_errors["customer_phone"] = "شماره موبایل باید ۱۱ رقم بوده و با ۰۹ شروع شود."

    clean_code = normalize_digits((tracking_code or "").strip())
    clean_code = re.sub(r"\s+", "", clean_code)
    if not clean_code:
        field_errors["tracking_code"] = "وارد کردن کد پیگیری الزامی است."
    elif not TRACKING_CODE_PATTERN.fullmatch(clean_code):
        field_errors["tracking_code"] = "کد پیگیری باید یک کد ۶ رقمی عددی باشد."

    if field_errors:
        raise FieldValidationError(field_errors)

    return clean_phone, clean_code


def _evaluate_customer_cancel_policy(
    appt: dict, now_dt: datetime, deadline_hours: int
) -> tuple[bool, str | None]:
    """بررسی قانون R9: امکان لغو نوبت توسط مشتری فقط تا مهلت تعیین‌شده پیش از شروع نوبت"""
    if appt["status"] == "لغو شده":
        return False, "این نوبت قبلاً لغو شده است."

    appt_date = datetime.strptime(appt["date"], "%Y-%m-%d").date()
    hour, minute = map(int, appt["start_time"].split(":"))
    appt_dt = datetime.combine(appt_date, dt_time(hour, minute))

    if now_dt >= appt_dt:
        return False, "زمان این نوبت گذشته است و امکان لغو آن وجود ندارد."

    if appt_dt - now_dt < timedelta(hours=deadline_hours):
        return (
            False,
            f"مهلت لغو نوبت (تا {deadline_hours} ساعت پیش از شروع نوبت) به پایان رسیده است.",
        )

    return True, None


def lookup_appointment_by_tracking_logic(customer_phone: str, tracking_code: str):
    """جستجوی فقط همان نوبت متعلق به شماره موبایل و کد پیگیری ۶ رقمی (قانون R9)"""
    clean_phone, clean_code = _validate_tracking_credentials(
        customer_phone, tracking_code
    )
    appt = get_appointment_by_phone_and_tracking(clean_phone, clean_code)
    if not appt:
        raise NotFoundDomainError("نوبتی با این شماره موبایل و کد پیگیری یافت نشد.")

    deadline_hours = get_cancel_deadline_hours()
    can_cancel, cancel_reason = _evaluate_customer_cancel_policy(
        appt, _now(), deadline_hours
    )

    return {
        "appointment": appt,
        "can_cancel": can_cancel,
        "cancel_reason": cancel_reason,
        "cancel_deadline_hours": deadline_hours,
    }


def cancel_appointment_by_customer_logic(customer_phone: str, tracking_code: str):
    """لغو نوبت توسط مشتری در صورت نرسیدن به مهلت لغو (قانون R9 و R4)"""
    clean_phone, clean_code = _validate_tracking_credentials(
        customer_phone, tracking_code
    )
    appt = get_appointment_by_phone_and_tracking(clean_phone, clean_code)
    if not appt:
        raise NotFoundDomainError("نوبتی با این شماره موبایل و کد پیگیری یافت نشد.")

    deadline_hours = get_cancel_deadline_hours()
    can_cancel, cancel_reason = _evaluate_customer_cancel_policy(
        appt, _now(), deadline_hours
    )
    if not can_cancel:
        raise ValidationDomainError(
            cancel_reason or "امکان لغو این نوبت وجود ندارد."
        )

    updated = cancel_appointment(appt["id"])
    return {
        "success": True,
        "message": "نوبت شما با موفقیت لغو شد و بازه زمانی آن آزاد گردید.",
        "appointment": updated,
        "can_cancel": False,
        "cancel_reason": "این نوبت قبلاً لغو شده است.",
        "cancel_deadline_hours": deadline_hours,
    }
