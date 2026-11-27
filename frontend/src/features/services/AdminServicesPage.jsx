import { useState, useEffect } from 'react'
import { Alert, Button, Card, Input, Modal } from '../../ui'
import { convertPersianToEnglishDigits, formatPrice } from '../../utils/persian'
import {
  changeAdminServiceStatus,
  createAdminService,
  deleteAdminService,
  fetchAdminServices,
  updateAdminService,
} from './servicesApi'
import './services.css'

function parseCleanInt(raw) {
  const normalized = convertPersianToEnglishDigits(String(raw ?? '')).replace(/[,\s٬]+/g, '')
  if (!normalized || !/^-?\d+$/.test(normalized)) {
    return null
  }
  return Number.parseInt(normalized, 10)
}

function AdminServicesPage({ onServicesChanged }) {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [actionMessage, setActionMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [busyRowId, setBusyRowId] = useState(null)

  const [serviceToDelete, setServiceToDelete] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    fetchAdminServices(controller.signal)
      .then((data) => {
        if (!active) return
        setServices(Array.isArray(data) ? data : [])
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
  }, [refreshKey])

  const triggerReload = () => {
    setLoading(true)
    setError(null)
    setRefreshKey((prev) => prev + 1)
    if (onServicesChanged) {
      onServicesChanged()
    }
  }

  const showSuccess = (msg) => {
    setActionMessage(msg)
    setTimeout(() => setActionMessage(null), 4000)
  }

  const clearFieldError = (field) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setPrice('')
    setDuration('')
    setFieldErrors({})
    setFormError(null)
  }

  const handleStartEdit = (item) => {
    setEditingId(item.id)
    setName(item.name)
    setPrice(String(item.price))
    setDuration(String(item.duration))
    setFieldErrors({})
    setFormError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setFormError(null)

    const nextErrors = {}
    const cleanName = name.trim()
    if (!cleanName) {
      nextErrors.name = 'نام خدمت نمی‌تواند خالی باشد.'
    } else if (cleanName.length < 2 || cleanName.length > 80) {
      nextErrors.name = 'نام خدمت باید بین ۲ تا ۸۰ کاراکتر باشد.'
    }

    const parsedPrice = parseCleanInt(price)
    if (parsedPrice === null || parsedPrice <= 0) {
      nextErrors.price = 'قیمت خدمت باید عددی بزرگ‌تر از صفر باشد.'
    }

    const parsedDuration = parseCleanInt(duration)
    if (parsedDuration === null || parsedDuration < 1 || parsedDuration > 600) {
      nextErrors.duration = 'مدت خدمت باید بین ۱ تا ۶۰۰ دقیقه باشد.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }

    setFieldErrors({})
    setSubmitting(true)

    const payload = {
      name: cleanName,
      price: parsedPrice,
      duration: parsedDuration,
    }

    const request = editingId
      ? updateAdminService(editingId, payload)
      : createAdminService(payload)

    request
      .then((res) => {
        setSubmitting(false)
        resetForm()
        showSuccess(res.message)
        triggerReload()
      })
      .catch((err) => {
        setSubmitting(false)
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors(err.fieldErrors)
          return
        }
        setFormError(err.message)
      })
  }

  const handleToggleStatus = (item) => {
    setBusyRowId(item.id)
    setFormError(null)
    changeAdminServiceStatus(item.id, !item.is_active)
      .then((res) => {
        setBusyRowId(null)
        showSuccess(res.message)
        triggerReload()
      })
      .catch((err) => {
        setBusyRowId(null)
        setFormError(err.message)
      })
  }

  const handleConfirmDelete = () => {
    if (!serviceToDelete) return
    setDeleteLoading(true)
    setDeleteError(null)

    deleteAdminService(serviceToDelete.id)
      .then((res) => {
        setDeleteLoading(false)
        if (editingId === serviceToDelete.id) {
          resetForm()
        }
        setServiceToDelete(null)
        showSuccess(res.message)
        triggerReload()
      })
      .catch((err) => {
        setDeleteLoading(false)
        setDeleteError(err.message)
      })
  }

  const previewPrice = parseCleanInt(price)

  return (
    <div className="admin-services-container">
      {actionMessage && (
        <Alert variant="success">
          <span>✅ {actionMessage}</span>
        </Alert>
      )}

      <Card className="admin-services-card">
        <h3>{editingId ? '✏️ ویرایش خدمت' : '➕ افزودن خدمت جدید'}</h3>
        <p className="admin-services-subtitle">
          نام، قیمت (تومان) و مدت زمان دلخواه به دقیقه (مثلاً ۲۵ یا ۳۵ دقیقه) را وارد کنید.
        </p>

        {formError && (
          <Alert variant="error">
            <span>⚠️ {formError}</span>
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="service-form-grid">
            <Input
              id="serviceName"
              label="نام خدمت:"
              type="text"
              placeholder="مثال: اصلاح مو و ریش"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                clearFieldError('name')
              }}
              error={fieldErrors.name}
              maxLength={80}
            />

            <Input
              id="servicePrice"
              label="قیمت (تومان):"
              type="tel"
              placeholder="مثال: 250000"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value)
                clearFieldError('price')
              }}
              error={fieldErrors.price}
              hint={
                previewPrice && previewPrice > 0
                  ? `معادل: ${formatPrice(previewPrice)} تومان`
                  : null
              }
            />

            <Input
              id="serviceDuration"
              label="مدت زمان (دقیقه):"
              type="tel"
              placeholder="مثال: 25"
              value={duration}
              onChange={(e) => {
                setDuration(e.target.value)
                clearFieldError('duration')
              }}
              error={fieldErrors.duration}
            />
          </div>

          <div className="service-form-actions">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting
                ? 'در حال ذخیره...'
                : editingId
                  ? 'ذخیره تغییرات خدمت'
                  : 'افزودن خدمت'}
            </Button>
            {editingId && (
              <Button variant="secondary" disabled={submitting} onClick={resetForm}>
                انصراف از ویرایش
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card className="admin-services-card">
        <h3>فهرست خدمات آرایشگاه</h3>
        <p className="admin-services-subtitle">
          خدمات غیرفعال در صفحه‌ی اصلی و فرم رزرو مشتریان نمایش داده نمی‌شوند. خدمتی که نوبت ثبت‌شده دارد پاک نمی‌شود و فقط قابل غیرفعال‌سازی است.
        </p>

        {loading && <p className="loading-slots">در حال بارگذاری لیست خدمات...</p>}

        {error && (
          <Alert variant="error">
            <p>❌ {error}</p>
            <Button
              variant="retry"
              onClick={() => {
                setLoading(true)
                setError(null)
                setRefreshKey((prev) => prev + 1)
              }}
            >
              تلاش دوباره
            </Button>
          </Alert>
        )}

        {!loading && !error && services.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">✂️</span>
            <p>هنوز هیچ خدمتی ثبت نشده است. از فرم بالا اولین خدمت را اضافه کنید.</p>
          </div>
        )}

        {!loading && !error && services.length > 0 && (
          <div className="table-responsive">
            <table className="services-admin-table">
              <thead>
                <tr>
                  <th>نام خدمت</th>
                  <th>قیمت</th>
                  <th>مدت</th>
                  <th>وضعیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {services.map((item) => {
                  const isBusy = busyRowId === item.id

                  return (
                    <tr key={item.id} className={!item.is_active ? 'row-inactive' : ''}>
                      <td className="service-name-cell">{item.name}</td>
                      <td>{formatPrice(item.price)} تومان</td>
                      <td>{item.duration} دقیقه</td>
                      <td>
                        <span
                          className={`service-status-pill ${item.is_active ? 'active' : 'inactive'}`}
                        >
                          {item.is_active ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td>
                        <div className="service-row-actions">
                          <button
                            type="button"
                            className="btn-table-sm"
                            disabled={isBusy}
                            onClick={() => handleStartEdit(item)}
                          >
                            ویرایش
                          </button>

                          <button
                            type="button"
                            className={`btn-table-sm ${item.is_active ? 'warn' : 'activate'}`}
                            disabled={isBusy}
                            onClick={() => handleToggleStatus(item)}
                          >
                            {item.is_active ? 'غیرفعال کردن' : 'فعال کردن'}
                          </button>

                          {item.has_appointments ? (
                            <span className="locked-hint" title="این خدمت دارای نوبت ثبت‌شده است و پاک نمی‌شود">
                              دارای نوبت (فقط غیرفعال‌سازی)
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn-table-sm danger"
                              disabled={isBusy}
                              onClick={() => {
                                setDeleteError(null)
                                setServiceToDelete(item)
                              }}
                            >
                              حذف
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={Boolean(serviceToDelete)}
        title="⚠️ تأیید حذف خدمت"
        error={deleteError}
        actions={
          <>
            <Button
              variant="secondary"
              disabled={deleteLoading}
              onClick={() => {
                setDeleteError(null)
                setServiceToDelete(null)
              }}
            >
              انصراف
            </Button>
            <Button
              variant="danger"
              disabled={deleteLoading}
              onClick={handleConfirmDelete}
            >
              {deleteLoading ? 'در حال حذف...' : 'بله، حذف شود'}
            </Button>
          </>
        }
      >
        {serviceToDelete && (
          <p>
            آیا از حذف خدمت <strong>«{serviceToDelete.name}»</strong> اطمینان دارید؟
          </p>
        )}
      </Modal>
    </div>
  )
}

export default AdminServicesPage
