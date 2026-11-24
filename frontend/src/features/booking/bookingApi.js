import { requestJson } from '../../api/client'

export function fetchSlots(date, signal) {
  return requestJson(`/api/slots?date=${encodeURIComponent(date)}`, {
    signal,
    timeoutMs: 5000,
    fallbackError: 'خطا در بارگذاری بازه‌های زمانی',
  })
}

export function createAppointment(payload) {
  return requestJson('/api/appointments', {
    method: 'POST',
    body: payload,
    fallbackError: 'خطایی در ثبت نوبت رخ داد.',
  })
}
