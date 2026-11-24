import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAppointments, cancelAppointment } from '../api/client'
import { getLocalDateString, shiftDate, isValidDateString } from '../utils/date'
import CancelModal from '../components/CancelModal'
import '../styles/owner.css'

function OwnerAppointmentsPage() {
  const navigate = useNavigate()
  const todayStr = getLocalDateString()
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [appointmentToCancel, setAppointmentToCancel] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [cancelError, setCancelError] = useState(null)
  const [actionMessage, setActionMessage] = useState(null)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    fetchAppointments(selectedDate, controller.signal)
      .then((data) => {
        if (!active) return
        setAppointments(Array.isArray(data) ? data : [])
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') return
        setError(err.message)
        setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [selectedDate, refreshKey])

  const selectDateAndReload = (nextDate) => {
    const safeDate = isValidDateString(nextDate) ? nextDate : getLocalDateString()
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

    cancelAppointment(appointmentToCancel.id)
      .then(() => {
        setActionLoading(false)
        setCancelError(null)
        setAppointmentToCancel(null)
        setActionMessage('نوبت با موفقیت لغو شد و بازه زمانی آن آزاد گردید.')
        setLoading(true)
        setRefreshKey((prev) => prev + 1)
        setTimeout(() => setActionMessage(null), 4000)
      })
      .catch((err) => {
        setCancelError(err.message)
        setActionLoading(false)
      })
  }

  const activeCount = appointments.filter((a) => a.status !== 'لغو شده').length
  const cancelledCount = appointments.filter((a) => a.status === 'لغو شده').length

  return (
    <div className="owner-container">
      <div className="owner-header">
        <button className="back-link" onClick={() => navigate('/')}>
          &larr; بازگشت به صفحه اصلی
        </button>
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
          <button className="btn-nav" onClick={() => selectDateAndReload(shiftDate(selectedDate, -1))}>
            &larr; روز قبل
          </button>
          <button
            className={`btn-nav ${selectedDate === todayStr ? 'active' : ''}`}
            onClick={() => selectDateAndReload(getLocalDateString())}
          >
            امروز
          </button>
          <button className="btn-nav" onClick={() => selectDateAndReload(shiftDate(selectedDate, 1))}>
            روز بعد &rarr;
          </button>
        </div>
      </div>

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

      <CancelModal
        appointment={appointmentToCancel}
        loading={actionLoading}
        error={cancelError}
        onClose={closeCancelModal}
        onConfirm={handleConfirmCancel}
      />
    </div>
  )
}

export default OwnerAppointmentsPage
