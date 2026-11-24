import { requestJson } from '../../api/client'

export function fetchAppointments(date, signal) {
  return requestJson(`/api/appointments?date=${encodeURIComponent(date)}`, {
    signal,
    fallbackError: 'خطا در دریافت لیست نوبت‌ها',
  })
}

export function cancelAppointment(appointmentId) {
  return requestJson(`/api/appointments/${appointmentId}/cancel`, {
    method: 'PATCH',
    fallbackError: 'خطا در لغو نوبت',
  })
}
