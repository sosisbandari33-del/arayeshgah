import { requestJson } from '../../api/client'

export function fetchPublicSettings(signal) {
  return requestJson('/api/settings/public', {
    signal,
    timeoutMs: 5000,
    fallbackError: 'خطا در بارگذاری تنظیمات آرایشگاه.',
  })
}

export function fetchAdminSettings(signal) {
  return requestJson('/api/admin/settings', {
    signal,
    fallbackError: 'خطا در بارگذاری تنظیمات مدیریت.',
  })
}

export function updateGeneralSettings(payload) {
  return requestJson('/api/admin/settings', {
    method: 'PUT',
    body: payload,
    fallbackError: 'خطا در ذخیره تنظیمات عمومی.',
  })
}

export function updateAdminAccount(payload) {
  return requestJson('/api/admin/account', {
    method: 'PUT',
    body: payload,
    fallbackError: 'خطا در به‌روزرسانی اطلاعات حساب مدیر.',
  })
}
