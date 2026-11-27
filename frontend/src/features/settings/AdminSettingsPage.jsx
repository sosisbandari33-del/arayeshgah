import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  ErrorState,
  Input,
  LoadingState,
} from '../../ui'
import { convertPersianToEnglishDigits, normalizePhone } from '../../utils/persian'
import { setAdminSession } from '../auth/authStorage'
import AdminSchedulePage from '../schedule/AdminSchedulePage'
import AdminServicesPage from '../services/AdminServicesPage'
import {
  fetchAdminSettings,
  updateAdminAccount,
  updateGeneralSettings,
} from './settingsApi'
import './settings.css'

function parseNonNegativeInt(raw) {
  const clean = convertPersianToEnglishDigits(String(raw ?? '').trim())
  if (!clean || !/^\d+$/.test(clean)) {
    return null
  }
  return Number.parseInt(clean, 10)
}

function AdminSettingsPage({ onServicesChanged, onPublicSettingsChanged }) {
  const outletCtx = useOutletContext() || {}
  const onAdminPhoneUpdated = outletCtx.onAdminPhoneUpdated

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [activeSection, setActiveSection] = useState('section-general')

  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId)
    const target = document.getElementById(sectionId)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const [salonName, setSalonName] = useState('')
  const [cancelDeadlineHours, setCancelDeadlineHours] = useState('')
  const [generalFieldErrors, setGeneralFieldErrors] = useState({})
  const [generalError, setGeneralError] = useState(null)
  const [generalSuccess, setGeneralSuccess] = useState(null)
  const [savingGeneral, setSavingGeneral] = useState(false)

  const [adminPhone, setAdminPhone] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [accountFieldErrors, setAccountFieldErrors] = useState({})
  const [accountError, setAccountError] = useState(null)
  const [accountSuccess, setAccountSuccess] = useState(null)
  const [savingAccount, setSavingAccount] = useState(false)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    fetchAdminSettings(controller.signal)
      .then((data) => {
        if (!active) return
        setSalonName(data.salon_name || '')
        setCancelDeadlineHours(String(data.cancel_deadline_hours ?? ''))
        setAdminPhone(data.admin_phone || '')
        setLoadError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') return
        setLoadError(err.message)
        setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [reloadKey])

  const handleRetryLoad = () => {
    setLoading(true)
    setLoadError(null)
    setReloadKey((prev) => prev + 1)
  }

  const clearGeneralFieldError = (field) => {
    setGeneralFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const clearAccountFieldError = (field) => {
    setAccountFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const handleSaveGeneral = (e) => {
    e.preventDefault()
    setGeneralError(null)
    setGeneralSuccess(null)

    const nextErrors = {}
    const cleanSalon = salonName.trim()
    if (!cleanSalon) {
      nextErrors.salon_name = 'نام آرایشگاه نمی‌تواند خالی باشد.'
    } else if (cleanSalon.length < 2 || cleanSalon.length > 80) {
      nextErrors.salon_name = 'نام آرایشگاه باید بین ۲ تا ۸۰ کاراکتر باشد.'
    }

    const parsedDeadline = parseNonNegativeInt(cancelDeadlineHours)
    if (parsedDeadline === null) {
      nextErrors.cancel_deadline_hours = 'مهلت لغو نوبت باید یک عدد صحیح معتبر به ساعت باشد.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setGeneralFieldErrors(nextErrors)
      return
    }

    setGeneralFieldErrors({})
    setSavingGeneral(true)

    updateGeneralSettings({
      salon_name: cleanSalon,
      cancel_deadline_hours: parsedDeadline,
    })
      .then((res) => {
        setSavingGeneral(false)
        setSalonName(res.settings.salon_name)
        setCancelDeadlineHours(String(res.settings.cancel_deadline_hours))
        setGeneralSuccess(res.message)
        if (onPublicSettingsChanged) {
          onPublicSettingsChanged(res.settings)
        }
        setTimeout(() => setGeneralSuccess(null), 4000)
      })
      .catch((err) => {
        setSavingGeneral(false)
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setGeneralFieldErrors(err.fieldErrors)
          return
        }
        setGeneralError(err.message)
      })
  }

  const handleSaveAccount = (e) => {
    e.preventDefault()
    setAccountError(null)
    setAccountSuccess(null)

    const nextErrors = {}
    const cleanPhone = normalizePhone(adminPhone)
    if (!cleanPhone) {
      nextErrors.phone = 'وارد کردن شماره موبایل الزامی است.'
    } else if (!/^09\d{9}$/.test(cleanPhone)) {
      nextErrors.phone = 'شماره موبایل باید ۱۱ رقم بوده و با ۰۹ شروع شود.'
    }

    if (!currentPassword || !currentPassword.trim()) {
      nextErrors.current_password = 'وارد کردن رمز عبور فعلی الزامی است.'
    }

    if (newPassword && newPassword.trim().length > 0 && newPassword.trim().length < 4) {
      nextErrors.new_password = 'رمز عبور جدید باید حداقل ۴ کاراکتر باشد.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setAccountFieldErrors(nextErrors)
      return
    }

    setAccountFieldErrors({})
    setSavingAccount(true)

    updateAdminAccount({
      phone: cleanPhone,
      current_password: currentPassword,
      new_password: newPassword.trim() ? newPassword : null,
    })
      .then((res) => {
        setSavingAccount(false)
        setAdminPhone(res.admin.phone)
        setCurrentPassword('')
        setNewPassword('')
        if (res.access_token) {
          setAdminSession(res.access_token, res.admin.phone)
        }
        if (onAdminPhoneUpdated) {
          onAdminPhoneUpdated(res.admin.phone)
        }
        setAccountSuccess(res.message)
        setTimeout(() => setAccountSuccess(null), 4000)
      })
      .catch((err) => {
        setSavingAccount(false)
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setAccountFieldErrors(err.fieldErrors)
          return
        }
        setAccountError(err.message)
      })
  }

  return (
    <div className="admin-settings-page">
      <Card className="settings-overview-card">
        <h2>⚙️ تنظیمات کامل آرایشگاه</h2>
        <p className="settings-overview-subtitle">
          از این صفحه می‌توانید تمام بخش‌های سامانه را یک‌جا مدیریت کنید: نام آرایشگاه، مهلت لغو نوبت، شماره موبایل و رمز ورود، ساعت کاری هفته، تعطیلی‌ها/مرخصی‌ها و خدمات.
        </p>
        <nav className="settings-anchor-nav" aria-label="پرش سریع به بخش‌های تنظیمات">
          <button
            type="button"
            className={`settings-anchor-pill ${activeSection === 'section-general' ? 'active' : ''}`.trim()}
            onClick={() => scrollToSection('section-general')}
          >
            🏪 نام و مهلت لغو
          </button>
          <button
            type="button"
            className={`settings-anchor-pill ${activeSection === 'section-security' ? 'active' : ''}`.trim()}
            onClick={() => scrollToSection('section-security')}
          >
            🔐 موبایل و رمز ورود
          </button>
          <button
            type="button"
            className={`settings-anchor-pill ${activeSection === 'section-schedule' ? 'active' : ''}`.trim()}
            onClick={() => scrollToSection('section-schedule')}
          >
            🕒 ساعت کاری و تعطیلی‌ها
          </button>
          <button
            type="button"
            className={`settings-anchor-pill ${activeSection === 'section-services' ? 'active' : ''}`.trim()}
            onClick={() => scrollToSection('section-services')}
          >
            ✂️ خدمات آرایشگاه
          </button>
        </nav>
      </Card>

      {loading ? (
        <Card className="settings-section-card" id="section-general">
          <div id="section-security" />
          <LoadingState variant="box" label="در حال بارگذاری تنظیمات کلی و اطلاعات حساب..." />
        </Card>
      ) : loadError ? (
        <Card className="settings-section-card" id="section-general">
          <div id="section-security" />
          <ErrorState message={loadError} onRetry={handleRetryLoad} />
        </Card>
      ) : (
        <div className="settings-top-grid">
          {/* بخش ۱: نام آرایشگاه و مهلت لغو */}
          <Card className="settings-section-card" id="section-general">
            <h3>🏪 مشخصات آرایشگاه و مهلت لغو</h3>
            <p className="settings-section-desc">
              نام آرایشگاه در هدر و صفحات مشتریان نمایش داده می‌شود و مهلت لغو تعیین می‌کند مشتری تا چند ساعت قبل از نوبت بتواند لغو کند.
            </p>

            {generalSuccess && (
              <Alert variant="success">
                <span>✅ {generalSuccess}</span>
              </Alert>
            )}
            {generalError && (
              <Alert variant="error">
                <span>⚠️ {generalError}</span>
              </Alert>
            )}

            <form onSubmit={handleSaveGeneral} className="settings-form-stack" noValidate>
              <Input
                id="settingSalonName"
                label="نام آرایشگاه:"
                type="text"
                value={salonName}
                onChange={(e) => {
                  setSalonName(e.target.value)
                  clearGeneralFieldError('salon_name')
                }}
                error={generalFieldErrors.salon_name}
                maxLength={80}
              />

              <Input
                id="settingCancelDeadline"
                label="مهلت لغو نوبت توسط مشتری (ساعت قبل از شروع):"
                type="tel"
                inputMode="numeric"
                value={cancelDeadlineHours}
                onChange={(e) => {
                  setCancelDeadlineHours(e.target.value)
                  clearGeneralFieldError('cancel_deadline_hours')
                }}
                error={generalFieldErrors.cancel_deadline_hours}
                hint="عدد ۰ یعنی امکان لغو تا لحظه‌ی شروع نوبت."
              />

              <div className="settings-form-footer">
                <Button type="submit" variant="primary" disabled={savingGeneral}>
                  {savingGeneral ? 'در حال ذخیره...' : 'ذخیره تنظیمات عمومی'}
                </Button>
              </div>
            </form>
          </Card>

          {/* بخش ۲: شماره موبایل و رمز عبور مدیر */}
          <Card className="settings-section-card" id="section-security">
            <h3>🔐 شماره موبایل و رمز ورود مدیر</h3>
            <p className="settings-section-desc">
              برای تغییر شماره موبایل ورود یا تنظیم رمز عبور جدید، وارد کردن رمز عبور فعلی الزامی است.
            </p>

            {accountSuccess && (
              <Alert variant="success">
                <span>✅ {accountSuccess}</span>
              </Alert>
            )}
            {accountError && (
              <Alert variant="error">
                <span>⚠️ {accountError}</span>
              </Alert>
            )}

            <form onSubmit={handleSaveAccount} className="settings-form-stack" noValidate>
              <Input
                id="settingAdminPhone"
                label="شماره موبایل ورود:"
                type="tel"
                value={adminPhone}
                onChange={(e) => {
                  setAdminPhone(e.target.value)
                  clearAccountFieldError('phone')
                }}
                error={accountFieldErrors.phone}
                maxLength={16}
                autoComplete="username"
              />

              <Input
                id="settingCurrentPassword"
                label="رمز عبور فعلی (الزامی):"
                type="password"
                placeholder="رمز فعلی خود را وارد کنید"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value)
                  clearAccountFieldError('current_password')
                }}
                error={accountFieldErrors.current_password}
                autoComplete="current-password"
              />

              <Input
                id="settingNewPassword"
                label="رمز عبور جدید (در صورت تمایل به تغییر رمز):"
                type="password"
                placeholder="اگر فقط شماره را عوض می‌کنید خالی بگذارید"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  clearAccountFieldError('new_password')
                }}
                error={accountFieldErrors.new_password}
                autoComplete="new-password"
              />

              <div className="settings-form-footer">
                <Button type="submit" variant="primary" disabled={savingAccount}>
                  {savingAccount ? 'در حال به‌روزرسانی...' : 'به‌روزرسانی اطلاعات ورود'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* بخش ۳: ساعات کاری هفته و تعطیلی‌ها/مرخصی‌ها (استفاده مجدد بدون جزء تکراری) */}
      <section id="section-schedule" className="settings-embedded-block">
        <AdminSchedulePage />
      </section>

      {/* بخش ۴: مدیریت خدمات (استفاده مجدد بدون جزء تکراری) */}
      <section id="section-services" className="settings-embedded-block">
        <AdminServicesPage onServicesChanged={onServicesChanged} />
      </section>
    </div>
  )
}

export default AdminSettingsPage
