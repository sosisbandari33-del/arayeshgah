import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
} from '../../ui'
import {
  convertPersianToEnglishDigits,
  formatPrice,
  normalizePhone,
  toPersianDigits,
} from '../../utils/persian'
import { cancelAppointmentByCustomer, lookupAppointment } from './trackingApi'
import './tracking.css'

function TrackingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [phone, setPhone] = useState(() => searchParams.get('phone') || '')
  const [trackingCode, setTrackingCode] = useState(() => searchParams.get('code') || '')
  const [fieldErrors, setFieldErrors] = useState({})
  const [networkError, setNetworkError] = useState(null)
  const [notFoundMsg, setNotFoundMsg] = useState(null)
  const [loading, setLoading] = useState(false)

  const [trackingResult, setTrackingResult] = useState(null)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelModalError, setCancelModalError] = useState(null)
  const [successBanner, setSuccessBanner] = useState(null)

  const clearFieldError = (field) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const validateInputs = () => {
    const errors = {}
    const cleanPhone = normalizePhone(phone)
    if (!cleanPhone) {
      errors.customer_phone = 'وارد کردن شماره موبایل الزامی است.'
    } else if (!/^09\d{9}$/.test(cleanPhone)) {
      errors.customer_phone = 'شماره موبایل باید ۱۱ رقم بوده و با ۰۹ شروع شود.'
    }

    const cleanCode = convertPersianToEnglishDigits(trackingCode).replace(/\s+/g, '')
    if (!cleanCode) {
      errors.tracking_code = 'وارد کردن کد پیگیری الزامی است.'
    } else if (!/^\d{6}$/.test(cleanCode)) {
      errors.tracking_code = 'کد پیگیری باید یک کد ۶ رقمی عددی باشد.'
    }

    return { errors, cleanPhone, cleanCode }
  }

  const performLookup = () => {
    setNetworkError(null)
    setNotFoundMsg(null)
    setSuccessBanner(null)

    const { errors, cleanPhone, cleanCode } = validateInputs()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setLoading(true)

    lookupAppointment({
      customer_phone: cleanPhone,
      tracking_code: cleanCode,
    })
      .then((data) => {
        setTrackingResult({
          ...data,
          queriedPhone: cleanPhone,
          queriedCode: cleanCode,
        })
        setLoading(false)
      })
      .catch((err) => {
        setLoading(false)
        setTrackingResult(null)
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors(err.fieldErrors)
          return
        }
        if (err.status === 404) {
          setNotFoundMsg(err.message)
          return
        }
        setNetworkError(err.message)
      })
  }

  const handleLookupSubmit = (e) => {
    e.preventDefault()
    performLookup()
  }

  const handleConfirmCancel = () => {
    if (!trackingResult) return
    setCancelLoading(true)
    setCancelModalError(null)

    cancelAppointmentByCustomer({
      customer_phone: trackingResult.queriedPhone,
      tracking_code: trackingResult.queriedCode,
    })
      .then((res) => {
        setCancelLoading(false)
        setConfirmCancelOpen(false)
        setTrackingResult((prev) => ({
          ...prev,
          appointment: res.appointment,
          can_cancel: false,
          cancel_reason: res.cancel_reason || 'این نوبت قبلاً لغو شده است.',
        }))
        setSuccessBanner(res.message || 'نوبت شما با موفقیت لغو شد.')
      })
      .catch((err) => {
        setCancelLoading(false)
        setCancelModalError(err.message)
      })
  }

  const appt = trackingResult?.appointment
  const isCancelled = appt?.status === 'لغو شده'
  const canCancel = Boolean(trackingResult?.can_cancel) && !isCancelled

  return (
    <div className="tracking-container">
      <Card className="tracking-card">
        <div className="tracking-header">
          <Button variant="back-link" onClick={() => navigate('/')}>
            &larr; بازگشت به صفحه اصلی
          </Button>
          <h2>پیگیری و لغو نوبت</h2>
          <p className="tracking-subtitle">
            شماره موبایل و کد پیگیری ۶ رقمی خود را وارد کنید تا جزئیات نوبت نمایش داده شود.
          </p>
        </div>

        <form onSubmit={handleLookupSubmit} className="tracking-form" noValidate>
          <div className="tracking-form-row">
            <Input
              id="trackingPhone"
              label="شماره موبایل:"
              type="tel"
              placeholder="مثال: 09121234567"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                clearFieldError('customer_phone')
              }}
              error={fieldErrors.customer_phone}
              maxLength={16}
            />

            <Input
              id="trackingCodeInput"
              label="کد پیگیری ۶ رقمی:"
              type="text"
              inputMode="numeric"
              placeholder="کد ۶ رقمی رسید"
              value={trackingCode}
              onChange={(e) => {
                setTrackingCode(e.target.value)
                clearFieldError('tracking_code')
              }}
              error={fieldErrors.tracking_code}
              maxLength={10}
            />
          </div>

          <div className="tracking-search-actions">
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'در حال جستجو...' : '🔍 مشاهده وضعیت نوبت'}
            </Button>
          </div>
        </form>

        {successBanner && (
          <Alert variant="success">
            <span>✅ {successBanner}</span>
          </Alert>
        )}

        {loading && (
          <LoadingState variant="box" label="در حال جستجوی اطلاعات نوبت شما..." />
        )}

        {!loading && networkError && (
          <ErrorState message={networkError} onRetry={performLookup} />
        )}

        {!loading && !networkError && notFoundMsg && (
          <EmptyState
            icon="🔍"
            title="نوبتی با این مشخصات پیدا نشد"
            description={notFoundMsg}
          />
        )}

        {!loading && !networkError && !notFoundMsg && !appt && (
          <EmptyState
            icon="🎫"
            title="هنوز نوبتی جستجو نشده است"
            description="شماره موبایل و کد پیگیری ۶ رقمی خود را وارد کرده و دکمه‌ی «مشاهده وضعیت نوبت» را بزنید."
          />
        )}

        {!loading && appt && (
          <div className="tracked-appt-box">
            <div className="tracked-appt-top">
              <div style={{ minWidth: 0 }}>
                <span className="tracked-code-badge">
                  کد پیگیری: {toPersianDigits(appt.tracking_code)}
                </span>
                <h3
                  className="tracked-customer-name text-clamp-2"
                  title={appt.customer_name}
                >
                  {appt.customer_name}
                </h3>
              </div>
              <span
                className={`tracked-status-pill ${isCancelled ? 'cancelled' : 'active'}`}
              >
                {appt.status}
              </span>
            </div>

            <div className="tracked-details-grid">
              <div className="tracked-detail-row">
                <span>خدمت‌ها:</span>
                <strong
                  className="tracked-services-val text-clamp-2"
                  title={appt.service_name}
                >
                  {appt.service_name}
                </strong>
              </div>
              {appt.total_duration > 0 && (
                <div className="tracked-detail-row">
                  <span>مدت کل:</span>
                  <strong>{toPersianDigits(appt.total_duration)} دقیقه</strong>
                </div>
              )}
              {appt.total_price > 0 && (
                <div className="tracked-detail-row">
                  <span>هزینه‌ی کل:</span>
                  <strong>{formatPrice(appt.total_price)} تومان</strong>
                </div>
              )}
              <div className="tracked-detail-row">
                <span>روز نوبت:</span>
                <strong>{toPersianDigits(appt.date)}</strong>
              </div>
              <div className="tracked-detail-row">
                <span>ساعت نوبت:</span>
                <strong>
                  {toPersianDigits(appt.start_time)}
                  {appt.end_time ? ` تا ${toPersianDigits(appt.end_time)}` : ''}
                </strong>
              </div>
            </div>

            <div className="tracked-cancel-section">
              <Button
                type="button"
                variant="danger"
                disabled={!canCancel}
                onClick={() => {
                  setCancelModalError(null)
                  setConfirmCancelOpen(true)
                }}
              >
                لغو نوبت
              </Button>

              {canCancel ? (
                <p className="cancel-policy-hint">
                  امکان لغو نوبت تا {toPersianDigits(trackingResult.cancel_deadline_hours)} ساعت پیش از زمان شروع نوبت فراهم است.
                </p>
              ) : (
                <p className="cancel-disabled-reason" role="status">
                  ℹ️ {trackingResult.cancel_reason}
                </p>
              )}
            </div>
          </div>
        )}
      </Card>

      <Modal
        isOpen={confirmCancelOpen}
        title="⚠️ تأیید لغو نوبت"
        error={cancelModalError}
        actions={
          <>
            <Button
              variant="secondary"
              disabled={cancelLoading}
              onClick={() => setConfirmCancelOpen(false)}
            >
              انصراف
            </Button>
            <Button
              variant="danger"
              disabled={cancelLoading}
              onClick={handleConfirmCancel}
            >
              {cancelLoading ? 'در حال لغو...' : 'بله، نوبت لغو شود'}
            </Button>
          </>
        }
      >
        {appt && (
          <p>
            آیا از لغو نوبت خود در تاریخ <strong>{toPersianDigits(appt.date)}</strong> ساعت{' '}
            <strong>{toPersianDigits(appt.start_time)}</strong> مطمئن هستید؟
          </p>
        )}
      </Modal>
    </div>
  )
}

export default TrackingPage
