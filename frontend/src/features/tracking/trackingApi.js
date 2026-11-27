import { requestJson } from '../../api/client'

export function lookupAppointment(payload) {
  return requestJson('/api/appointments/lookup', {
    method: 'POST',
    body: payload,
    fallbackError: 'خطا در جستجوی نوبت.',
  })
}

export function cancelAppointmentByCustomer(payload) {
  return requestJson('/api/appointments/customer-cancel', {
    method: 'POST',
    body: payload,
    fallbackError: 'خطا در لغو نوبت.',
  })
}
