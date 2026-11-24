const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * دریافت تاریخ محلی به فرمت YYYY-MM-DD بدون باگ اختلاف ساعت جهانی (UTC)
 */
export function getLocalDateString(d = new Date()) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * بررسی اعتبار فرمت تاریخ YYYY-MM-DD
 */
export function isValidDateString(dateStr) {
  return typeof dateStr === 'string' && DATE_REGEX.test(dateStr)
}

/**
 * تغییر ایمن روز بدون باگ پرش تاریخ یا تاریخ خالی
 */
export function shiftDate(dateStr, days) {
  if (!isValidDateString(dateStr)) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return getLocalDateString(d)
  }
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  d.setDate(d.getDate() + days)
  return getLocalDateString(d)
}
