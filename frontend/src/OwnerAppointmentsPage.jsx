import { useState, useEffect } from 'react'

function OwnerAppointmentsPage({ onBack }) {
  const todayStr = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // برای مودال تأیید لغو نوبت
  const [appointmentToCancel, setAppointmentToCancel] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState(null)

  const fetchAppointments = (date) => {
    setLoading(true)
    setError(null)
    fetch(`http://127.0.0.1:8000/api/appointments?date=${date}`)
      .then((res) => {
        if (!res.ok) throw new Error('خطا در دریافت لیست نوبت‌ها')
        return res.json()
      })
      .then((data) => {
        setAppointments(data)
        setLoading(false)
      })
      .catch((err) => {
        let msg = err.message
        if (!msg || msg.includes('Failed to fetch') || msg.includes('NetworkError') || err.name === 'TypeError') {
          msg = 'برقراری ارتباط با سرور ممکن نیست. لطفاً مطمئن شوید سرور بک‌اند در حال اجراست.'
        }
        setError(msg)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchAppointments(selectedDate)
  }, [selectedDate])

  const handlePrevDay = () => {
    const current = new Date(selectedDate)
    current.setDate(current.getDate() - 1)
    setSelectedDate(current.toISOString().split('T')[0])
  }

  const handleNextDay = () => {
    const current = new Date(selectedDate)
    current.setDate(current.getDate() + 1)
    setSelectedDate(current.toISOString().split('T')[0])
  }

  const handleToday = () => {
    setSelectedDate(todayStr)
  }

  const handleConfirmCancel = () => {
    if (!appointmentToCancel) return

    setActionLoading(true)
    fetch(`http://127.0.0.1:8000/api/appointments/${appointmentToCancel.id}/cancel`, {
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
        setAppointmentToCancel(null)
        setActionMessage('نوبت با موفقیت لغو شد و بازه زمانی آن آزاد گردید.')
        // به‌روزرسانی لیست
        fetchAppointments(selectedDate)
        setTimeout(() => setActionMessage(null), 4000)
      })
      .catch((err) => {
        let msg = err.message
        if (!msg || msg.includes('Failed to fetch') || msg.includes('NetworkError') || err.name === 'TypeError') {
          msg = 'برقراری ارتباط با سرور ممکن نیست. لطفاً مطمئن شوید سرور بک‌اند در حال اجراست.'
        }
        alert(msg)
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
            onChange={(e) => setSelectedDate(e.target.value)}
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
            <button className="retry-btn" onClick={() => fetchAppointments(selectedDate)}>تلاش دوباره</button>
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
                            onClick={() => setAppointmentToCancel(item)}
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
                onClick={() => setAppointmentToCancel(null)}
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

