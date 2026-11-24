import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchSlots, createAppointment } from '../api/client'
import { getLocalDateString } from '../utils/date'
import { normalizePhone, formatPrice } from '../utils/persian'
import '../styles/booking.css'

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

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate)
    setSelectedTime('')
    setSlotError(null)
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

  const handleSubmit = (e) => {
    e.preventDefault()
    setErrorMessage(null)

    const cleanName = customerName.trim()
    if (!cleanName || cleanName.length < 2) {
      setErrorMessage('نام و نام خانوادگی باید حداقل ۲ کاراکتر باشد و نمی‌تواند فقط فاصله باشد.')
      return
    }

    if (cleanName.length > 50) {
      setErrorMessage('نام و نام خانوادگی نمی‌تواند بیشتر از ۵۰ کاراکتر باشد.')
      return
    }

    const cleanPhone = normalizePhone(customerPhone)
    if (!/^09\d{9}$/.test(cleanPhone)) {
      setErrorMessage('شماره موبایل باید ۱۱ رقم بوده، با ۰۹ شروع شود و شامل حروف نباشد.')
      return
    }

    if (!effectiveServiceId) {
      setErrorMessage('لطفاً نوع خدمت را انتخاب کنید.')
      return
    }

    if (!selectedDate) {
      setErrorMessage('لطفاً تاریخ نوبت را انتخاب کنید.')
      return
    }

    if (!selectedTime) {
      setErrorMessage('لطفاً یکی از ساعت‌های آزاد را انتخاب کنید.')
      return
    }

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
        setSubmitting(false)
      })
      .catch((err) => {
        setErrorMessage(err.message)
        setSubmitting(false)
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
      <div className="booking-container">
        <div className="success-card">
          <div className="success-icon">✅</div>
          <h2>نوبت شما با موفقیت ثبت شد!</h2>
          <p className="success-subtitle">اطلاعات نوبت شما در سیستم ذخیره گردید.</p>

          <div className="receipt-box">
            <div className="receipt-item">
              <span className="receipt-label">شماره پیگیری:</span>
              <span className="receipt-value">#{successData.id}</span>
            </div>
            <div className="receipt-item">
              <span className="receipt-label">نام مشتری:</span>
              <span className="receipt-value">{successData.customer_name}</span>
            </div>
            <div className="receipt-item">
              <span className="receipt-label">شماره تماس:</span>
              <span className="receipt-value">{successData.customer_phone}</span>
            </div>
            <div className="receipt-item">
              <span className="receipt-label">خدمت انتخابی:</span>
              <span className="receipt-value">{successData.service_name}</span>
            </div>
            <div className="receipt-item">
              <span className="receipt-label">تاریخ نوبت:</span>
              <span className="receipt-value">{successData.date}</span>
            </div>
            <div className="receipt-item">
              <span className="receipt-label">ساعت نوبت:</span>
              <span className="receipt-value time-badge">{successData.start_time}</span>
            </div>
            <div className="receipt-item">
              <span className="receipt-label">وضعیت:</span>
              <span className="status-pill">{successData.status}</span>
            </div>
          </div>

          <div className="success-actions">
            <button className="btn btn-secondary" onClick={handleResetForNewBooking}>
              ثبت نوبت دیگر
            </button>
            <button className="btn btn-primary" onClick={handleGoHome}>
              بازگشت به صفحه اصلی
            </button>
          </div>
        </div>
      </div>
    )
  }

  const selectedService = services.find((s) => s.id === Number(effectiveServiceId))

  return (
    <div className="booking-container">
      <div className="booking-card">
        <div className="booking-card-header">
          <button className="back-link" onClick={handleGoHome}>&larr; بازگشت به خانه</button>
          <h2>فرم رزرو نوبت آرایشگاه</h2>
          <p className="booking-subtitle">لطفاً مشخصات خود و زمان مورد نظرتان را مشخص فرمایید.</p>
        </div>

        {errorMessage && (
          <div className="error-alert">
            <span>⚠️ {errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="booking-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="customerName">نام و نام خانوادگی:</label>
              <input
                id="customerName"
                type="text"
                placeholder="مثال: محمد امینی"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                maxLength={50}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="customerPhone">شماره موبایل:</label>
              <input
                id="customerPhone"
                type="tel"
                placeholder="مثال: 09121234567"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                maxLength={16}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="serviceSelect">انتخاب خدمت:</label>
            {servicesLoading ? (
              <p className="loading-slots">در حال بارگذاری لیست خدمات...</p>
            ) : services.length === 0 ? (
              <div className="slot-error-box">
                <p className="slot-error-text">
                  ⚠️ {servicesError ? `دریافت لیست خدمات ممکن نیست (${servicesError}).` : 'هیچ خدمتی یافت نشد.'}
                </p>
                {onRetryServices && (
                  <button
                    type="button"
                    className="retry-btn-small"
                    onClick={onRetryServices}
                  >
                    🔄 تلاش دوباره برای دریافت خدمات
                  </button>
                )}
              </div>
            ) : (
              <>
                <select
                  id="serviceSelect"
                  value={effectiveServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} — {formatPrice(service.price)} تومان ({service.duration} دقیقه)
                    </option>
                  ))}
                </select>
                {selectedService && (
                  <p className="field-hint">
                    تعرفه: <strong>{formatPrice(selectedService.price)} تومان</strong> | مدت: {selectedService.duration} دقیقه
                  </p>
                )}
              </>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="bookingDate">انتخاب روز:</label>
            <input
              id="bookingDate"
              type="date"
              min={todayStr}
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>انتخاب ساعت نوبت (بازه‌های ۳۰ دقیقه‌ای از ۱۰:۰۰ الی ۲۰:۰۰):</label>
            {!selectedDate ? (
              <p className="field-hint">لطفاً ابتدا تاریخ نوبت را انتخاب کنید.</p>
            ) : loadingSlots ? (
              <p className="loading-slots">در حال بررسی ساعت‌های آزاد...</p>
            ) : slotError ? (
              <div className="slot-error-box">
                <p className="slot-error-text">⚠️ {slotError}</p>
                <button
                  type="button"
                  className="retry-btn-small"
                  onClick={handleRetrySlots}
                >
                  🔄 تلاش دوباره
                </button>
              </div>
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
                      onClick={() => setSelectedTime(slot.time)}
                    >
                      <span className="slot-time">{slot.time}</span>
                      {slot.is_booked && <span className="slot-badge booked">رزرو شده</span>}
                      {slot.is_past && <span className="slot-badge past">گذشته</span>}
                    </button>
                  )
                })}
              </div>
            )}
            {selectedTime && (
              <p className="selected-time-notice">
                ساعت انتخابی شما: <strong>{selectedTime}</strong>
              </p>
            )}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-submit"
              disabled={submitting || !selectedTime || !effectiveServiceId}
            >
              {submitting ? 'در حال ثبت نوبت...' : 'ثبت نهایی نوبت'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default BookingPage
