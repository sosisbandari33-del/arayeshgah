import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Input, Select } from '../../ui'
import { getLocalDateString, isValidDateString } from '../../utils/date'
import { normalizePhone, formatPrice } from '../../utils/persian'
import { fetchSlots, createAppointment } from './bookingApi'
import BookingReceipt from './BookingReceipt'
import './booking.css'

const BOOKING_FORM_FIELDS = new Set([
  'customer_name',
  'customer_phone',
  'service_id',
  'date',
  'start_time',
])

function BookingPage({ services, servicesLoading, servicesError, onRetryServices }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preSelectedServiceId = searchParams.get('service') || ''
  const todayStr = getLocalDateString()

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState(preSelectedServiceId)
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [selectedTime, setSelectedTime] = useState('')

  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [slotError, setSlotError] = useState(null)
  const [slotsRefreshKey, setSlotsRefreshKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [successData, setSuccessData] = useState(null)

  const hasValidSelectedService = services.some((s) => String(s.id) === String(selectedServiceId))
  const effectiveServiceId = hasValidSelectedService
    ? String(selectedServiceId)
    : services && services.length > 0
      ? String(services[0].id)
      : ''

  useEffect(() => {
    if (!selectedDate) return

    let active = true
    const controller = new AbortController()

    fetchSlots(selectedDate, controller.signal)
      .then((data) => {
        if (!active) return
        setSlots(data.slots || [])
        setSlotError(null)
        setLoadingSlots(false)
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') return
        setSlots([])
        setSlotError(err.message)
        setLoadingSlots(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [selectedDate, slotsRefreshKey])

  const clearFieldError = (field) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate)
    setSelectedTime('')
    setSlotError(null)
    clearFieldError('date')
    clearFieldError('start_time')
    if (!newDate) {
      setSlots([])
      setLoadingSlots(false)
    } else {
      setLoadingSlots(true)
    }
  }

  const handleRetrySlots = () => {
    if (!selectedDate) return
    setSlotError(null)
    setSelectedTime('')
    setLoadingSlots(true)
    setSlotsRefreshKey((prev) => prev + 1)
  }

  const validateClientForm = () => {
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

    if (!effectiveServiceId) {
      nextErrors.service_id = 'انتخاب خدمت الزامی است.'
    }

    if (!selectedDate) {
      nextErrors.date = 'وارد کردن تاریخ الزامی است.'
    } else if (!isValidDateString(selectedDate)) {
      nextErrors.date = 'فرمت تاریخ نامعتبر است (باید دقیقاً به شکل YYYY-MM-DD باشد).'
    }

    if (!selectedTime) {
      nextErrors.start_time = 'انتخاب ساعت نوبت الزامی است.'
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
      service_id: Number(effectiveServiceId),
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
        if (err.isServerResponse && selectedDate) {
          setSelectedTime('')
          setLoadingSlots(true)
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
    setLoadingSlots(true)
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

  const selectedService = services.find((s) => s.id === Number(effectiveServiceId))

  return (
    <div className="booking-container">
      <Card className="booking-card">
        <div className="booking-card-header">
          <Button variant="back-link" onClick={handleGoHome}>
            &larr; بازگشت به خانه
          </Button>
          <h2>فرم رزرو نوبت آرایشگاه</h2>
          <p className="booking-subtitle">لطفاً مشخصات خود و زمان مورد نظرتان را مشخص فرمایید.</p>
        </div>

        {errorMessage && (
          <Alert variant="error">
            <span>⚠️ {errorMessage}</span>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="booking-form" noValidate>
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

          {servicesLoading ? (
            <div className="form-group">
              <label htmlFor="serviceSelect">انتخاب خدمت:</label>
              <p className="loading-slots">در حال بارگذاری لیست خدمات...</p>
            </div>
          ) : services.length === 0 ? (
            <div className="form-group">
              <label htmlFor="serviceSelect">انتخاب خدمت:</label>
              <Alert variant="box-error">
                <p className="slot-error-text">
                  ⚠️ {servicesError ? `دریافت لیست خدمات ممکن نیست (${servicesError}).` : 'هیچ خدمتی یافت نشد.'}
                </p>
                {onRetryServices && (
                  <Button variant="retry-small" onClick={onRetryServices}>
                    🔄 تلاش دوباره برای دریافت خدمات
                  </Button>
                )}
              </Alert>
              {fieldErrors.service_id && (
                <p className="field-error" role="alert">
                  {fieldErrors.service_id}
                </p>
              )}
            </div>
          ) : (
            <Select
              id="serviceSelect"
              label="انتخاب خدمت:"
              value={effectiveServiceId}
              onChange={(e) => {
                setSelectedServiceId(e.target.value)
                clearFieldError('service_id')
              }}
              error={fieldErrors.service_id}
              hint={
                selectedService ? (
                  <>
                    تعرفه: <strong>{formatPrice(selectedService.price)} تومان</strong> | مدت:{' '}
                    {selectedService.duration} دقیقه
                  </>
                ) : null
              }
            >
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} — {formatPrice(service.price)} تومان ({service.duration} دقیقه)
                </option>
              ))}
            </Select>
          )}

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
            <label>انتخاب ساعت نوبت (بازه‌های ۳۰ دقیقه‌ای از ۱۰:۰۰ الی ۲۰:۰۰):</label>
            {!selectedDate ? (
              <p className="field-hint">لطفاً ابتدا تاریخ نوبت را انتخاب کنید.</p>
            ) : loadingSlots ? (
              <p className="loading-slots">در حال بررسی ساعت‌های آزاد...</p>
            ) : slotError ? (
              <Alert variant="box-error">
                <p className="slot-error-text">⚠️ {slotError}</p>
                <Button variant="retry-small" onClick={handleRetrySlots}>
                  🔄 تلاش دوباره
                </Button>
              </Alert>
            ) : (
              <div className="slots-grid">
                {slots.map((slot) => {
                  const isSelected = selectedTime === slot.time
                  const isDisabled = !slot.is_available

                  return (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={isDisabled}
                      className={`slot-btn ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                      onClick={() => {
                        setSelectedTime(slot.time)
                        clearFieldError('start_time')
                      }}
                    >
                      <span className="slot-time">{slot.time}</span>
                      {slot.is_booked && <span className="slot-badge booked">رزرو شده</span>}
                      {slot.is_past && <span className="slot-badge past">گذشته</span>}
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
            {selectedTime && (
              <p className="selected-time-notice">
                ساعت انتخابی شما: <strong>{selectedTime}</strong>
              </p>
            )}
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
