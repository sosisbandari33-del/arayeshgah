const TOKEN_KEY = 'barbershop_admin_token'
const PHONE_KEY = 'barbershop_admin_phone'
export const AUTH_CHANGE_EVENT = 'admin-auth-changed'

export function getAdminToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function getStoredAdminPhone() {
  try {
    return localStorage.getItem(PHONE_KEY) || ''
  } catch {
    return ''
  }
}

export function setAdminSession(token, phone) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    if (phone) {
      localStorage.setItem(PHONE_KEY, phone)
    }
  } catch {
    // نادیده گرفتن محدودیت مرورگر در حالت خصوصی
  }
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}

export function clearAdminSession() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(PHONE_KEY)
  } catch {
    // نادیده گرفتن خطای دسترسی حافظه
  }
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}
