import { requestJson } from '../../api/client'

export function fetchServices(signal) {
  return requestJson('/api/services', {
    signal,
    withAuth: false,
    clearOnUnauthorized: false,
    fallbackError: 'خطا در دریافت لیست خدمات از سرور',
    networkError: 'سرور در دسترس نیست',
  })
}

export function fetchAdminServices(signal) {
  return requestJson('/api/admin/services', {
    signal,
    fallbackError: 'خطا در دریافت لیست مدیریتی خدمات',
  })
}

export function createAdminService(payload) {
  return requestJson('/api/admin/services', {
    method: 'POST',
    body: payload,
    fallbackError: 'خطا در افزودن خدمت جدید',
  })
}

export function updateAdminService(serviceId, payload) {
  return requestJson(`/api/admin/services/${serviceId}`, {
    method: 'PUT',
    body: payload,
    fallbackError: 'خطا در ویرایش خدمت',
  })
}

export function changeAdminServiceStatus(serviceId, isActive) {
  return requestJson(`/api/admin/services/${serviceId}/status`, {
    method: 'PATCH',
    body: { is_active: isActive },
    fallbackError: 'خطا در تغییر وضعیت خدمت',
  })
}

export function deleteAdminService(serviceId) {
  return requestJson(`/api/admin/services/${serviceId}`, {
    method: 'DELETE',
    fallbackError: 'خطا در حذف خدمت',
  })
}
