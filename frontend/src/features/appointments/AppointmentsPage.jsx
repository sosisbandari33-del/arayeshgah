import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
} from '../../ui'
import { getLocalDateString, shiftDate, isValidDateString } from '../../utils/date'
import { toPersianDigits } from '../../utils/persian'
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
          <Input
            id="ownerDate"
            label="انتخاب روز کاری:"
            type="date"
            wrapperClassName="owner-date-input-group"
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
        <h3>برنامه نوبت‌های تاریخ {toPersianDigits(selectedDate)}</h3>

        {loading && (
          <LoadingState variant="table" count={4} label="در حال بارگذاری لیست نوبت‌ها..." />
        )}

        {!loading && error && (
          <ErrorState message={error} onRetry={handleRetry} />
        )}

        {!loading && !error && appointments.length === 0 && (
          <EmptyState
            icon="☕"
            title={
              selectedDate === todayStr
                ? 'امروز نوبتی ندارید'
                : 'برای این تاریخ نوبتی ثبت نشده است'
            }
            description="نوبت‌های ثبت‌شده توسط مشتریان به‌ترتیب ساعت شروع در این جدول قرار می‌گیرند."
          />
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
                  const svcLabel = item.total_duration
                    ? `${item.service_name} (${toPersianDigits(item.total_duration)} دقیقه)`
                    : item.service_name

                  return (
                    <tr key={item.id} className={isCancelled ? 'row-cancelled' : ''}>
                      <td>
                        <span className="time-tag">
                          ⏱ {toPersianDigits(item.start_time)}
                          {item.end_time ? ` تا ${toPersianDigits(item.end_time)}` : ''}
                        </span>
                      </td>
                      <td className="customer-name">
                        <span className="text-clamp-1" title={item.customer_name}>
                          {item.customer_name}
                        </span>
                      </td>
                      <td>
                        <a href={`tel:${item.customer_phone}`} className="phone-link">
                          {toPersianDigits(item.customer_phone)}
                        </a>
                      </td>
                      <td className="appointment-service-cell">
                        <span className="text-clamp-2" title={svcLabel}>
                          {svcLabel}
                        </span>
                      </td>
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
