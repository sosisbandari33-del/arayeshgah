function CancelModal({ appointment, loading, error, onClose, onConfirm }) {
  if (!appointment) return null

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <h4>⚠️ تأیید لغو نوبت</h4>
        </div>
        <div className="modal-body">
          {error && (
            <div className="error-alert">
              <span>⚠️ {error}</span>
            </div>
          )}
          <p>آیا از لغو نوبت زیر اطمینان دارید؟</p>
          <div className="confirm-details">
            <p><strong>مشتری:</strong> {appointment.customer_name}</p>
            <p><strong>ساعت:</strong> {appointment.start_time}</p>
            <p><strong>خدمت:</strong> {appointment.service_name}</p>
            <p><strong>تاریخ:</strong> {appointment.date}</p>
          </div>
          <p className="r4-notice">
            ℹ️ طبق قانون سیستم، رکورد نوبت حذف نخواهد شد و به وضعیت «لغو شده» تغییر یافته و ساعت آن مجدداً برای مشتریان دیگر آزاد خواهد گردید.
          </p>
        </div>
        <div className="modal-actions">
          <button
            className="btn btn-secondary"
            disabled={loading}
            onClick={onClose}
          >
            انصراف
          </button>
          <button
            className="btn btn-danger"
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? 'در حال لغو...' : 'بله، نوبت لغو شود'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CancelModal
