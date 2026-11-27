from datetime import date as dt_date, datetime
import re

from database import (
    create_time_off,
    delete_time_off,
    get_active_appointments_by_date,
    get_active_appointments_from_date,
    get_all_time_offs,
    get_all_working_hours,
    get_time_off_by_id,
    get_time_offs_by_date,
    get_working_hours_for_day,
    save_all_working_hours,
)
from services.errors import FieldValidationError, NotFoundDomainError

TIME_PATTERN = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"

WEEKDAY_NAMES = {
    0: "شنبه",
    1: "یکشنبه",
    2: "دوشنبه",
    3: "سه‌شنبه",
    4: "چهارشنبه",
    5: "پنج‌شنبه",
    6: "جمعه",
}


def normalize_digits_str(text: str) -> str:
    res = text or ""
    for i in range(10):
        res = res.replace(PERSIAN_DIGITS[i], str(i)).replace(ARABIC_DIGITS[i], str(i))
    return res


def python_date_to_iranian_weekday(d: dt_date) -> int:
    """تبدیل روز هفته‌ی پایتون (دوشنبه=0) به روز هفته‌ی ایرانی (شنبه=0 ... جمعه=6)"""
    return (d.weekday() + 2) % 7


def parse_hhmm_to_minutes(value: str | None) -> tuple[int | None, str | None]:
    """بررسی فرمت دقیق HH:MM و تبدیل به دقیقه از ابتدای شبانه‌روز"""
    clean = normalize_digits_str((value or "").strip())
    match = TIME_PATTERN.match(clean)
    if not match:
        return None, None
    hour, minute = int(match.group(1)), int(match.group(2))
    return hour * 60 + minute, f"{hour:02d}:{minute:02d}"


def minutes_to_hhmm(total_minutes: int) -> str:
    return f"{total_minutes // 60:02d}:{total_minutes % 60:02d}"


def get_day_schedule_context(selected_date: dt_date, normalized_date: str) -> dict:
    """محاسبه‌ی وضعیت کاری یک تاریخ مشخص (ساعت کاری هفتگی، تعطیلی کل روز و مرخصی‌های ساعتی)"""
    ir_weekday = python_date_to_iranian_weekday(selected_date)
    wh = get_working_hours_for_day(ir_weekday)
    if not wh:
        wh = {
            "day_of_week": ir_weekday,
            "start_time": "10:00",
            "end_time": "20:00",
            "is_closed": ir_weekday == 6,
        }

    day_time_offs = get_time_offs_by_date(normalized_date)
    full_day_off = next((item for item in day_time_offs if item["is_full_day"]), None)
    partial_leaves = [item for item in day_time_offs if not item["is_full_day"]]

    if wh["is_closed"]:
        day_name = WEEKDAY_NAMES.get(ir_weekday, "این روز")
        return {
            "is_closed_day": True,
            "closure_reason": f"آرایشگاه در روزهای {day_name} تعطیل است.",
            "working_hours": wh,
            "partial_leaves": [],
            "allowed_slots": [],
        }

    if full_day_off:
        reason_suffix = f" ({full_day_off['reason']})" if full_day_off["reason"] else ""
        return {
            "is_closed_day": True,
            "closure_reason": f"آرایشگاه در تاریخ {normalized_date} تعطیل است{reason_suffix}.",
            "working_hours": wh,
            "partial_leaves": [],
            "allowed_slots": [],
        }

    start_min, _ = parse_hhmm_to_minutes(wh["start_time"])
    end_min, _ = parse_hhmm_to_minutes(wh["end_time"])
    assert start_min is not None and end_min is not None

    allowed_slots: list[str] = []
    current = start_min
    while current + 30 <= end_min:
        allowed_slots.append(minutes_to_hhmm(current))
        current += 30

    parsed_leaves = []
    for leave in partial_leaves:
        l_start, _ = parse_hhmm_to_minutes(leave["start_time"])
        l_end, _ = parse_hhmm_to_minutes(leave["end_time"])
        if l_start is not None and l_end is not None:
            parsed_leaves.append(
                {
                    "id": leave["id"],
                    "start_min": l_start,
                    "end_min": l_end,
                    "start_time": leave["start_time"],
                    "end_time": leave["end_time"],
                    "reason": leave["reason"],
                }
            )

    return {
        "is_closed_day": False,
        "closure_reason": None,
        "working_hours": wh,
        "partial_leaves": parsed_leaves,
        "allowed_slots": allowed_slots,
    }


def is_slot_in_partial_leave(slot_start_min: int, slot_duration_min: int, partial_leaves: list[dict]) -> bool:
    slot_end_min = slot_start_min + slot_duration_min
    for leave in partial_leaves:
        if slot_start_min < leave["end_min"] and slot_end_min > leave["start_min"]:
            return True
    return False


def get_any_open_day_allowed_slots() -> set[str]:
    """مجموعه‌ی تمام بازه‌های ۳۰ دقیقه‌ای مجاز در حداقل یکی از روزهای باز هفته"""
    slots: set[str] = set()
    for wh in get_all_working_hours():
        if wh["is_closed"]:
            continue
        start_min, _ = parse_hhmm_to_minutes(wh["start_time"])
        end_min, _ = parse_hhmm_to_minutes(wh["end_time"])
        if start_min is None or end_min is None:
            continue
        current = start_min
        while current + 30 <= end_min:
            slots.add(minutes_to_hhmm(current))
            current += 30
    return slots


def list_working_hours_logic():
    hours = get_all_working_hours()
    for item in hours:
        item["day_name"] = WEEKDAY_NAMES.get(item["day_of_week"], "")
    return hours


def update_working_hours_logic(days_payload: list[dict]):
    if len(days_payload) != 7:
        raise FieldValidationError({"days": "باید تنظیمات هر ۷ روز هفته (شنبه تا جمعه) ارسال شود."})

    seen_days = set()
    normalized_days: list[dict] = []
    errors: dict[str, str] = {}

    for item in days_payload:
        day_idx = item["day_of_week"]
        if day_idx < 0 or day_idx > 6 or day_idx in seen_days:
            errors["days"] = "روزهای هفته باید یکتا و بین ۰ (شنبه) تا ۶ (جمعه) باشند."
            continue
        seen_days.add(day_idx)

        day_label = WEEKDAY_NAMES.get(day_idx, f"روز {day_idx}")
        start_min, norm_start = parse_hhmm_to_minutes(item["start_time"])
        end_min, norm_end = parse_hhmm_to_minutes(item["end_time"])

        if item["is_closed"]:
            # در صورت تعطیل بودن روز، اگر ساعت معتبری نبود همان ساعت پیش‌فرض حفظ شود
            normalized_days.append(
                {
                    "day_of_week": day_idx,
                    "start_time": norm_start or "10:00",
                    "end_time": norm_end or "20:00",
                    "is_closed": True,
                }
            )
            continue

        if start_min is None or norm_start is None:
            errors[f"day_{day_idx}_start"] = f"فرمت ساعت شروع {day_label} نامعتبر است (HH:MM)."
            continue
        if end_min is None or norm_end is None:
            errors[f"day_{day_idx}_end"] = f"فرمت ساعت پایان {day_label} نامعتبر است (HH:MM)."
            continue
        if end_min - start_min < 30:
            errors[f"day_{day_idx}_end"] = f"ساعت پایان {day_label} باید حداقل ۳۰ دقیقه بعد از ساعت شروع باشد."
            continue

        normalized_days.append(
            {
                "day_of_week": day_idx,
                "start_time": norm_start,
                "end_time": norm_end,
                "is_closed": False,
            }
        )

    if errors:
        raise FieldValidationError(errors)

    saved = save_all_working_hours(normalized_days)
    for item in saved:
        item["day_name"] = WEEKDAY_NAMES.get(item["day_of_week"], "")

    # بررسی نوبت‌های فعال از امروز به بعد و هشدار بدون لغو خودکار
    by_day = {item["day_of_week"]: item for item in normalized_days}
    today_str = dt_date.today().strftime("%Y-%m-%d")
    upcoming_active = get_active_appointments_from_date(today_str)

    conflicts = []
    for appt in upcoming_active:
        appt_date = datetime.strptime(appt["date"], "%Y-%m-%d").date()
        ir_day = python_date_to_iranian_weekday(appt_date)
        cfg = by_day[ir_day]
        appt_min, _ = parse_hhmm_to_minutes(appt["start_time"])
        cfg_start, _ = parse_hhmm_to_minutes(cfg["start_time"])
        cfg_end, _ = parse_hhmm_to_minutes(cfg["end_time"])

        if cfg["is_closed"]:
            conflicts.append(appt)
        elif (
            appt_min is not None
            and cfg_start is not None
            and cfg_end is not None
            and (appt_min < cfg_start or appt_min + 30 > cfg_end)
        ):
            conflicts.append(appt)

    warning = None
    if conflicts:
        warning = (
            f"توجه: {len(conflicts)} نوبت فعال قبلی خارج از ساعات کاری جدید قرار می‌گیرند. "
            "این نوبت‌ها به‌صورت خودکار لغو نشدند؛ لطفاً با مشتریان هماهنگ کنید."
        )

    return {
        "success": True,
        "message": "ساعات کاری هفتگی با موفقیت ذخیره شد.",
        "working_hours": saved,
        "warning": warning,
        "conflicting_appointments": conflicts,
    }


def list_time_offs_logic():
    return get_all_time_offs()


def create_time_off_logic(
    date_str: str,
    is_full_day: bool,
    start_time: str | None,
    end_time: str | None,
    reason: str,
    date_validator_fn,
):
    errors: dict[str, str] = {}

    _, normalized_date, date_err = date_validator_fn(date_str)
    if date_err:
        errors["date"] = date_err

    clean_reason = (reason or "").strip()
    if len(clean_reason) > 120:
        errors["reason"] = "توضیح تعطیلی یا مرخصی نمی‌تواند بیشتر از ۱۲۰ کاراکتر باشد."

    norm_start = None
    norm_end = None
    start_min = None
    end_min = None

    if not is_full_day:
        if not (start_time or "").strip():
            errors["start_time"] = "وارد کردن ساعت شروع مرخصی الزامی است."
        else:
            start_min, norm_start = parse_hhmm_to_minutes(start_time)
            if start_min is None:
                errors["start_time"] = "فرمت ساعت شروع نامعتبر است (باید HH:MM باشد)."

        if not (end_time or "").strip():
            errors["end_time"] = "وارد کردن ساعت پایان مرخصی الزامی است."
        else:
            end_min, norm_end = parse_hhmm_to_minutes(end_time)
            if end_min is None:
                errors["end_time"] = "فرمت ساعت پایان نامعتبر است (باید HH:MM باشد)."

        if start_min is not None and end_min is not None and end_min <= start_min:
            errors["end_time"] = "ساعت پایان مرخصی باید بعد از ساعت شروع باشد."

    if errors:
        raise FieldValidationError(errors)

    assert normalized_date is not None

    created = create_time_off(
        date_str=normalized_date,
        is_full_day=is_full_day,
        start_time=norm_start,
        end_time=norm_end,
        reason=clean_reason,
    )

    # بررسی نوبت‌های فعال در همان تاریخ و هشدار بدون لغو خودکار
    day_active = get_active_appointments_by_date(normalized_date)
    conflicts = []
    if is_full_day:
        conflicts = day_active
    elif start_min is not None and end_min is not None:
        for appt in day_active:
            appt_min, _ = parse_hhmm_to_minutes(appt["start_time"])
            if appt_min is not None and appt_min < end_min and (appt_min + 30) > start_min:
                conflicts.append(appt)

    warning = None
    if conflicts:
        warning = (
            f"توجه: برای این بازه از قبل {len(conflicts)} نوبت فعال ثبت شده است. "
            "نوبت‌های قبلی به‌صورت خودکار لغو نشدند؛ در صورت نیاز با مشتریان هماهنگ کنید."
        )

    return {
        "success": True,
        "message": "تعطیلی / مرخصی با موفقیت ثبت شد.",
        "time_off": created,
        "warning": warning,
        "conflicting_appointments": conflicts,
    }


def delete_time_off_logic(time_off_id: int):
    existing = get_time_off_by_id(time_off_id)
    if not existing:
        raise NotFoundDomainError("تعطیلی یا مرخصی مورد نظر یافت نشد.")

    delete_time_off(time_off_id)
    return {
        "success": True,
        "message": "تعطیلی / مرخصی با موفقیت حذف شد.",
    }
