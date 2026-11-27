import { useState, useEffect } from 'react'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
} from '../../ui'
import { getLocalDateString } from '../../utils/date'
import { toPersianDigits } from '../../utils/persian'
import {
  createTimeOff,
  deleteTimeOff,
  fetchTimeOffs,
  fetchWorkingHours,
  saveWorkingHours,
} from './scheduleApi'
import './schedule.css'

function AdminSchedulePage() {
  const todayStr = getLocalDateString()

  const [days, setDays] = useState([])
  const [loadingHours, setLoadingHours] = useState(true)
  const [hoursError, setHoursError] = useState(null)
  const [hoursFieldErrors, setHoursFieldErrors] = useState({})
  const [savingHours, setSavingHours] = useState(false)
  const [hoursReloadKey, setHoursReloadKey] = useState(0)

  const [timeOffs, setTimeOffs] = useState([])
  const [loadingTimeOffs, setLoadingTimeOffs] = useState(true)
  const [timeOffsError, setTimeOffsError] = useState(null)
  const [timeOffsReloadKey, setTimeOffsReloadKey] = useState(0)

  const [offDate, setOffDate] = useState(todayStr)
  const [isFullDay, setIsFullDay] = useState(true)
  const [offStartTime, setOffStartTime] = useState('')
  const [offEndTime, setOffEndTime] = useState('')
  const [offReason, setOffReason] = useState('')
  const [offFieldErrors, setOffFieldErrors] = useState({})
  const [offFormError, setOffFormError] = useState(null)
  const [savingOff, setSavingOff] = useState(false)

  const [actionMessage, setActionMessage] = useState(null)
  const [conflictBanner, setConflictBanner] = useState(null)

  const [itemToDelete, setItemToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    fetchWorkingHours(controller.signal)
      .then((data) => {
        if (!active) return
        setDays(Array.isArray(data) ? data : [])
        setHoursError(null)
        setLoadingHours(false)
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') return
        setHoursError(err.message)
        setLoadingHours(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [hoursReloadKey])

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    fetchTimeOffs(controller.signal)
      .then((data) => {
        if (!active) return
        setTimeOffs(Array.isArray(data) ? data : [])
        setTimeOffsError(null)
        setLoadingTimeOffs(false)
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') return
        setTimeOffsError(err.message)
        setLoadingTimeOffs(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [timeOffsReloadKey])

  const showSuccess = (msg) => {
    setActionMessage(msg)
    setTimeout(() => setActionMessage(null), 4000)
  }

  const updateDayField = (dayIndex, field, value) => {
    setDays((prev) =>
      prev.map((d) => (d.day_of_week === dayIndex ? { ...d, [field]: value } : d))
    )
    setHoursFieldErrors((prev) => {
      const next = { ...prev }
      delete next[`day_${dayIndex}_start`]
      delete next[`day_${dayIndex}_end`]
      delete next.days
      return next
    })
  }

  const handleSaveWeeklyHours = (e) => {
    e.preventDefault()
    setSavingHours(true)
    setHoursFieldErrors({})
    setHoursError(null)

    const payload = days.map(({ day_of_week, start_time, end_time, is_closed }) => ({
      day_of_week,
      start_time,
      end_time,
      is_closed,
    }))

    saveWorkingHours(payload)
      .then((res) => {
        setSavingHours(false)
        if (Array.isArray(res.working_hours)) {
          setDays(res.working_hours)
        }
        showSuccess(res.message)
        if (res.warning) {
          setConflictBanner({
            warning: res.warning,
            appointments: res.conflicting_appointments || [],
          })
        } else {
          setConflictBanner(null)
        }
      })
      .catch((err) => {
        setSavingHours(false)
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setHoursFieldErrors(err.fieldErrors)
          return
        }
        setHoursError(err.message)
      })
  }

  const clearOffFieldError = (field) => {
    setOffFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const handleCreateTimeOff = (e) => {
    e.preventDefault()
    setOffFormError(null)

    const nextErrors = {}
    if (!offDate) {
      nextErrors.date = 'وارد کردن تاریخ الزامی است.'
    }
    if (!isFullDay) {
      if (!offStartTime) nextErrors.start_time = 'وارد کردن ساعت شروع مرخصی الزامی است.'
      if (!offEndTime) nextErrors.end_time = 'وارد کردن ساعت پایان مرخصی الزامی است.'
      if (offStartTime && offEndTime && offEndTime <= offStartTime) {
        nextErrors.end_time = 'ساعت پایان مرخصی باید بعد از ساعت شروع باشد.'
      }
    }
    if (offReason.trim().length > 120) {
      nextErrors.reason = 'توضیح تعطیلی یا مرخصی نمی‌تواند بیشتر از ۱۲۰ کاراکتر باشد.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setOffFieldErrors(nextErrors)
      return
    }

    setOffFieldErrors({})
    setSavingOff(true)

    createTimeOff({
      date: offDate,
      is_full_day: isFullDay,
      start_time: isFullDay ? null : offStartTime,
      end_time: isFullDay ? null : offEndTime,
      reason: offReason.trim(),
    })
      .then((res) => {
        setSavingOff(false)
        setOffReason('')
        showSuccess(res.message)
        setLoadingTimeOffs(true)
        setTimeOffsReloadKey((prev) => prev + 1)
        if (res.warning) {
          setConflictBanner({
            warning: res.warning,
            appointments: res.conflicting_appointments || [],
          })
        } else {
          setConflictBanner(null)
        }
      })
      .catch((err) => {
        setSavingOff(false)
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setOffFieldErrors(err.fieldErrors)
          return
        }
        setOffFormError(err.message)
      })
  }

  const handleConfirmDeleteTimeOff = () => {
    if (!itemToDelete) return
    setDeleting(true)
    setDeleteError(null)

    deleteTimeOff(itemToDelete.id)
      .then((res) => {
        setDeleting(false)
        setItemToDelete(null)
        showSuccess(res.message)
        setLoadingTimeOffs(true)
        setTimeOffsReloadKey((prev) => prev + 1)
      })
      .catch((err) => {
        setDeleting(false)
        setDeleteError(err.message)
      })
  }

  return (
    <div className="admin-schedule-container">
      {actionMessage && (
        <Alert variant="success">
          <span>✅ {actionMessage}</span>
        </Alert>
      )}

      {conflictBanner && (
        <Alert variant="warning">
          <div className="warning-header-row">
            <strong>⚠️ {conflictBanner.warning}</strong>
            <button
              type="button"
              className="warning-close-btn"
              onClick={() => setConflictBanner(null)}
            >
              متوجه شدم
            </button>
          </div>
          {conflictBanner.appointments.length > 0 && (
            <ul className="conflict-list">
              {conflictBanner.appointments.map((appt) => (
                <li key={appt.id}>
                  <strong>{appt.customer_name}</strong> ({toPersianDigits(appt.customer_phone)}) — تاریخ{' '}
                  {toPersianDigits(appt.date)} ساعت {toPersianDigits(appt.start_time)} ({appt.service_name})
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      {/* بخش اول: ساعات کاری هفتگی */}
      <Card className="schedule-card">
        <h3>🕒 ساعات کاری هفتگی</h3>
        <p className="schedule-subtitle">
          برای هر روز هفته ساعت شروع و پایان مشخص کنید یا آن روز را تعطیل بزنید.
        </p>

        {hoursFieldErrors.days && (
          <Alert variant="error">
            <span>⚠️ {hoursFieldErrors.days}</span>
          </Alert>
        )}

        {loadingHours ? (
          <LoadingState variant="table" count={4} label="در حال بارگذاری ساعات کاری هفته..." />
        ) : hoursError ? (
          <ErrorState
            message={hoursError}
            onRetry={() => {
              setLoadingHours(true)
              setHoursError(null)
              setHoursReloadKey((prev) => prev + 1)
            }}
          />
        ) : days.length === 0 ? (
          <EmptyState icon="🕒" title="برنامه کاری هفتگی یافت نشد" />
        ) : (
          <form onSubmit={handleSaveWeeklyHours} noValidate>
            <div className="weekly-hours-list">
              {days.map((item) => {
                const startErr = hoursFieldErrors[`day_${item.day_of_week}_start`]
                const endErr = hoursFieldErrors[`day_${item.day_of_week}_end`]

                return (
                  <div
                    key={item.day_of_week}
                    className={`weekday-row ${item.is_closed ? 'closed' : ''}`.trim()}
                  >
                    <div className="weekday-name">{item.day_name}</div>

                    <label className="closed-toggle-label">
                      <input
                        type="checkbox"
                        checked={item.is_closed}
                        onChange={(e) =>
                          updateDayField(item.day_of_week, 'is_closed', e.target.checked)
                        }
                      />
                      تعطیل
                    </label>

                    <div className="time-field-inline">
                      <span>ساعت شروع:</span>
                      <input
                        type="time"
                        value={item.start_time}
                        disabled={item.is_closed}
                        className={startErr ? 'input-error' : undefined}
                        onChange={(e) =>
                          updateDayField(item.day_of_week, 'start_time', e.target.value)
                        }
                      />
                      {startErr && <p className="field-error">{startErr}</p>}
                    </div>

                    <div className="time-field-inline">
                      <span>ساعت پایان:</span>
                      <input
                        type="time"
                        value={item.end_time}
                        disabled={item.is_closed}
                        className={endErr ? 'input-error' : undefined}
                        onChange={(e) =>
                          updateDayField(item.day_of_week, 'end_time', e.target.value)
                        }
                      />
                      {endErr && <p className="field-error">{endErr}</p>}
                    </div>
                  </div>
                )
              })}
            </div>

            <Button type="submit" variant="primary" disabled={savingHours}>
              {savingHours ? 'در حال ذخیره...' : 'ذخیره ساعات کاری هفتگی'}
            </Button>
          </form>
        )}
      </Card>

      {/* بخش دوم: ثبت تعطیلی تاریخ خاص یا مرخصی ساعتی */}
      <Card className="schedule-card">
        <h3>📅 ثبت تعطیلی تاریخ خاص یا مرخصی چندساعته</h3>
        <p className="schedule-subtitle">
          یک تاریخ خاص را کامل تعطیل کنید یا در یک روز بازه‌ی مرخصی ساعتی ثبت نمایید.
        </p>

        {offFormError && (
          <Alert variant="error">
            <span>⚠️ {offFormError}</span>
          </Alert>
        )}

        <form onSubmit={handleCreateTimeOff} noValidate>
          <div className="timeoff-mode-switch">
            <label className={`mode-radio-pill ${isFullDay ? 'selected' : ''}`.trim()}>
              <input
                type="radio"
                name="timeOffMode"
                checked={isFullDay}
                onChange={() => {
                  setIsFullDay(true)
                  clearOffFieldError('start_time')
                  clearOffFieldError('end_time')
                }}
              />
              تعطیلی کل روز
            </label>

            <label className={`mode-radio-pill ${!isFullDay ? 'selected' : ''}`.trim()}>
              <input
                type="radio"
                name="timeOffMode"
                checked={!isFullDay}
                onChange={() => setIsFullDay(false)}
              />
              مرخصی چندساعته در یک روز
            </label>
          </div>

          <div className="timeoff-form-grid">
            <Input
              id="offDate"
              label="تاریخ:"
              type="date"
              value={offDate}
              onChange={(e) => {
                setOffDate(e.target.value)
                clearOffFieldError('date')
              }}
              error={offFieldErrors.date}
            />

            {!isFullDay && (
              <>
                <Input
                  id="offStartTime"
                  label="از ساعت:"
                  type="time"
                  value={offStartTime}
                  onChange={(e) => {
                    setOffStartTime(e.target.value)
                    clearOffFieldError('start_time')
                  }}
                  error={offFieldErrors.start_time}
                />

                <Input
                  id="offEndTime"
                  label="تا ساعت:"
                  type="time"
                  value={offEndTime}
                  onChange={(e) => {
                    setOffEndTime(e.target.value)
                    clearOffFieldError('end_time')
                  }}
                  error={offFieldErrors.end_time}
                />
              </>
            )}

            <Input
              id="offReason"
              label="توضیح (اختیاری):"
              type="text"
              placeholder="مثال: تعطیلی مناسبتی یا مرخصی ساعتی"
              value={offReason}
              onChange={(e) => {
                setOffReason(e.target.value)
                clearOffFieldError('reason')
              }}
              error={offFieldErrors.reason}
              maxLength={120}
            />
          </div>

          <div style={{ marginTop: '1.15rem' }}>
            <Button type="submit" variant="primary" disabled={savingOff}>
              {savingOff ? 'در حال ثبت...' : isFullDay ? 'ثبت تعطیلی روز' : 'ثبت مرخصی ساعتی'}
            </Button>
          </div>
        </form>
      </Card>

      {/* بخش سوم: لیست تعطیلی‌ها و مرخصی‌های ثبت‌شده */}
      <Card className="schedule-card">
        <h3>فهرست تعطیلی‌ها و مرخصی‌های ثبت‌شده</h3>

        {loadingTimeOffs && (
          <LoadingState
            variant="table"
            count={3}
            label="در حال بارگذاری فهرست تعطیلی‌ها و مرخصی‌ها..."
          />
        )}

        {!loadingTimeOffs && timeOffsError && (
          <ErrorState
            message={timeOffsError}
            onRetry={() => {
              setLoadingTimeOffs(true)
              setTimeOffsError(null)
              setTimeOffsReloadKey((prev) => prev + 1)
            }}
          />
        )}

        {!loadingTimeOffs && !timeOffsError && timeOffs.length === 0 && (
          <EmptyState
            icon="📆"
            title="هیچ تعطیلی یا مرخصی‌ای ثبت نشده است"
            description="در صورت ثبت تعطیلی تاریخ خاص یا مرخصی ساعتی، فهرست آن‌ها اینجا نمایش داده می‌شود."
          />
        )}

        {!loadingTimeOffs && !timeOffsError && timeOffs.length > 0 && (
          <div className="table-responsive">
            <table className="timeoff-table">
              <thead>
                <tr>
                  <th>تاریخ</th>
                  <th>نوع</th>
                  <th>بازه زمانی</th>
                  <th>توضیح</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {timeOffs.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{toPersianDigits(item.date)}</strong>
                    </td>
                    <td>
                      <span
                        className={`service-status-pill ${item.is_full_day ? 'inactive' : 'active'}`}
                      >
                        {item.is_full_day ? 'تعطیلی کل روز' : 'مرخصی ساعتی'}
                      </span>
                    </td>
                    <td>
                      {item.is_full_day
                        ? 'تمام روز'
                        : `از ${toPersianDigits(item.start_time)} تا ${toPersianDigits(item.end_time)}`}
                    </td>
                    <td className="reason-cell">
                      <span className="text-clamp-2" title={item.reason || ''}>
                        {item.reason || '—'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-table-sm danger"
                        onClick={() => {
                          setDeleteError(null)
                          setItemToDelete(item)
                        }}
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={Boolean(itemToDelete)}
        title="⚠️ تأیید حذف تعطیلی / مرخصی"
        error={deleteError}
        actions={
          <>
            <Button
              variant="secondary"
              disabled={deleting}
              onClick={() => {
                setDeleteError(null)
                setItemToDelete(null)
              }}
            >
              انصراف
            </Button>
            <Button variant="danger" disabled={deleting} onClick={handleConfirmDeleteTimeOff}>
              {deleting ? 'در حال حذف...' : 'بله، حذف شود'}
            </Button>
          </>
        }
      >
        {itemToDelete && (
          <p>
            آیا از حذف {itemToDelete.is_full_day ? 'تعطیلی' : 'مرخصی ساعتی'} تاریخ{' '}
            <strong>{toPersianDigits(itemToDelete.date)}</strong> اطمینان دارید؟
          </p>
        )}
      </Modal>
    </div>
  )
}

export default AdminSchedulePage
