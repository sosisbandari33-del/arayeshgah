import { requestJson } from '../../api/client'

export function fetchWorkingHours(signal) {
  return requestJson('/api/admin/working-hours', {
    signal,
    fallbackError: 'خطا در دریافت ساعات کاری هفتگی',
  })
}

export function saveWorkingHours(days) {
  return requestJson('/api/admin/working-hours', {
    method: 'PUT',
    body: { days },
    fallbackError: 'خطا در ذخیره‌ی ساعات کاری هفتگی',
  })
}

export function fetchTimeOffs(signal) {
  return requestJson('/api/admin/time-offs', {
    signal,
    fallbackError: 'خطا در دریافت فهرست تعطیلی‌ها و مرخصی‌ها',
  })
}

export function createTimeOff(payload) {
  return requestJson('/api/admin/time-offs', {
    method: 'POST',
    body: payload,
    fallbackError: 'خطا در ثبت تعطیلی یا مرخصی',
  })
}

export function deleteTimeOff(timeOffId) {
  return requestJson(`/api/admin/time-offs/${timeOffId}`, {
    method: 'DELETE',
    fallbackError: 'خطا در حذف تعطیلی یا مرخصی',
  })
}
