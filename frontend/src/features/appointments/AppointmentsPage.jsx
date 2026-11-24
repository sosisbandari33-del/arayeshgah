import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card } from '../../ui'
import { getLocalDateString, shiftDate, isValidDateString } from '../../utils/date'
import { fetchAppointments, cancelAppointment } from './appointmentsApi'
import CancelAppointmentModal from './CancelAppointmentModal'
import './appointments.css'

function AppointmentsPage() {
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
      <Card className="owner-header">
        <Button variant="back-link" onClick={() => navigate('/')}>
          &larr; بازگشت به صفحه اصلی
        </Button>
        <div className="owner-title-bar">
          <h2>پنل مدیریت نوبت‌های آرایشگاه</h2>
          <span className="owner-badge">مخصوص صاحب کار</span>
        </div>
        <p className="owner-subtitle">مشاهده برنامه کاری روزانه و مدیریت نوبت‌های رزرو شده</p>
      </Card>

      {actionMessage && (
        <Alert variant="success">
          <span>✅ {actionMessage}</span>
        </Alert>
      )}

      <Card className="date-control-card">
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
          <Button variant="nav" onClick={() => selectDateAndReload(shiftDate(selectedDate, -1))}>
            &larr; روز قبل
          </Button>
          <Button
            variant="nav"
            className={selectedDate === todayStr ? 'active' : ''}
            onClick={() => selectDateAndReload(getLocalDateString())}
          >
            امروز
          </Button>
          <Button variant="nav" onClick={() => selectDateAndReload(shiftDate(selectedDate, 1))}>
            روز بعد &rarr;
          </Button>
        </div>
      </Card>

      <div className="stats-row">
        <Card className="stat-card">
          <span className="stat-number">{appointments.length}</span>
          <span className="stat-label">کل نوبت‌های ثبت‌شده</span>
        </Card>
        <Card className="stat-card active-stat">
          <span className="stat-number">{activeCount}</span>
          <span className="stat-label">نوبت‌های فعال</span>
        </Card>
        <Card className="stat-card cancelled-stat">
          <span className="stat-number">{cancelledCount}</span>
          <span className="stat-label">نوبت‌های لغو شده</span>
        </Card>
      </div>

      <Card className="appointments-card">
        <h3>برنامه نوبت‌های تاریخ {selectedDate}</h3>

        {loading && <p className="loading-text">در حال بارگذاری لیست نوبت‌ها...</p>}

        {error && (
          <Alert variant="error">
            <p>❌ {error}</p>
            <Button variant="retry" onClick={handleRetry}>
              تلاش دوباره
            </Button>
          </Alert>
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
                          <Button variant="cancel-action" onClick={() => openCancelModal(item)}>
                            لغو نوبت
                          </Button>
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
      </Card>

      <CancelAppointmentModal
        appointment={appointmentToCancel}
        loading={actionLoading}
        error={cancelError}
        onClose={closeCancelModal}
        onConfirm={handleConfirmCancel}
      />
    </div>
  )
}

export default AppointmentsPage
