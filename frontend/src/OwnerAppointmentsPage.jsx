import { useState, useEffect } from 'react'

// تابع دریافت تاریخ محلی به فرمت YYYY-MM-DD بدون باگ اختلاف ساعت جهانی (UTC)
const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// تابع تغییر ایمن روز بدون باگ پرش تاریخ یا تاریخ خالی
const shiftDate = (dateStr, days) => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return getLocalDateString(d)
  }
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  d.setDate(d.getDate() + days)
  return getLocalDateString(d)
}

function OwnerAppointmentsPage({ onBack }) {
  const todayStr = getLocalDateString()
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // برای مودال تأیید لغو نوبت
  const [appointmentToCancel, setAppointmentToCancel] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [cancelError, setCancelError] = useState(null)
  const [actionMessage, setActionMessage] = useState(null)

  // دریافت لیست نوبت‌های روز انتخابی از مسیر پروکسی /api
  useEffect(() => {
    let active = true
    const controller = new AbortController()

    fetch(`/api/appointments?date=${encodeURIComponent(selectedDate)}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          let errBody = {}
          try {
            errBody = await res.json()
          } catch {
            errBody = {}
          }
          throw new Error(errBody.detail || 'خطا در دریافت لیست نوبت‌ها')
        }
        return res.json()
      })
      .then((data) => {
        if (!active) return
        setAppointments(Array.isArray(data) ? data : [])
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') return
        let msg = err.message
        if (!msg || msg.includes('Failed to fetch') || msg.includes('NetworkError') || err.name === 'TypeError') {
          msg = 'برقراری ارتباط با سرور ممکن نیست. لطفاً مطمئن شوید سرور بک‌اند در حال اجراست.'
        }
        setError(msg)
        setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [selectedDate, refreshKey])

  const selectDateAndReload = (nextDate) => {
    const safeDate = nextDate && /^\d{4}-\d{2}-\d{2}$/.test(nextDate) ? nextDate : getLocalDateString()
    setSelectedDate(safeDate)
    setError(null)
    setLoading(true)
    if (safeDate === selectedDate) {
      setRefreshKey((prev) => prev + 1)
    }
  }

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    setRefreshKey((prev) => prev + 1)
  }

  const handlePrevDay = () => {
    selectDateAndReload(shiftDate(selectedDate, -1))
  }

  const handleNextDay = () => {
    selectDateAndReload(shiftDate(selectedDate, 1))
  }

  const handleToday = () => {
    selectDateAndReload(getLocalDateString())
  }

  const openCancelModal = (item) => {
    setCancelError(null)
    setAppointmentToCancel(item)
  }

  const closeCancelModal = () => {
    if (actionLoading) return
    setCancelError(null)
    setAppointmentToCancel(null)
  }

  const handleConfirmCancel = () => {
    if (!appointmentToCancel) return

    setActionLoading(true)
    setCancelError(null)
    fetch(`/api/appointments/${appointmentToCancel.id}/cancel`, {
      method: 'PATCH',
    })
      .then(async (res) => {
        let data
        try {
          data = await res.json()
        } catch {
          data = {}
        }
        if (!res.ok) {
          throw new Error(data.detail || 'خطا در لغو نوبت')
        }
        return data
      })
      .then(() => {
        setActionLoading(false)
        setCancelError(null)
        setAppointmentToCancel(null)
        setActionMessage('نوبت با موفقیت لغو شد و بازه زمانی آن آزاد گردید.')
        // به‌روزرسانی لیست
        setLoading(true)
        setRefreshKey((prev) => prev + 1)
        setTimeout(() => setActionMessage(null), 4000)
      })
      .catch((err) => {
        let msg = err.message
        if (!msg || msg.includes('Failed to fetch') || msg.includes('NetworkError') || err.name === 'TypeError') {
          msg = 'برقراری ارتباط با سرور ممکن نیست. لطفاً مطمئن شوید سرور بک‌اند در حال اجراست.'
        }
        setCancelError(msg)
        setActionLoading(false)
      })
  }

  const activeCount = appointments.filter((a) => a.status !== 'لغو شده').length
  const cancelledCount = appointments.filter((a) => a.status === 'لغو شده').length

  return (
    <div className="owner-container">
      <div className="owner-header">
        <button className="back-link" onClick={onBack}>&larr; بازگشت به صفحه اصلی</button>
        <div className="owner-title-bar">
          <h2>پنل مدیریت نوبت‌های آرایشگاه</h2>
          <span className="owner-badge">مخصوص صاحب کار</span>
        </div>
        <p className="owner-subtitle">مشاهده برنامه کاری روزانه و مدیریت نوبت‌های رزرو شده</p>
      </div>

      {actionMessage && (
        <div className="success-banner">
          <span>✅ {actionMessage}</span>
        </div>
      )}

      {/* نوار فیلتر و انتخاب تاریخ */}
      <div className="date-control-card">
        <div className="date-picker-wrap">
          <label htmlFor="ownerDate">انتخاب روز کاری:</label>
          <input
            id="ownerDate"
            type="date"
            value={selectedDate}
            onChange={(e) => selectDateAndReload(e.target.value)}
          />
        </div>

        <div className="date-quick-nav">
          <button className="btn-nav" onClick={handlePrevDay}>&larr; روز قبل</button>
          <button
            className={`btn-nav ${selectedDate === todayStr ? 'active' : ''}`}
            onClick={handleToday}
          >
            امروز
          </button>
          <button className="btn-nav" onClick={handleNextDay}>روز بعد &rarr;</button>
        </div>
      </div>

      {/* خلاصه آماری روز */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-number">{appointments.length}</span>
          <span className="stat-label">کل نوبت‌های ثبت‌شده</span>
        </div>
        <div className="stat-card active-stat">
          <span className="stat-number">{activeCount}</span>
          <span className="stat-label">نوبت‌های فعال</span>
        </div>
        <div className="stat-card cancelled-stat">
          <span className="stat-number">{cancelledCount}</span>
          <span className="stat-label">نوبت‌های لغو شده</span>
        </div>
      </div>

      {/* لیست نوبت‌ها */}
      <div className="appointments-card">
        <h3>برنامه نوبت‌های تاریخ {selectedDate}</h3>

        {loading && <p className="loading-text">در حال بارگذاری لیست نوبت‌ها...</p>}

        {error && (
          <div className="error-alert">
            <p>❌ {error}</p>
            <button className="retry-btn" onClick={handleRetry}>تلاش دوباره</button>
          </div>
        )}

        {!loading && !error && appointments.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">☕</span>
            <p>برای این تاریخ هیچ نوبتی ثبت نشده است.</p>
          </div>
        )}

        {!loading && !error && appointments.length > 0 && (
          <div className="table-responsive">
            <table className="appointments-table">
              <thead>
                <tr>
                  <th>ساعت</th>
                  <th>نام مشتری</th>
                  <th>شماره موبایل</th>
                  <th>خدمت</th>
                  <th>وضعیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((item) => {
                  const isCancelled = item.status === 'لغو شده'

                  return (
                    <tr key={item.id} className={isCancelled ? 'row-cancelled' : ''}>
                      <td>
                        <span className="time-tag">⏱ {item.start_time}</span>
                      </td>
                      <td className="customer-name">{item.customer_name}</td>
                      <td>
                        <a href={`tel:${item.customer_phone}`} className="phone-link">
                          {item.customer_phone}
                        </a>
                      </td>
                      <td>{item.service_name}</td>
                      <td>
                        <span className={`status-tag ${isCancelled ? 'status-cancelled' : 'status-active'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        {!isCancelled ? (
                          <button
                            className="btn-cancel-action"
                            onClick={() => openCancelModal(item)}
                          >
                            لغو نوبت
                          </button>
                        ) : (
                          <span className="text-muted-tag">آزاد شده</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* دیالوگ / مودال تأیید لغو نوبت */}
      {appointmentToCancel && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h4>⚠️ تأیید لغو نوبت</h4>
            </div>
            <div className="modal-body">
              {cancelError && (
                <div className="error-alert">
                  <span>⚠️ {cancelError}</span>
                </div>
              )}
              <p>آیا از لغو نوبت زیر اطمینان دارید؟</p>
              <div className="confirm-details">
                <p><strong>مشتری:</strong> {appointmentToCancel.customer_name}</p>
                <p><strong>ساعت:</strong> {appointmentToCancel.start_time}</p>
                <p><strong>خدمت:</strong> {appointmentToCancel.service_name}</p>
                <p><strong>تاریخ:</strong> {appointmentToCancel.date}</p>
              </div>
              <p className="r4-notice">
                ℹ️ طبق قانون سیستم، رکورد نوبت حذف نخواهد شد و به وضعیت «لغو شده» تغییر یافته و ساعت آن مجدداً برای مشتریان دیگر آزاد خواهد گردید.
              </p>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                disabled={actionLoading}
                onClick={closeCancelModal}
              >
                انصراف
              </button>
              <button
                className="btn btn-danger"
                disabled={actionLoading}
                onClick={handleConfirmCancel}
              >
                {actionLoading ? 'در حال لغو...' : 'بله، نوبت لغو شود'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OwnerAppointmentsPage
