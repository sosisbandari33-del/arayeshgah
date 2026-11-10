import { useState, useEffect } from 'react'

// تابع تبدیل ارقام فارسی و عربی به ارقام انگلیسی
const convertPersianToEnglishDigits = (str) => {
  const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  const arabic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
  let res = str || ''
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(persian[i], String(i)).replaceAll(arabic[i], String(i))
  }
  return res
}

function BookingPage({ services, preSelectedServiceId, onBack }) {
  // تاریخ امروز با فرمت YYYY-MM-DD به عنوان حداقل تاریخ قابل انتخاب
  const todayStr = new Date().toISOString().split('T')[0]

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState(
    preSelectedServiceId || (services.length > 0 ? services[0].id : '')
  )
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [selectedTime, setSelectedTime] = useState('')
  
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotError, setSlotError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [successData, setSuccessData] = useState(null)

  // دریافت بازه‌های زمانی آزاد برای تاریخ انتخابی با تایم‌اوت ۵ ثانیه‌ای
  const fetchSlots = (date) => {
    if (!date) return

    setLoadingSlots(true)
    setSlotError(null)
    setSelectedTime('')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    // ابتدا تلاش از مسیر پروکسی /api و در صورت نیاز آدرس مستقیم
    const apiUrl = `/api/slots?date=${date}`

    fetch(apiUrl, { signal: controller.signal })
      .then((res) => {
        clearTimeout(timeoutId)
        if (!res.ok) throw new Error('خطا در بارگذاری بازه‌های زمانی')
        return res.json()
      })
      .then((data) => {
        setSlots(data.slots || [])
        setLoadingSlots(false)
      })
      .catch((err) => {
        clearTimeout(timeoutId)
        // اگر پروکسی با خطا مواجه شد، مستقیم به 127.0.0.1 امتحان کن
        fetch(`http://127.0.0.1:8000/api/slots?date=${date}`)
          .then((res) => {
            if (!res.ok) throw new Error('خطا')
            return res.json()
          })
          .then((data) => {
            setSlots(data.slots || [])
            setLoadingSlots(false)
          })
          .catch(() => {
            setSlotError('برقراری ارتباط با سرور ممکن نیست. لطفاً مطمئن شوید سرور بک‌اند در حال اجراست.')
            setLoadingSlots(false)
          })
      })
  }

  useEffect(() => {
    fetchSlots(selectedDate)
  }, [selectedDate])

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

    // تبدیل ارقام فارسی و عربی به انگلیسی و حذف فاصله‌ها
    const cleanPhone = convertPersianToEnglishDigits(customerPhone).replace(/\s+/g, '')
    if (!/^09\d{9}$/.test(cleanPhone)) {
      setErrorMessage('شماره موبایل باید ۱۱ رقم بوده و با ۰۹ شروع شود.')
      return
    }

    if (!selectedServiceId) {
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

    fetch('http://127.0.0.1:8000/api/appointments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_name: cleanName,
        customer_phone: cleanPhone,
        service_id: Number(selectedServiceId),
        date: selectedDate,
        start_time: selectedTime,
      }),
    })
      .then(async (res) => {
        let data
        try {
          data = await res.json()
        } catch {
          data = {}
        }
        if (!res.ok) {
          let errorMsg = 'خطایی در ثبت نوبت رخ داد.'
          if (typeof data.detail === 'string') {
            errorMsg = data.detail
          } else if (Array.isArray(data.detail)) {
            errorMsg = data.detail.map((d) => d.msg || JSON.stringify(d)).join(' - ')
          } else if (typeof data.detail === 'object' && data.detail !== null) {
            errorMsg = data.detail.msg || JSON.stringify(data.detail)
          }
          throw new Error(errorMsg)
        }
        return data
      })
      .then((data) => {
        setSuccessData(data.appointment)
        setSubmitting(false)
      })
      .catch((err) => {
        let msg = err.message
        if (!msg || msg.includes('Failed to fetch') || msg.includes('NetworkError') || err.name === 'TypeError') {
          msg = 'برقراری ارتباط با سرور ممکن نیست. لطفاً مطمئن شوید سرور بک‌اند در حال اجراست.'
        }
        setErrorMessage(msg)
        setSubmitting(false)
      })
  }

  // نمایش کارت موفقیت و خلاصه نوبت
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
            <button className="btn btn-secondary" onClick={() => {
              setSuccessData(null)
              setSelectedTime('')
            }}>
              ثبت نوبت دیگر
            </button>
            <button className="btn btn-primary" onClick={onBack}>
              بازگشت به صفحه اصلی
            </button>
          </div>
        </div>
      </div>
    )
  }

  const selectedService = services.find((s) => s.id === Number(selectedServiceId))

  return (
    <div className="booking-container">
      <div className="booking-card">
        <div className="booking-card-header">
          <button className="back-link" onClick={onBack}>&larr; بازگشت به خانه</button>
          <h2>فرم رزرو نوبت آرایشگاه</h2>
          <p className="booking-subtitle">لطفاً مشخصات خود و زمان مورد نظرتان را مشخص فرمایید.</p>
        </div>

        {errorMessage && (
          <div className="error-alert">
            <span>⚠️ {errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="booking-form">
          {/* مشخصات مشتری */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="customerName">نام و نام خانوادگی:</label>
              <input
                id="customerName"
                type="text"
                placeholder="مثال: محمد امینی"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
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
                maxLength={11}
                required
              />
            </div>
          </div>

          {/* انتخاب خدمت */}
          <div className="form-group">
            <label htmlFor="serviceSelect">انتخاب خدمت:</label>
            <select
              id="serviceSelect"
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
            >
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} — {Number(service.price).toLocaleString('fa-IR')} تومان ({service.duration} دقیقه)
                </option>
              ))}
            </select>
            {selectedService && (
              <p className="field-hint">
                تعرفه: <strong>{Number(selectedService.price).toLocaleString('fa-IR')} تومان</strong> | مدت: {selectedService.duration} دقیقه
              </p>
            )}
          </div>

          {/* انتخاب تاریخ */}
          <div className="form-group">
            <label htmlFor="bookingDate">انتخاب روز:</label>
            <input
              id="bookingDate"
              type="date"
              min={todayStr}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              required
            />
          </div>

          {/* انتخاب ساعت (بازه‌های ۳۰ دقیقه‌ای) */}
          <div className="form-group">
            <label>انتخاب ساعت نوبت (بازه‌های ۳۰ دقیقه‌ای از ۱۰:۰۰ الی ۲۰:۰۰):</label>
            {loadingSlots ? (
              <p className="loading-slots">در حال بررسی ساعت‌های آزاد...</p>
            ) : slotError ? (
              <div className="slot-error-box">
                <p className="slot-error-text">⚠️ {slotError}</p>
                <button 
                  type="button" 
                  className="retry-btn-small"
                  onClick={() => fetchSlots(selectedDate)}
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

          {/* دکمه ارسال */}
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-submit"
              disabled={submitting || !selectedTime}
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

