import { requestJson } from '../../api/client'

export function fetchServices(signal) {
  return requestJson('/api/services', {
    signal,
    fallbackError: 'خطا در دریافت لیست خدمات از سرور',
    networkError: 'سرور در دسترس نیست',
  })
}
