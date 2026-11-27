import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Input } from '../../ui'
import { getLocalDateString, isValidDateString } from '../../utils/date'
import { normalizePhone, formatPrice, toPersianDigits } from '../../utils/persian'
import { fetchSlots, createAppointment } from './bookingApi'
import BookingReceipt from './BookingReceipt'
import './booking.css'

const WIZARD_STEPS = [
  { id: 1, title: 'انتخاب خدمت‌ها' },
  { id: 2, title: 'انتخاب روز و زمان' },
  { id: 3, title: 'نام و موبایل' },
  { id: 4, title: 'تأیید' },
]

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
  const parsedPreselected =
    rawPreselected && /^\d+$/.test(rawPreselected) ? Number(rawPreselected) : null
  const todayStr = getLocalDateString()

  const [step, setStep] = useState(1)
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
    setErrorMessage(null)
    clearFieldError('service_ids')
    clearFieldError('service_id')
    clearFieldError('start_time')
  }

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate)
    setSelectedTime('')
    setSlotError(null)
    setErrorMessage(null)
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

  const handleNextFromStep1 = () => {
    setErrorMessage(null)
    if (effectiveServiceIds.length === 0) {
      setFieldErrors({ service_ids: 'لطفاً حداقل یک خدمت را انتخاب کنید.' })
      return
    }
    setFieldErrors({})
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNextFromStep2 = () => {
    setErrorMessage(null)
    const nextErrors = {}
    if (!selectedDate) {
      nextErrors.date = 'وارد کردن تاریخ الزامی است.'
    } else if (!isValidDateString(selectedDate)) {
      nextErrors.date = 'فرمت تاریخ نامعتبر است (باید دقیقاً به شکل YYYY-MM-DD باشد).'
    }
    if (!selectedTime) {
      nextErrors.start_time = 'لطفاً یکی از ساعت‌های آزاد را انتخاب کنید.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }
    setFieldErrors({})
    setStep(3)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNextFromStep3 = () => {
    setErrorMessage(null)
    const nextErrors = {}

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

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }
    setFieldErrors({})
    setStep(4)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleFinalConfirm = (e) => {
    e.preventDefault()
    setErrorMessage(null)
    setFieldErrors({})
    setSubmitting(true)

    const cleanName = customerName.trim()
    const cleanPhone = normalizePhone(customerPhone)

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
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
      .catch((err) => {
        setSubmitting(false)

        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors(err.fieldErrors)
          if (err.fieldErrors.service_ids || err.fieldErrors.service_id) {
            setStep(1)
          } else if (err.fieldErrors.date || err.fieldErrors.start_time) {
            setStep(2)
          } else if (err.fieldErrors.customer_name || err.fieldErrors.customer_phone) {
            setStep(3)
          }
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
          setStep(2)
          setSlotsRefreshKey((prev) => prev + 1)
        }
      })
  }

  const handleResetForNewBooking = () => {
    const currentToday = getLocalDateString()
    const nextDate = !selectedDate || selectedDate < currentToday ? currentToday : selectedDate
    setSuccessData(null)
    setStep(1)
    setSelectedServiceIds([])
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
  const selectedTimeRange = selectedTime
    ? selectedSlotObj?.end_time
      ? `${toPersianDigits(selectedTime)} تا ${toPersianDigits(selectedSlotObj.end_time)}`
      : toPersianDigits(selectedTime)
    : null

  return (
    <div className="booking-container">
      <Card className="booking-card">
        <div className="booking-card-header">
          <Button variant="back-link" onClick={handleGoHome}>
            &larr; بازگشت به صفحه اصلی
          </Button>
          <h2>رزرو نوبت آنلاین</h2>
          <p className="booking-subtitle">
            در ۴ قدم ساده خدمت، زمان و مشخصات خود را وارد و نوبتتان را ثبت کنید.
          </p>
        </div>

        {/* نوار گام‌های ویزارد */}
        <ol className="wizard-stepper" aria-label="مراحل رزرو نوبت">
          {WIZARD_STEPS.map((item) => {
            const isCurrent = step === item.id
            const isDone = step > item.id
            return (
              <li
                key={item.id}
                className={`wizard-step ${isCurrent ? 'current' : ''} ${isDone ? 'done' : ''}`}
              >
                <span className="wizard-step-num">
                  {isDone ? '✓' : toPersianDigits(item.id)}
                </span>
                <span className="wizard-step-label">{item.title}</span>
              </li>
            )
          })}
        </ol>

        {/* نوار خلاصه‌ی انتخاب مشتری در تمام قدم‌ها */}
        <div className="live-selection-bar" aria-live="polite">
          <div className="live-selection-main">
            <span className="live-selection-title">انتخاب شما تا این لحظه:</span>
            {activeSelectedServices.length === 0 ? (
              <span className="live-selection-empty">هنوز خدمتی انتخاب نشده است</span>
            ) : (
              <span className="live-selection-services">
                {activeSelectedServices.map((s) => s.name).join(' + ')}
              </span>
            )}
          </div>
          <div className="live-selection-metrics">
            <span>
              مدت کل: <strong>{toPersianDigits(totalDuration)} دقیقه</strong>
            </span>
            <span>
              هزینه‌ی کل: <strong>{formatPrice(totalPrice)} تومان</strong>
            </span>
            {step >= 2 && selectedDate && selectedTimeRange && (
              <span>
                زمان: <strong>{toPersianDigits(selectedDate)} — {selectedTimeRange}</strong>
              </span>
            )}
          </div>
        </div>

        {errorMessage && (
          <Alert variant="error">
            <span>⚠️ {errorMessage}</span>
          </Alert>
        )}

        <form onSubmit={handleFinalConfirm} className="booking-form" noValidate>
          {/* قدم ۱: انتخاب خدمت‌ها */}
          {step === 1 && (
            <div className="wizard-panel">
              <h3 className="wizard-panel-title">قدم ۱: خدمت یا خدمت‌های مورد نظر را انتخاب کنید</h3>

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
              )}

              {serviceFieldError && (
                <p className="field-error" role="alert">
                  {serviceFieldError}
                </p>
              )}

              <div className="wizard-actions single-end">
                <Button type="button" variant="primary" onClick={handleNextFromStep1}>
                  ادامه: انتخاب روز و زمان &rarr;
                </Button>
              </div>
            </div>
          )}

          {/* قدم ۲: انتخاب روز و زمان */}
          {step === 2 && (
            <div className="wizard-panel">
              <h3 className="wizard-panel-title">قدم ۲: روز و ساعت مناسب را انتخاب کنید</h3>

              <Input
                id="bookingDate"
                label="انتخاب روز:"
                type="date"
                min={todayStr}
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                error={fieldErrors.date}
              />

              <div className="form-group">
                <label>
                  ساعت‌های آزاد متناسب با {toPersianDigits(totalDuration)} دقیقه خدمت
                  {dayWorkingHours
                    ? ` (ساعت کاری: ${toPersianDigits(dayWorkingHours.start_time)} الی ${toPersianDigits(dayWorkingHours.end_time)})`
                    : ''}
                  :
                </label>

                {!selectedDate ? (
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
                            <span className="slot-end-hint">
                              تا {toPersianDigits(slot.end_time)}
                            </span>
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
              </div>

              <div className="wizard-actions">
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                  &larr; مرحله قبل (خدمت‌ها)
                </Button>
                <Button type="button" variant="primary" onClick={handleNextFromStep2}>
                  ادامه: نام و موبایل &rarr;
                </Button>
              </div>
            </div>
          )}

          {/* قدم ۳: نام و موبایل */}
          {step === 3 && (
            <div className="wizard-panel">
              <h3 className="wizard-panel-title">قدم ۳: مشخصات تماس خود را وارد کنید</h3>

              <div className="form-row">
                <Input
                  id="customerName"
                  label="نام و نام خانوادگی:"
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

              <div className="wizard-actions">
                <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                  &larr; مرحله قبل (روز و زمان)
                </Button>
                <Button type="button" variant="primary" onClick={handleNextFromStep3}>
                  ادامه: بررسی و تأیید &rarr;
                </Button>
              </div>
            </div>
          )}

          {/* قدم ۴: تأیید نهایی */}
          {step === 4 && (
            <div className="wizard-panel">
              <h3 className="wizard-panel-title">قدم ۴: بررسی خلاصه و تأیید نهایی نوبت</h3>

              <div className="confirm-summary-card">
                <div className="confirm-summary-section">
                  <span className="confirm-summary-heading">خدمت‌های انتخاب‌شده:</span>
                  <ul className="confirm-services-list">
                    {activeSelectedServices.map((svc) => (
                      <li key={svc.id}>
                        <span>{svc.name} ({toPersianDigits(svc.duration)} دقیقه)</span>
                        <strong>{formatPrice(svc.price)} تومان</strong>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="confirm-summary-grid">
                  <div className="confirm-summary-row">
                    <span>مدت کل:</span>
                    <strong>{toPersianDigits(totalDuration)} دقیقه</strong>
                  </div>
                  <div className="confirm-summary-row highlight">
                    <span>هزینه‌ی کل:</span>
                    <strong>{formatPrice(totalPrice)} تومان</strong>
                  </div>
                  <div className="confirm-summary-row">
                    <span>روز نوبت:</span>
                    <strong>{toPersianDigits(selectedDate)}</strong>
                  </div>
                  <div className="confirm-summary-row">
                    <span>ساعت نوبت:</span>
                    <strong>{selectedTimeRange}</strong>
                  </div>
                  <div className="confirm-summary-row">
                    <span>نام مشتری:</span>
                    <strong>{customerName.trim()}</strong>
                  </div>
                  <div className="confirm-summary-row">
                    <span>شماره موبایل:</span>
                    <strong>{toPersianDigits(normalizePhone(customerPhone))}</strong>
                  </div>
                </div>
              </div>

              <div className="wizard-actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => setStep(3)}
                >
                  &larr; ویرایش مشخصات
                </Button>
                <Button type="submit" variant="submit" disabled={submitting}>
                  {submitting ? 'در حال ثبت نهایی...' : '✅ تأیید و ثبت نهایی نوبت'}
                </Button>
              </div>
            </div>
          )}
        </form>
      </Card>
    </div>
  )
}

export default BookingPage
