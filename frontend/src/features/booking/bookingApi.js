import { requestJson } from '../../api/client'

export function fetchSlots(date, serviceIds, signal) {
  const params = new URLSearchParams({
    date,
    service_ids: serviceIds.join(','),
  })
  return requestJson(`/api/slots?${params.toString()}`, {
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
