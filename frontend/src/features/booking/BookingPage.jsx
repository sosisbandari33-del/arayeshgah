import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Input } from '../../ui'
import { getLocalDateString, isValidDateString } from '../../utils/date'
import { normalizePhone, formatPrice, toPersianDigits } from '../../utils/persian'
import { fetchSlots, createAppointment } from './bookingApi'
import BookingReceipt from './BookingReceipt'
import './booking.css'

const BOOKING_FORM_FIELDS = new Set([
  'customer_name',
  'customer_phone',
  'service_ids',
  'service_id',
  'date',
  'start_time',
])

function BookingPage({ services, servicesLoading, servicesError, onRetryServices }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const rawPreselected = searchParams.get('service')
  const parsedPreselected = rawPreselected && /^\d+$/.test(rawPreselected) ? Number(rawPreselected) : null
  const todayStr = getLocalDateString()

  const [selectedServiceIds, setSelectedServiceIds] = useState(() =>
    parsedPreselected ? [parsedPreselected] : []
  )
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [selectedTime, setSelectedTime] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  const [slots, setSlots] = useState([])
  const [isClosedDay, setIsClosedDay] = useState(false)
  const [closureReason, setClosureReason] = useState(null)
  const [dayWorkingHours, setDayWorkingHours] = useState(null)
  const [slotError, setSlotError] = useState(null)
  const [slotsRefreshKey, setSlotsRefreshKey] = useState(0)
  const [completedFetchKey, setCompletedFetchKey] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [successData, setSuccessData] = useState(null)

  const activeSelectedServices = services.filter((s) => selectedServiceIds.includes(s.id))
  const effectiveServiceIds = activeSelectedServices.map((s) => s.id)
  const serviceIdsKey = effectiveServiceIds.join(',')
  const totalDuration = activeSelectedServices.reduce((sum, s) => sum + s.duration, 0)
  const totalPrice = activeSelectedServices.reduce((sum, s) => sum + s.price, 0)

  const currentFetchKey =
    selectedDate && serviceIdsKey ? `${selectedDate}|${serviceIdsKey}|${slotsRefreshKey}` : ''
  const loadingSlots = Boolean(currentFetchKey) && completedFetchKey !== currentFetchKey

  useEffect(() => {
    if (!selectedDate || !serviceIdsKey) return

    let active = true
    const controller = new AbortController()
    const keyForThisRun = `${selectedDate}|${serviceIdsKey}|${slotsRefreshKey}`
    const idsList = serviceIdsKey.split(',').map(Number)

    fetchSlots(selectedDate, idsList, controller.signal)
      .then((data) => {
        if (!active) return
        setSlots(data.slots || [])
        setIsClosedDay(Boolean(data.is_closed_day))
        setClosureReason(data.closure_reason || null)
        setDayWorkingHours(data.working_hours || null)
        setSlotError(null)
        setCompletedFetchKey(keyForThisRun)
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') return
        setSlots([])
        setIsClosedDay(false)
        setClosureReason(null)
        setDayWorkingHours(null)
        setSlotError(err.message)
        setCompletedFetchKey(keyForThisRun)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [selectedDate, serviceIdsKey, slotsRefreshKey])

  const clearFieldError = (field) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const toggleServiceSelection = (serviceId) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    )
    setSelectedTime('')
    setSlotError(null)
    clearFieldError('service_ids')
    clearFieldError('service_id')
    clearFieldError('start_time')
  }

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate)
    setSelectedTime('')
    setSlotError(null)
    clearFieldError('date')
    clearFieldError('start_time')
    if (!newDate) {
      setSlots([])
    }
  }

  const handleRetrySlots = () => {
    if (!selectedDate || effectiveServiceIds.length === 0) return
    setSlotError(null)
    setSelectedTime('')
    setSlotsRefreshKey((prev) => prev + 1)
  }

  const validateClientForm = () => {
    const nextErrors = {}

    if (effectiveServiceIds.length === 0) {
      nextErrors.service_ids = 'لطفاً حداقل یک خدمت را انتخاب کنید.'
    }

    if (!selectedDate) {
      nextErrors.date = 'وارد کردن تاریخ الزامی است.'
    } else if (!isValidDateString(selectedDate)) {
      nextErrors.date = 'فرمت تاریخ نامعتبر است (باید دقیقاً به شکل YYYY-MM-DD باشد).'
    }

    if (!selectedTime) {
      nextErrors.start_time = 'انتخاب ساعت نوبت الزامی است.'
    }

    const cleanName = customerName.trim()
    if (!cleanName) {
      nextErrors.customer_name = 'نام و نام خانوادگی نمی‌تواند خالی باشد.'
    } else if (cleanName.length < 2 || cleanName.length > 50) {
      nextErrors.customer_name = 'نام و نام خانوادگی باید بین ۲ تا ۵۰ کاراکتر باشد.'
    }

    const cleanPhone = normalizePhone(customerPhone)
    if (!cleanPhone) {
      nextErrors.customer_phone = 'وارد کردن شماره موبایل الزامی است.'
    } else if (!/^09\d{9}$/.test(cleanPhone)) {
      nextErrors.customer_phone = 'شماره موبایل باید ۱۱ رقم بوده و با ۰۹ شروع شود.'
    }

    return { nextErrors, cleanName, cleanPhone }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setErrorMessage(null)

    const { nextErrors, cleanName, cleanPhone } = validateClientForm()
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }

    setFieldErrors({})
    setSubmitting(true)

    createAppointment({
      customer_name: cleanName,
      customer_phone: cleanPhone,
      service_ids: effectiveServiceIds,
      date: selectedDate,
      start_time: selectedTime,
    })
      .then((data) => {
        setSuccessData(data.appointment)
        setFieldErrors({})
        setSubmitting(false)
      })
      .catch((err) => {
        setSubmitting(false)

        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors(err.fieldErrors)
          const hasUnmappedField = Object.keys(err.fieldErrors).some(
            (key) => !BOOKING_FORM_FIELDS.has(key)
          )
          if (hasUnmappedField) {
            setErrorMessage(err.message)
          }
          return
        }

        setErrorMessage(err.message)
        if (err.isServerResponse && selectedDate && effectiveServiceIds.length > 0) {
          setSelectedTime('')
          setSlotsRefreshKey((prev) => prev + 1)
        }
      })
  }

  const handleResetForNewBooking = () => {
    const currentToday = getLocalDateString()
    const nextDate = !selectedDate || selectedDate < currentToday ? currentToday : selectedDate
    setSuccessData(null)
    setCustomerName('')
    setCustomerPhone('')
    setSelectedDate(nextDate)
    setSelectedTime('')
    setErrorMessage(null)
    setFieldErrors({})
    setSlotError(null)
    setSlotsRefreshKey((prev) => prev + 1)
  }

  const handleGoHome = () => {
    navigate('/')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (successData) {
    return (
      <BookingReceipt
        appointment={successData}
        onNewBooking={handleResetForNewBooking}
        onGoHome={handleGoHome}
      />
    )
  }

  const serviceFieldError = fieldErrors.service_ids || fieldErrors.service_id
  const selectedSlotObj = slots.find((s) => s.time === selectedTime)

  return (
    <div className="booking-container">
      <Card className="booking-card">
        <div className="booking-card-header">
          <Button variant="back-link" onClick={handleGoHome}>
            &larr; بازگشت به خانه
          </Button>
          <h2>فرم رزرو نوبت آرایشگاه</h2>
          <p className="booking-subtitle">
            ابتدا یک یا چند خدمت را انتخاب کنید، سپس روز و یکی از ساعت‌های آزاد متناسب را برگزینید.
          </p>
        </div>

        {errorMessage && (
          <Alert variant="error">
            <span>⚠️ {errorMessage}</span>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="booking-form" noValidate>
          {/* گام ۱: انتخاب یک یا چند خدمت */}
          <div className="form-group">
            <label>۱. انتخاب خدمت (امکان انتخاب چند مورد):</label>
            {servicesLoading ? (
              <p className="loading-slots">در حال بارگذاری لیست خدمات...</p>
            ) : services.length === 0 ? (
              <Alert variant="box-error">
                <p className="slot-error-text">
                  ⚠️{' '}
                  {servicesError
                    ? `دریافت لیست خدمات ممکن نیست (${servicesError}).`
                    : 'در حال حاضر هیچ خدمت فعالی برای رزرو وجود ندارد.'}
                </p>
                {onRetryServices && (
                  <Button variant="retry-small" onClick={onRetryServices}>
                    🔄 تلاش دوباره برای دریافت خدمات
                  </Button>
                )}
              </Alert>
            ) : (
              <>
                <div className="service-multi-grid" role="group" aria-label="انتخاب خدمات">
                  {services.map((service) => {
                    const isChecked = effectiveServiceIds.includes(service.id)
                    return (
                      <label
                        key={service.id}
                        className={`service-choice-card ${isChecked ? 'checked' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleServiceSelection(service.id)}
                        />
                        <div className="service-choice-content">
                          <span className="service-choice-name">{service.name}</span>
                          <span className="service-choice-meta">
                            ⏱ {toPersianDigits(service.duration)} دقیقه |{' '}
                            <strong>{formatPrice(service.price)} تومان</strong>
                          </span>
                        </div>
                      </label>
                    )
                  })}
                </div>

                {activeSelectedServices.length > 0 && (
                  <div className="selected-services-summary">
                    <span>
                      خدمات انتخابی: <strong>{toPersianDigits(activeSelectedServices.length)} مورد</strong>
                    </span>
                    <span>
                      مجموع مدت: <strong>{toPersianDigits(totalDuration)} دقیقه</strong>
                    </span>
                    <span>
                      مجموع هزینه: <strong>{formatPrice(totalPrice)} تومان</strong>
                    </span>
                  </div>
                )}
              </>
            )}

            {serviceFieldError && (
              <p className="field-error" role="alert">
                {serviceFieldError}
              </p>
            )}
          </div>

          {/* گام ۲: انتخاب روز */}
          <Input
            id="bookingDate"
            label="۲. انتخاب روز:"
            type="date"
            min={todayStr}
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            error={fieldErrors.date}
          />

          {/* گام ۳: نمایش فقط زمان‌هایی که خدمات کامل در آن جا می‌شوند */}
          <div className="form-group">
            <label>
              ۳. انتخاب ساعت نوبت
              {effectiveServiceIds.length > 0 && dayWorkingHours
                ? ` (ساعت کاری روز: ${toPersianDigits(dayWorkingHours.start_time)} الی ${toPersianDigits(dayWorkingHours.end_time)})`
                : ''}
              :
            </label>

            {effectiveServiceIds.length === 0 ? (
              <div className="step-guide-box">
                👆 لطفاً ابتدا در گام ۱ یک یا چند خدمت را انتخاب کنید تا ساعت‌های متناسب محاسبه شوند.
              </div>
            ) : !selectedDate ? (
              <p className="field-hint">لطفاً تاریخ نوبت را انتخاب کنید.</p>
            ) : loadingSlots ? (
              <p className="loading-slots">
                در حال بررسی زمان‌های آزاد برای {toPersianDigits(totalDuration)} دقیقه خدمت...
              </p>
            ) : slotError ? (
              <Alert variant="box-error">
                <p className="slot-error-text">⚠️ {slotError}</p>
                <Button variant="retry-small" onClick={handleRetrySlots}>
                  🔄 تلاش دوباره
                </Button>
              </Alert>
            ) : isClosedDay ? (
              <div className="closed-day-box">
                🚫 {closureReason || 'این روز تعطیل است و نوبتی ثبت نمی‌شود.'}
              </div>
            ) : slots.length === 0 ? (
              <div className="empty-slots-box">
                ⏳ در این تاریخ زمان خالیِ پیوسته به اندازه‌ی {toPersianDigits(totalDuration)} دقیقه وجود ندارد؛ لطفاً روز دیگری را انتخاب کنید.
              </div>
            ) : (
              <div className="slots-grid">
                {slots.map((slot) => {
                  const isSelected = selectedTime === slot.time
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      className={`slot-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedTime(slot.time)
                        clearFieldError('start_time')
                      }}
                    >
                      <span className="slot-time">{toPersianDigits(slot.time)}</span>
                      {slot.end_time && (
                        <span className="slot-end-hint">تا {toPersianDigits(slot.end_time)}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {fieldErrors.start_time && (
              <p className="field-error" role="alert">
                {fieldErrors.start_time}
              </p>
            )}

            {selectedSlotObj && (
              <p className="selected-time-notice">
                زمان انتخابی شما: <strong>{toPersianDigits(selectedSlotObj.time)}</strong>
                {selectedSlotObj.end_time
                  ? ` تا ${toPersianDigits(selectedSlotObj.end_time)} (${toPersianDigits(totalDuration)} دقیقه)`
                  : ''}
              </p>
            )}
          </div>

          {/* گام ۴: مشخصات مشتری */}
          <div className="form-row">
            <Input
              id="customerName"
              label="۴. نام و نام خانوادگی:"
              type="text"
              placeholder="مثال: محمد امینی"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value)
                clearFieldError('customer_name')
              }}
              error={fieldErrors.customer_name}
              maxLength={50}
            />

            <Input
              id="customerPhone"
              label="شماره موبایل:"
              type="tel"
              placeholder="مثال: 09121234567"
              value={customerPhone}
              onChange={(e) => {
                setCustomerPhone(e.target.value)
                clearFieldError('customer_phone')
              }}
              error={fieldErrors.customer_phone}
              maxLength={16}
            />
          </div>

          <div className="form-actions">
            <Button type="submit" variant="submit" disabled={submitting}>
              {submitting ? 'در حال ثبت نوبت...' : 'ثبت نهایی نوبت'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default BookingPage
