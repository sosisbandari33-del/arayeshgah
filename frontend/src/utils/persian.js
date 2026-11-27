const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
const INVISIBLE_CHARS_REGEX = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\u061C\uFEFF]/g

/**
 * یکدست‌سازی ارقام عربی (٤٥٦ در کیبورد قدیمی ویندوز) به ارقام استاندارد فارسی و حذف کاراکترهای نامرئی جهت‌دهی
 */
export function sanitizeDigitInputDisplay(str) {
  let res = String(str ?? '').replace(INVISIBLE_CHARS_REGEX, '')
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(ARABIC_DIGITS[i], PERSIAN_DIGITS[i])
  }
  return res
}

/**
 * تبدیل ارقام فارسی، عربی و تمام‌عرض یونیکد به ارقام انگلیسی و حذف علامت‌های نامرئی
 */
export function convertPersianToEnglishDigits(str) {
  let res = String(str ?? '').replace(INVISIBLE_CHARS_REGEX, '')
  for (let i = 0; i < 10; i++) {
    res = res
      .replaceAll(PERSIAN_DIGITS[i], String(i))
      .replaceAll(ARABIC_DIGITS[i], String(i))
      .replaceAll(String.fromCharCode(0xff10 + i), String(i))
  }
  return res
}

/**
 * نرمال‌سازی شماره موبایل: تبدیل ارقام و حذف فاصله، نیم‌فاصله و خط‌تیره (هماهنگ با بک‌اند)
 */
export function normalizePhone(phone) {
  return convertPersianToEnglishDigits(phone).replace(/[\s-]+/g, '')
}

/**
 * نرمال‌سازی کد پیگیری ۶ رقمی (پشتیبانی کامل از ارقام فارسی، عربی، انگلیسی و حذف فاصله/نیم‌فاصله)
 */
export function normalizeTrackingCode(code) {
  return convertPersianToEnglishDigits(code).replace(/[\s-]+/g, '')
}

/**
 * تبدیل ارقام انگلیسی یا عربی در متن یا عدد به ارقام فارسی یکدست
 */
export function toPersianDigits(value) {
  let res = sanitizeDigitInputDisplay(value)
  res = res.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)])
  return res
}

/**
 * قالب‌بندی عدد قیمت با جداکننده و ارقام فارسی
 */
export function formatPrice(price) {
  return Number(price).toLocaleString('fa-IR')
}
