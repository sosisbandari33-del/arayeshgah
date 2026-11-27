import { requestJson } from '../../api/client'

export function loginAdmin({ phone, password }) {
  return requestJson('/api/auth/login', {
    method: 'POST',
    body: { phone, password },
    withAuth: false,
    clearOnUnauthorized: false,
    fallbackError: 'ورود به پنل مدیریت ناموفق بود.',
  })
}

export function fetchCurrentAdmin(signal) {
  return requestJson('/api/auth/me', {
    signal,
    fallbackError: 'بررسی وضعیت ورود ناموفق بود.',
  })
}
