import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Input } from '../../ui'
import { normalizePhone } from '../../utils/persian'
import { loginAdmin } from './authApi'
import { getAdminToken, setAdminSession } from './authStorage'
import './auth.css'

function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const existingToken = getAdminToken()

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [errorMessage, setErrorMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (existingToken) {
    return <Navigate to="/admin/appointments" replace />
  }

  const clearFieldError = (field) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setErrorMessage(null)

    const nextErrors = {}
    const cleanPhone = normalizePhone(phone)
    if (!cleanPhone) {
      nextErrors.phone = 'وارد کردن شماره موبایل الزامی است.'
    } else if (!/^09\d{9}$/.test(cleanPhone)) {
      nextErrors.phone = 'شماره موبایل باید ۱۱ رقم بوده و با ۰۹ شروع شود.'
    }

    if (!password || !password.trim()) {
      nextErrors.password = 'وارد کردن رمز عبور الزامی است.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }

    setFieldErrors({})
    setSubmitting(true)

    loginAdmin({ phone: cleanPhone, password })
      .then((data) => {
        setAdminSession(data.access_token, data.admin?.phone || cleanPhone)
        setSubmitting(false)
        const target = location.state?.from || '/admin/appointments'
        navigate(target, { replace: true })
      })
      .catch((err) => {
        setSubmitting(false)
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors(err.fieldErrors)
          return
        }
        setErrorMessage(err.message)
      })
  }

  return (
    <div className="login-wrapper">
      <Card className="login-card">
        <div className="login-header">
          <span className="login-icon">🔐</span>
          <h2>ورود به پنل مدیریت</h2>
          <p className="login-subtitle">ویژه‌ی صاحب آرایشگاه — شماره موبایل و رمز عبور خود را وارد کنید.</p>
        </div>

        {errorMessage && (
          <Alert variant="error">
            <span>⚠️ {errorMessage}</span>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <Input
            id="adminPhone"
            label="شماره موبایل مدیر:"
            type="tel"
            placeholder="مثال: 09121234567"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              clearFieldError('phone')
            }}
            error={fieldErrors.phone}
            maxLength={16}
            autoComplete="username"
          />

          <Input
            id="adminPassword"
            label="رمز عبور:"
            type="password"
            placeholder="رمز عبور خود را وارد کنید"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              clearFieldError('password')
            }}
            error={fieldErrors.password}
            autoComplete="current-password"
          />

          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'در حال بررسی...' : 'ورود به پنل مدیریت'}
          </Button>
        </form>

        <div className="login-footer-link">
          <Button variant="back-link" onClick={() => navigate('/')}>
            &larr; بازگشت به صفحه‌ی مشتریان
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default AdminLoginPage
