const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']

/**
 * تبدیل ارقام فارسی و عربی به ارقام انگلیسی
 */
export function convertPersianToEnglishDigits(str) {
  let res = str || ''
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(PERSIAN_DIGITS[i], String(i)).replaceAll(ARABIC_DIGITS[i], String(i))
  }
  return res
}

/**
 * نرمال‌سازی شماره موبایل: تبدیل ارقام و حذف فاصله و خط‌تیره (هماهنگ با بک‌اند)
 */
export function normalizePhone(phone) {
  return convertPersianToEnglishDigits(phone).replace(/[\s-]+/g, '')
}

/**
 * قالب‌بندی عدد قیمت با جداکننده و ارقام فارسی
 */
export function formatPrice(price) {
  return Number(price).toLocaleString('fa-IR')
}
